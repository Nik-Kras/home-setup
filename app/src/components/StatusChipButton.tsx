import { Pressable, StyleSheet } from 'react-native';
import { ITEM_STATUS_LABEL } from '../domain/items';
import type { ItemStatus } from '../domain/types';
import { TARGET } from '../theme/tokens';
import { StatusChip } from './ui';

/**
 * A row's status chip as a control: tapping it opens the status sheet. No chevron, as in the design
 * (the rows stay calm); the 44dp target and the hint say it opens something.
 */
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
      <StatusChip status={status} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  hit: { minHeight: TARGET, justifyContent: 'center', flexShrink: 0 },
  pressed: { opacity: 0.72 },
});
