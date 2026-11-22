/**
 * Offline write queue. Every local edit becomes an Op that is saved to storage first and sent
 * later, in order. If the network is down the queue keeps the Op and stops; the next flush
 * resumes where it stopped. Ops are idempotent (upsert/patch by id), so a retry never duplicates.
 */
export interface KV {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export type Op =
  /** ignoreDuplicates: insert only, never overwrite an existing row (creation ops, so a retry cannot undo a later edit). */
  | { id: string; kind: 'upsert'; table: string; row: Record<string, unknown>; onConflict?: string; ignoreDuplicates?: boolean }
  | { id: string; kind: 'patch'; table: string; match: Record<string, string>; row: Record<string, unknown> };

/** ok: done. retry: network or server trouble, keep the Op. drop: the server refused it for good. */
export type Outcome = 'ok' | 'retry' | 'drop';

const KEY = 'homesetup.queue.v1';

export class OpQueue {
  private storageTail: Promise<unknown> = Promise.resolve();
  private flushing: Promise<void> | null = null;

  constructor(
    private readonly storage: KV,
    private readonly exec: (op: Op) => Promise<Outcome>,
    private readonly onDrop: (op: Op) => void = () => undefined,
  ) {}

  /** The app and headless worker share one queue instance in Android's ReactHost. */
  private withOps<T>(work: (ops: Op[]) => T | Promise<T>): Promise<T> {
    const next = this.storageTail.then(async () => {
      const raw = await this.storage.getItem(KEY);
      return work(raw ? JSON.parse(raw) as Op[] : []);
    });
    this.storageTail = next.catch(() => undefined);
    return next;
  }

  enqueue(op: Op): Promise<void> {
    return this.enqueueAll([op]);
  }

  enqueueAll(added: readonly Op[]): Promise<void> {
    if (added.length === 0) return Promise.resolve();
    return this.withOps((ops) => this.storage.setItem(KEY, JSON.stringify([...ops, ...added])));
  }

  size(): Promise<number> {
    return this.withOps((ops) => ops.length);
  }

  /** Send queued Ops in order. Safe to call often; overlapping calls share one run. */
  flush(): Promise<void> {
    if (!this.flushing) {
      this.flushing = this.run().finally(() => {
        this.flushing = null;
      });
    }
    return this.flushing;
  }

  private async run() {
    while (true) {
      const op = await this.withOps((ops) => ops[0]);
      if (!op) return;
      let outcome: Outcome;
      try {
        outcome = await this.exec(op);
      } catch {
        outcome = 'retry';
      }
      if (outcome === 'retry') return;
      if (outcome === 'drop') this.onDrop(op);
      // Re-read under the same lock: a widget or app edit may have appended during the request.
      await this.withOps((ops) =>
        this.storage.setItem(KEY, JSON.stringify(ops.filter((pending) => pending.id !== op.id))),
      );
    }
  }
}
