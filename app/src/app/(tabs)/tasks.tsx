import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { NotesChip } from '../../components/NotesChip';
import { Screen } from '../../components/Screen';
import { GroupChips } from '../../components/GroupChips';
import { NAME, TaskRow } from '../../components/TaskRow';
import { Icon, SectionHeading, Segmented, Sub, Title } from '../../components/ui';
import { useStore } from '../../data/store';
import { addedSince, groupsFor } from '../../domain/taskOptions';
import { openTasksSorted, sharedTasks, tasksFor } from '../../domain/tasks';
import type { Person } from '../../domain/types';
import { colors, fonts, TARGET } from '../../theme/tokens';

type View_ = 'nikita' | 'daryna' | 'both';

/** The typed text lives with the screen, so "More options" can keep it until a task is really added. */
function AddTaskBar({ text, setText, onAdd, onMore }: { text: string; setText: (t: string) => void; onAdd: (title: string, both: boolean) => void; onMore: (title: string, both: boolean) => void }) {
  const [both, setBoth] = useState(false);
  const ref = useRef<ComponentRef<typeof TextInput>>(null);
  const submit = () => {
    if (!text.trim()) return;
    onAdd(text, both);
    setText('');
    ref.current?.focus();
  };
  const more = () => onMore(text.trim(), both);
  return (
    <View style={{ gap: 8, marginVertical: 4 }}>
      <View style={s.addBar}>
        <TextInput ref={ref} value={text} onChangeText={setText} onSubmitEditing={submit} submitBehavior="submit" returnKeyType="done" placeholder="Add a task..." placeholderTextColor={colors.textSecondary} accessibilityLabel="Add a task" style={s.addInput} />
        <Pressable onPress={submit} accessibilityRole="button" accessibilityLabel="Add task" style={s.addBtn}><Icon name="plus" size={20} color={colors.onMint} stroke={2.6} /></Pressable>
      </View>
      <View style={s.optionsLine}>
        <Pressable onPress={() => setBoth((v) => !v)} accessibilityRole="switch" accessibilityState={{ checked: both }} accessibilityLabel="Each of us does it" style={s.toggle}>
          <View style={[s.box, both && s.boxOn]}>{both ? <Icon name="check" size={13} color={colors.onMint} stroke={3.5} /> : null}</View>
          <Text style={s.toggleText}>Each of us does it, and ticks it separately</Text>
        </Pressable>
        <Pressable onPress={more} accessibilityRole="button" accessibilityLabel="More options" accessibilityHint="Due date, group, who and urgent" style={s.more}>
          <Text style={s.moreText}>More options</Text>
        </Pressable>
      </View>
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
  const groupPerson = viewer ?? me;
  // "More options" keeps the typed text; it is cleared only once a new task of mine shows up (backing out keeps it).
  const [text, setText] = useState('');
  const optionsFrom = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (optionsFrom.current && addedSince(optionsFrom.current, tasks, me)) {
      optionsFrom.current = null;
      setText('');
    }
  }, [tasks, me]);
  const openOptions = (title: string, both: boolean) => {
    optionsFrom.current = new Set(tasks.map((t) => t.id));
    router.push({ pathname: '/add-task', params: { title, who: both ? 'both' : view === other ? 'other' : 'me' } });
  };
  const quickAdd = (title: string, both: boolean) => {
    optionsFrom.current = null;
    addTask(title, both ? ['nikita', 'daryna'] : [view === 'both' ? me : view]);
  };

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
      <AddTaskBar text={text} setText={setText} onAdd={quickAdd} onMore={openOptions} />
      {urgent.length > 0 ? <SectionHeading meta={`${urgent.length}`}>Most urgent</SectionHeading> : null}
      {urgent.map((t) => <TaskRow key={t.id} task={t} viewer={viewer} me={me} onToggle={toggle(t.id)} />)}
      {rest.length > 0 ? <SectionHeading>{view === 'both' ? 'Each of you ticks it' : 'Next up'}</SectionHeading> : null}
      {rest.map((t) => <TaskRow key={t.id} task={t} viewer={viewer} me={me} onToggle={toggle(t.id)} />)}
      {list.length === 0 ? <Text style={s.empty}>Nothing open here.</Text> : null}
      <GroupChips groups={groupsFor(tasks, groupPerson)} person={groupPerson}>
        <NotesChip />
      </GroupChips>
    </Screen>
  );
}

const s = StyleSheet.create({
  addBar: { flexDirection: 'row', alignItems: 'center', height: 54, borderRadius: 27, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: colors.surface, paddingLeft: 18, paddingRight: 5 },
  addInput: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.text, height: '100%' },
  addBtn: { width: TARGET, height: TARGET, borderRadius: 22, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  optionsLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: TARGET, paddingHorizontal: 4 },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.mint, borderColor: colors.mint },
  toggleText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, flexShrink: 1 },
  more: { minHeight: TARGET, paddingHorizontal: 8, justifyContent: 'center' },
  moreText: { fontFamily: fonts.medium, fontSize: 14, color: colors.mint },
  empty: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, padding: 16 },
});
