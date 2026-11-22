import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dayMonth, dueLabel, localDate } from '../domain/taskOptions';
import { assignmentFor, isShared, waitingOn } from '../domain/tasks';
import type { Person, Task } from '../domain/types';
import { colors, fonts, radius } from '../theme/tokens';
import { CheckCircle, PersonDisc, StatusChip, UrgentBadge } from './ui';

export const NAME: Record<Person, string> = { nikita: 'Nikita', daryna: 'Daryna' };

/**
 * One task with its check circle. `plain` drops the row's own surface so it can sit inside a card
 * (the group screen), and shows who it is for (and the due date) instead of the group name, which the
 * screen title already says.
 */
export function TaskRow({ task, viewer, me, onToggle, plain = false }: { task: Task; viewer: Person | null; me: Person; onToggle: (p: Person, done: boolean) => void; plain?: boolean }) {
  const shared = isShared(task);
  const subject = viewer ?? me;
  const mine = assignmentFor(task, subject);
  const canTick = mine !== undefined && subject === me;
  const wait = waitingOn(task);
  const due = task.due ? dueLabel(task.due, localDate()) : undefined;
  // In a group the chip says "Tomorrow" or "3 days"; the subtitle adds the date itself (the chip already shows far dates).
  const forWhom = [subject === me ? 'For you' : `For ${NAME[subject]}`, task.due && due?.tone !== 'neutral' ? `due ${dayMonth(task.due)}` : null].filter(Boolean).join(' · ');
  const meta = shared
    ? task.assignments.map((a) => `${a.person === me ? 'You' : NAME[a.person]}: ${a.status === 'done' ? 'done' : a.status === 'in_progress' ? 'in progress' : wait.includes(a.person) ? 'waiting' : 'to do'}`).join(' · ')
    : plain ? forWhom : task.group ?? '';
  const status = !shared && mine && mine.status !== 'todo' ? (mine.status === 'done' ? 'done' : mine.status === 'in_progress' ? 'in progress' : 'waiting') : null;
  const label = [task.title, task.urgent ? 'Urgent' : null, meta || null, status, due ? `due ${due.text}` : null].filter(Boolean).join(', ');
  return (
    <View style={[s.row, plain && s.plain]}>
      <CheckCircle done={mine?.status === 'done'} label={`${mine?.status === 'done' ? 'Mark not done' : 'Mark done'}: ${task.title}`} onPress={canTick ? () => onToggle(subject, mine?.status !== 'done') : undefined} />
      <Pressable onPress={() => router.push(`/task/${task.id}`)} accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Opens details" style={s.mid}>
        <View style={s.nameLine}><Text style={s.name} numberOfLines={2}>{task.title}</Text>{task.urgent ? <UrgentBadge /> : null}</View>
        {meta ? <Text style={s.meta} numberOfLines={1}>{meta}</Text> : null}
      </Pressable>
      <View style={s.side}>
        {due ? (
          // Coral for overdue or due today; any other date is a neutral chip (amber means in transit only).
          <View style={[s.due, due.tone === 'coral' && { backgroundColor: colors.coralFill }]}>
            <Text style={[s.dueText, due.tone === 'coral' && { color: colors.coral }]} numberOfLines={1}>{due.text}</Text>
          </View>
        ) : !shared && mine && mine.status !== 'todo' ? <StatusChip status={mine.status} /> : null}
        {shared ? (
          <View style={{ flexDirection: 'row' }}>
            {task.assignments.map((a, i) => <View key={a.person} style={{ marginLeft: i ? -6 : 0 }}><PersonDisc person={a.person} done={a.status === 'done'} /></View>)}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 58, paddingVertical: 6, paddingLeft: 4, paddingRight: 12, backgroundColor: colors.surface, borderRadius: radius.row, borderWidth: 1, borderColor: colors.hairline },
  plain: { backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0, minHeight: 56, paddingRight: 14 },
  mid: { flex: 1, gap: 1, alignSelf: 'stretch', justifyContent: 'center' },
  nameLine: { flexDirection: 'row', alignItems: 'center' },
  name: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 20, color: colors.text, flexShrink: 1 },
  meta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  side: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  due: { minHeight: 28, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.09)' },
  dueText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.text },
});
