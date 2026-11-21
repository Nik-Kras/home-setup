import { useLocalSearchParams } from 'expo-router';
import { Placeholder } from '../../components/Placeholder';

export default function GroupDetail() {
  const { name } = useLocalSearchParams<{ name: string }>();
  return <Placeholder title="Group" detail={name} />;
}
