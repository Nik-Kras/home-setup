import { describe, expect, it } from 'vitest';
import { OpQueue, type KV, type Op, type Outcome } from './queue';

const memory = (): KV & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: async (k) => data.get(k) ?? null, setItem: async (k, v) => void data.set(k, v) };
};
const op = (id: string): Op => ({ id, kind: 'upsert', table: 'items', row: { id } });

describe('OpQueue', () => {
  it('sends ops in order', async () => {
    const sent: string[] = [];
    const q = new OpQueue(memory(), async (o) => (sent.push(o.id), 'ok'));
    await q.enqueue(op('a'));
    await q.enqueue(op('b'));
    await q.flush();
    expect(sent).toEqual(['a', 'b']);
    expect(await q.size()).toBe(0);
  });

  it('stops at the first failure and keeps the rest, then resumes', async () => {
    const sent: string[] = [];
    let online = false;
    const q = new OpQueue(memory(), async (o): Promise<Outcome> => {
      if (!online) return 'retry';
      sent.push(o.id);
      return 'ok';
    });
    await q.enqueue(op('a'));
    await q.enqueue(op('b'));
    await q.flush();
    expect(sent).toEqual([]);
    expect(await q.size()).toBe(2);
    online = true;
    await q.flush();
    expect(sent).toEqual(['a', 'b']);
  });

  it('treats a thrown error as a retry', async () => {
    const q = new OpQueue(memory(), async () => {
      throw new Error('network down');
    });
    await q.enqueue(op('a'));
    await q.flush();
    expect(await q.size()).toBe(1);
  });

  it('survives an app restart: a new queue on the same storage keeps the ops', async () => {
    const store = memory();
    const first = new OpQueue(store, async () => 'retry');
    await first.enqueue(op('a'));
    await first.enqueue(op('b'));
    const sent: string[] = [];
    const second = new OpQueue(store, async (o) => (sent.push(o.id), 'ok'));
    await second.flush();
    expect(sent).toEqual(['a', 'b']);
  });

  it('drops an op the server refuses for good, and carries on', async () => {
    const dropped: string[] = [];
    const sent: string[] = [];
    const q = new OpQueue(
      memory(),
      async (o) => (o.id === 'bad' ? 'drop' : (sent.push(o.id), 'ok')),
      (o) => dropped.push(o.id),
    );
    await q.enqueue(op('bad'));
    await q.enqueue(op('good'));
    await q.flush();
    expect(dropped).toEqual(['bad']);
    expect(sent).toEqual(['good']);
  });

  it('overlapping flushes send each op once', async () => {
    const sent: string[] = [];
    const q = new OpQueue(memory(), async (o) => (await Promise.resolve(), sent.push(o.id), 'ok'));
    await q.enqueue(op('a'));
    await Promise.all([q.flush(), q.flush(), q.flush()]);
    expect(sent).toEqual(['a']);
  });
});
