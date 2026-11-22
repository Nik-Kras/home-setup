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
    const exists = vi.fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValue({ data: false, error: null });
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

  it('signs paths in one batch, reuses URLs and signs them again after expiry', async () => {
    const other = { ...photo, id: 'second', path: 'items/item-id/second.jpg' };
    const createSignedUrls = vi.fn(async (paths: string[]) => ({
      data: paths.map((path) => ({ path, signedUrl: `https://example.test/${path}`, error: null })),
    }));
    const db = { storage: { from: () => ({ createSignedUrls }) } } as unknown as SupabaseClient;
    let time = 0;
    const cache = new SignedPhotoUrls(db, () => time);
    expect(await cache.resolve([])).toEqual(new Map());
    const urls = await cache.resolve([photo, other]);
    expect(urls.get(other.path)).toBe(`https://example.test/${other.path}`);
    expect(createSignedUrls).toHaveBeenCalledWith([photo.path, other.path], 3600);
    time = 3599_999;
    expect(await cache.resolve([photo, other])).toEqual(urls);
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    time = 3600_000;
    await cache.resolve([photo, other]);
    expect(createSignedUrls).toHaveBeenCalledTimes(2);
  });
});
