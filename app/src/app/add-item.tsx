import { useLocalSearchParams } from 'expo-router';
import { AddScreen } from '../components/AddScreen';

/**
 * The add screen on its Item side, with the bar focused. Opened from the Buy list's add bar
 * (`from=list`) and by the widget's "+" (homesetup://add-item, no `from`: closing it goes to the list).
 */
export default function AddItem() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  return <AddScreen initialMode="item" byLink={from !== 'list'} />;
}
