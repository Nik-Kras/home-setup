import { Redirect } from 'expo-router';

export default function AddItemLink() {
  return <Redirect href={{ pathname: '/', params: { focusAdd: '1' } }} />;
}
