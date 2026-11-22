import { router } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { DeadlineCard } from '../../components/DeadlineCard';
import { NotesChip } from '../../components/NotesChip';
import { ListGate, useListState } from '../../components/LoadState';
import { SectionScreen } from '../../components/SectionScreen';
import { GroupChips } from '../../components/GroupChips';
import { NAME, TaskRow } from '../../components/TaskRow';
import { Icon, SectionHeading, Segmented, Sub, Title } from '../../components/ui';
import { useStore } from '../../data/store';
import { focusTask } from '../../domain/focus';
import { addedSince, groupsFor, localDate } from '../../domain/taskOptions';
import { doneTasksFor, openTasksSorted, sharedTasks, tasksFor } from '../../domain/tasks';
import type { Person, Task } from '../../domain/types';
import { colors, fonts, TARGET, personColor } from '../../theme/tokens';

/** Kept relative to the signed-in person, so "Mine" is always theirs whatever `me` is. */
type View_ = 'mine' | 'other' | 'both';
/** The segment values stay person keys, so their test ids are `segment-nikita`, `segment-daryna`, `segment-both`. */
type Segment = Person | 'both';
type TaskSection = { key: string; title: string; meta?: string; data: Task[] };

const DONE = 'done';
const TaskGap = () => <View style={{ height: 8 }} />;

/** Memoised row: `onToggle` is stable and takes the task id, so unchanged rows are not redrawn. */
const Row = memo(function Row({ task, viewer, me, onToggle }: { task: Task; viewer: Person | null; me: Person; onToggle: (id: string, p: Person, done: boolean) => void }) {
  return <TaskRow task={task} viewer={viewer} me={me} onToggle={(p, done) => onToggle(task.id, p, done)} />;
});

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
    <View style={s.addBar}>
      <TextInput ref={ref} value={text} onChangeText={setText} onSubmitEditing={submit} submitBehavior="submit" returnKeyType="done" placeholder={placeholder} placeholderTextColor={colors.textSecondary} accessibilityLabel="Add a task" style={s.addInput} />
      <Pressable onPress={() => onMore(text.trim())} accessibilityRole="button" accessibilityLabel="More options" accessibilityHint="Due date, group, who and urgent" style={({ pressed }) => [s.moreBtn, pressed && { opacity: 0.6 }]}>
        <Icon name="sliders" size={20} color={colors.textSecondary} stroke={2} />
      </Pressable>
      <Pressable onPress={submit} accessibilityRole="button" accessibilityLabel="Add task" style={s.addBtn}><Icon name="plus" size={20} color={colors.onMint} stroke={2.6} /></Pressable>
    </View>
  );
}

