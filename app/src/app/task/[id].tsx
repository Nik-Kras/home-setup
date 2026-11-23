import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { ActivityLine } from '../../components/ActivityLine';
import { CommentBar, CommentLines } from '../../components/Comments';
import { shortDate } from '../../components/DatePickerSheet';
import { LoadingState, NotFoundState, OfflineState, useDetailState } from '../../components/LoadState';
import { HeaderAction, ScreenHeader } from '../../components/ScreenHeader';
import { Sheet, SheetOption, TextSheetBody } from '../../components/Sheet';
import { AssignmentCard, TaskCallout, TaskChecklist, TaskChip, TaskStatusControl, TASK_STATUS_LABEL, TASK_STATUS_OPTIONS } from '../../components/TaskDetailParts';
import { TaskEditSheet } from '../../components/TaskEditSheet';
import { useStore } from '../../data/store';
import { taskEditChanges, type TaskDraft } from '../../domain/taskEdit';
import { actorName } from '../../domain/items';
import { addDays, endOfWeek, localDate } from '../../domain/taskOptions';
import { assignmentFor, daysLeft, isShared, parseTaskDate, taskProgressLabel, waitingOn } from '../../domain/tasks';
import type { Task, TaskStatus } from '../../domain/types';
import { colors, fonts, personColor, radius } from '../../theme/tokens';

type Editor = 'due' | 'date' | 'status';
const EDITOR_TITLE: Record<Editor, string> = { due: 'Due date', date: 'Pick a date', status: 'Your status' };

const back = () => (router.canGoBack() ? router.back() : router.replace('/tasks'));

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tasks, retry, deleteTask } = useStore();
  const task = tasks.find((t) => t.id === id);
  // Tasks are not cached, so a cold start or deep link waits for the load before saying "not found".
  const state = useDetailState(task !== undefined);
  /** Set by Delete, so the screen sliding away shows nothing rather than "Task not found". */
  const [leaving, setLeaving] = useState(false);
  // Leave first, then delete: the snackbar on the list offers Undo for 10 s.
  const remove = (taskId: string) => {
    setLeaving(true);
    back();
    deleteTask(taskId);
  };
  if (!task && leaving) return <View style={s.root}><TaskHeader /></View>;
  return task ? <TaskDetails key={task.id} task={task} onDelete={() => remove(task.id)} /> : (
    <View style={s.root}>
      <TaskHeader />
      <View style={s.missing}>
        {state === 'loading' ? <LoadingState label="Loading task" /> : null}
        {state === 'offline' ? <OfflineState onRetry={retry} /> : null}
        {state === 'missing' ? (
          <NotFoundState title="Task not found" line="It may have been removed on the other phone." backLabel="Back to tasks" onBack={back} />
        ) : null}
      </View>
    </View>
  );
}

function TaskHeader({ onEdit }: { onEdit?: () => void }) {
  return (
    <ScreenHeader
      onBack={back}
      backLabel="Back to tasks"
      right={onEdit ? <HeaderAction label="Edit" onPress={onEdit} accessibilityLabel="Edit task: title, date, group, who, urgent, notes, or delete" /> : undefined}
    />
  );
}

