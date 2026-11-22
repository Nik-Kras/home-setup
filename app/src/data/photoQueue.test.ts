import { describe, expect, it, vi } from 'vitest';
import { photoPath, type ItemPhoto } from '../domain/photos';
import { PhotoQueue } from './photoQueue';
import type { Outcome } from './queue';

const photo: ItemPhoto = {
  id: 'photo-id', itemId: 'item-id', path: photoPath('item-id', 'photo-id'), createdAt: '2026-01-01T12:00:00Z',
};
const second = { ...photo, id: 'second', path: photoPath('item-id', 'second') };

function setup() {
  const records = new Map<string, string>();
  const kv = {
    getItem: async (key: string) => records.get(key) ?? null,
    setItem: async (key: string, data: string) => { records.set(key, data); },
  };
  const executor = {
    upload: vi.fn<() => Promise<Outcome>>().mockResolvedValue('ok'),
    insert: vi.fn<() => Promise<Outcome>>().mockResolvedValue('ok'),
    remove: vi.fn<() => Promise<Outcome>>().mockResolvedValue('ok'),
  };
  const drop = vi.fn();
  const queue = () => new PhotoQueue(kv, 'test-account', executor, () => undefined, drop);
  return { queue, executor, records, drop };
}

describe('PhotoQueue', () => {
  it('persists an offline upload and completes it on a later flush after restart', async () => {
    const { queue, executor } = setup();
    executor.upload.mockRejectedValueOnce(new Error('offline'));
    const first = queue();
    await first.enqueue(photo);
    expect(await first.list()).toMatchObject([{ photo, transfer: { status: 'pending', retries: 0 } }]);
    await first.flush();
    expect(executor.insert).not.toHaveBeenCalled();

    const restarted = queue();
    expect(await restarted.list()).toMatchObject([{ photo, transfer: { status: 'pending', retries: 1 } }]);
    await restarted.flush();
    expect(executor.upload).toHaveBeenLastCalledWith(photo, true);
    expect(executor.insert).toHaveBeenCalledWith(photo);
    expect(await restarted.list()).toMatchObject([{ transfer: { status: 'done', retries: 1 } }]);
  });

  it('checkpoints storage success and retries just the insert after a restart', async () => {
    const { queue, executor } = setup();
    executor.insert.mockResolvedValueOnce('retry');
    const first = queue();
    await first.enqueue(photo);
    await first.flush();
    const restarted = queue();
    await restarted.flush();
    expect(executor.upload).toHaveBeenCalledTimes(1);
    expect(executor.insert.mock.calls).toEqual([[photo], [photo]]);
    expect(await restarted.list()).toMatchObject([{ transfer: { status: 'done', retries: 1 } }]);
  });

  it('recovers an interrupted in-flight transfer and shares overlapping flushes', async () => {
    const { queue, executor, records } = setup();
    const first = queue();
    let endUpload!: (result: Outcome) => void;
    let beginUpload!: () => void;
    const started = new Promise<void>((resolve) => { beginUpload = resolve; });
    const upload = new Promise<Outcome>((resolve) => { endUpload = resolve; });
    executor.upload.mockImplementationOnce(() => { beginUpload(); return upload; });
    await first.enqueue(photo);
    const flushing = first.flush();
    expect(first.flush()).toBe(flushing);
    await started;
    expect([...records.values()][0]).toContain('"status":"uploading"');
    expect(await queue().list()).toMatchObject([{ transfer: { status: 'pending', retries: 1 } }]);
    await first.enqueue(second);
    endUpload('ok');
    await flushing;
    await first.flush();
    expect(await first.list()).toMatchObject([
      { photo, transfer: { status: 'done' } }, { photo: second, transfer: { status: 'done' } },
    ]);
  });

  it('drops refused uploads from automatic processing but retains them for manual retry', async () => {
    const { queue, executor, drop } = setup();
    executor.upload.mockResolvedValueOnce('drop');
    const q = queue();
    await Promise.all([q.enqueue(photo), q.enqueue(second)]);
    await q.flush();
    expect(drop).toHaveBeenCalledOnce();
    expect(await q.list()).toMatchObject([
      { photo, transfer: { status: 'failed' } }, { photo: second, transfer: { status: 'done' } },
    ]);
    const restarted = queue();
    await restarted.flush();
    expect(executor.upload).toHaveBeenCalledTimes(2);
    await restarted.retry(photo.id);
    await restarted.flush();
    expect(executor.upload).toHaveBeenLastCalledWith(photo, true);
  });

  it('does not let an in-flight upload overwrite a queued deletion', async () => {
    const { queue, executor } = setup();
    const q = queue();
    executor.upload.mockImplementationOnce(async () => {
      await q.delete(photo);
      return 'ok';
    });
    await q.enqueue(photo);
    await q.flush();
    expect(await q.list()).toMatchObject([{ kind: 'delete', transfer: { status: 'pending' } }]);
    await q.flush();
    expect(executor.remove).toHaveBeenCalledWith(photo);
    expect(await q.list()).toMatchObject([{ kind: 'delete', transfer: { status: 'done' } }]);
  });

  it('allows a permanently refused first upload to be discarded without network', async () => {
    const { queue, executor } = setup();
    executor.upload.mockResolvedValueOnce('drop');
    const q = queue();
    await q.enqueue(photo);
    await q.flush();
    await q.delete(photo);
    await q.flush();
    expect(executor.remove).not.toHaveBeenCalled();
    expect(await q.list()).toMatchObject([{ kind: 'delete', transfer: { status: 'done' } }]);
  });

  it('queues deletes offline and cancels uploads that never started without making a request', async () => {
    const { queue, executor } = setup();
    executor.remove.mockResolvedValueOnce('retry');
    const q = queue();
    await q.enqueue(photo);
    await q.delete(photo);
    await q.delete(second);
    await q.flush();
    expect(executor.upload).not.toHaveBeenCalled();
    const restarted = queue();
    expect(await restarted.list()).toMatchObject([
      { kind: 'delete', photo, transfer: { status: 'done' } },
      { kind: 'delete', photo: second, transfer: { status: 'pending', retries: 1 } },
    ]);
    await restarted.flush();
    expect(executor.remove.mock.calls).toEqual([[second], [second]]);
    await restarted.forgetDone(new Set([photo.id, second.id]));
    expect(await queue().list()).toEqual([]);
  });
});
