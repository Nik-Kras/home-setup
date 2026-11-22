import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, TARGET } from '../theme/tokens';
import { Icon, type IconName } from './ui';

/** Gap between the safe area and the header row, the same on every pushed screen. */
export const HEADER_TOP = 8;

/**
 * Header for pushed screens: a 44dp back button at a fixed offset below the safe area, and an
 * optional right action. The row is exactly 44dp tall, so the back arrow sits at the same height on
 * every screen whatever the right action is.
 */
export function ScreenHeader({ onBack, backLabel = 'Back', right, title }: { onBack: () => void; backLabel?: string; right?: ReactNode; title?: string }) {
  const { top } = useSafeAreaInsets();
  return (
    <View style={[s.row, { marginTop: top + HEADER_TOP }]}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={backLabel} style={({ pressed }) => [s.back, pressed && s.pressed]}>
        <Icon name="back" size={24} color={colors.text} stroke={2} />
      </Pressable>
      {title ? <Text style={s.title} accessibilityRole="header" numberOfLines={1}>{title}</Text> : null}
      {right ?? null}
    </View>
  );
}

/** A round mint icon action for the header's right side, such as Add. 44dp, its edge 20dp from the screen edge. */
export function HeaderIconButton({ icon, onPress, accessibilityLabel }: { icon: IconName; onPress: () => void; accessibilityLabel: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => [s.iconAction, pressed && s.pressed]}>
      <Icon name={icon} size={22} color={colors.onMint} stroke={2.6} />
    </Pressable>
  );
}

/** A text action for the header's right side, such as Edit. 44dp target. */
export function HeaderAction({ label, onPress, accessibilityLabel }: { label: string; onPress: () => void; accessibilityLabel?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} hitSlop={4} style={({ pressed }) => [s.action, pressed && s.pressed]}>
      <Text style={s.actionText}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { height: TARGET, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 8, paddingRight: 12 },
  back: { width: TARGET, height: TARGET, alignItems: 'center', justifyContent: 'center', borderRadius: TARGET / 2 },
  action: { minWidth: TARGET, height: TARGET, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderRadius: TARGET / 2 },
  actionText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  // The row pads 12 on the right; 8 more puts the disc's edge 20 from the screen, like the title's left edge.
  iconAction: { width: TARGET, height: TARGET, marginRight: 8, borderRadius: TARGET / 2, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, marginLeft: 4, fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  pressed: { opacity: 0.6 },
});
