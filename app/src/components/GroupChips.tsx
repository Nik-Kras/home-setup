import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { groupToParam, type GroupSummary } from '../domain/taskOptions';
import type { Person } from '../domain/types';
import { colors, fonts, TARGET } from '../theme/tokens';

/** Row of task-group chips (name and open count) on the Tasks screen. Each opens the group screen. */
export function GroupChips({ groups, person }: { groups: GroupSummary[]; person: Person }) {
  if (groups.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row} style={s.scroll} accessibilityLabel="Task groups">
      {groups.map((g) => (
        <Pressable
          key={g.name}
          onPress={() => router.push({ pathname: '/group/[name]', params: { name: groupToParam(g.name), person } })}
          accessibilityRole="button"
          accessibilityLabel={`${g.name}, ${g.open} open`}
          accessibilityHint="Opens the group"
          style={s.chip}
        >
          <Text style={s.name}>{g.name}</Text>
          <Text style={s.count}>{g.open}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { marginTop: 4, marginRight: -16, flexGrow: 0 },
  row: { gap: 8, paddingRight: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, height: TARGET, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: colors.surface },
  name: { fontFamily: fonts.medium, fontSize: 14, color: '#D5DBD7' },
  count: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
});
