import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Assignment, TaskStatus, TaskStep } from '../domain/types';
import { colors, fonts, radius, TARGET } from '../theme/tokens';
import { actorName } from '../domain/items';
import { Icon, PersonDisc, Rule } from './ui';

export const TASK_STATUS_LABEL = {
  todo: 'To do',
  in_progress: 'In progress',
  waiting: 'Waiting',
  done: 'Done',
} satisfies Record<TaskStatus, string>;

export const TASK_STATUS_OPTIONS = Object.entries(TASK_STATUS_LABEL) as [TaskStatus, string][];

function statusTone(status: TaskStatus) {
  if (status === 'in_progress') return { fill: colors.amberFill, text: colors.amber };
  if (status === 'done') return { fill: colors.mintFill, text: colors.mint };
  return { fill: colors.neutralFill, text: colors.text };
}

export function TaskChip({ label, color = colors.text, fill = colors.neutralFill, onPress, accessibilityLabel, children }: {
  label: string;
  color?: string;
  fill?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  children?: ReactNode;
}) {
  const pill = (
    <View style={[s.chip, { backgroundColor: fill }]}>
      {children}
      <Text style={[s.chipText, { color }]}>{label}</Text>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} style={({ pressed }) => [s.chipTarget, pressed && s.pressed]}>
      {pill}
    </Pressable>
  ) : pill;
}

