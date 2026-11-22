import { describe, expect, it, vi } from 'vitest';
import { MAX_PHOTO_FAILURES, photoPath, type ItemPhoto } from '../domain/photos';
import { claimPhotos, PHOTO_OWNER_KEY, unsentPhotoCount, photoPickerKey, photoQueueKey, PhotoQueue, type PhotoOutcome } from './photoQueue';

type Outcome = PhotoOutcome;

const photo: ItemPhoto = {
  id: 'photo-id', itemId: 'item-id', path: photoPath('item-id', 'photo-id'), createdAt: '2026-01-01T12:00:00Z',
};
const second = { ...photo, id: 'second', path: photoPath('item-id', 'second') };

function setup() {
  const records = new Map<string, string>();
  const kv = {
    getItem: async (key: string) => records.get(key) ?? null,
    setItem: async (key: string, data: string) => { records.set(key, data); },
    removeItem: async (key: string) => { records.delete(key); },
  };
  // Fake device file system: the ids of photos that have a local file.
  const files = new Set<string>();
  const removeFile = vi.fn(async (id: string) => { files.delete(id); });
  const executor = {
    upload: vi.fn<(item: ItemPhoto, retrying?: boolean) => Promise<Outcome>>().mockResolvedValue('ok'),
    insert: vi.fn<() => Promise<Outcome>>().mockResolvedValue('ok'),
    remove: vi.fn<() => Promise<Outcome>>().mockResolvedValue('ok'),
  };
  const drop = vi.fn();
  const queue = (scope = 'test-account') => new PhotoQueue(kv, scope, executor, () => undefined, drop, removeFile);
  const add = async (q: PhotoQueue, item: ItemPhoto) => {
    files.add(item.id);
    await q.enqueue(item);
  };
  return { queue, executor, records, drop, kv, files, removeFile, add };
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

  it('fails a photo after five retries and moves on to the next one', async () => {
    const { queue, executor, drop } = setup();
    executor.upload.mockImplementation(async (item: ItemPhoto) => (item.id === photo.id ? 'retry' : 'ok'));
    const q = queue();
    await q.enqueue(photo);
    await q.enqueue(second);
    await q.flush();
    expect(await q.list()).toMatchObject([
      { photo, transfer: { status: 'pending', failures: 1 } }, { photo: second, transfer: { status: 'done' } },
    ]);
    for (let i = 1; i < MAX_PHOTO_FAILURES; i++) await q.flush();
    expect(await q.list()).toMatchObject([{ photo, transfer: { status: 'failed', failures: MAX_PHOTO_FAILURES } }, {}]);
    expect(drop).toHaveBeenCalledOnce();
    await q.flush();
    expect(executor.upload).toHaveBeenCalledTimes(MAX_PHOTO_FAILURES + 1);
    await q.retry(photo.id);
    expect(await q.list()).toMatchObject([{ transfer: { status: 'pending', failures: 0 } }, {}]);
  });

  it('keeps an offline photo waiting without a cap and stops the flush at the first offline answer', async () => {
    const { queue, executor } = setup();
    executor.upload.mockResolvedValue('offline');
    const q = queue();
    await q.enqueue(photo);
    await q.enqueue(second);
    for (let i = 0; i < MAX_PHOTO_FAILURES * 2; i++) await q.flush();
    expect(executor.upload).toHaveBeenCalledTimes(MAX_PHOTO_FAILURES * 2);
    expect(executor.upload.mock.calls.every(([item]) => item === photo)).toBe(true);
    expect(await q.list()).toMatchObject([{ transfer: { status: 'pending' } }, { transfer: { status: 'pending', retries: 0 } }]);
    executor.upload.mockResolvedValue('ok');
    await q.flush();
    expect(await q.list()).toMatchObject([{ transfer: { status: 'done' } }, { transfer: { status: 'done' } }]);
  });

  it('lets any account discard a never-uploaded photo, but not an uploaded one', async () => {
    const { queue, executor, files, add } = setup();
    executor.upload.mockResolvedValueOnce('drop').mockResolvedValueOnce('ok');
    executor.insert.mockResolvedValueOnce('drop');
    const q = queue();
    await add(q, photo);
    await add(q, second);
    await q.flush();
    expect(await q.list()).toMatchObject([
      { photo, uploaded: false, transfer: { status: 'failed' } },
      { photo: second, uploaded: true, transfer: { status: 'failed' } },
    ]);
    expect(await q.discard(photo.id)).toBe(true);
    expect(await q.discard(second.id)).toBe(false);
    expect(await q.list()).toMatchObject([{ photo: second }]);
    expect([...files]).toEqual([second.id]);
    expect(executor.remove).not.toHaveBeenCalled();
  });

  it('leaves no local file behind after a successful upload or delete', async () => {
    const { queue, executor, files, add } = setup();
    const q = queue();
    await add(q, photo);
    await add(q, second);
    await q.flush();
    // The uploaded file stays until a display URL exists, so the tile never goes blank.
    await q.reconcile(new Set([photo.path, second.path]), new Set([second.path]));
    expect([...files]).toEqual([photo.id]);
    await q.reconcile(new Set([photo.path, second.path]), new Set([photo.path, second.path]));
    expect(files.size).toBe(0);
    expect(await q.list()).toEqual([]);

    const third = { ...photo, id: 'third', path: photoPath('item-id', 'third') };
    await add(q, third);
    await q.flush();
    await q.delete(third);
    await q.flush();
    expect(executor.remove).toHaveBeenCalledWith(third);
    expect(files.size).toBe(0);
    await q.reconcile(new Set(), new Set());
    expect(await q.list()).toEqual([]);

    const local = { ...photo, id: 'local', path: photoPath('item-id', 'local') };
    await add(q, local);
    await q.delete(local); // never started: deleted on the device without a request
    expect(files.size).toBe(0);
  });

  it('drops another account\'s photo jobs and their files when a new account claims the device', async () => {
    const { queue, kv, records, files, removeFile, add } = setup();
    await claimPhotos(kv, 'account-a', removeFile);
    const a = queue('account-a');
    await add(a, photo);
    await add(a, second);
    await kv.setItem(photoPickerKey('account-a'), 'item-id');
    await claimPhotos(kv, 'account-a', removeFile);
    expect(files.size).toBe(2); // the same account keeps its photos

    await claimPhotos(kv, 'account-b', removeFile);
    expect(files.size).toBe(0);
    expect(records.has(photoQueueKey('account-a'))).toBe(false);
    expect(records.has(photoPickerKey('account-a'))).toBe(false);
    expect(records.get(PHOTO_OWNER_KEY)).toBe('account-b');
    expect(await queue('account-a').list()).toEqual([]);
  });
});

describe('unsentPhotoCount', () => {
  it('counts every photo not confirmed by the server, so sign-out can ask before losing it', () => {
    const job = (status: 'pending' | 'uploading' | 'done' | 'failed') => ({ kind: 'upload' as const, photo, transfer: { status, retries: 0 }, uploaded: false });
    expect(unsentPhotoCount([])).toBe(0);
    expect(unsentPhotoCount([job('pending'), job('uploading'), job('failed'), job('done')])).toBe(3);
  });
});
