import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, TARGET } from '../theme/tokens';

/**
 * "Assigned to  Nobody  [I'll buy it]" for an unclaimed item. Two sibling controls, like the product
 * page row, so each is its own accessible element on iOS and Android: the row part opens the person
 * sheet, the pill claims the item for me in one tap (undoable).
 */
export function ClaimRow({ itemName, onOpen, onClaim }: { itemName: string; onOpen: () => void; onClaim: () => void }) {
  return (
    <View style={s.row}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="Assigned to, nobody" accessibilityHint="Opens a sheet to change it" style={({ pressed }) => [s.open, pressed && s.pressed]}>
        <Text style={s.key}>Assigned to</Text>
        <Text style={s.empty} numberOfLines={1}>Nobody</Text>
      </Pressable>
      <Pressable onPress={onClaim} accessibilityRole="button" accessibilityLabel={`I'll buy ${itemName}`} hitSlop={{ top: 4, bottom: 4 }} style={({ pressed }) => [s.claim, pressed && { opacity: 0.7 }]}>
        <Text style={s.claimText}>I'll buy it</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingRight: 8 },
  open: { flex: 1, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 12 },
  pressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  key: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary },
  empty: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary },
  claim: { minHeight: TARGET, minWidth: TARGET, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  claimText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onMint },
});
