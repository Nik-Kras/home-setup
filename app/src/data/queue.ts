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
  /**
   * match: every column must equal its value (null means the column is null). Extra columns make the
   * patch conditional: if the row no longer holds those values, nothing changes (an Undo after the
   * other person changed the same field, a stale widget tap).
   */
  | { id: string; kind: 'patch'; table: string; match: Record<string, string | number | boolean | null>; row: Record<string, unknown>; reportMiss?: true }
  /**
   * Hard delete of the rows matching every column. Only for a task assignment taken off a task (it has
   * no deleted_at); Undo puts it back with an insert-only upsert. reportMiss: as for patch. `row` is
   * always empty; it is there so every Op has one.
   */
  | { id: string; kind: 'delete'; table: string; match: Record<string, string | number | boolean | null>; row: Record<string, never>; reportMiss?: true };

/**
 * ok: done. retry: network or server trouble, keep the Op. drop: the server refused it for good.
 * missed: done, but a conditional patch (reportMiss) matched no row, so nothing changed.
 */
export type Outcome = 'ok' | 'retry' | 'drop' | 'missed';

const KEY = 'homesetup.queue.v1';

export class OpQueue {
  private storageTail: Promise<unknown> = Promise.resolve();
  private flushing: Promise<void> | null = null;
  /** The Op being sent right now; it can no longer be cancelled. */
  private sending: string | null = null;
  /** Ops tried once without a clear answer: they may have reached the server, so they are never cancelled. */
  private readonly tried = new Set<string>();

  constructor(
    private readonly storage: KV,
    private readonly exec: (op: Op) => Promise<Outcome>,
    private readonly onDrop: (op: Op) => void = () => undefined,
    private readonly onMiss: (op: Op) => void = () => undefined,
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

  /** Forget every unsent Op. Only for a device handed to a different account (see accountScope.ts). */
  clear(): Promise<void> {
    return this.withOps(() => this.storage.setItem(KEY, '[]'));
  }

  /**
   * Take back Ops that have not been sent, all or nothing (Undo of an edit made offline: then nothing
   * reaches the server at all). False, and nothing removed, if any of them is being sent or is gone.
   */
  cancel(ids: readonly string[]): Promise<boolean> {
    if (ids.length === 0) return Promise.resolve(false);
    return this.withOps(async (ops) => {
      const pending = new Set(ops.map((op) => op.id));
      if (ids.some((id) => id === this.sending || this.tried.has(id) || !pending.has(id))) return false;
      await this.storage.setItem(KEY, JSON.stringify(ops.filter((op) => !ids.includes(op.id))));
      return true;
    });
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
      // Picked under the lock, so a cancel() sees it as being sent from this moment.
      const op = await this.withOps((ops) => (this.sending = ops[0]?.id ?? null, ops[0]));
      if (!op) return;
      let outcome: Outcome;
      try {
        outcome = await this.exec(op);
      } catch {
        outcome = 'retry';
      }
      if (outcome === 'retry') {
        this.tried.add(op.id);
        this.sending = null;
        return;
      }
      if (outcome === 'drop') this.onDrop(op);
      if (outcome === 'missed') this.onMiss(op);
      // Re-read under the same lock: a widget or app edit may have appended during the request.
      await this.withOps((ops) =>
        this.storage.setItem(KEY, JSON.stringify(ops.filter((pending) => pending.id !== op.id))),
      );
      this.sending = null;
    }
  }
}
