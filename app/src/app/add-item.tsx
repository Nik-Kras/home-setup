import { AddScreen } from '../components/AddScreen';

/**
 * The add screen on its Item side, with the bar focused. Opened from the Buy list's add bar and by the
 * widget's "+" (homesetup://add-item).
 */
export default function AddItem() {
  return <AddScreen initialMode="item" />;
}
