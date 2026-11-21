import { useLocalSearchParams } from 'expo-router';
import { Placeholder } from '../../components/Placeholder';

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Placeholder title="Task" detail={id} />;
}