export default function Tasks() {
  const { tasks, me, identity, addTask, setTaskStatus } = useStore();
  const [view, setView] = useState<View_>('mine');
  const other: Person = me === 'nikita' ? 'daryna' : 'nikita';
  const viewer = view === 'both' ? null : view === 'mine' ? me : other;
  const ready = useListState(tasks.length) === 'ready';
  const [showDone, setShowDone] = useState(false);

  const { list, focus, sections } = useMemo(() => {
    const list = viewer ? openTasksSorted(tasks, viewer) : sharedTasks(tasks);
    // The deadline card shows one task; the rows below leave it out so it is not listed twice.
    const focus = focusTask(list, viewer);
    const urgent = list.filter((t) => t.urgent && t !== focus);
    const rest = list.filter((t) => !t.urgent && t !== focus);
    const sections: TaskSection[] = [];
    if (urgent.length > 0) sections.push({ key: 'urgent', title: 'Most urgent', meta: urgent.length > 1 ? `${urgent.length} tasks` : undefined, data: urgent });
    if (rest.length > 0) sections.push({ key: 'rest', title: viewer ? 'Next up' : 'Each of you ticks it', data: rest });
    // Finished parts, collapsed, where they can be opened and unticked. The Both view already lists
    // finished shared tasks in place, so it has no Done list.
    const done = viewer ? doneTasksFor(tasks, viewer) : [];
    if (done.length > 0) sections.push({ key: DONE, title: `Done (${done.length})`, meta: String(done.length), data: showDone ? done : [] });
    return { list, focus, sections };
  }, [tasks, viewer, showDone]);
  const counts = useMemo(() => ({
    mine: openTasksSorted(tasks, me).length,
    other: openTasksSorted(tasks, other).length,
    both: sharedTasks(tasksFor(tasks, me)).length,
  }), [tasks, me, other]);

  const toggle = useCallback((id: string, p: Person, done: boolean) => setTaskStatus(id, p, done ? 'done' : 'todo'), [setTaskStatus]);
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
    router.push({ pathname: '/add-task', params: { title, who: view === 'mine' ? 'me' : view } });
  };
  const quickAdd = (title: string) => {
    optionsFrom.current = null;
    addTask(title, viewer ? [viewer] : [me, other]);
  };

  return (
    <SectionScreen<Task, TaskSection>
      header={
        <View style={{ gap: 10 }}>
          <View>
            <Title>Tasks</Title>
            <Sub>{viewer ? `${NAME[viewer]}'s list` : 'Shared tasks'}{ready ? ` · ${list.length} open` : ''}</Sub>
            {identity === 'standIn' ? <Sub>Test account, acting as {NAME[me]}</Sub> : null}
          </View>
          <Segmented<Segment>
            value={viewer ?? 'both'}
            onChange={(v) => setView(v === 'both' ? 'both' : v === me ? 'mine' : 'other')}
            options={[
              { value: me, label: 'Mine', count: counts.mine, dot: personColor[me] },
              { value: other, label: NAME[other], count: counts.other, dot: personColor[other], tint: { fill: other === 'daryna' ? 'rgba(185,164,255,0.16)' : colors.mintFill, fg: personColor[other] } },
              { value: 'both', label: 'Both', count: counts.both },
            ]}
          />
        </View>
      }
      sections={ready ? sections : []}
      keyExtractor={(t) => t.id}
      ItemSeparatorComponent={TaskGap}
      ListHeaderComponent={
        <View style={s.listHeader}>
          {focus ? <DeadlineCard task={focus} person={viewer ?? me} today={localDate()} /> : null}
          <AddTaskBar text={text} setText={setText} placeholder={view === 'both' ? 'Add a shared task...' : 'Add a task...'} onAdd={quickAdd} onMore={openOptions} />
          {/* With only the Done list below, ListEmptyComponent does not show, so say it here. */}
          {ready && list.length === 0 && sections.length > 0 ? <Text style={s.empty}>Nothing open here.</Text> : null}
        </View>
      }
      renderSectionHeader={({ section }) => section.key === DONE ? (
        <Pressable onPress={() => setShowDone((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showDone }} accessibilityLabel={`Done tasks, ${section.meta}`} style={[s.doneToggle, showDone && { marginBottom: 8 }]}>
          <Text style={s.doneText}>{section.title}</Text>
          <View style={{ transform: [{ rotate: showDone ? '90deg' : '-90deg' }] }}>
            <Icon name="back" size={18} color={colors.textSecondary} stroke={2} />
          </View>
        </Pressable>
      ) : <View style={s.section}><SectionHeading meta={section.meta}>{section.title}</SectionHeading></View>}
      renderItem={({ item }) => <Row task={item} viewer={viewer} me={me} onToggle={toggle} />}
      ListEmptyComponent={<View style={s.gap}><ListGate count={tasks.length}>{focus ? null : <Text style={s.empty}>Nothing open here.</Text>}</ListGate></View>}
      ListFooterComponent={ready ? (
        <View style={s.gap}>
          <GroupChips groups={groupsFor(tasks, groupPerson)} person={groupPerson}>
            <NotesChip />
          </GroupChips>
        </View>
      ) : undefined}
    />
  );
}

const s = StyleSheet.create({
  listHeader: { gap: 8 },
  section: { paddingTop: 8, marginBottom: 8 },
  gap: { paddingTop: 8 },
  addBar: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 54, borderRadius: 27, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: colors.surface, paddingLeft: 18, paddingRight: 5, paddingVertical: 4 },
  addInput: { flex: 1, alignSelf: 'stretch', fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  addBtn: { width: TARGET, height: TARGET, borderRadius: 22, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  moreBtn: { width: TARGET, height: TARGET, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  doneToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: TARGET, paddingHorizontal: 4, marginTop: 8 },
  doneText: { fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary },
  empty: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, padding: 16 },
});
