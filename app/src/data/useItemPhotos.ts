import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { photoPath, type DisplayPhoto, type ItemPhoto } from '../domain/photos';
import { newId } from './mappers';
import { localPhotoFile, pickImage, removeLocalPhoto, saveLocalPhoto, type PhotoSource } from './photoFiles';
import { PhotoQueue, type PhotoJob } from './photoQueue';
import { makePhotoExecutor, SignedPhotoUrls } from './photoRepo';
import { db, kv } from './supabase';

const executor = db && makePhotoExecutor(db, async (id) => {
  const file = localPhotoFile(id);
  return file.exists ? file.arrayBuffer() : undefined;
});

export function useItemPhotos(scope: string | null, canDelete: boolean) {
  const [local, setLocal] = useState<{ scope: string; jobs: readonly PhotoJob[] }>();
  const [remote, setRemote] = useState<{ scope: string; photos: readonly ItemPhoto[]; urls: Map<string, string> }>();
  const queue = useMemo(() => scope && new PhotoQueue(
    kv, scope, executor, (jobs) => setLocal({ scope, jobs }),
    ({ kind }) => console.warn(`Server refused photo ${kind}`),
  ), [scope]);
  const signer = useMemo(() => scope && db && new SignedPhotoUrls(db), [scope]);
  const pickerKey = scope && `homesetup.photo-picker.${scope}`;
  const picking = useRef(false);
  const activeScope = useRef(scope);
  activeScope.current = scope;

  const save = useCallback(async (itemId: string, asset: ImagePicker.ImagePickerAsset) => {
    if (!queue) throw new Error('Sign in to add a photo.');
    const id = newId();
    await saveLocalPhoto(id, asset);
    try {
      await queue.enqueue({ id, itemId, path: photoPath(itemId, id), createdAt: new Date().toISOString() });
    } catch (error) {
      await removeLocalPhoto(id).catch(() => undefined);
      throw error;
    }
  }, [queue]);

  useEffect(() => {
    if (!queue) return;
    void queue.list().catch(() => console.warn('Could not read saved photos'));
    if (Platform.OS !== 'android' || !pickerKey) return;
    let active = true;
    void (async () => {
      const itemId = await kv.getItem(pickerKey);
      if (!active || !itemId || picking.current) return;
      const result = await ImagePicker.getPendingResultAsync();
      if (!active || picking.current) return;
      if (result && 'assets' in result && !result.canceled) await save(itemId, result.assets[0]!);
      if (result && 'code' in result) Alert.alert('Could not add photo', 'Try taking or choosing the photo again.');
      await kv.removeItem(pickerKey);
    })().catch(() => {
      if (active) Alert.alert('Could not recover photo', 'Try taking or choosing the photo again.');
    });
    return () => { active = false; };
  }, [pickerKey, queue, save]);

  const addPhoto = useCallback(async (itemId: string, source: PhotoSource) => {
    if (picking.current || !pickerKey) return;
    picking.current = true;
    try {
      if (Platform.OS === 'android') await kv.setItem(pickerKey, itemId);
      const result = await pickImage(source);
      if (!result.canceled) await save(itemId, result.assets[0]!);
    } finally {
      if (Platform.OS === 'android') await kv.removeItem(pickerKey).catch(() => undefined);
      picking.current = false;
    }
  }, [pickerKey, save]);

  const deletePhoto = useCallback(async (photo: ItemPhoto) => {
    if (!queue || !canDelete) return;
    // Copy metadata only. Display URLs must never enter persistent storage.
    const { id, itemId, path, createdAt } = photo;
    await queue.delete({ id, itemId, path, createdAt });
    const job = (await queue.list()).find((entry) => entry.photo.id === id);
    if (job?.kind === 'delete' && job.transfer.status === 'done') {
      await removeLocalPhoto(id);
      if (!db) await queue.forgetDone(new Set([id]));
    }
  }, [canDelete, queue]);

  const retryPhoto = useCallback(async (photo: DisplayPhoto) => {
    if (!queue || (photo.deleting && !canDelete)) return;
    await queue.retry(photo.id);
  }, [canDelete, queue]);

  const flushPhotos = useCallback(async () => {
    if (queue) await queue.flush(() => activeScope.current === scope);
  }, [queue, scope]);

  const loadPhotos = useCallback(async (photos: ItemPhoto[]) => {
    if (!scope || !signer || !queue) return;
    const urls = await signer.resolve(photos);
    if (activeScope.current !== scope) return;
    setRemote({ scope, photos, urls });
    const paths = new Set(photos.map((photo) => photo.path));
    const cleaned = new Set<string>();
    for (const { kind, photo, transfer } of await queue.list()) {
      if (transfer.status !== 'done') continue;
      const exists = paths.has(photo.path);
      if (kind === 'delete' ? exists : exists && !urls.has(photo.path)) continue;
      await removeLocalPhoto(photo.id);
      cleaned.add(photo.id);
    }
    await queue.forgetDone(cleaned);
  }, [queue, scope, signer]);

  const photos = useMemo(() => {
    const byId = new Map<string, DisplayPhoto>();
    const urls = remote?.scope === scope ? remote?.urls : undefined;
    for (const photo of (remote?.scope === scope ? remote?.photos : undefined) ?? []) {
      byId.set(photo.id, { ...photo, uri: urls?.get(photo.path), status: 'done' });
    }
    for (const job of (local?.scope === scope ? local?.jobs : undefined) ?? []) {
      const { photo, transfer, kind } = job;
      if (kind === 'delete' && transfer.status !== 'failed') {
        byId.delete(photo.id);
        continue;
      }
      const file = localPhotoFile(photo.id);
      const uri = urls?.get(photo.path) ?? (file.exists ? file.uri : undefined);
      byId.set(photo.id, { ...photo, uri, status: transfer.status, deleting: kind === 'delete' });
    }
    return [...byId.values()];
  }, [local, remote, scope]);

  return { photos, addPhoto, deletePhoto, retryPhoto, flushPhotos, loadPhotos };
}
