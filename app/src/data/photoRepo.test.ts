import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { makePhotoExecutor, SignedPhotoUrls } from './photoRepo';

const photo = { id: 'photo-id', itemId: 'item-id', path: 'items/item-id/photo-id.jpg', createdAt: '2026-01-01T12:00:00Z' };

describe('photo repository', () => {
  it('uploads file bytes without upsert and inserts a row idempotently after an explicit retry conflict', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer;
    const upload = vi.fn().mockResolvedValueOnce({ error: null }).mockResolvedValue({
      error: { status: 409, code: 'ResourceAlreadyExists' },
    });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ upsert }));
    const bucket = vi.fn(() => ({ upload }));
    const db = { from, storage: { from: bucket } } as unknown as SupabaseClient;
    const exec = makePhotoExecutor(db, async () => bytes);

    expect(await exec.upload(photo, false)).toBe('ok');
    expect(await exec.upload(photo, false)).toBe('drop');
    expect(await exec.upload(photo, true)).toBe('ok');
    expect(upload).toHaveBeenCalledWith(photo.path, bytes, { upsert: false, contentType: 'image/jpeg' });
    expect(bucket).toHaveBeenCalledWith('photos');
    expect(await exec.insert(photo)).toBe('ok');
    expect(from).toHaveBeenCalledWith('item_photos');
    expect(upsert).toHaveBeenCalledWith(
      { id: photo.id, item_id: photo.itemId, path: photo.path, created_at: photo.createdAt },
      { onConflict: 'id', ignoreDuplicates: true },
    );
  });

  it('retries status failures and distinguishes absent objects from refused deletes', async () => {
    const remove = vi.fn()
      .mockResolvedValueOnce({ error: { status: 503 } })
      .mockResolvedValue({ data: [], error: null });
    // Like storage-js: a missing object is `{ data: false, error }` with a 404 StorageApiError.
    const exists = vi.fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValue({ data: false, error: { status: 404, statusCode: '404', message: 'Object not found' } });
    const selectDeleted = vi.fn().mockResolvedValue({ data: [], error: null });
    const maybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: { id: photo.id }, error: null })
      .mockResolvedValue({ data: null, error: null });
    const from = vi.fn(() => ({
      delete: () => ({ eq: () => ({ select: selectDeleted }) }),
      select: () => ({ eq: () => ({ maybeSingle }) }),
    }));
    const db = { from, storage: { from: () => ({ remove, exists }) } } as unknown as SupabaseClient;
    const exec = makePhotoExecutor(db, async () => undefined);

    expect(await exec.remove(photo)).toBe('retry');
    expect(await exec.remove(photo)).toBe('drop');
    expect(from).not.toHaveBeenCalled();
    expect(await exec.remove(photo)).toBe('drop');
    expect(await exec.remove(photo)).toBe('ok');
    expect(remove).toHaveBeenCalledWith([photo.path]);
    expect(from).toHaveBeenCalledWith('item_photos');
  });

  it('treats a file that is already gone as deleted and removes the row', async () => {
    const remove = vi.fn().mockResolvedValue({ data: [], error: null });
    const exists = vi.fn().mockResolvedValue({ data: false, error: { status: 404, statusCode: '404', message: 'Object not found' } });
    const selectDeleted = vi.fn().mockResolvedValue({ data: [{ id: photo.id }], error: null });
    const eq = vi.fn(() => ({ select: selectDeleted }));
    const from = vi.fn(() => ({ delete: () => ({ eq }) }));
    const db = { from, storage: { from: () => ({ remove, exists }) } } as unknown as SupabaseClient;
    expect(await makePhotoExecutor(db, async () => undefined).remove(photo)).toBe('ok');
    expect(eq).toHaveBeenCalledWith('id', photo.id);
  });

  it('reports no answer from the server as offline, not as a retry that counts', async () => {
    const upload = vi.fn().mockResolvedValue({ error: { message: 'Network request failed' } });
    const upsert = vi.fn().mockResolvedValue({ error: { message: 'FetchError' }, status: 0 });
    const db = { from: () => ({ upsert }), storage: { from: () => ({ upload }) } } as unknown as SupabaseClient;
    const exec = makePhotoExecutor(db, async () => new ArrayBuffer(4));
    expect(await exec.upload(photo, false)).toBe('offline');
    expect(await exec.insert(photo)).toBe('offline');
  });

  it('signs paths in one batch, reuses URLs and signs them again five minutes before expiry', async () => {
    const other = { ...photo, id: 'second', path: 'items/item-id/second.jpg' };
    const createSignedUrls = vi.fn(async (paths: string[]) => ({
      data: paths.map((path) => ({ path, signedUrl: `https://example.test/${path}`, error: null })),
      error: null,
    }));
    const db = { storage: { from: () => ({ createSignedUrls }) } } as unknown as SupabaseClient;
    let time = 0;
    const cache = new SignedPhotoUrls(db, () => time);
    expect(await cache.resolve([])).toEqual({ urls: new Map(), failed: new Set() });
    const { urls } = await cache.resolve([photo, other]);
    expect(urls.get(other.path)).toBe(`https://example.test/${other.path}`);
    expect(createSignedUrls).toHaveBeenCalledWith([photo.path, other.path], 3600);
    time = 3300_000 - 1;
    expect((await cache.resolve([photo, other])).urls).toEqual(urls);
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    time = 3300_000;
    await cache.resolve([photo, other]);
    expect(createSignedUrls).toHaveBeenCalledTimes(2);
    cache.forget(photo.path);
    await cache.resolve([photo, other]);
    expect(createSignedUrls).toHaveBeenLastCalledWith([photo.path], 3600);
  });

  it('surfaces a signing error as failed paths and keeps a URL that has not expired yet', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const createSignedUrls = vi.fn()
      .mockResolvedValueOnce({ data: [{ path: photo.path, signedUrl: 'https://example.test/a', error: null }], error: null })
      .mockResolvedValue({ data: null, error: { message: 'Service unavailable', status: 503 } });
    const other = { ...photo, id: 'second', path: 'items/item-id/second.jpg' };
    const db = { storage: { from: () => ({ createSignedUrls }) } } as unknown as SupabaseClient;
    let time = 0;
    const cache = new SignedPhotoUrls(db, () => time);
    await cache.resolve([photo]);
    time = 3400_000; // inside the refresh margin, before expiry
    const result = await cache.resolve([photo, other]);
    expect(result.urls.get(photo.path)).toBe('https://example.test/a');
    expect(result.failed).toEqual(new Set([other.path]));
    time = 3600_000;
    expect((await cache.resolve([photo, other])).failed).toEqual(new Set([photo.path, other.path]));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
