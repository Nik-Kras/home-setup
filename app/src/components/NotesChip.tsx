import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useStore } from '../data/store';
import { toConfirmCount } from '../domain/notes';
import { colors, fonts, radius, TARGET } from '../theme/tokens';

/** Chip on the Tasks screen that opens Flat notes, with the number still to confirm. */
export function NotesChip() {
  const { notes } = useStore();
  const n = toConfirmCount(notes);
  return (
    <Pressable onPress={() => router.push('/notes')} accessibilityRole="button" accessibilityLabel={`Flat notes, ${n} to confirm`} style={s.chip}>
      <Text style={s.text}>
        Flat notes{n > 0 ? <Text style={s.count}>  {n} to confirm</Text> : null}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  chip: { alignSelf: 'flex-start', minHeight: TARGET + 4, paddingHorizontal: 18, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', marginTop: 8 },
  text: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  count: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
});
