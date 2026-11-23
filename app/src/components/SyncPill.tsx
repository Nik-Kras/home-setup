import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../data/store';
import { syncPill } from '../domain/sync';
import { colors, fonts, TARGET } from '../theme/tokens';
import { Title } from './ui';

/** "Sending" shows only once it has lasted this long, so a normal edit (sent in under a second) does not flash it. */
const SENDING_DELAY_MS = 1_500;

/**
 * A tab screen's serif title with the sync pill on the same line, to its right. The row is as tall as
 * the title, and the pill fits inside it (wrapping to two short lines when narrow), so showing or hiding
 * the pill never moves the list and leaves no empty band under the header.
 */
export function HeaderTitle({ children }: { children: ReactNode }) {
  return (
    <View style={s.titleRow}>
      <Title>{children}</Title>
      <View style={s.pillSlot}><SyncPill /></View>
    </View>
  );
}

/**
 * A small pill beside the tab screens' titles, only when something is off: "Offline · 3 unsent" or
 * "Sending 2". Hidden when synced. Offline it stays put while edits are made (the store
 * keeps "offline" until a send works). Tapping it tries to send now. Amber only while edits wait (to
 * confirm), never for a plain "Offline".
 */
export function SyncPill({ compact }: { compact?: boolean } = {}) {
  const { sync, pending, retry } = useStore();
  const pill = syncPill(sync, pending);
  const [late, setLate] = useState(false);
  const sending = pill?.sending === true;
  useEffect(() => {
    setLate(false);
    if (!sending) return;
    const timer = setTimeout(() => setLate(true), SENDING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [sending]);
  if (sync === 'demo' || !pill || (pill.sending && !late)) return null;
  const amber = pill.tone === 'amber';
  return (
    <Pressable onPress={retry} accessibilityRole="button" accessibilityLabel={`Sync, ${pill.label}`} accessibilityHint="Tries to send now" hitSlop={8} style={({ pressed }) => [s.hit, compact && s.hitCompact, pressed && { opacity: 0.7 }]}>
      <View style={[s.pill, compact && s.pillCompact, amber && s.pillAmber]} accessibilityLiveRegion="polite">
        <View style={[s.dot, amber ? { backgroundColor: colors.amber } : s.dotOutline]} />
        <Text style={[s.text, amber && { color: colors.amber }]} numberOfLines={2}>{pill.label.replace(/(\d+) /g, '$1\u00A0')}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  // Title lineHeight is 40: the pill (at most two 16px lines) stays inside it.
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 40 },
  pillSlot: { flex: 1, minWidth: 0, alignItems: 'flex-end', justifyContent: 'center' },
  hit: { maxWidth: '100%', minHeight: TARGET - 4, minWidth: TARGET, justifyContent: 'center' },
  // On a text line (Home): no minimum height, so the line keeps its height; hitSlop still widens the target.
  hitCompact: { minHeight: 0 },
  pillCompact: { minHeight: 22, paddingVertical: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 26, maxHeight: 40, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 13, backgroundColor: colors.neutralFill, flexShrink: 1 },
  pillAmber: { backgroundColor: colors.amberFill },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotOutline: { borderWidth: 1.5, borderColor: colors.textMuted },
  text: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 16, color: colors.textSecondary },
});
