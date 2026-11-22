import { describe, expect, it } from 'vitest';
import { advancePhoto, coverPhoto, fitsPhotoTarget, itemPhotos, MAX_PHOTO_FAILURES, photoPath, photoResize, type PhotoTransfer } from './photos';

describe('photos', () => {
  it('creates an item-scoped JPEG path and caps either long edge without upscaling', () => {
    expect(photoPath('item-id', 'photo-id')).toBe('items/item-id/photo-id.jpg');
    expect(photoResize(4000, 2000)).toEqual({ width: 1600 });
    expect(photoResize(2000, 4000)).toEqual({ height: 1600 });
    expect(photoResize(1600, 1600)).toBeUndefined();
    expect(photoResize(1600, 900, 1200)).toEqual({ width: 1200 });
    expect(fitsPhotoTarget(299_999)).toBe(true);
    expect([0, -1, NaN, 300_000].map(fitsPhotoTarget)).toEqual([false, false, false, false]);
  });

  it('tracks automatic retries and only retries a refused transfer on user action', () => {
    const pending: PhotoTransfer = { status: 'pending', retries: 0 };
    const started = advancePhoto(pending, 'start');
    expect(started).toEqual({ status: 'uploading', retries: 0 });
    const delayed = advancePhoto(started, 'retryLater');
    expect(delayed).toEqual({ status: 'pending', retries: 1, failures: 1 });
    const failed = advancePhoto(advancePhoto(delayed, 'start'), 'refused');
    expect(advancePhoto(failed, 'start')).toEqual({ status: 'failed', retries: 1, failures: 1 });
    const restarted = advancePhoto(advancePhoto(failed, 'retryNow'), 'start');
    expect(advancePhoto(restarted, 'success')).toEqual({ status: 'done', retries: 2, failures: 0 });
  });

  it('fails a transfer after five retries, but waits without a cap while offline', () => {
    let transfer: PhotoTransfer = { status: 'pending', retries: 0 };
    for (let i = 0; i < 20; i++) transfer = advancePhoto(advancePhoto(transfer, 'start'), 'offline');
    expect(transfer).toEqual({ status: 'pending', retries: 20 });
    for (let i = 1; i < MAX_PHOTO_FAILURES; i++) transfer = advancePhoto(advancePhoto(transfer, 'start'), 'retryLater');
    expect(transfer).toMatchObject({ status: 'pending', failures: MAX_PHOTO_FAILURES - 1 });
    transfer = advancePhoto(advancePhoto(transfer, 'start'), 'retryLater');
    expect(transfer).toEqual({ status: 'failed', retries: 25, failures: MAX_PHOTO_FAILURES });
    expect(advancePhoto(transfer, 'retryNow')).toEqual({ status: 'pending', retries: 26, failures: 0 });
  });

  it('selects the newest photo by capture time for the requested item', () => {
    const photo = (id: string, itemId: string, createdAt: string) => ({ id, itemId, createdAt, path: photoPath(itemId, id) });
    const older = photo('old', 'item', '2026-01-01T08:00:00Z');
    const newest = photo('new', 'item', '2026-01-01T10:00:00+01:00');
    const unrelated = photo('other', 'another-item', '2026-01-03T00:00:00Z');
    expect(itemPhotos([older, unrelated, newest], 'item')).toEqual([newest, older]);
    expect(coverPhoto([older, unrelated, newest], 'item')).toEqual(newest);
    expect(coverPhoto([older], 'missing')).toBeUndefined();
  });
});
