import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../data/store';
import { signOutPrompt, syncView, type SyncView } from '../domain/sync';
import { colors, fonts, radius, TARGET } from '../theme/tokens';
import { Sheet, SheetButton } from './Sheet';

const DOT: Record<SyncView['tone'], string> = { mint: colors.mint, amber: colors.amber, neutral: colors.textMuted };

/** The calm sync indicator: a small dot and a word. Tapping it tries to send and load now. */
export function SyncStatusRow() {
  const { sync, pending, retry } = useStore();
  const view = syncView(sync, pending);
  const live = view.kind !== 'demo';
  return (
    <Pressable
      onPress={live ? retry : undefined}
      disabled={!live}
      testID="sync-status"
      accessibilityRole={live ? 'button' : 'text'}
      accessibilityLabel={`Sync, ${view.label}`}
      accessibilityHint={live ? 'Tries to send and load now' : undefined}
      accessibilityLiveRegion="polite"
      style={({ pressed }) => [s.row, pressed && s.pressed]}
    >
      <Text style={s.label}>Sync</Text>
      <View style={s.value}>
        <View style={[s.dot, view.tone === 'neutral' ? s.dotOutline : { backgroundColor: DOT[view.tone] }]} />
        <Text style={s.valueText}>{view.label}</Text>
      </View>
    </Pressable>
  );
}

/**
 * The small settings area at the end of the Home tab: sync status and Sign out. Sign out sends what
 * it can first and asks before leaving unsent changes behind.
 */
export function AccountCard() {
  const { sync, signOut } = useStore();
  const [busy, setBusy] = useState(false);
  const [unsent, setUnsent] = useState(0);
  const demo = sync === 'demo';

  const run = async (force: boolean) => {
    setBusy(true);
    try {
      setUnsent(await signOut({ force }));
    } catch {
      setUnsent(0); // stays signed in on this screen; the row can be tapped again
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.card}>
      <SyncStatusRow />
      {demo ? null : (
        <>
          <View style={s.divider} />
          <Pressable
            onPress={() => void run(false)}
            disabled={busy}
            testID="sign-out"
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            accessibilityState={{ disabled: busy, busy }}
            style={({ pressed }) => [s.row, pressed && s.pressed]}
          >
            <Text style={s.label}>{busy ? 'Signing out...' : 'Sign out'}</Text>
          </Pressable>
        </>
      )}
      <Sheet visible={unsent > 0} title={signOutPrompt(unsent) ?? ''} onClose={() => setUnsent(0)} closeLabel="Cancel">
        <Text style={s.confirm}>They stay on this phone and are sent when you sign in again. If someone else signs in here, they are lost.</Text>
        <SheetButton label="Sign out anyway" disabled={busy} onPress={() => void run(true)} />
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  card: { marginTop: 16, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surface, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: TARGET + 8, paddingHorizontal: 18 },
  divider: { height: 1, backgroundColor: colors.hairline, marginHorizontal: 18 },
  label: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  value: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  valueText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOutline: { borderWidth: 1.5, borderColor: colors.textMuted },
  confirm: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.textSecondary, paddingHorizontal: 4, paddingBottom: 8 },
  pressed: { opacity: 0.6 },
});
