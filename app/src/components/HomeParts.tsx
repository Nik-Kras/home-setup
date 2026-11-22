import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { HomeChip, HomeMode } from '../domain/home';
import { actorName } from '../domain/items';
import { coverPhoto, type DisplayPhoto } from '../domain/photos';
import type { Item } from '../domain/types';
import { colors, fonts, personColor, radius, TARGET, tileTone } from '../theme/tokens';
import { Icon, itemGlyph } from './ui';

const MODES: { value: HomeMode; label: string; a11y: string }[] = [
  { value: 'room', label: 'Room', a11y: 'By room' },
  { value: 'owner', label: 'Owner', a11y: 'By owner' },
];

/** Room / Owner switch. Each side is a 44dp target. */
export function ModeSwitch({ value, onChange }: { value: HomeMode; onChange: (m: HomeMode) => void }) {
  return (
    <View style={s.switch} accessibilityRole="tablist" accessibilityLabel="Group things">
      {MODES.map((m) => {
        const on = m.value === value;
        return (
          <Pressable key={m.value} onPress={() => onChange(m.value)} accessibilityRole="tab" accessibilityLabel={m.a11y} accessibilityState={{ selected: on }} style={[s.mode, on && s.modeOn]}>
            <Text style={[s.modeText, on && s.modeTextOn]}>{m.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "All" plus one chip per room that has something in place. Scrolls sideways, fading at the right edge. */
export function RoomChips({ chips, total, room, onChange }: { chips: HomeChip[]; total: number; room?: string; onChange: (room?: string) => void }) {
  const all = [{ room: undefined as string | undefined, label: 'All', count: total }, ...chips.map((c) => ({ room: c.room as string | undefined, label: c.room, count: c.count }))];
  return (
    <View style={s.chipsWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} accessibilityRole="radiogroup" accessibilityLabel="Room">
        {all.map((c) => {
          const on = c.room === room;
          return (
            <Pressable key={c.label} onPress={() => onChange(c.room)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${c.label}, ${c.count}`} style={[s.chip, on && s.chipOn]}>
              <Text style={[s.chipText, on && s.chipTextOn]}>{c.label}</Text>
              <Text style={[s.chipCount, on && s.chipTextOn]}>{c.count}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View pointerEvents="none" style={s.fade} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="chipFade" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.bg} stopOpacity={0} />
              <Stop offset="1" stopColor={colors.bg} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#chipFade)" />
        </Svg>
      </View>
    </View>
  );
}

export function HomeTile({ item, photoUri }: { item: Item; photoUri?: string }) {
  const owner = item.boughtBy;
  const [failedUri, setFailedUri] = useState<string>();
  const showPhoto = !!photoUri && photoUri !== failedUri;
  const glyph = itemGlyph(item);
  const tone = tileTone[glyph.tone];
  return (
    <View style={[s.tile, { backgroundColor: tone.card }]} accessible accessibilityLabel={[item.name, item.room ?? 'No room', owner ? `bought by ${actorName(owner)}` : undefined].filter(Boolean).join(', ')}>
      {showPhoto ? (
        <Image testID={`home-photo-${item.id}`} source={{ uri: photoUri }} style={s.photo} resizeMode="cover" accessible={false} onError={() => setFailedUri(photoUri)} />
      ) : (
        <View style={s.glyph}><Icon name={glyph.icon} size={56} color={tone.fg} stroke={1.2} /></View>
      )}
      <View style={[s.cap, showPhoto && s.photoCap]}>
        {showPhoto ? null : <CaptionScrim />}
        <Text style={s.name} numberOfLines={2}>{item.name}</Text>
        <View style={s.metaLine}>
          <Text style={s.meta} numberOfLines={1}>{item.room ?? 'No room'}</Text>
          {owner ? (
            <>
              <View style={[s.dot, { backgroundColor: personColor[owner] }]} />
              <Text style={s.meta} numberOfLines={1}>{actorName(owner)}</Text>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** The design's caption scrim: transparent at the top to 88% background at the bottom. */
function CaptionScrim() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="capScrim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.bg} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.bg} stopOpacity={0.88} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#capScrim)" />
      </Svg>
    </View>
  );
}

/** Two-column grid of tiles. */
export function HomeGrid({ items, photos }: { items: Item[]; photos: DisplayPhoto[] }) {
  // Rows of two equal tiles (percentage widths plus a gap can round over the row and wrap to one column).
  const rows: Item[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <View style={s.grid}>
      {rows.map((row) => (
        <View key={row[0].id} style={s.gridRow}>
          {row.map((i) => <HomeTile key={i.id} item={i} photoUri={coverPhoto(photos, i.id)?.uri} />)}
          {row.length === 1 ? <View style={s.gridSpacer} /> : null}
        </View>
      ))}
    </View>
  );
}

/** Shown when nothing is in place yet, so the screen never looks like a failed load. */
export function HomeEmpty({ onGoToBuy }: { onGoToBuy: () => void }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyGlyph}><Icon name="home" size={28} color={colors.textSecondary} stroke={1.6} /></View>
      <Text style={s.emptyText}>Nothing in place yet. Items show up here once they are delivered or installed.</Text>
      <Pressable onPress={onGoToBuy} accessibilityRole="button" style={({ pressed }) => [s.emptyButton, pressed && { opacity: 0.8 }]}>
        <Text style={s.emptyButtonText}>Go to Buy list</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  switch: { flexDirection: 'row', borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  mode: { minHeight: TARGET, minWidth: TARGET, paddingHorizontal: 16, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  modeOn: { backgroundColor: colors.mintFill },
  modeText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
  modeTextOn: { fontFamily: fonts.semibold, color: colors.mint },
  chipsWrap: { marginHorizontal: -16 },
  chips: { gap: 6, paddingLeft: 16, paddingRight: 40 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: TARGET, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: '#D5DBD7' },
  chipCount: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  chipTextOn: { color: colors.bg },
  fade: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 40 },
  grid: { gap: 10 },
  gridRow: { flexDirection: 'row', gap: 10 },
  gridSpacer: { flex: 1 },
  tile: { flex: 1, aspectRatio: 1 / 1.02, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.neutralFill, borderWidth: 1, borderColor: colors.hairline, justifyContent: 'flex-end' },
  glyph: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 64, alignItems: 'center', justifyContent: 'center' },
  photo: { position: 'absolute', width: '100%', height: '100%' },
  photoCap: { backgroundColor: colors.bg },
  cap: { paddingHorizontal: 14, paddingBottom: 12, paddingTop: 28, gap: 2 },
  name: { fontFamily: fonts.serif, fontSize: 21, lineHeight: 24, color: colors.text },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: '#D5DBD7' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  empty: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: 20, gap: 14, alignItems: 'flex-start' },
  emptyGlyph: { width: 52, height: 52, borderRadius: radius.tile, backgroundColor: colors.neutralFill, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: colors.textSecondary },
  emptyButton: { minHeight: TARGET, paddingHorizontal: 20, borderRadius: radius.pill, backgroundColor: colors.mint, justifyContent: 'center' },
  emptyButtonText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onMint },
});
