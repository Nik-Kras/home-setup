import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Card, PersonDisc, Sub, Title } from '../../components/ui';
import { useStore } from '../../data/store';
import { budgetView, gbp, type BudgetRoomRow } from '../../domain/budgetView';
import { colors, fonts, personColor } from '../../theme/tokens';

function RoomBar({ row }: { row: BudgetRoomRow }) {
  return (
    <View style={{ gap: 6 }} accessible accessibilityLabel={`${row.room}, ${row.label}`}>
      <View style={s.barRow}><Text style={s.barLabel}>{row.room}</Text><Text style={s.barValue}>{row.label}</Text></View>
      <View style={s.track}><View style={[s.fill, { width: `${row.fill * 100}%`, backgroundColor: colors.textSecondary }]} /></View>
    </View>
  );
}

/** Everything here is derived from the prices entered on items; there is nothing to type on this screen. */
export default function Budget() {
  const { items } = useStore();
  const b = budgetView(items);

  return (
    <Screen header={<View><Title>Budget</Title><Sub>Worked out from the prices you enter</Sub></View>}>
      <Card style={s.hero}>
        <Text style={s.label}>Spent so far</Text>
        <Text style={s.big}>{gbp(b.spent)}<Text style={s.of}>  of {gbp(b.estimatedTotal)}</Text></Text>
        <View style={s.track} accessible accessibilityLabel={`${b.percent} percent of the estimate spent`}><View style={[s.fill, { width: `${b.percent}%`, backgroundColor: colors.mint }]} /></View>
      </Card>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Card style={{ flex: 1, gap: 2 }}><Text style={s.label}>Still to buy</Text><Text style={s.mid}>{gbp(b.toBuy)}</Text></Card>
        <Card style={{ flex: 1, gap: 2 }}><Text style={s.label}>Estimated total</Text><Text style={s.mid}>{gbp(b.estimatedTotal)}</Text></Card>
      </View>
      <Card style={{ gap: 12 }}>
        <Text style={s.label}>Who paid</Text>
        {/* Only the neutral track until someone has paid, so an empty budget never looks split. */}
        <View style={[s.split, b.split.length === 0 && s.splitEmpty]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {b.split.map(({ person, share }) => <View key={person} style={{ flex: share, backgroundColor: personColor[person], borderRadius: 7 }} />)}
        </View>
        {b.splitNote ? (
          <Text style={s.note}>{b.splitNote}</Text>
        ) : (
          <View style={s.barRow}>
            {(['nikita', 'daryna'] as const).map((p) => (
              <View key={p} style={s.legend}>
                <PersonDisc person={p} size={18} />
                <Text style={s.barLabel}>{p === 'nikita' ? 'Nikita' : 'Daryna'} {gbp(b.byPerson[p])}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>
      {b.rooms.length > 0 ? (
        <Card style={{ gap: 12 }}>
          <Text style={s.label}>By room</Text>
          {b.rooms.map((row) => <RoomBar key={row.room} row={row} />)}
        </Card>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { gap: 8, backgroundColor: colors.surfaceRaised, borderColor: 'rgba(94,224,184,0.32)' },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  big: { fontFamily: fonts.serif, fontSize: 48, lineHeight: 52, color: colors.text },
  of: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary },
  mid: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 36, color: colors.text },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: 8 },
  split: { flexDirection: 'row', height: 14, gap: 3 },
  splitEmpty: { borderRadius: 7, backgroundColor: colors.track },
  barRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  barLabel: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  barValue: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  note: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary },
});
