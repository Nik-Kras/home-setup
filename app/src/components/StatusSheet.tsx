import { StyleSheet, Text } from 'react-native';
import { canJumpToGot, ITEM_STATUS_LABEL, stageHint, statusChoices } from '../domain/items';
import type { Item, ItemStatus } from '../domain/types';
import { colors, fonts } from '../theme/tokens';
import { Sheet, SheetButton, SheetOption } from './Sheet';

/**
 * Every stage of an item, the current one checked. Any stage can be picked, forwards or backwards;
 * the change shows an Undo snackbar like any other edit. Each stage can carry a quieter second line
 * ("Next", "You have it", "Optional · only if it needs fitting"). While the item is still Needed or
 * Looking, a labelled "Got it" goes straight to Delivered: the shop case, bought on the spot.
 */
export function StatusSheet({ item, visible, onPick, onClose }: { item: Item | undefined; visible: boolean; onPick: (status: ItemStatus) => void; onClose: () => void }) {
  if (!item) return null;
  const pick = (status: ItemStatus) => {
    onClose();
    if (status !== item.status) onPick(status);
  };
  return (
    <Sheet visible={visible} title={`${item.name}: status`} onClose={onClose}>
      {canJumpToGot(item) ? (
        <>
          <SheetButton primary label="Got it" onPress={() => pick('delivered')} />
          <Text style={s.jumpHint}>Bought it already? Goes straight to Delivered.</Text>
        </>
      ) : null}
      {statusChoices(item).map((status) => (
        <SheetOption key={status} label={ITEM_STATUS_LABEL[status]} hint={stageHint(item, status)} selected={item.status === status} onPress={() => pick(status)} />
      ))}
    </Sheet>
  );
}

const s = StyleSheet.create({
  jumpHint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary, textAlign: 'center', paddingBottom: 4 },
});
