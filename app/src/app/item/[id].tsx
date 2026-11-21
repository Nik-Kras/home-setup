import { useLocalSearchParams } from 'expo-router';
import { Placeholder } from '../../components/Placeholder';

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Placeholder title="Item" detail={id} />;
}
