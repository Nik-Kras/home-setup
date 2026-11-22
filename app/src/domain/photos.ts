export interface ItemPhoto {
  id: string;
  itemId: string;
  path: string;
  createdAt: string;
}

export type PhotoTransfer = {
  status: 'pending' | 'uploading' | 'done' | 'failed';
  /** Attempts that may have reached storage, so a retried upload accepts a duplicate as its own. */
  retries: number;
  /** Server answers asking to try again since the last manual retry. At the cap the job fails. */
  failures?: number;
};

export interface DisplayPhoto extends ItemPhoto {
  uri?: string;
  status: PhotoTransfer['status'];
  deleting?: boolean;
  /** Never uploaded: any account may discard it, because nothing exists on the server. */
  localOnly?: boolean;
  /** The server photo exists but no display URL could be created, so the tile offers a retry. */
  linkFailed?: boolean;
}

export const MAX_PHOTO_EDGE = 1600;
export const TARGET_PHOTO_BYTES = 300_000;
/** One stuck photo must not block the others forever: after this many retries it fails visibly. */
export const MAX_PHOTO_FAILURES = 5;

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

/**
 * `retryLater`: the server (or the device) failed and asked for another try; counts toward the cap.
 * `offline`: no answer at all (no network, or the app stopped mid-transfer); waits without a cap,
 * so a photo taken offline still uploads when the connection returns.
 */
export function advancePhoto(
  transfer: PhotoTransfer,
  event: 'start' | 'success' | 'retryLater' | 'offline' | 'refused' | 'retryNow',
): PhotoTransfer {
  if (transfer.status === 'pending' && event === 'start') return { ...transfer, status: 'uploading' };
  if (transfer.status === 'failed' && event === 'retryNow') return { status: 'pending', retries: transfer.retries + 1, failures: 0 };
  if (transfer.status !== 'uploading') return transfer;
  switch (event) {
    case 'success': return { ...transfer, status: 'done' };
    case 'offline': return { ...transfer, status: 'pending', retries: transfer.retries + 1 };
    case 'retryLater': {
      const failures = (transfer.failures ?? 0) + 1;
      return { status: failures >= MAX_PHOTO_FAILURES ? 'failed' : 'pending', retries: transfer.retries + 1, failures };
    }
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
