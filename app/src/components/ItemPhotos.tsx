import { useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PhotoSource } from '../data/photoFiles';
import { useStore } from '../data/store';
import { itemPhotos, type DisplayPhoto } from '../domain/photos';
import { colors, fonts, TARGET } from '../theme/tokens';
import { Sheet, SheetButton } from './Sheet';
import { Icon } from './ui';

function photoStatus(photo: DisplayPhoto, demo: boolean): string | undefined {
  if (photo.status === 'failed') return photo.deleting ? 'Delete failed' : 'Upload failed';
  if (photo.status === 'uploading') return 'Uploading';
  if (photo.status === 'pending') return demo ? 'On this device' : 'Waiting to upload';
}

export function ItemPhotos({ itemId, itemName }: { itemId: string; itemName: string }) {
  const { photos, sync, addPhoto, deletePhoto, retryPhoto, canDeletePhotos } = useStore();
  const [chooseSource, setChooseSource] = useState(false);
  const [adding, setAdding] = useState(false);
  const choosing = useRef(false);
  const [selectedId, setSelectedId] = useState<string>();
  const insets = useSafeAreaInsets();
  const list = itemPhotos(photos, itemId);
  const selected = list.find((photo) => photo.id === selectedId);
  const close = () => setSelectedId(undefined);

  const pick = async (source: PhotoSource) => {
    if (choosing.current) return;
    choosing.current = true;
    setAdding(true);
    try {
      await addPhoto(itemId, source);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      Alert.alert('Could not add photo', message.startsWith('Allow camera') || message.startsWith('This photo is too large')
        ? message : 'Try taking or choosing the photo again.');
    } finally {
      setChooseSource(false);
      setAdding(false);
      choosing.current = false;
    }
  };

  const remove = (photo: DisplayPhoto) => {
    Alert.alert('Delete photo?', 'This removes the photo from the item.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          void deletePhoto(photo).then(close, () => Alert.alert('Could not delete photo', 'Try again.'));
        },
      },
    ]);
  };

  return (
    <View style={s.row}>
      <Text style={s.heading} accessibilityRole="header">Photos</Text>
      <ScrollView horizontal contentContainerStyle={s.tiles}>
        <Pressable
          onPress={() => setChooseSource(true)}
          disabled={adding}
          accessibilityRole="button"
          accessibilityLabel="Add photo"
          accessibilityState={{ disabled: adding, busy: adding }}
          style={[s.tile, s.add]}
        >
          <Icon name="camera" size={23} color={colors.textSecondary} />
          <Text style={s.label}>{adding ? 'Adding…' : 'Add photo'}</Text>
        </Pressable>
        {list.map((photo, index) => {
          const status = photoStatus(photo, sync === 'demo');
          return (
            <Pressable
              key={photo.id}
              onPress={() => setSelectedId(photo.id)}
              accessibilityRole="button"
              accessibilityLabel={`Photo of ${itemName}, ${index + 1} of ${list.length}`}
              accessibilityHint={status}
              style={s.tile}
            >
              <Icon name="camera" size={22} />
              {photo.uri && <Image source={{ uri: photo.uri }} style={s.thumb} resizeMode="cover" accessible={false} />}
              {status && <Text style={s.badge}>{photo.status === 'pending' && sync !== 'demo' ? 'Pending' : status}</Text>}
            </Pressable>
          );
        })}
      </ScrollView>
      <Sheet visible={chooseSource} title="Add photo" onClose={() => setChooseSource(false)}>
        <SheetButton label="Camera" disabled={adding} onPress={() => void pick('camera')} />
        <SheetButton label="Library" disabled={adding} onPress={() => void pick('library')} />
      </Sheet>
      <Modal visible={!!selected} animationType="fade" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
        {selected && (
          <View style={[s.viewer, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]} accessibilityViewIsModal>
            <View style={s.viewerHeader}>
              <Pressable style={s.control} onPress={close} accessibilityLabel="Close photo" accessibilityRole="button">
                <Text style={s.controlText}>Close</Text>
              </Pressable>
              {canDeletePhotos && !selected.deleting && (
                <Pressable
                  style={s.control}
                  onPress={() => remove(selected)}
                  accessibilityRole="button"
                  accessibilityLabel="Delete photo"
                >
                  <Text style={s.controlText}>Delete</Text>
                </Pressable>
              )}
            </View>
            {selected.uri ? (
              <Image source={{ uri: selected.uri }} style={s.fullPhoto} resizeMode="contain" accessibilityLabel={`Photo of ${itemName}`} />
            ) : (
              <View style={s.unavailable}><Text style={s.label}>Photo unavailable</Text></View>
            )}
            {photoStatus(selected, sync === 'demo') && (
              <Text style={s.viewerStatus} accessibilityLiveRegion="polite">{photoStatus(selected, sync === 'demo')}</Text>
            )}
            {selected.status === 'failed' && (!selected.deleting || canDeletePhotos) && (
              <Pressable
                style={s.retry}
                accessibilityRole="button"
                accessibilityLabel={selected.deleting ? 'Retry deletion' : 'Retry upload'}
                onPress={() => void retryPhoto(selected).catch(() => Alert.alert('Could not retry photo', 'Try again.'))}
              >
                <Text style={s.controlText}>{selected.deleting ? 'Retry deletion' : 'Retry upload'}</Text>
              </Pressable>
            )}
          </View>
        )}
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  row: { borderTopWidth: 1, borderColor: colors.hairline, gap: 8, paddingTop: 12 },
  heading: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 15, paddingHorizontal: 16 },
  tiles: { gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  tile: {
    width: 92, height: 92, borderRadius: 16, borderWidth: 1, borderColor: colors.hairline,
    backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', gap: 5, overflow: 'hidden',
  },
  add: { borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.38)' },
  label: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 13, textAlign: 'center' },
  thumb: { position: 'absolute', width: '100%', height: '100%' },
  badge: {
    position: 'absolute', left: 0, right: 0, bottom: 0, padding: 3, textAlign: 'center',
    color: colors.text, backgroundColor: colors.bg, fontFamily: fonts.medium, fontSize: 13,
  },
  viewer: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, gap: 8 },
  viewerHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  control: { minHeight: TARGET, minWidth: TARGET, paddingHorizontal: 8, justifyContent: 'center' },
  controlText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15 },
  fullPhoto: { flex: 1, width: '100%' },
  unavailable: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewerStatus: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 15, textAlign: 'center' },
  retry: { minHeight: TARGET, paddingHorizontal: 16, justifyContent: 'center', alignSelf: 'center' },
});
