import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, TARGET } from '../theme/tokens';
import { Icon } from './ui';

/** Option pill. Selected shows a check mark as well as the mint colour, and is announced as selected. */
export function ChoiceChip({ label, selected, onPress, a11yLabel, hint }: { label: string; selected: boolean; onPress: () => void; a11yLabel?: string; hint?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={a11yLabel ?? label} accessibilityHint={hint} style={[s.pill, selected && s.on]}>
      {selected ? <Icon name="check" size={16} color={colors.mint} stroke={2.6} /> : null}
      <Text style={[s.text, selected && s.textOn]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: TARGET, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface },
  on: { borderWidth: 1.5, borderColor: colors.mint, backgroundColor: 'rgba(94,224,184,0.14)', paddingHorizontal: 15 },
  text: { fontFamily: fonts.medium, fontSize: 14, color: '#D5DBD7' },
  textOn: { fontFamily: fonts.semibold, color: colors.mint },
});
