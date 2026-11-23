import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BudgetTrend, WeekSpend } from '../../components/BudgetTrend';
import { ListGate } from '../../components/LoadState';
import { Screen } from '../../components/Screen';
import { Card, PersonDot, Sub, Title } from '../../components/ui';
import { roomTone } from '../../domain/glyphs';
import { useStore } from '../../data/store';
import { budgetView, gbp, type BudgetRoomRow } from '../../domain/budgetView';
import { localDay, spendTrend } from '../../domain/spendTrend';
import { colors, fonts, glow, personColor, tileTone } from '../../theme/tokens';

/** Spend with no buyer: a neutral segment, as nobody's colour applies. */
const UNASSIGNED = 'rgba(255,255,255,0.38)';

/** Each room's bar in its category colour, as in the design; rooms without one ("Other") stay grey. */
function RoomBar({ row }: { row: BudgetRoomRow }) {
  const tone = roomTone(row.room);
  const fill = tone === 'neutral' ? colors.textMuted : tileTone[tone].fg;
  return (
    <View style={{ gap: 6 }} accessible accessibilityLabel={`${row.room}, ${row.label}`}>
      <View style={s.barRow}><Text style={s.barLabel}>{row.room}</Text><Text style={s.barValue}>{row.label}</Text></View>
      <View style={s.track}><View style={[s.fill, { width: `${row.fill * 100}%`, backgroundColor: fill }]} /></View>
    </View>
  );
}

/** Everything here is derived from the prices entered on items; there is nothing to type on this screen. */
export default function Budget() {
  const { items } = useStore();
  const b = useMemo(() => budgetView(items), [items]);
  const trend = useMemo(() => spendTrend(items, localDay(new Date())), [items]);

  return (
    <Screen header={<View><Title>Budget</Title><Sub>Worked out from the prices you enter</Sub></View>}>
      <ListGate count={items.length}>
        <Card style={s.hero}>
          <View style={s.heroTop}><Text style={s.label}>Spent so far</Text><WeekSpend trend={trend} /></View>
          <Text style={s.big}>{gbp(b.spent)}<Text style={s.of}>  of {gbp(b.estimatedTotal)}</Text></Text>
          <View style={s.track} accessible accessibilityLabel={`${b.percent} percent of the estimate spent`}><View style={[s.fill, { width: `${b.percent}%`, backgroundColor: colors.mint }]} /></View>
          <BudgetTrend trend={trend} />
        </Card>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Card style={{ flex: 1, gap: 2 }}><Text style={s.label}>Still to buy</Text><Text style={s.mid}>{gbp(b.toBuy)}</Text></Card>
          <Card style={{ flex: 1, gap: 2 }}><Text style={s.label}>Estimated total</Text><Text style={s.mid}>{gbp(b.estimatedTotal)}</Text></Card>
        </View>
        <Card style={{ gap: 12 }}>
          <Text style={s.label}>Who paid</Text>
          {/* Only the neutral track until someone has paid, so an empty budget never looks split. */}
          <View style={[s.split, b.split.length === 0 && s.splitEmpty]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {b.split.map(({ person, share }) => <View key={person} style={{ flex: share, backgroundColor: person === 'unassigned' ? UNASSIGNED : personColor[person], borderRadius: 7 }} />)}
          </View>
          {b.splitNote ? (
            <Text style={s.note}>{b.splitNote}</Text>
          ) : (
            <View style={s.legendRow}>
              {(['nikita', 'daryna'] as const).map((p) => (
                <View key={p} style={s.legend}>
                  <PersonDot person={p} />
                  <Text style={s.barLabel}>{p === 'nikita' ? 'Nikita' : 'Daryna'} {gbp(b.byPerson[p])}</Text>
                </View>
              ))}
              {/* Spend nobody is recorded as buying, so the shares always add up to Spent. */}
              {b.unassigned > 0 ? (
                <View style={s.legend} accessible accessibilityLabel={`Unassigned ${gbp(b.unassigned)}, no buyer recorded`}>
                  <View style={s.unassignedDot} />
                  <Text style={s.barLabel}>Unassigned {gbp(b.unassigned)}</Text>
                </View>
              ) : null}
            </View>
          )}
        </Card>
        {b.rooms.length > 0 ? (
          <Card style={{ gap: 12 }}>
            <Text style={s.label}>By room</Text>
            {b.rooms.map((row) => <RoomBar key={row.room} row={row} />)}
          </Card>
        ) : null}
      </ListGate>
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { gap: 8, ...glow },
  heroTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  label: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 16, color: colors.textSecondary },
  big: { fontFamily: fonts.serif, fontSize: 48, lineHeight: 50, color: colors.text, fontVariant: ['tabular-nums'] },
  of: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary },
  mid: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 36, color: colors.text, fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: 8 },
  split: { flexDirection: 'row', height: 14, gap: 3 },
  splitEmpty: { borderRadius: 7, backgroundColor: colors.track },
  barRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  barLabel: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 18, color: colors.text, fontVariant: ['tabular-nums'] },
  barValue: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', columnGap: 16, rowGap: 6 },
  unassignedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: UNASSIGNED },
  note: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary },
});
