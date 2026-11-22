import { Pressable, StyleSheet, Text, View } from 'react-native';
import { togglePersonFilter, type PersonFilter } from '../domain/personFilter';
import type { Person } from '../domain/types';
import { colors, fonts, personColor, TARGET } from '../theme/tokens';

const PEOPLE: { person: Person; letter: string; name: string; fill: string }[] = [
  { person: 'nikita', letter: 'N', name: 'Nikita', fill: colors.mintFill },
  { person: 'daryna', letter: 'D', name: 'Daryna', fill: 'rgba(185,164,255,0.16)' },
];

/**
 * The Buy list's person filter: two 44dp initial discs. Outline when off, tinted fill when on; tapping
 * one shows only that person's items, tapping it again shows everyone.
 */
export function PersonFilterDiscs({ value, onChange }: { value: PersonFilter; onChange: (next: PersonFilter) => void }) {
  return (
    <View style={s.row}>
      {PEOPLE.map(({ person, letter, name, fill }) => {
        const on = value === person;
        const c = personColor[person];
        return (
          <Pressable
            key={person}
            onPress={() => onChange(togglePersonFilter(value, person))}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`Only ${name}'s items`}
            accessibilityHint={on ? 'Shows everyone again' : undefined}
            style={({ pressed }) => [s.disc, { borderColor: c }, on && { backgroundColor: fill }, pressed && s.pressed]}
          >
            <Text style={[s.letter, { color: c }]}>{letter}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  disc: { width: TARGET, height: TARGET, borderRadius: TARGET / 2, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  letter: { fontFamily: fonts.semibold, fontSize: 16 },
  pressed: { opacity: 0.7 },
});
