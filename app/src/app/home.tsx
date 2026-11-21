import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Icon, PersonDisc, Sub, Title, glyphFor } from '../components/ui';
import { useStore } from '../data/store';
import { isItemDone } from '../domain/items';
import { colors, fonts, radius } from '../theme/tokens';

/** Inventory of what is in place. Photos replace the glyphs once added (phase 3). */
export default function Home() {
  const { items } = useStore();
  const placed = items.filter(isItemDone);
  return (
    <Screen header={<View><Title>Home</Title><Sub>{placed.length} things in place</Sub></View>}>
      <View style={s.grid}>
        {placed.map((i) => (
          <View key={i.id} style={s.card} accessible accessibilityLabel={`${i.name}, ${i.room ?? 'no room'}`}>
            <View style={s.glyph}><Icon name={glyphFor(i.name)} size={56} color={colors.textSecondary} stroke={1.2} /></View>
            <View style={s.cap}>
              <Text style={s.name} numberOfLines={1}>{i.name}</Text>
              <View style={s.metaLine}>
                {i.boughtBy ? <PersonDisc person={i.boughtBy} size={16} /> : null}
                <Text style={s.meta}>{i.room ?? 'No room'}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '48.5%', aspectRatio: 1 / 1.02, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.neutralFill, borderWidth: 1, borderColor: colors.hairline, justifyContent: 'flex-end' },
  glyph: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 64, alignItems: 'center', justifyContent: 'center' },
  cap: { padding: 12, paddingTop: 28, backgroundColor: 'rgba(14,17,16,0.72)', gap: 2 },
  name: { fontFamily: fonts.serif, fontSize: 21, lineHeight: 24, color: colors.text },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: '#D5DBD7' },
});
