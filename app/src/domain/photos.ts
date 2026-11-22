export interface ItemPhoto {
  id: string;
  itemId: string;
  path: string;
  createdAt: string;
}

export type PhotoTransfer = {
  status: 'pending' | 'uploading' | 'done' | 'failed';
  retries: number;
};

export interface DisplayPhoto extends ItemPhoto {
  uri?: string;
  status: PhotoTransfer['status'];
  deleting?: boolean;
}

export const MAX_PHOTO_EDGE = 1600;
export const TARGET_PHOTO_BYTES = 300_000;

export function photoPath(itemId: string, id: string): string {
  return `items/${itemId}/${id}.jpg`;
}

export function photoResize(width: number, height: number, maxEdge = MAX_PHOTO_EDGE) {
  if (Math.max(width, height) <= maxEdge) return undefined;
  return width >= height ? { width: maxEdge } : { height: maxEdge };
}

export function fitsPhotoTarget(bytes: number): boolean {
  return Number.isFinite(bytes) && bytes > 0 && bytes < TARGET_PHOTO_BYTES;
}

export function advancePhoto(
  transfer: PhotoTransfer,
  event: 'start' | 'success' | 'retryLater' | 'refused' | 'retryNow',
): PhotoTransfer {
  if (transfer.status === 'pending' && event === 'start') return { ...transfer, status: 'uploading' };
  if (transfer.status === 'failed' && event === 'retryNow') return { status: 'pending', retries: transfer.retries + 1 };
  if (transfer.status !== 'uploading') return transfer;
  switch (event) {
    case 'success': return { ...transfer, status: 'done' };
    case 'retryLater': return { status: 'pending', retries: transfer.retries + 1 };
    case 'refused': return { ...transfer, status: 'failed' };
    default: return transfer;
  }
}

function newestFirst(a: ItemPhoto, b: ItemPhoto): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id);
}

export function itemPhotos<T extends ItemPhoto>(photos: readonly T[], itemId: string): T[] {
  return photos.filter((photo) => photo.itemId === itemId).sort(newestFirst);
}

export function coverPhoto<T extends ItemPhoto>(photos: readonly T[], itemId: string): T | undefined {
  return itemPhotos(photos, itemId)[0];
}
