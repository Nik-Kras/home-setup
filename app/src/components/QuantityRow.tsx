import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, TARGET } from '../theme/tokens';
import Svg, { Path } from 'react-native-svg';

const Glyph = ({ d }: { d: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={2.2} strokeLinecap="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Path d={d} />
  </Svg>
);

/** Quantity with minus and plus. Never below 1 (the database refuses 0). Each tap saves at once. */
export function QuantityRow({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={s.row}>
      <Text style={s.key} importantForAccessibility="no" accessibilityElementsHidden>Quantity</Text>
      <View style={s.controls}>
        <Pressable onPress={() => onChange(value - 1)} disabled={value <= 1} accessibilityRole="button" accessibilityLabel="Decrease quantity" accessibilityState={{ disabled: value <= 1 }} style={({ pressed }) => [s.btn, value <= 1 && s.disabled, pressed && s.pressed]}>
          <Glyph d="M5 12h14" />
        </Pressable>
        <Text style={s.value} accessibilityLabel={`Quantity ${value}`} accessibilityLiveRegion="polite">{value}</Text>
        <Pressable onPress={() => onChange(value + 1)} accessibilityRole="button" accessibilityLabel="Increase quantity" style={({ pressed }) => [s.btn, pressed && s.pressed]}>
          <Glyph d="M12 5v14M5 12h14" />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 50, paddingLeft: 16, paddingRight: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  key: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary },
  controls: { flexDirection: 'row', alignItems: 'center' },
  btn: { width: TARGET, height: TARGET, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  disabled: { opacity: 0.35 },
  pressed: { backgroundColor: 'rgba(255,255,255,0.06)' },
  value: { minWidth: 28, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
});