export function TaskStatusControl({ status, onChange }: { status: TaskStatus; onChange: (status: TaskStatus) => void }) {
  return (
    <View style={[s.card, s.segments]} accessibilityRole="radiogroup" accessibilityLabel="Task status">
      {TASK_STATUS_OPTIONS.map(([value, label]) => {
        const selected = value === status;
        const tone = statusTone(value);
        return (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(value)}
            style={({ pressed }) => [s.segment, selected && { backgroundColor: tone.fill }, pressed && s.pressed]}
          >
            <Text style={[s.segmentText, selected && { color: tone.text, fontFamily: fonts.semibold }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface StepActions {
  toggle: (stepId: string) => void;
  add: (title: string) => void;
}

function StepRow({ step, compact, onPress }: { step: TaskStep; compact: boolean; onPress?: () => void }) {
  const contents = (
    <>
      <View style={[s.circle, compact && s.circleCompact, step.done && s.circleDone]}>
        {step.done ? <Icon name="check" size={compact ? 13 : 15} color={colors.onMint} stroke={3} /> : null}
      </View>
      <Text style={[s.stepText, compact && s.stepTextCompact, step.done && s.stepDone]}>{step.title}</Text>
    </>
  );
  const style = [s.step, compact && s.stepCompact];
  return onPress ? (
    <Pressable style={({ pressed }) => [...style, pressed && s.pressed]} accessibilityRole="checkbox" accessibilityState={{ checked: step.done }} accessibilityLabel={step.title} onPress={onPress}>
      {contents}
    </Pressable>
  ) : (
    <View style={style} accessible accessibilityLabel={`${step.title}, ${step.done ? 'complete' : 'incomplete'}`}>
      {contents}
    </View>
  );
}

function AddStepInput({ onAdd, compact }: { onAdd: StepActions['add']; compact: boolean }) {
  const [title, setTitle] = useState('');
  const disabled = title.trim() === '';
  const submit = () => {
    if (disabled) return;
    onAdd(title);
    setTitle('');
  };

  return (
    <View style={[s.addRow, compact && s.addRowCompact]}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={submit}
        placeholder="Add step"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="New step"
        returnKeyType="done"
        style={s.stepInput}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add step"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={submit}
        style={({ pressed }) => [s.addButton, pressed && s.pressed]}
      >
        <Icon name="plus" size={20} color={disabled ? colors.textMuted : colors.mint} stroke={2} />
      </Pressable>
    </View>
  );
}

function Steps({ steps, actions, compact = false }: { steps: TaskStep[]; actions?: StepActions; compact?: boolean }) {
  return (
    <View>
      {steps.map((step, index) => (
        <View key={step.id}>
          {!compact && index > 0 ? <Rule /> : null}
          <StepRow step={step} compact={compact} onPress={actions && (() => actions.toggle(step.id))} />
        </View>
      ))}
      {actions ? (
        <>
          {!compact && steps.length > 0 ? <Rule /> : null}
          <AddStepInput onAdd={actions.add} compact={compact} />
        </>
      ) : steps.length === 0 ? <Text style={[s.empty, compact && s.emptyCompact]}>No steps yet</Text> : null}
    </View>
  );
}

export function TaskChecklist({ assignment, actions }: { assignment: Assignment; actions?: StepActions }) {
  const done = assignment.steps.filter((step) => step.done).length;
  return (
    <View style={s.card}>
      <View style={s.checklistHeader}>
        <Text style={s.heading} accessibilityRole="header">Steps</Text>
        <Text style={s.meta}>{done} of {assignment.steps.length}</Text>
      </View>
      <Steps steps={assignment.steps} actions={actions} />
    </View>
  );
}

export function AssignmentCard({ assignment, actions, onStatusPress }: {
  assignment: Assignment;
  actions?: StepActions;
  onStatusPress?: () => void;
}) {
  const { person, status, steps } = assignment;
  const name = actions ? 'You' : actorName(person);
  const tone = statusTone(status);
  const doneSteps = steps.filter((step) => step.done).length;
  const percent = steps.length === 0 ? (status === 'done' ? 100 : 0) : Math.round(doneSteps / steps.length * 100);

  return (
    <View style={[s.card, s.assignment, actions && s.mine]}>
      <View style={s.person}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <PersonDisc person={person} done={status === 'done'} size={36} />
        </View>
        <Text style={s.personName} accessibilityRole="header">{name}</Text>
      </View>
      <View style={s.statusChip}>
        <TaskChip label={TASK_STATUS_LABEL[status]} color={tone.text} fill={tone.fill} onPress={onStatusPress} accessibilityLabel={`Change your status, ${TASK_STATUS_LABEL[status]}`} />
      </View>
      <View
        style={s.track}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${name === 'You' ? 'Your' : name + '’s'} progress`}
        accessibilityValue={{ min: 0, max: 100, now: percent, text: steps.length ? `${doneSteps} of ${steps.length} steps done` : TASK_STATUS_LABEL[status] }}
      >
        <View style={[s.progress, { width: `${percent}%` }]} />
      </View>
      <Steps steps={steps} actions={actions} compact />
    </View>
  );
}

export function TaskCallout({ kind, children }: { kind: 'note' | 'shared'; children: ReactNode }) {
  return (
    <View style={[s.card, s.callout, kind === 'note' && s.note]}>
      <Icon name={kind === 'note' ? 'tasks' : 'check'} size={20} color={colors.textSecondary} />
      <View style={s.calloutBody}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%', minHeight: 28, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 13 },
  chipTarget: { minWidth: TARGET, minHeight: TARGET, maxWidth: '100%', justifyContent: 'center' },
  pressed: { opacity: 0.72 },
  segments: { flexDirection: 'row', padding: 4, borderRadius: 26 },
  segment: { flex: 1, minWidth: TARGET, minHeight: TARGET, justifyContent: 'center', alignItems: 'center', borderRadius: 22, padding: 4 },
  segmentText: { textAlign: 'center', fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  checklistHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  heading: { fontFamily: fonts.serif, fontSize: 23, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 49, paddingVertical: 6, paddingHorizontal: 14 },
  stepCompact: { gap: 6, minHeight: TARGET, paddingHorizontal: 0 },
  circle: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.hairlineStrong },
  circleCompact: { width: 22, height: 22, borderRadius: 11 },
  circleDone: { backgroundColor: colors.mint, borderColor: colors.mint },
  stepText: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  stepTextCompact: { fontFamily: fonts.regular, fontSize: 14 },
  stepDone: { color: colors.textSecondary },
  empty: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, padding: 14 },
  emptyCompact: { paddingHorizontal: 0 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginHorizontal: 8, marginVertical: 4 },
  addRowCompact: { marginHorizontal: 0 },
  stepInput: { flex: 1, minHeight: TARGET, paddingHorizontal: 6, paddingVertical: 8, fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  addButton: { width: TARGET, minHeight: TARGET, alignItems: 'center', justifyContent: 'center' },
  assignment: { flex: 1, padding: 14 },
  mine: { borderColor: 'rgba(94,224,184,0.44)' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personName: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  statusChip: { minHeight: TARGET, alignItems: 'flex-start', justifyContent: 'center', marginTop: 2 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.track, marginBottom: 8 },
  progress: { height: '100%', backgroundColor: colors.mint },
  callout: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: radius.row },
  note: { backgroundColor: colors.surfaceRaised },
  calloutBody: { flex: 1, gap: 4 },
});
