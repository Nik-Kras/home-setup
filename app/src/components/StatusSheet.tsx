import { ITEM_STATUS_LABEL, nextStatus, statusChoices } from '../domain/items';
import type { Item, ItemStatus } from '../domain/types';
import { Sheet, SheetOption } from './Sheet';

/**
 * Every stage of an item, the current one checked. Any stage can be picked, forwards or backwards;
 * the change shows an Undo snackbar like any other edit. Delivered carries the hint "got it" (the
 * word on the button that leads there); the next stage is marked "next".
 */
export function StatusSheet({ item, visible, onPick, onClose }: { item: Item | undefined; visible: boolean; onPick: (status: ItemStatus) => void; onClose: () => void }) {
  if (!item) return null;
  const next = nextStatus(item);
  return (
    <Sheet visible={visible} title={`${item.name}: status`} onClose={onClose}>
      {statusChoices(item).map((status) => (
        <SheetOption
          key={status}
          label={[ITEM_STATUS_LABEL[status], status === 'delivered' ? 'got it' : null, status === next && next !== item.status ? 'next' : null].filter(Boolean).join(' · ')}
          selected={item.status === status}
          onPress={() => {
            onClose();
            if (status !== item.status) onPick(status);
          }}
        />
      ))}
    </Sheet>
  );
}
