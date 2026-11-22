import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../data/store';
import { syncPill } from '../domain/sync';
import { colors, fonts, TARGET } from '../theme/tokens';

/** "Sending" shows only once it has lasted this long, so a normal edit (sent in under a second) does not flash it. */
const SENDING_DELAY_MS = 1_500;

/**
 * A small pill in the tab screens' headers, only when something is off: "Offline · 3 unsent" or
 * "Sending 2". Hidden when synced. Tapping it tries to send now. Amber only while edits wait (to
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
  if (!pill || (pill.sending && !late)) return null;
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
  hit: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center', marginTop: 6, minWidth: TARGET },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: colors.neutralFill },
  pillAmber: { backgroundColor: colors.amberFill },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotOutline: { borderWidth: 1.5, borderColor: colors.textMuted },
  text: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 17, color: colors.textSecondary },
});
