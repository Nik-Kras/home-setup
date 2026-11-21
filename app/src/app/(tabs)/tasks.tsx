import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { CheckCircle, Icon, PersonDisc, SectionHeading, Segmented, StatusChip, Sub, Title, UrgentBadge } from '../../components/ui';
import { useStore } from '../../data/store';
import { assignmentFor, daysLeft, isShared, openTasksSorted, sharedTasks, tasksFor, waitingOn } from '../../domain/tasks';
import type { Person, Task } from '../../domain/types';
import { colors, fonts, radius, TARGET } from '../../theme/tokens';

type View_ = 'nikita' | 'daryna' | 'both';
const NAME: Record<Person, string> = { nikita: 'Nikita', daryna: 'Daryna' };
const TODAY = () => new Date().toISOString().slice(0, 10);

function dueLabel(due: string): { text: string; tone: 'coral' | 'amber' | 'neutral' } {
  const d = daysLeft(due, TODAY());
  if (d < 0) return { text: 'Overdue', tone: 'coral' };
  if (d === 0) return { text: 'Today', tone: 'coral' };
  if (d <= 7) return { text: `${d} days`, tone: 'amber' };
  return { text: new Date(`${due}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }), tone: 'neutral' };
}

function TaskRow({ task, viewer, me, onToggle }: { task: Task; viewer: Person | null; me: Person; onToggle: (p: Person, done: boolean) => void }) {
  const shared = isShared(task);
  const subject = viewer ?? me;
  const mine = assignmentFor(task, subject);
  const canTick = mine !== undefined && subject === me;
  const wait = waitingOn(task);
  const meta = shared
    ? task.assignments.map((a) => `${a.person === me ? 'You' : NAME[a.person]}: ${a.status === 'done' ? 'done' : a.status === 'in_progress' ? 'in progress' : wait.includes(a.person) ? 'waiting' : 'to do'}`).join(' · ')
    : task.group ?? '';
  const due = task.due ? dueLabel(task.due) : undefined;
  return (
    <View style={s.row}>
      <CheckCircle done={mine?.status === 'done'} label={`${mine?.status === 'done' ? 'Mark not done' : 'Mark done'}: ${task.title}`} onPress={canTick ? () => onToggle(subject, mine?.status !== 'done') : undefined} />
      <Pressable onPress={() => router.push(`/task/${task.id}`)} accessibilityRole="button" accessibilityLabel={`Open ${task.title}`} style={s.mid}>
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

function AddTaskBar({ onAdd }: { onAdd: (title: string, both: boolean) => void }) {
  const [text, setText] = useState('');
  const [both, setBoth] = useState(false);
  const ref = useRef<ComponentRef<typeof TextInput>>(null);
  const submit = () => {
    if (!text.trim()) return;
    onAdd(text, both);
    setText('');
    ref.current?.focus();
  };
  return (
    <View style={{ gap: 8, marginVertical: 4 }}>
      <View style={s.addBar}>
        <TextInput ref={ref} value={text} onChangeText={setText} onSubmitEditing={submit} submitBehavior="submit" returnKeyType="done" placeholder="Add a task..." placeholderTextColor={colors.textSecondary} accessibilityLabel="Add a task" style={s.addInput} />
        <Pressable onPress={submit} accessibilityRole="button" accessibilityLabel="Add task" style={s.addBtn}><Icon name="plus" size={20} color={colors.onMint} stroke={2.6} /></Pressable>
      </View>
      <Pressable onPress={() => setBoth((v) => !v)} accessibilityRole="switch" accessibilityState={{ checked: both }} accessibilityLabel="Each of us does it" style={s.toggle}>
        <View style={[s.box, both && s.boxOn]}>{both ? <Icon name="check" size={13} color={colors.onMint} stroke={3.5} /> : null}</View>
        <Text style={s.toggleText}>Each of us does it, and ticks it separately</Text>
      </Pressable>
    </View>
  );
}

export default function Tasks() {
  const { tasks, me, addTask, setTaskStatus } = useStore();
  const [view, setView] = useState<View_>('nikita');
  const other: Person = me === 'nikita' ? 'daryna' : 'nikita';

  const list = view === 'both' ? sharedTasks(tasks) : openTasksSorted(tasks, view);
  const urgent = list.filter((t) => t.urgent);
  const rest = list.filter((t) => !t.urgent);
  const open = (p: Person) => openTasksSorted(tasks, p).length;
  const viewer = view === 'both' ? null : view;

  const toggle = (id: string) => (p: Person, done: boolean) => setTaskStatus(id, p, done ? 'done' : 'todo');

  return (
    <Screen
      header={
        <View style={{ gap: 10 }}>
          <View>
            <Title>Tasks</Title>
            <Sub>{view === 'both' ? 'Shared tasks' : `${NAME[view]}'s list`} · {list.length} open</Sub>
          </View>
          <Segmented<View_>
            value={view}
            onChange={setView}
            options={[
              { value: me, label: 'Mine', count: open(me) },
              { value: other, label: NAME[other], count: open(other) },
              { value: 'both', label: 'Both', count: sharedTasks(tasksFor(tasks, me)).length },
            ]}
          />
        </View>
      }
    >
      <AddTaskBar onAdd={(title, both) => addTask(title, both ? ['nikita', 'daryna'] : [view === 'both' ? me : view])} />
      {urgent.length > 0 ? <SectionHeading meta={`${urgent.length}`}>Most urgent</SectionHeading> : null}
      {urgent.map((t) => <TaskRow key={t.id} task={t} viewer={viewer} me={me} onToggle={toggle(t.id)} />)}
      {rest.length > 0 ? <SectionHeading>{view === 'both' ? 'Each of you ticks it' : 'Next up'}</SectionHeading> : null}
      {rest.map((t) => <TaskRow key={t.id} task={t} viewer={viewer} me={me} onToggle={toggle(t.id)} />)}
      {list.length === 0 ? <Text style={s.empty}>Nothing open here.</Text> : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 58, paddingVertical: 6, paddingLeft: 4, paddingRight: 12, backgroundColor: colors.surface, borderRadius: radius.row, borderWidth: 1, borderColor: colors.hairline },
  mid: { flex: 1, gap: 1, alignSelf: 'stretch', justifyContent: 'center' },
  nameLine: { flexDirection: 'row', alignItems: 'center' },
  name: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 20, color: colors.text, flexShrink: 1 },
  meta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  due: { height: 28, paddingHorizontal: 10, borderRadius: 14, justifyContent: 'center', backgroundColor: colors.neutralFill },
  dueText: { fontFamily: fonts.medium, fontSize: 13, color: '#D5DBD7' },
  addBar: { flexDirection: 'row', alignItems: 'center', height: 54, borderRadius: 27, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: colors.surface, paddingLeft: 18, paddingRight: 5 },
  addInput: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.text, height: '100%' },
  addBtn: { width: TARGET, height: TARGET, borderRadius: 22, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: TARGET, paddingHorizontal: 4 },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.mint, borderColor: colors.mint },
  toggleText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, flexShrink: 1 },
  empty: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, padding: 16 },
});
