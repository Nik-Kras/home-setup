import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { assignmentFor, daysLeft, isShared, waitingOn } from '../domain/tasks';
import type { Person, Task } from '../domain/types';
import { colors, fonts, radius } from '../theme/tokens';
import { CheckCircle, PersonDisc, StatusChip, UrgentBadge } from './ui';

export const NAME: Record<Person, string> = { nikita: 'Nikita', daryna: 'Daryna' };
const TODAY = () => new Date().toISOString().slice(0, 10);

function dueLabel(due: string): { text: string; tone: 'coral' | 'amber' | 'neutral' } {
  const d = daysLeft(due, TODAY());
  if (d < 0) return { text: 'Overdue', tone: 'coral' };
  if (d === 0) return { text: 'Today', tone: 'coral' };
  if (d <= 7) return { text: `${d} days`, tone: 'amber' };
  return { text: new Date(`${due}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }), tone: 'neutral' };
}

/**
 * One task with its check circle. `plain` drops the row's own surface so it can sit inside a card
 * (the group screen), and leaves out the group name, which the screen title already says.
 */
export function TaskRow({ task, viewer, me, onToggle, plain = false }: { task: Task; viewer: Person | null; me: Person; onToggle: (p: Person, done: boolean) => void; plain?: boolean }) {
  const shared = isShared(task);
  const subject = viewer ?? me;
  const mine = assignmentFor(task, subject);
  const canTick = mine !== undefined && subject === me;
  const wait = waitingOn(task);
  const meta = shared
    ? task.assignments.map((a) => `${a.person === me ? 'You' : NAME[a.person]}: ${a.status === 'done' ? 'done' : a.status === 'in_progress' ? 'in progress' : wait.includes(a.person) ? 'waiting' : 'to do'}`).join(' · ')
    : plain ? '' : task.group ?? '';
  const due = task.due ? dueLabel(task.due) : undefined;
  const status = !shared && mine && mine.status !== 'todo' ? (mine.status === 'done' ? 'done' : mine.status === 'in_progress' ? 'in progress' : 'waiting') : null;
  const label = [task.title, task.urgent ? 'Urgent' : null, meta || null, status, due ? `due ${due.text}` : null].filter(Boolean).join(', ');
  return (
    <View style={[s.row, plain && s.plain]}>
      <CheckCircle done={mine?.status === 'done'} label={`${mine?.status === 'done' ? 'Mark not done' : 'Mark done'}: ${task.title}`} onPress={canTick ? () => onToggle(subject, mine?.status !== 'done') : undefined} />
      <Pressable onPress={() => router.push(`/task/${task.id}`)} accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Opens details" style={s.mid}>
        <View style={s.nameLine}><Text style={s.name} numberOfLines={2}>{task.title}</Text>{task.urgent ? <UrgentBadge /> : null}</View>
        {meta ? <Text style={s.meta} numberOfLines={1}>{meta}</Text> : null}
      </Pressable>
      {shared ? (
        <View style={{ flexDirection: 'row' }}>
          {task.assignments.map((a, i) => <View key={a.person} style={{ marginLeft: i ? -6 : 0 }}><PersonDisc person={a.person} done={a.status === 'done'} /></View>)}
        </View>
      ) : due ? (
        <View style={[s.due, due.tone === 'coral' && { backgroundColor: colors.coralFill }, due.tone === 'amber' && { backgroundColor: colors.amberFill }]}>
          <Text style={[s.dueText, due.tone === 'coral' && { color: colors.coral }, due.tone === 'amber' && { color: colors.amber }]}>{due.text}</Text>
        </View>
      ) : mine && mine.status !== 'todo' ? <StatusChip status={mine.status} /> : null}
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
  due: { height: 28, paddingHorizontal: 10, borderRadius: 14, justifyContent: 'center', backgroundColor: colors.neutralFill },
  dueText: { fontFamily: fonts.medium, fontSize: 13, color: '#D5DBD7' },
});
