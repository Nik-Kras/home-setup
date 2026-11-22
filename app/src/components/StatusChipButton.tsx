import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ITEM_STATUS_LABEL } from '../domain/items';
import type { ItemStatus } from '../domain/types';
import { colors, TARGET } from '../theme/tokens';
import { StatusChip } from './ui';

/** A row's status chip as a control: tapping it opens the status sheet. The chevron says it opens something. */
export function StatusChipButton({ status, name, onPress }: { status: ItemStatus; name: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={`Status ${ITEM_STATUS_LABEL[status]}: ${name}`}
      accessibilityHint="Opens the stages to change the status"
      style={({ pressed }) => [s.hit, pressed && s.pressed]}
    >
      <View style={s.row}>
        <StatusChip status={status} />
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Path d="m6 9 6 6 6-6" />
        </Svg>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  hit: { minHeight: TARGET, justifyContent: 'center', flexShrink: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  pressed: { opacity: 0.72 },
});
