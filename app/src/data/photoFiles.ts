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

export async function saveLocalPhoto(id: string, asset: ImagePicker.ImagePickerAsset): Promise<void> {
  const context = ImageManipulator.manipulate(asset.uri);
  try {
    // Use the rendered dimensions to account for image orientation.
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
        const file = new File((await rendered.saveAsync({ compress, format: SaveFormat.JPEG })).uri);
        if (fitsPhotoTarget(file.size)) {
          await file.move(localPhotoFile(id));
          return;
        }
        await file.delete();
      }
    } finally {
      rendered.release();
    }
  } finally {
    context.release();
  }
  throw new Error('This photo is too large. Choose a smaller photo.');
}
