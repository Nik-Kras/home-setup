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
  | { id: string; kind: 'upsert'; table: string; row: Record<string, unknown>; onConflict?: string }
  | { id: string; kind: 'patch'; table: string; match: Record<string, string>; row: Record<string, unknown> };

/** ok: done. retry: network or server trouble, keep the Op. drop: the server refused it for good. */
export type Outcome = 'ok' | 'retry' | 'drop';

const KEY = 'homesetup.queue.v1';

export class OpQueue {
  private ops: Op[] = [];
  private loaded = false;
  private flushing: Promise<void> | null = null;

  constructor(
    private readonly storage: KV,
    private readonly exec: (op: Op) => Promise<Outcome>,
    private readonly onDrop: (op: Op) => void = () => undefined,
  ) {}

  private async load() {
    if (this.loaded) return;
    const raw = await this.storage.getItem(KEY);
    this.ops = raw ? (JSON.parse(raw) as Op[]) : [];
    this.loaded = true;
  }

  private async save() {
    await this.storage.setItem(KEY, JSON.stringify(this.ops));
  }

  async enqueue(op: Op): Promise<void> {
    await this.load();
    this.ops.push(op);
    await this.save();
  }

  async size(): Promise<number> {
    await this.load();
    return this.ops.length;
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
    await this.load();
    while (this.ops.length > 0) {
      const op = this.ops[0]!;
      let outcome: Outcome;
      try {
        outcome = await this.exec(op);
      } catch {
        outcome = 'retry';
      }
      if (outcome === 'retry') return;
      if (outcome === 'drop') this.onDrop(op);
      this.ops.shift();
      await this.save();
    }
  }
}
