import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, TARGET } from '../theme/tokens';
import { Icon, Sub, Title } from './ui';

/** Stand-in for a detail screen that a later task fills in. Shows what it received and a way back. */
export function Placeholder({ title, detail }: { title: string; detail?: string }) {
  const insets = useSafeAreaInsets();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back" style={s.back}>
        <Icon name="back" size={24} color={colors.text} stroke={2} />
      </Pressable>
      <View style={s.body}>
        <Title>{title}</Title>
        {detail ? <Sub>{detail}</Sub> : null}
        <Text style={s.note}>Coming soon.</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  back: { width: TARGET, height: TARGET, marginLeft: 8, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, gap: 4 },
  note: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, paddingTop: 12 },
});
