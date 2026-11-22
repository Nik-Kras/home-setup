import { advancePhoto, type ItemPhoto, type PhotoTransfer } from '../domain/photos';
import type { KV, Outcome } from './queue';

export type PhotoJob =
  | { kind: 'upload'; photo: ItemPhoto; transfer: PhotoTransfer; uploaded: boolean }
  | { kind: 'delete'; photo: ItemPhoto; transfer: PhotoTransfer };

export interface PhotoExecutor {
  upload: (photo: ItemPhoto, retrying: boolean) => Promise<Outcome>;
  insert: (photo: ItemPhoto) => Promise<Outcome>;
  remove: (photo: ItemPhoto) => Promise<Outcome>;
}

const KEY = 'homesetup.photos.v1';
const pending: PhotoTransfer = { status: 'pending', retries: 0 };

/** Persist each state before publishing it. Network work runs outside the storage lock. */
export class PhotoQueue {
  private jobs: PhotoJob[] = [];
  private loaded = false;
  private writes = Promise.resolve();
  private flushing: Promise<void> | null = null;
  private readonly key: string;

  constructor(
    private readonly storage: KV,
    scope: string,
    private readonly exec: PhotoExecutor | null,
    private readonly onChange: (jobs: readonly PhotoJob[]) => void,
    private readonly onDrop: (job: PhotoJob) => void = () => undefined,
  ) {
    this.key = `${KEY}.${scope}`;
  }

  private update(change: (jobs: PhotoJob[]) => PhotoJob[] = (jobs) => jobs): Promise<void> {
    const write = this.writes.then(async () => {
      if (!this.loaded) {
        const raw = await this.storage.getItem(this.key);
        this.jobs = raw ? (JSON.parse(raw) as PhotoJob[]).map((job) => ({
          ...job, transfer: advancePhoto(job.transfer, 'retryLater'),
        })) : [];
        this.loaded = true;
        this.onChange(this.jobs);
      }
      const jobs = change(this.jobs);
      if (jobs === this.jobs) return;
      await this.storage.setItem(this.key, JSON.stringify(jobs));
      this.jobs = jobs;
      this.onChange(jobs);
    });
    this.writes = write.catch(() => undefined);
    return write;
  }

  async list(): Promise<readonly PhotoJob[]> {
    await this.update();
    return this.jobs;
  }

  enqueue(photo: ItemPhoto): Promise<void> {
    return this.update((jobs) => [...jobs, { kind: 'upload', photo, transfer: pending, uploaded: false }]);
  }

  delete(photo: ItemPhoto): Promise<void> {
    return this.update((jobs) => {
      const previous = jobs.find((job) => job.photo.id === photo.id);
      if (previous?.kind === 'delete') return jobs;
      const localOnly = previous?.kind === 'upload' && !previous.uploaded
        && previous.transfer.retries === 0 && previous.transfer.status !== 'uploading';
      const transfer = !this.exec || localOnly ? { ...pending, status: 'done' as const } : pending;
      return [...jobs.filter((job) => job.photo.id !== photo.id), { kind: 'delete', photo, transfer }];
    });
  }

  retry(id: string): Promise<void> {
    return this.update((jobs) => jobs.map((job) => job.photo.id === id
      ? { ...job, transfer: advancePhoto(job.transfer, 'retryNow') } : job));
  }

  /** Done jobs bridge the gap until a fresh snapshot can replace them. */
  forgetDone(ids: ReadonlySet<string>): Promise<void> {
    return ids.size ? this.update((jobs) => jobs.filter((job) => job.transfer.status !== 'done' || !ids.has(job.photo.id))) : Promise.resolve();
  }

  flush(isCurrent = () => true): Promise<void> {
    if (!this.exec) return Promise.resolve();
    if (!this.flushing) {
      this.flushing = this.run(this.exec, isCurrent).finally(() => { this.flushing = null; });
    }
    return this.flushing;
  }

  private async run(exec: PhotoExecutor, isCurrent: () => boolean) {
    const pendingJobs = (await this.list()).filter((job) => job.transfer.status === 'pending');
    for (const { photo: { id } } of pendingJobs) {
      if (!isCurrent()) return;
      let started: PhotoJob | undefined;
      await this.update((jobs) => jobs.map((job) => {
        if (job.photo.id !== id || job.transfer.status !== 'pending') return job;
        started = { ...job, transfer: advancePhoto(job.transfer, 'start') };
        return started;
      }));
      if (!started) continue;
      const job: PhotoJob = started;
      let outcome: Outcome;
      try {
        if (!isCurrent()) {
          outcome = 'retry';
        } else if (job.kind === 'delete') {
          outcome = await exec.remove(job.photo);
        } else {
          outcome = job.uploaded ? 'ok' : await exec.upload(job.photo, job.transfer.retries > 0);
          if (outcome === 'ok') {
            if (!job.uploaded) await this.update((jobs) => jobs.map((entry) => entry.photo.id === id && entry.kind === 'upload'
              ? { ...entry, uploaded: true } : entry));
            outcome = isCurrent() ? await exec.insert(job.photo) : 'retry';
          }
        }
      } catch {
        outcome = 'retry';
      }
      const event = outcome === 'ok' ? 'success' : outcome === 'retry' ? 'retryLater' : 'refused';
      await this.update((jobs) => jobs.map((entry) => entry.photo.id === id && entry.kind === job.kind
        ? { ...entry, transfer: advancePhoto(entry.transfer, event) } : entry));
      if (outcome === 'drop') this.onDrop(job);
      if (outcome === 'retry') return;
    }
  }
}
