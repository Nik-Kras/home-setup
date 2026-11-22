import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { trendPath, type SpendTrend } from '../domain/spendTrend';
import { gbp } from '../domain/budgetView';
import { colors, fonts } from '../theme/tokens';

const HEIGHT = 30;
const short = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** "+£120 this week" beside "Spent so far"; nothing when nothing was paid in the last 7 days. */
export function WeekSpend({ trend }: { trend: SpendTrend }) {
  return trend.thisWeek > 0 ? <Text style={s.week}>+{gbp(trend.thisWeek)} this week</Text> : null;
}

/** Spending since the first paid item, as in Budget.png: a mint line over a soft fill, "1 Oct" to "today". */
export function BudgetTrend({ trend }: { trend: SpendTrend }) {
  const [width, setWidth] = useState(0);
  if (!trend.start || trend.points.length === 0) return null;
  const { line, area } = trendPath(trend.points, width, HEIGHT);
  const rising = trend.points.at(-1)!.total > 0;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Spending since ${short(trend.start)}${rising ? ', rising' : ''}`}>
      <View style={s.chart} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.mint} stopOpacity={0.3} />
                <Stop offset="1" stopColor={colors.mint} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={area} fill="url(#trendFill)" />
            <Path d={line} fill="none" stroke={colors.mint} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        ) : null}
      </View>
      <View style={s.axis}>
        <Text style={s.axisText}>{short(trend.start)}</Text>
        <Text style={s.axisText}>today</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  chart: { height: HEIGHT, marginTop: 2 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  axisText: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  week: { fontFamily: fonts.medium, fontSize: 13, color: colors.mint },
});
