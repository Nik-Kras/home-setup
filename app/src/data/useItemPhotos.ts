import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { photoPath, type DisplayPhoto, type ItemPhoto } from '../domain/photos';
import { newId } from './mappers';
import { localPhotoFile, pickImage, removeLocalPhoto, saveLocalPhoto, type PhotoSource } from './photoFiles';
import { claimPhotos, isLocalOnly, photoPickerKey, PhotoQueue, type PhotoJob } from './photoQueue';
import { makePhotoExecutor, SignedPhotoUrls } from './photoRepo';
import { db, kv } from './supabase';

const executor = db && makePhotoExecutor(db, async (id) => {
  const file = localPhotoFile(id);
  return file.exists ? file.arrayBuffer() : undefined;
});

export function useItemPhotos(scope: string | null, canDelete: boolean) {
  const [local, setLocal] = useState<{ scope: string; jobs: readonly PhotoJob[] }>();
  const [remote, setRemote] = useState<{ scope: string; photos: readonly ItemPhoto[]; urls: Map<string, string>; failed: Set<string> }>();
  const queue = useMemo(() => scope && new PhotoQueue(
    kv, scope, executor, (jobs) => setLocal({ scope, jobs }),
    ({ kind }) => console.warn(`Photo ${kind} failed`),
    removeLocalPhoto,
  ), [scope]);
  const signer = useMemo(() => scope && db && new SignedPhotoUrls(db), [scope]);
  const pickerKey = scope && photoPickerKey(scope);
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
    // Another account's unsent photos are dropped with their files (see claimPhotos).
    if (db && scope) void claimPhotos(kv, scope, removeLocalPhoto).catch(() => console.warn('Could not clear old photos'));
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
  }, [pickerKey, queue, save, scope]);

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
    if (!queue) return;
    // Any account may discard a never-uploaded photo; server photos are deleted by the people only.
    if (!canDelete) {
      await queue.discard(photo.id);
      return;
    }
    // Copy metadata only. Display URLs must never enter persistent storage.
    const { id, itemId, path, createdAt } = photo;
    await queue.delete({ id, itemId, path, createdAt });
    if (!db) await queue.forgetDone(new Set([id]));
  }, [canDelete, queue]);

  const retryPhoto = useCallback(async (photo: DisplayPhoto) => {
    if (!queue || (photo.deleting && !canDelete)) return;
    if (photo.status === 'failed') await queue.retry(photo.id);
    else if (signer) signer.forget(photo.path); // a display URL failed: sign it again on the next load
  }, [canDelete, queue, signer]);

  const flushPhotos = useCallback(async () => {
    if (queue) await queue.flush(() => activeScope.current === scope);
  }, [queue, scope]);

  const loadPhotos = useCallback(async (photos: ItemPhoto[]) => {
    if (!scope || !signer || !queue) return;
    const { urls, failed } = await signer.resolve(photos);
    if (activeScope.current !== scope) return;
    setRemote({ scope, photos, urls, failed });
    await queue.reconcile(new Set(photos.map((photo) => photo.path)), new Set(urls.keys()));
  }, [queue, scope, signer]);

  const photos = useMemo(() => {
    const byId = new Map<string, DisplayPhoto>();
    const urls = remote?.scope === scope ? remote?.urls : undefined;
    const failed = remote?.scope === scope ? remote?.failed : undefined;
    for (const photo of (remote?.scope === scope ? remote?.photos : undefined) ?? []) {
      const uri = urls?.get(photo.path);
      byId.set(photo.id, { ...photo, uri, status: 'done', linkFailed: !uri && failed?.has(photo.path) });
    }
    for (const job of (local?.scope === scope ? local?.jobs : undefined) ?? []) {
      const { photo, transfer, kind } = job;
      if (kind === 'delete' && transfer.status !== 'failed') {
        byId.delete(photo.id);
        continue;
      }
      const file = localPhotoFile(photo.id);
      const uri = urls?.get(photo.path) ?? (file.exists ? file.uri : undefined);
      byId.set(photo.id, {
        ...photo, uri, status: transfer.status, deleting: kind === 'delete', localOnly: isLocalOnly(job),
        linkFailed: !uri && kind === 'upload' && transfer.status === 'done' && failed?.has(photo.path),
      });
    }
    return [...byId.values()];
  }, [local, remote, scope]);

  return { photos, addPhoto, deletePhoto, retryPhoto, flushPhotos, loadPhotos };
}
