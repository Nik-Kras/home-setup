import { useLocalSearchParams } from 'expo-router';
import { AddScreen } from '../components/AddScreen';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The add screen on its Task side. Opened from Tasks (carrying the typed text), a group screen or a flat note. */
export default function AddTask() {
  const params = useLocalSearchParams<{ title?: string; group?: string; who?: string }>();
  return <AddScreen initialMode="task" initialText={one(params.title) ?? ''} initialGroup={one(params.group)} initialWho={one(params.who)} />;
}
