import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { monthGrid } from '../domain/taskOptions';
import { colors, fonts, radius, TARGET } from '../theme/tokens';
import { Icon } from './ui';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const fmt = (day: string, opts: Intl.DateTimeFormatOptions) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });

/** Short label for a picked day, such as "Thu 10 Dec". */
export const shortDate = (day: string) => fmt(day, { weekday: 'short', day: 'numeric', month: 'short' });

/** Bottom sheet with a month calendar. Days before `today` cannot be picked. Plain views, no native module. */
export function DatePickerSheet({ visible, today, value, onPick, onClose }: { visible: boolean; today: string; value?: string; onPick: (day: string) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const start = value ?? today;
  const [ym, setYm] = useState({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) });
  const shift = (n: number) => setYm(({ y, m }) => {
    const t = y * 12 + (m - 1) + n;
    return { y: Math.floor(t / 12), m: (t % 12) + 1 };
  });
  const firstOfMonth = `${ym.y}-${String(ym.m).padStart(2, '0')}-01`;
  const canGoBack = firstOfMonth > `${today.slice(0, 8)}01`; // never page back before this month
  const title = fmt(firstOfMonth, { month: 'long', year: 'numeric' });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close calendar" />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.head}>
            <Pressable onPress={() => shift(-1)} disabled={!canGoBack} accessibilityRole="button" accessibilityLabel="Previous month" accessibilityState={{ disabled: !canGoBack }} style={[s.nav, !canGoBack && { opacity: 0.35 }]}>
              <Icon name="back" size={22} color={colors.text} stroke={2} />
            </Pressable>
            <Text style={s.month} accessibilityRole="header">{title}</Text>
            <Pressable onPress={() => shift(1)} accessibilityRole="button" accessibilityLabel="Next month" style={[s.nav, { transform: [{ rotate: '180deg' }] }]}>
              <Icon name="back" size={22} color={colors.text} stroke={2} />
            </Pressable>
          </View>
          <View style={s.week} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {WEEKDAYS.map((d, i) => <Text key={i} style={s.weekday}>{d}</Text>)}
          </View>
          {monthGrid(ym.y, ym.m).map((week, w) => (
            <View key={w} style={s.week}>
              {week.map((day, i) => {
                if (!day) return <View key={i} style={s.cell} />;
                const past = day < today;
                const on = day === value;
                const isToday = day === today;
                return (
                  <Pressable
                    key={day}
                    onPress={() => onPick(day)}
                    disabled={past}
                    accessibilityRole="button"
                    accessibilityLabel={`${WEEKDAY_NAMES[i]} ${fmt(day, { day: 'numeric', month: 'long' })}${isToday ? ', today' : ''}`}
                    accessibilityState={{ selected: on, disabled: past }}
                    style={s.cell}
                  >
                    <View style={[s.dayDisc, isToday && s.today, on && s.dayOn]}>
                      <Text style={[s.day, past && s.dayPast, on && s.dayTextOn]}>{Number(day.slice(8))}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
          <Pressable onPress={onClose} accessibilityRole="button" style={s.cancel}>
            <Text style={s.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, paddingTop: 12, paddingHorizontal: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  nav: { width: TARGET, height: TARGET, alignItems: 'center', justifyContent: 'center' },
  month: { fontFamily: fonts.serif, fontSize: 21, lineHeight: 24, color: colors.text },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 13, lineHeight: 28, color: colors.textMuted },
  cell: { flex: 1, height: TARGET, alignItems: 'center', justifyContent: 'center' },
  dayDisc: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 1, borderColor: colors.hairlineStrong },
  dayOn: { backgroundColor: colors.mint, borderColor: colors.mint },
  day: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  dayPast: { color: colors.textMuted, opacity: 0.5 },
  dayTextOn: { color: colors.onMint, fontFamily: fonts.semibold },
  cancel: { height: TARGET, marginTop: 8, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.neutralFill },
  cancelText: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
});