function TaskDetails({ task, onDelete }: { task: Task; onDelete: () => void }) {
  const { me, canDeletePhotos, updateTask, setTaskStatus, toggleStep, addStep } = useStore();
  const [editing, setEditing] = useState(false);
  const saveEdit = (draft: TaskDraft, original: Task) => {
    const { patch, assignees } = taskEditChanges(original, draft, me);
    if (Object.keys(patch).length > 0 || assignees) updateTask(task.id, patch, assignees);
  };
  const { bottom, left, right } = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const [editor, setEditor] = useState<Editor | null>(null);
  const close = () => setEditor(null);
  const shared = isShared(task);
  const mine = assignmentFor(task, me);
  const mineDone = mine?.status === 'done';
  const solo = task.assignments[0];
  const people = mine ? [mine, ...task.assignments.filter((a) => a !== mine)] : task.assignments;
  const twoColumns = width - left - right >= 360 && fontScale <= 1.2;
  const today = localDate();
  const dateChoices = [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: addDays(today, 1) },
    { label: 'This week', date: endOfWeek(today) },
  ];
  const selectedDate = dateChoices.findIndex(({ date }) => date === task.due);
  const actions = {
    toggle: (stepId: string) => toggleStep(task.id, me, stepId),
    add: (title: string) => addStep(task.id, title),
  };
  const setStatus = (status: TaskStatus) => setTaskStatus(task.id, me, status);
  const setDue = (due?: string) => {
    updateTask(task.id, { due });
    close();
  };
  const waiting = waitingOn(task)[0];
  const waitingLabel = waiting === me ? 'They’re waiting for you.' : waiting ? `Waiting for ${actorName(waiting)}.` : null;
  const glow = task.urgent ? colors.coral : shared ? colors.mint : undefined;
  const due = task.due ? dueLabel(task.due, today) : undefined;

  return (
    <View style={[s.root, { paddingLeft: left, paddingRight: right }]}>
      {glow ? (
        <View pointerEvents="none" style={s.glow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="taskHeaderGlow" cx="27%" cy="12%" rx="73%" ry="86%">
                <Stop offset="0" stopColor={glow} stopOpacity={0.09} />
                <Stop offset="1" stopColor={glow} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#taskHeaderGlow)" />
          </Svg>
        </View>
      ) : null}
      <TaskHeader onEdit={() => setEditing(true)} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.content, { paddingBottom: 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.titleBlock}>
          <Text accessibilityRole="header" style={s.title}>{task.title}</Text>
          <View style={s.chips}>
            {shared ? (
              <>
                <TaskChip label="Both of you · each ticks it" fill={colors.mintFill} color={colors.mint} />
                <Text style={s.meta} accessibilityLiveRegion="polite">{taskProgressLabel(task)}</Text>
              </>
            ) : null}
            <TaskChip
              label={due ?? 'Add due date'}
              onPress={() => setEditor('due')}
              accessibilityLabel={`Change due date, ${due ?? 'no date'}`}
            />
            {task.urgent ? <TaskChip label="Urgent" fill={colors.coralFill} color={colors.coral} /> : null}
            {task.reference ? <TaskChip label={task.reference} /> : null}
            {!shared && solo ? (
              <TaskChip label={actorName(solo.person)}>
                <View style={[s.dot, { backgroundColor: personColor[solo.person] }]} />
              </TaskChip>
            ) : null}
          </View>
        </View>

        {shared ? (
          <>
            <View style={twoColumns ? s.columns : s.stacked}>
              {people.map((a) => (
                <AssignmentCard
                  key={a.person}
                  assignment={a}
                  actions={a === mine ? actions : undefined}
                  onStatusPress={a === mine ? () => setEditor('status') : undefined}
                />
              ))}
            </View>
            <TaskCallout kind="shared">
              <Text style={s.body}>The task closes when both of you are done.</Text>
              {waitingLabel ? <Text style={s.meta}>{waitingLabel}</Text> : null}
            </TaskCallout>
          </>
        ) : solo ? (
          <>
            {mine ? <TaskStatusControl status={solo.status} onChange={setStatus} /> : (
              <Text style={s.meta}>Status {TASK_STATUS_LABEL[solo.status]}</Text>
            )}
            <TaskChecklist assignment={solo} actions={mine ? actions : undefined} />
          </>
        ) : <Text style={s.meta}>No one is assigned to this task.</Text>}

        {task.notes ? (
          <TaskCallout kind="note">
            <Text style={s.body}>{task.notes}</Text>
          </TaskCallout>
        ) : null}

        <View style={shared && s.activityCard}>
          {shared ? <Text style={s.activityHeading} accessibilityRole="header">Activity</Text> : null}
          <View style={!shared && s.activitySolo}>
            <ActivityLine actor={task.updatedBy} text="made the last change" />
            <CommentLines targetType="task" targetId={task.id} />
          </View>
        </View>
      </ScrollView>

      <CommentBar targetType="task" targetId={task.id} safeBottom={!(shared && mine)} />

      {shared && mine ? (
        <View style={[s.footer, { paddingBottom: bottom + 16 }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setStatus(mineDone ? 'todo' : 'done')}
            style={({ pressed }) => [s.primary, pressed && { opacity: 0.75 }]}
          >
            <Text style={s.primaryText}>{mineDone ? 'Mark mine not done' : 'Mark mine done'}</Text>
          </Pressable>
        </View>
      ) : null}

      <TaskEditSheet visible={editing} task={task} me={me} canRemove={canDeletePhotos} onClose={() => setEditing(false)} onSave={saveEdit} onDelete={onDelete} />

      {editor ? (
        <Sheet visible title={EDITOR_TITLE[editor]} onClose={close}>
          {editor === 'due' ? (
            <>
              {dateChoices.map(({ label, date }, index) => (
                <SheetOption key={label} label={label} selected={index === selectedDate} onPress={() => setDue(date)} />
              ))}
              <SheetOption label="Pick a date" selected={!!task.due && selectedDate === -1} onPress={() => setEditor('date')} />
              <SheetOption label="No date" selected={!task.due} onPress={() => setDue()} />
            </>
          ) : null}
          {editor === 'date' ? (
            <TextSheetBody
              key="date"
              title={EDITOR_TITLE.date}
              initial={task.due?.replace(/-/g, '') ?? ''}
              placeholder="YYYYMMDD"
              helper="Enter the year, month and day as eight digits."
              keyboardType="number-pad"
              validate={(value) => parseTaskDate(value) ? undefined : 'Enter a valid date as YYYYMMDD'}
              onSave={(value) => updateTask(task.id, { due: parseTaskDate(value) })}
              onClose={close}
            />
          ) : null}
          {editor === 'status' ? TASK_STATUS_OPTIONS.map(([status, label]) => (
            <SheetOption key={status} label={label} selected={mine?.status === status} onPress={() => { setStatus(status); close(); }} />
          )) : null}
        </Sheet>
      ) : null}
    </View>
  );
}

function dueLabel(due: string, today: string): string {
  const days = daysLeft(due, today);
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days < 0) return `Due ${shortDate(due)} · overdue`;
  return `Due ${shortDate(due)} · ${days} days`;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  glow: { position: 'absolute', height: 380, top: 0, left: 0, right: 0 },
  missing: { paddingHorizontal: 16, paddingTop: 12 },
  scroll: { flex: 1 },
  content: { gap: 12, paddingHorizontal: 16 },
  titleBlock: { paddingHorizontal: 4, gap: 6 },
  title: { fontFamily: fonts.serif, fontSize: 36, lineHeight: 37, color: colors.text, letterSpacing: -0.5, paddingBottom: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4 },
  columns: { flexDirection: 'row', gap: 10 },
  stacked: { gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  body: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  meta: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  activitySolo: { paddingHorizontal: 16, gap: 8 },
  activityCard: { gap: 8, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline },
  activityHeading: { fontFamily: fonts.serif, fontSize: 21, color: colors.text },
  footer: { borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 12, paddingHorizontal: 16 },
  primary: { minHeight: 50, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mint, borderRadius: radius.pill },
  primaryText: { textAlign: 'center', color: colors.onMint, fontFamily: fonts.semibold, fontSize: 16 },
});
