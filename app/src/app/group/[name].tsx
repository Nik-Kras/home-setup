import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NAME, TaskRow } from '../../components/TaskRow';
import { Icon, Sub, Title } from '../../components/ui';
import { useStore } from '../../data/store';
import { groupTasks } from '../../domain/taskOptions';
import type { Person, Task } from '../../domain/types';
import { colors, fonts, TARGET } from '../../theme/tokens';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** One task group: progress, the viewer's open tasks, and their done ones collapsed at the end. */
export default function GroupDetail() {
  const params = useLocalSearchParams<{ name: string; person?: string }>();
  const name = one(params.name) ?? '';
  const { tasks, me, setTaskStatus } = useStore();
  const insets = useSafeAreaInsets();
  const p = one(params.person);
  const person: Person = p === 'nikita' || p === 'daryna' ? p : me;
  const [showDone, setShowDone] = useState(false);

  const { open, done } = groupTasks(tasks, name, person);
  const total = open.length + done.length;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/tasks'));
  const add = () => router.push({ pathname: '/add-task', params: { group: name, who: person === me ? 'me' : 'other' } });
  const toggle = (id: string) => (who: Person, isDone: boolean) => setTaskStatus(id, who, isDone ? 'done' : 'todo');

  const card = (list: Task[], label: string) => (
    <View style={s.card} accessibilityLabel={label}>
      {list.map((t, i) => (
        <Fragment key={t.id}>
          {i > 0 ? <View style={s.divider} /> : null}
          <TaskRow task={t} viewer={person} me={me} onToggle={toggle(t.id)} plain />
        </Fragment>
      ))}
    </View>
  );

  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      <View style={s.head}>
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back to tasks" style={s.iconBtn}>
          <Icon name="back" size={24} color={colors.text} stroke={2} />
        </Pressable>
        <Pressable onPress={add} accessibilityRole="button" accessibilityLabel={`Add a task to ${name}`} style={[s.iconBtn, s.addBtn]}>
          <Icon name="plus" size={22} color={colors.onMint} stroke={2.6} />
        </Pressable>
      </View>

      <View style={s.titleBlock}>
        <Title>{name}</Title>
        {person !== me ? <Sub>{NAME[person]}&apos;s tasks</Sub> : null}
        <View style={s.progressLine}>
          <View style={s.track} accessible accessibilityRole="progressbar" accessibilityLabel={`${done.length} of ${total} done`} accessibilityValue={{ min: 0, max: Math.max(total, 1), now: done.length }}>
            <View style={[s.fill, { width: `${total ? (done.length / total) * 100 : 0}%` }]} />
          </View>
          <Text style={s.count} importantForAccessibility="no" accessibilityElementsHidden>{done.length} of {total}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]}>
        {open.length > 0 ? card(open, `${name}, open tasks`) : null}
        {total === 0 ? <Text style={s.empty}>No tasks here yet.</Text> : null}
        {total > 0 && open.length === 0 ? <Text style={s.empty}>All done in this group.</Text> : null}
        {done.length > 0 ? (
          <Pressable onPress={() => setShowDone((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showDone }} accessibilityLabel={`Done, ${done.length}`} style={s.doneToggle}>
            <Text style={s.doneText}>Done <Text style={s.doneCount}>{done.length}</Text></Text>
            <View style={{ transform: [{ rotate: showDone ? '90deg' : '-90deg' }] }}>
              <Icon name="back" size={18} color={colors.textSecondary} stroke={2} />
            </View>
          </Pressable>
        ) : null}
        {showDone && done.length > 0 ? card(done, `${name}, done tasks`) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, paddingLeft: 8, paddingRight: 20 },
  iconBtn: { width: TARGET, height: TARGET, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  addBtn: { backgroundColor: colors.mint },
  titleBlock: { paddingTop: 2, paddingHorizontal: 20, paddingBottom: 10 },
  progressLine: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.mint },
  count: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  body: { paddingHorizontal: 16, gap: 10 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, borderRadius: 22, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  doneToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: TARGET, paddingHorizontal: 4, marginTop: 2 },
  doneText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  doneCount: { fontFamily: fonts.regular, color: colors.textMuted },
  empty: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, padding: 16 },
});
