import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../data/store';
import { syncPill } from '../domain/sync';
import { colors, fonts, TARGET } from '../theme/tokens';

/** "Sending" shows only once it has lasted this long, so a normal edit (sent in under a second) does not flash it. */
const SENDING_DELAY_MS = 1_500;

/**
 * A small pill in the tab screens' headers, only when something is off: "Offline · 3 unsent" or
 * "Sending 2". Hidden when synced, its slot kept. Offline it stays put while edits are made (the store
 * keeps "offline" until a send works). Tapping it tries to send now. Amber only while edits wait (to
 * confirm), never for a plain "Offline".
 */
export function SyncPill() {
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
  // The slot keeps its height whether or not the pill shows, so the list below never jumps.
  if (sync === 'demo') return null;
  if (!pill || (pill.sending && !late)) return <View style={s.slot} />;
  const amber = pill.tone === 'amber';
  return (
    <Pressable onPress={retry} accessibilityRole="button" accessibilityLabel={`Sync, ${pill.label}`} accessibilityHint="Tries to send now" hitSlop={8} style={({ pressed }) => [s.hit, pressed && { opacity: 0.7 }]}>
      <View style={[s.pill, amber && s.pillAmber]} accessibilityLiveRegion="polite">
        <View style={[s.dot, amber ? { backgroundColor: colors.amber } : s.dotOutline]} />
        <Text style={[s.text, amber && { color: colors.amber }]}>{pill.label}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  slot: { height: 32, marginTop: 4 },
  hit: { alignSelf: 'flex-start', height: 32, justifyContent: 'center', marginTop: 4, minWidth: TARGET },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: colors.neutralFill },
  pillAmber: { backgroundColor: colors.amberFill },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotOutline: { borderWidth: 1.5, borderColor: colors.textMuted },
  text: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 17, color: colors.textSecondary },
});
