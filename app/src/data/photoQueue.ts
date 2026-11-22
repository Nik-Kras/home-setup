import { advancePhoto, type ItemPhoto, type PhotoTransfer } from '../domain/photos';
import type { KV, Outcome } from './queue';

export type PhotoJob =
  | { kind: 'upload'; photo: ItemPhoto; transfer: PhotoTransfer; uploaded: boolean }
  | { kind: 'delete'; photo: ItemPhoto; transfer: PhotoTransfer };

/** `offline`: no answer from the server (no network). It stops the flush and never fails a photo. */
export type PhotoOutcome = Outcome | 'offline';

export interface PhotoExecutor {
  upload: (photo: ItemPhoto, retrying: boolean) => Promise<PhotoOutcome>;
  insert: (photo: ItemPhoto) => Promise<PhotoOutcome>;
  remove: (photo: ItemPhoto) => Promise<PhotoOutcome>;
}

/** Deletes the device copy of a photo. Must succeed when the file is already gone. */
export type RemoveLocalFile = (id: string) => Promise<void>;

const KEY = 'homesetup.photos.v1';
const pending: PhotoTransfer = { status: 'pending', retries: 0 };
const EVENTS = { ok: 'success', retry: 'retryLater', offline: 'offline', drop: 'refused' } as const;

export const PHOTO_OWNER_KEY = 'homesetup.photo-owner.v1';
export const photoQueueKey = (scope: string) => `${KEY}.${scope}`;
export const photoPickerKey = (scope: string) => `homesetup.photo-picker.${scope}`;

/** Never uploaded and not in flight, so nothing of it can exist as a row on the server. */
export function isLocalOnly(job: PhotoJob | undefined): boolean {
  return job?.kind === 'upload' && !job.uploaded && job.transfer.status !== 'uploading';
}

/**
 * Called when an account starts using the device. Photo jobs queued by another account must never
 * be sent under this session (like `claimDevice` for Ops), so they are dropped with their files.
 */
export async function claimPhotos(
  storage: KV & { removeItem(key: string): Promise<void> },
  account: string,
  removeFile: RemoveLocalFile,
): Promise<void> {
  const owner = await storage.getItem(PHOTO_OWNER_KEY);
  if (owner === account) return;
  if (owner !== null) {
    const raw = await storage.getItem(photoQueueKey(owner));
    for (const job of raw ? JSON.parse(raw) as PhotoJob[] : []) await removeFile(job.photo.id);
    await storage.removeItem(photoQueueKey(owner));
    await storage.removeItem(photoPickerKey(owner));
  }
  await storage.setItem(PHOTO_OWNER_KEY, account);
}

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
    private readonly removeFile: RemoveLocalFile = async () => undefined,
  ) {
    this.key = photoQueueKey(scope);
  }

  private update(change: (jobs: PhotoJob[]) => PhotoJob[] = (jobs) => jobs): Promise<void> {
    const write = this.writes.then(async () => {
      if (!this.loaded) {
        const raw = await this.storage.getItem(this.key);
        this.jobs = raw ? (JSON.parse(raw) as PhotoJob[]).map((job) => ({
          ...job, transfer: advancePhoto(job.transfer, 'offline'), // interrupted by an app stop
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

  /** A person's delete. A local-only photo is deleted at once with its file, without a request. */
  async delete(photo: ItemPhoto): Promise<void> {
    let local = false;
    await this.update((jobs) => {
      const previous = jobs.find((job) => job.photo.id === photo.id);
      if (previous?.kind === 'delete') return jobs;
      // After a retry the upload may have landed with a lost response, so the server copy is deleted too.
      local = !this.exec || (isLocalOnly(previous) && previous!.transfer.retries === 0);
      const transfer = local ? { ...pending, status: 'done' as const } : pending;
      return [...jobs.filter((job) => job.photo.id !== photo.id), { kind: 'delete', photo, transfer }];
    });
    if (local) await this.removeFile(photo.id).catch(() => undefined);
  }

  /**
   * Any account may discard its own never-uploaded photo. An object from an attempt whose response
   * was lost can stay in storage without a row; only the people may delete storage objects.
   */
  async discard(id: string): Promise<boolean> {
    let found = false;
    await this.update((jobs) => {
      if (!isLocalOnly(jobs.find((job) => job.photo.id === id))) return jobs;
      found = true;
      return jobs.filter((job) => job.photo.id !== id);
    });
    if (found) await this.removeFile(id).catch(() => undefined);
    return found;
  }

  retry(id: string): Promise<void> {
    return this.update((jobs) => jobs.map((job) => job.photo.id === id
      ? { ...job, transfer: advancePhoto(job.transfer, 'retryNow') } : job));
  }

  /** Done jobs bridge the gap until a fresh snapshot can replace them. */
  forgetDone(ids: ReadonlySet<string>): Promise<void> {
    return ids.size ? this.update((jobs) => jobs.filter((job) => job.transfer.status !== 'done' || !ids.has(job.photo.id))) : Promise.resolve();
  }

  /**
   * After a fresh snapshot: forget finished jobs it confirms and delete their device copies. An
   * uploaded photo keeps its file until a display URL exists, so the tile never goes blank.
   */
  async reconcile(paths: ReadonlySet<string>, signed: ReadonlySet<string>): Promise<void> {
    const cleaned = new Set<string>();
    for (const { kind, photo, transfer } of await this.list()) {
      if (transfer.status !== 'done') continue;
      const exists = paths.has(photo.path);
      if (kind === 'delete' ? exists : exists && !signed.has(photo.path)) continue;
      try {
        await this.removeFile(photo.id);
        cleaned.add(photo.id);
      } catch {
        // Keep the job, so the next snapshot tries the file again.
      }
    }
    await this.forgetDone(cleaned);
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
      let outcome: PhotoOutcome;
      try {
        if (!isCurrent()) {
          outcome = 'offline'; // the account changed: not this photo's fault
        } else if (job.kind === 'delete') {
          outcome = await exec.remove(job.photo);
        } else {
          outcome = job.uploaded ? 'ok' : await exec.upload(job.photo, job.transfer.retries > 0);
          if (outcome === 'ok') {
            if (!job.uploaded) await this.update((jobs) => jobs.map((entry) => entry.photo.id === id && entry.kind === 'upload'
              ? { ...entry, uploaded: true } : entry));
            outcome = isCurrent() ? await exec.insert(job.photo) : 'offline';
          }
        }
      } catch {
        outcome = 'retry'; // a thrown error (such as an unreadable file) counts toward the cap
      }
      let failed = false as boolean;
      await this.update((jobs) => jobs.map((entry) => {
        if (entry.photo.id !== id || entry.kind !== job.kind) return entry;
        const transfer = advancePhoto(entry.transfer, EVENTS[outcome]);
        failed = transfer.status === 'failed';
        return { ...entry, transfer };
      }));
      if (failed) this.onDrop(job);
      if (job.kind === 'delete' && outcome === 'ok') await this.removeFile(id).catch(() => undefined);
      // Without network the next photos would fail too. A stuck photo only waits its turn.
      if (outcome === 'offline') return;
    }
  }
}
