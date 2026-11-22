import type { SupabaseClient } from '@supabase/supabase-js';
import type { ItemPhoto } from '../domain/photos';
import type { PhotoExecutor } from './photoQueue';
import type { Outcome } from './queue';

const ONE_HOUR = 3600;
const DUPLICATE_CODES = ['Duplicate', 'ResourceAlreadyExists', 'KeyAlreadyExists'];

function photoOutcome(status?: number): Outcome {
  return status && status >= 400 && status < 500 && ![401, 408, 429].includes(status) ? 'drop' : 'retry';
}

function storageStatus(error: { statusCode?: string; status?: number }): number | undefined {
  return Number(error.statusCode) || error.status;
}

export function makePhotoExecutor(db: SupabaseClient, readFile: (id: string) => Promise<ArrayBuffer | undefined>): PhotoExecutor {
  const bucket = db.storage.from('photos');
  return {
    async upload(photo, retrying) {
      const bytes = await readFile(photo.id);
      if (!bytes) return 'drop';
      const { error } = await bucket.upload(photo.path, bytes, { contentType: 'image/jpeg', upsert: false });
      if (!error) return 'ok';
      // A previous upload can succeed even if its response is lost. Storage also
      // returns legacy duplicate responses with statusCode 409 inside an HTTP 400.
      const status = storageStatus(error);
      const code = ('code' in error ? error.code : undefined) ?? error.statusCode;
      const duplicate = status === 409 || DUPLICATE_CODES.some((value) => value === code);
      if (retrying && duplicate) return 'ok';
      return photoOutcome(status);
    },
    async insert(photo) {
      const { error, status } = await db.from('item_photos').upsert(
        { id: photo.id, item_id: photo.itemId, path: photo.path, created_at: photo.createdAt },
        { onConflict: 'id', ignoreDuplicates: true },
      );
      return error ? photoOutcome(status) : 'ok';
    },
    async remove(photo) {
      const { data, error } = await bucket.remove([photo.path]);
      if (error) return photoOutcome(storageStatus(error));
      if (!data.length) {
        // An empty deletion can mean either a missing object or refusal by its storage policy.
        const { data: exists, error: lookupError } = await bucket.exists(photo.path);
        if (lookupError) return photoOutcome(storageStatus(lookupError));
        if (exists) return 'drop';
      }
      const rows = db.from('item_photos');
      const result = await rows.delete().eq('id', photo.id).select('id');
      if (result.error) return photoOutcome(result.status);
      if (result.data.length) return 'ok';
      // RLS can filter a DELETE to zero rows. An already-absent row is also a success.
      const existing = await rows.select('id').eq('id', photo.id).maybeSingle();
      if (existing.error) return photoOutcome(existing.status);
      return existing.data ? 'drop' : 'ok';
    },
  };
}

/** A cache belongs to one signed-in session and is held only in memory. */
export class SignedPhotoUrls {
  private readonly entries = new Map<string, { uri: string; expiresAt: number }>();

  constructor(private readonly db: SupabaseClient, private readonly now = Date.now) {}

  async resolve(photos: readonly ItemPhoto[]): Promise<Map<string, string>> {
    const paths = new Set(photos.map((photo) => photo.path));
    const start = this.now();
    for (const [path, entry] of this.entries) {
      if (!paths.has(path) || entry.expiresAt <= start) this.entries.delete(path);
    }
    const missing = [...paths].filter((path) => !this.entries.has(path));
    if (missing.length) {
      const { data } = await this.db.storage.from('photos').createSignedUrls(missing, ONE_HOUR);
      for (const entry of data ?? []) {
        if (!entry.error && entry.path && entry.signedUrl) this.entries.set(entry.path, { uri: entry.signedUrl, expiresAt: start + ONE_HOUR * 1000 });
      }
    }
    return new Map([...this.entries].map(([path, entry]) => [path, entry.uri]));
  }
}
