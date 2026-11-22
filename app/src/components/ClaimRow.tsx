import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, TARGET } from '../theme/tokens';

/**
 * "Assigned to  Nobody  [I'll buy it]" for an unclaimed item: the row opens the person sheet, the pill
 * claims it for me in one tap (undoable). Two sibling controls, like the product page row.
 */
export function ClaimRow({ onOpen, onClaim }: { onOpen: () => void; onClaim: () => void }) {
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="Assigned to, nobody" accessibilityHint="Opens a sheet to change it" style={({ pressed }) => [s.row, pressed && s.pressed]}>
      <Text style={s.key}>Assigned to</Text>
      <Text style={s.empty} numberOfLines={1}>Nobody</Text>
      <Pressable onPress={onClaim} accessibilityRole="button" accessibilityLabel="I'll buy it" hitSlop={{ top: 4, bottom: 4 }} style={({ pressed }) => [s.claim, pressed && { opacity: 0.7 }]}>
        <Text style={s.claimText}>I'll buy it</Text>
      </Pressable>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingLeft: 16, paddingRight: 8 },
  pressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  key: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary },
  empty: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary },
  claim: { minHeight: 40, minWidth: TARGET, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  claimText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onMint },
});
