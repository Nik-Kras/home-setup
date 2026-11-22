import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { fitsPhotoTarget, MAX_PHOTO_EDGE, photoResize } from '../domain/photos';

export type PhotoSource = 'camera' | 'library';

export async function pickImage(source: PhotoSource) {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Allow camera access in Settings or choose Library.');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'] };
  return source === 'camera'
    ? ImagePicker.launchCameraAsync(options)
    : ImagePicker.launchImageLibraryAsync(options);
}

export function localPhotoFile(id: string): File {
  return new File(Paths.document, `item-photo-${id}.jpg`);
}

export async function removeLocalPhoto(id: string): Promise<void> {
  const file = localPhotoFile(id);
  if (file.exists) await file.delete();
}

/** Deletes a file the picker or manipulator wrote to the app cache. Never touches other files. */
export async function removeCacheFile(uri: string): Promise<void> {
  if (!uri.startsWith(Paths.cache.uri)) return;
  try {
    const file = new File(uri);
    if (file.exists) await file.delete();
  } catch {
    // The OS clears the cache eventually; a leftover copy is not worth failing the photo for.
  }
}

/**
 * Saves a JPEG of at most MAX_PHOTO_EDGE on the long edge and under the size target. The image is
 * downsampled while it is decoded (`maxWidth`/`maxHeight`), so a full-size camera bitmap is never
 * held in memory; bounding both sides caps the long edge whatever the orientation.
 * Re-encoding writes pixels only, so EXIF metadata (such as GPS location) is stripped: keep it that way.
 */
export async function saveLocalPhoto(id: string, asset: ImagePicker.ImagePickerAsset): Promise<void> {
  const context = ImageManipulator.manipulate(asset.uri, { maxWidth: MAX_PHOTO_EDGE, maxHeight: MAX_PHOTO_EDGE });
  try {
    let rendered = await context.renderAsync();
    try {
      for (const [edge, compress] of [[MAX_PHOTO_EDGE, 0.7], [MAX_PHOTO_EDGE, 0.55], [1200, 0.55], [960, 0.5]]) {
        const size = photoResize(rendered.width, rendered.height, edge);
        if (size) {
          context.resize(size);
          const resized = await context.renderAsync();
          rendered.release();
          rendered = resized;
        }
        const saved = await rendered.saveAsync({ compress, format: SaveFormat.JPEG });
        const file = new File(saved.uri);
        if (fitsPhotoTarget(file.size)) {
          try {
            await file.move(localPhotoFile(id)); // `move` points `file` at the new location
            return;
          } catch (error) {
            await removeCacheFile(saved.uri); // no temp copy stays behind
            throw error;
          }
        }
        await file.delete();
      }
    } finally {
      rendered.release();
    }
  } finally {
    context.release();
    await removeCacheFile(asset.uri); // the picker's own copy is not needed once processed
  }
  throw new Error('This photo is too large. Choose a smaller photo.');
}
