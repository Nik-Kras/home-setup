import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Card, PersonDisc, Sub, Title } from '../components/ui';
import { useStore } from '../data/store';
import { budget } from '../domain/items';
import { colors, fonts, personColor } from '../theme/tokens';

const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={s.barRow}><Text style={s.barLabel}>{label}</Text><Text style={s.barValue}>{gbp(value)}</Text></View>
      <View style={s.track} accessible accessibilityLabel={`${label} ${gbp(value)}`}><View style={[s.fill, { width: `${max === 0 ? 0 : Math.max((value / max) * 100, 2)}%`, backgroundColor: color }]} /></View>
    </View>
  );
}

/** Everything here is derived from the prices entered on items; there is nothing to type on this screen. */
export default function Budget() {
  const { items } = useStore();
  const b = budget(items);
  const people = (['nikita', 'daryna'] as const).map((p) => ({ p, v: b.byPerson[p] }));
  const rooms = Object.entries(b.byRoom).sort((a, c) => c[1] - a[1]);
  const maxRoom = Math.max(0, ...rooms.map(([, v]) => v));
  const pct = b.estimatedTotal === 0 ? 0 : Math.round((b.spent / b.estimatedTotal) * 100);

  return (
    <Screen header={<View><Title>Budget</Title><Sub>Worked out from the prices you enter</Sub></View>}>
      <Card style={s.hero}>
        <Text style={s.label}>Spent so far</Text>
        <Text style={s.big}>{gbp(b.spent)}<Text style={s.of}>  of {gbp(b.estimatedTotal)}</Text></Text>
        <View style={s.track} accessible accessibilityLabel={`${pct} percent of the estimate spent`}><View style={[s.fill, { width: `${pct}%`, backgroundColor: colors.mint }]} /></View>
      </Card>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Card style={{ flex: 1, gap: 2 }}><Text style={s.label}>Still to buy</Text><Text style={s.mid}>{gbp(b.toBuy)}</Text></Card>
        <Card style={{ flex: 1, gap: 2 }}><Text style={s.label}>Estimated total</Text><Text style={s.mid}>{gbp(b.estimatedTotal)}</Text></Card>
      </View>
      <Card style={{ gap: 12 }}>
        <Text style={s.label}>Who paid</Text>
        <View style={s.split}>
          {people.map(({ p, v }) => <View key={p} style={{ flex: Math.max(v, 1), backgroundColor: personColor[p], borderRadius: 7 }} />)}
        </View>
        <View style={s.barRow}>
          {people.map(({ p, v }) => <View key={p} style={s.legend}><PersonDisc person={p} size={18} /><Text style={s.barLabel}>{p === 'nikita' ? 'Nikita' : 'Daryna'} {gbp(v)}</Text></View>)}
        </View>
      </Card>
      <Card style={{ gap: 12 }}>
        <Text style={s.label}>By room</Text>
        {rooms.map(([room, v]) => <Bar key={room} label={room} value={v} max={maxRoom} color={colors.textSecondary} />)}
      </Card>
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
  barRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barLabel: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  barValue: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
