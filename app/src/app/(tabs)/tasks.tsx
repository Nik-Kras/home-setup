import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { DeadlineCard } from '../../components/DeadlineCard';
import { NotesChip } from '../../components/NotesChip';
import { Screen } from '../../components/Screen';
import { GroupChips } from '../../components/GroupChips';
import { NAME, TaskRow } from '../../components/TaskRow';
import { Icon, SectionHeading, Segmented, Sub, Title } from '../../components/ui';
import { useStore } from '../../data/store';
import { focusTask } from '../../domain/focus';
import { addedSince, groupsFor, localDate } from '../../domain/taskOptions';
import { openTasksSorted, sharedTasks, tasksFor } from '../../domain/tasks';
import type { Person } from '../../domain/types';
import { colors, fonts, TARGET } from '../../theme/tokens';

type View_ = 'nikita' | 'daryna' | 'both';

/** The typed text lives with the screen, so "More options" can keep it until a task is really added. */
function AddTaskBar({ text, setText, placeholder, onAdd, onMore }: { text: string; setText: (t: string) => void; placeholder: string; onAdd: (title: string) => void; onMore: (title: string) => void }) {
  const ref = useRef<ComponentRef<typeof TextInput>>(null);
  const submit = () => {
    if (!text.trim()) return;
    onAdd(text);
    setText('');
    ref.current?.focus();
  };
  return (
    <View style={{ gap: 6, marginVertical: 4 }}>
      <View style={s.addBar}>
        <TextInput ref={ref} value={text} onChangeText={setText} onSubmitEditing={submit} submitBehavior="submit" returnKeyType="done" placeholder={placeholder} placeholderTextColor={colors.textSecondary} accessibilityLabel="Add a task" style={s.addInput} />
        <Pressable onPress={submit} accessibilityRole="button" accessibilityLabel="Add task" style={s.addBtn}><Icon name="plus" size={20} color={colors.onMint} stroke={2.6} /></Pressable>
      </View>
      <Pressable onPress={() => onMore(text.trim())} accessibilityRole="button" accessibilityLabel="More options" accessibilityHint="Due date, group, who and urgent" hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }} style={s.more}>
        <Text style={s.moreText}>More options</Text>
      </Pressable>
    </View>
  );
}

export default function Tasks() {
  const { tasks, me, addTask, setTaskStatus } = useStore();
  const [view, setView] = useState<View_>('nikita');
  const other: Person = me === 'nikita' ? 'daryna' : 'nikita';

  const list = view === 'both' ? sharedTasks(tasks) : openTasksSorted(tasks, view);
  const viewer = view === 'both' ? null : view;
  // The deadline card shows one task; the rows below leave it out so it is not listed twice.
  const focus = focusTask(list, viewer);
  const urgent = list.filter((t) => t.urgent && t !== focus);
  const rest = list.filter((t) => !t.urgent && t !== focus);
  const open = (p: Person) => openTasksSorted(tasks, p).length;

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
  // "Each of us" lives in the add-task screen; the Both view adds shared tasks, so a new one shows where it was typed.
  const openOptions = (title: string) => {
    optionsFrom.current = new Set(tasks.map((t) => t.id));
    router.push({ pathname: '/add-task', params: { title, who: view === 'both' ? 'both' : view === other ? 'other' : 'me' } });
  };
  const quickAdd = (title: string) => {
    optionsFrom.current = null;
    addTask(title, view === 'both' ? [me, other] : [view]);
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
      {focus ? <DeadlineCard task={focus} person={viewer ?? me} today={localDate()} /> : null}
      <AddTaskBar text={text} setText={setText} placeholder={view === 'both' ? 'Add a shared task...' : 'Add a task...'} onAdd={quickAdd} onMore={openOptions} />
      {urgent.length > 0 ? <SectionHeading meta={`${urgent.length}`}>Most urgent</SectionHeading> : null}
      {urgent.map((t) => <TaskRow key={t.id} task={t} viewer={viewer} me={me} onToggle={toggle(t.id)} />)}
      {rest.length > 0 ? <SectionHeading>{view === 'both' ? 'Each of you ticks it' : 'Next up'}</SectionHeading> : null}
      {rest.map((t) => <TaskRow key={t.id} task={t} viewer={viewer} me={me} onToggle={toggle(t.id)} />)}
      {!focus && urgent.length + rest.length === 0 ? <Text style={s.empty}>Nothing open here.</Text> : null}
      <GroupChips groups={groupsFor(tasks, groupPerson)} person={groupPerson}>
        <NotesChip />
      </GroupChips>
    </Screen>
  );
}

const s = StyleSheet.create({
  addBar: { flexDirection: 'row', alignItems: 'center', minHeight: 54, borderRadius: 27, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: colors.surface, paddingLeft: 18, paddingRight: 5, paddingVertical: 4 },
  addInput: { flex: 1, alignSelf: 'stretch', fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  addBtn: { width: TARGET, height: TARGET, borderRadius: 22, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  more: { alignSelf: 'flex-end', paddingVertical: 7, paddingHorizontal: 10 },
  moreText: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18, color: colors.mint },
  empty: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, padding: 16 },
});
