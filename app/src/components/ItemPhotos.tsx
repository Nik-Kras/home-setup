import { useRef, useState } from 'react';
import { Alert, FlatList, Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PhotoSource } from '../data/photoFiles';
import { useStore } from '../data/store';
import { itemPhotos, type DisplayPhoto } from '../domain/photos';
import { colors, fonts, TARGET } from '../theme/tokens';
import { Sheet, SheetButton } from './Sheet';
import { Icon } from './ui';

/** iOS cannot present the picker while the sheet's modal is still fading out. */
const SHEET_DISMISS_MS = Platform.OS === 'ios' ? 400 : 0;

function photoStatus(photo: DisplayPhoto, demo: boolean, broken: boolean): string | undefined {
  if (photo.status === 'failed') return photo.deleting ? 'Delete failed' : 'Upload failed';
  if (photo.status === 'uploading') return 'Uploading';
  if (photo.status === 'pending') return demo ? 'On this device' : 'Waiting to upload';
  if (photo.linkFailed || broken) return 'Could not load';
}

/** What the retry button does, or undefined when the photo has nothing to retry. */
function retryLabel(photo: DisplayPhoto, canDelete: boolean, broken: boolean): string | undefined {
  if (photo.status === 'failed') {
    if (!photo.deleting) return 'Retry upload';
    return canDelete ? 'Retry delete' : undefined;
  }
  if (photo.linkFailed || broken) return 'Reload';
}

export function ItemPhotos({ itemId, itemName }: { itemId: string; itemName: string }) {
  const { photos, sync, addPhoto, deletePhoto, retryPhoto, canDeletePhotos } = useStore();
  const [chooseSource, setChooseSource] = useState(false);
  const [adding, setAdding] = useState(false);
  const choosing = useRef(false);
  const [selectedId, setSelectedId] = useState<string>();
  // Display URIs whose image failed to load (expired or unreachable); they show a retry instead.
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  const insets = useSafeAreaInsets();
  const list = itemPhotos(photos, itemId);
  const selected = list.find((photo) => photo.id === selectedId);
  const close = () => setSelectedId(undefined);
  const demo = sync === 'demo';
  const isBroken = (photo: DisplayPhoto) => !!photo.uri && broken.has(photo.uri);
  const markBroken = (uri: string) => setBroken((prev) => new Set(prev).add(uri));

  const pick = async (source: PhotoSource) => {
    if (choosing.current) return;
    choosing.current = true;
    setAdding(true);
    setChooseSource(false); // the picker covers the screen, so the sheet closes as it opens
    try {
      if (SHEET_DISMISS_MS) await new Promise((resolve) => setTimeout(resolve, SHEET_DISMISS_MS));
      await addPhoto(itemId, source);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      Alert.alert('Could not add photo', message.startsWith('Allow camera') || message.startsWith('This photo is too large')
        ? message : 'Try taking or choosing the photo again.');
    } finally {
      setAdding(false);
      choosing.current = false;
    }
  };

  const retry = (photo: DisplayPhoto) => {
    const uri = photo.uri;
    if (uri && broken.has(uri)) {
      setBroken((prev) => {
        const next = new Set(prev);
        next.delete(uri);
        return next;
      });
    }
    void retryPhoto(photo).catch(() => Alert.alert('Could not retry photo', 'Try again.'));
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

  const addTile = (
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
  );

  const renderPhoto = ({ item: photo, index }: { item: DisplayPhoto; index: number }) => {
    const brokenUri = isBroken(photo);
    const status = photoStatus(photo, demo, brokenUri);
    const retryText = retryLabel(photo, canDeletePhotos, brokenUri);
    const label = [
      `Photo of ${itemName}, ${index + 1} of ${list.length}`,
      status?.toLowerCase(),
      retryText && 'double tap to retry',
    ].filter(Boolean).join(', ');
    return (
      <View style={s.tile}>
        <Pressable
          onPress={() => setSelectedId(photo.id)}
          accessibilityRole="button"
          accessibilityLabel={label}
          // With a retry, a screen reader's double tap retries and opening is a custom action.
          accessibilityActions={retryText ? [{ name: 'activate' }, { name: 'open', label: 'Open photo' }] : undefined}
          onAccessibilityAction={retryText ? ({ nativeEvent }) => {
            if (nativeEvent.actionName === 'activate') retry(photo);
            if (nativeEvent.actionName === 'open') setSelectedId(photo.id);
          } : undefined}
          style={s.fill}
        >
          <Icon name="camera" size={22} />
          {photo.uri && !brokenUri && (
            <Image
              source={{ uri: photo.uri }}
              style={s.thumb}
              resizeMode="cover"
              resizeMethod="resize"
              onError={() => markBroken(photo.uri!)}
              accessible={false}
            />
          )}
          {status && !retryText && <Text style={s.badge}>{photo.status === 'pending' && !demo ? 'Pending' : status}</Text>}
        </Pressable>
        {retryText && (
          <Pressable
            onPress={() => retry(photo)}
            style={s.retryBadge}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <Text style={s.retryText}>{retryText}</Text>
          </Pressable>
        )}
      </View>
    );
  };

  const selectedBroken = !!selected && isBroken(selected);
  const selectedStatus = selected && photoStatus(selected, demo, selectedBroken);
  const selectedRetry = selected && retryLabel(selected, canDeletePhotos, selectedBroken);

  return (
    <View style={s.row}>
      <Text style={s.heading} accessibilityRole="header">Photos</Text>
      <FlatList
        horizontal
        data={list}
        keyExtractor={(photo) => photo.id}
        renderItem={renderPhoto}
        ListHeaderComponent={addTile}
        contentContainerStyle={s.tiles}
      />
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
              {(canDeletePhotos || selected.localOnly) && !selected.deleting && (
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
            {selected.uri && !selectedBroken ? (
              <Image
                source={{ uri: selected.uri }}
                style={s.fullPhoto}
                resizeMode="contain"
                accessibilityLabel={`Photo of ${itemName}`}
                onError={() => markBroken(selected.uri!)}
              />
            ) : (
              <View style={s.unavailable}><Text style={s.label}>Photo unavailable</Text></View>
            )}
            {selectedStatus && (
              <Text style={s.viewerStatus} accessibilityLiveRegion="polite">{selectedStatus}</Text>
            )}
            {selectedRetry && (
              <Pressable
                style={s.retry}
                accessibilityRole="button"
                accessibilityLabel={selectedRetry}
                onPress={() => retry(selected)}
              >
                <Text style={s.controlText}>{selectedRetry}</Text>
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
  fill: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  thumb: { position: 'absolute', width: '100%', height: '100%' },
  badge: {
    position: 'absolute', left: 0, right: 0, bottom: 0, padding: 3, textAlign: 'center',
    color: colors.text, backgroundColor: colors.bg, fontFamily: fonts.medium, fontSize: 13,
  },
  retryBadge: {
    position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: TARGET,
    justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg,
  },
  retryText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 13, textAlign: 'center' },
  viewer: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, gap: 8 },
  viewerHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  control: { minHeight: TARGET, minWidth: TARGET, paddingHorizontal: 8, justifyContent: 'center' },
  controlText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15 },
  fullPhoto: { flex: 1, width: '100%' },
  unavailable: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewerStatus: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 15, textAlign: 'center' },
  retry: { minHeight: TARGET, paddingHorizontal: 16, justifyContent: 'center', alignSelf: 'center' },
});
