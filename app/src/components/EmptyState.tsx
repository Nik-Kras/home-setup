import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, TARGET } from '../theme/tokens';
import { Icon, type IconName } from './ui';

/** An empty list: icon tile, serif title, one line of help and an optional primary action. */
export function EmptyState({ icon, title, line, action }: { icon: IconName; title: string; line: string; action?: { label: string; onPress: () => void; accessibilityLabel?: string } }) {
  return (
    <View style={s.card}>
      <View style={s.tile} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon name={icon} size={24} color={colors.textSecondary} stroke={1.8} />
      </View>
      <Text style={s.title} accessibilityRole="header">{title}</Text>
      <Text style={s.line}>{line}</Text>
      {action ? (
        <Pressable onPress={action.onPress} accessibilityRole="button" accessibilityLabel={action.accessibilityLabel ?? action.label} style={({ pressed }) => [s.button, pressed && s.pressed]}>
          <Icon name="plus" size={18} color={colors.onMint} stroke={2.6} />
          <Text style={s.buttonText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { alignItems: 'flex-start', gap: 6, padding: 18, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surface },
  tile: { width: TARGET, height: TARGET, marginBottom: 6, borderRadius: radius.tile, backgroundColor: colors.neutralFill, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 26, color: colors.text },
  line: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  button: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: TARGET, marginTop: 8, paddingLeft: 16, paddingRight: 20, borderRadius: radius.pill, backgroundColor: colors.mint },
  buttonText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onMint },
  pressed: { opacity: 0.75 },
});
