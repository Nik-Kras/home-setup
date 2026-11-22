import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../data/store';
import { settledAnnouncement, signOutPrompt, syncView, type SyncView } from '../domain/sync';
import { colors, fonts, radius, TARGET } from '../theme/tokens';
import { Sheet, SheetButton } from './Sheet';
import { NAME } from './TaskRow';

const DOT: Record<SyncView['tone'], string> = { mint: colors.mint, amber: colors.amber, neutral: colors.textMuted };

/** The calm sync indicator: a small dot and a word. Tapping it tries to send and load now. */
export function SyncStatusRow() {
  const { sync, pending, retry } = useStore();
  const view = syncView(sync, pending);
  const live = view.kind !== 'demo';
  // Announce settled changes only (going offline, back to synced), not every edit's Sending step.
  const announced = useRef<string | undefined>('Synced');
  useEffect(() => {
    const timer = setTimeout(() => {
      const text = settledAnnouncement(view, announced.current);
      if (!text) return;
      announced.current = text;
      AccessibilityInfo.announceForAccessibility(`Sync, ${text}`);
    }, 1_500);
    return () => clearTimeout(timer);
  }, [view.kind, view.label]); // eslint-disable-line react-hooks/exhaustive-deps -- the label is the whole view
  return (
    <Pressable
      onPress={live ? retry : undefined}
      disabled={!live}
      testID="sync-status"
      accessibilityRole={live ? 'button' : 'text'}
      accessibilityLabel={`Sync, ${view.label}`}
      accessibilityHint={live ? 'Tries to send and load now' : undefined}
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
  const { sync, me, identity, signOut } = useStore();
  const [busy, setBusy] = useState(false);
  // The count stays while the sheet fades out, so its title does not blank as it closes.
  const [ask, setAsk] = useState({ open: false, unsent: 0 });
  const demo = sync === 'demo';

  const run = async (force: boolean) => {
    setBusy(true);
    try {
      const unsent = await signOut({ force });
      setAsk({ open: unsent > 0, unsent: unsent || ask.unsent });
    } catch {
      setAsk((a) => ({ ...a, open: false })); // still signed in; the row can be tapped again
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.card}>
      {demo ? null : (
        <>
          <View style={s.row} accessible accessibilityLabel={`Signed in as ${identity === 'standIn' ? `a test account, acting as ${NAME[me]}` : NAME[me]}`}>
            <Text style={s.label}>Signed in as</Text>
            <Text style={s.valueText} numberOfLines={1}>{identity === 'standIn' ? `Test account · acts as ${NAME[me]}` : NAME[me]}</Text>
          </View>
          <View style={s.divider} />
        </>
      )}
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
      <Sheet visible={ask.open} title={signOutPrompt(ask.unsent) ?? ''} onClose={() => setAsk((a) => ({ ...a, open: false }))} closeLabel="Cancel">
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
