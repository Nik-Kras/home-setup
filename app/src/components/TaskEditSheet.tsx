import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDays, assigneesFor, endOfWeek, localDate, TASK_GROUPS } from '../domain/taskOptions';
import { canSaveTask, taskDraft, type TaskDraft } from '../domain/taskEdit';
import type { Who } from '../domain/tasks';
import type { Person, Task } from '../domain/types';
import { colors, fonts, radius, TARGET } from '../theme/tokens';
import { ChoiceChip } from './ChoiceChip';
import { DatePickerSheet, shortDate } from './DatePickerSheet';
import { SwitchRow } from './SwitchRow';
import { NAME } from './TaskRow';
import { UrgentBadge } from './ui';

/**
 * The full task edit sheet: title, when, group, who, urgent, notes and reference, and Delete. Save
 * hands back the draft; the screen sends only what changed (see taskEditChanges). Delete is a soft
 * delete with Undo, so it asks nothing.
 */
export function TaskEditSheet({ visible, task, me, onClose, onSave, onDelete }: {
  visible: boolean;
  task: Task;
  me: Person;
  onClose: () => void;
  /** `original` is the task as it was when the sheet opened, to diff against (see taskEditChanges). */
  onSave: (draft: TaskDraft, original: Task) => void;
  onDelete: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<TaskDraft>(() => taskDraft(task, me));
  const [original, setOriginal] = useState(task);
  const [picking, setPicking] = useState(false);
  const other: Person = me === 'nikita' ? 'daryna' : 'nikita';
  const today = localDate();

  // Fill the form from the task each time the sheet opens (the other phone may have changed it).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only on opening, so typing is never reset by a realtime update
  useEffect(() => {
    if (!visible) return;
    setDraft(taskDraft(task, me));
    setOriginal(task);
  }, [visible]);

  const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const canSave = canSaveTask(draft);
  const save = () => {
    if (!canSave) return;
    onSave(draft, original);
    onClose();
  };

  const quick = [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: addDays(today, 1) },
    { label: 'This week', date: endOfWeek(today) },
  ];
  const quickHit = quick.some((q) => q.date === draft.due);
  const groups: string[] = draft.group && !(TASK_GROUPS as readonly string[]).includes(draft.group) ? [draft.group, ...TASK_GROUPS] : [...TASK_GROUPS];
  const whoChoices: { value: Who; label: string }[] = [
    { value: 'me', label: 'Me' },
    { value: 'other', label: NAME[other] },
    { value: 'both', label: 'Each of us' },
  ];
  // Honest about what Save does to a part that already exists: taking a person off removes it.
  const after = assigneesFor(draft.who, me);
  const removed = original.assignments.map((a) => a.person).filter((p) => !after.includes(p));
  const removing = removed.length === 0 ? null : removed[0] === me ? 'you' : NAME[removed[0]!];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={s.fill}>
        <Pressable style={s.backdrop} onPress={onClose} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]} accessibilityViewIsModal>
          <View style={s.head}>
            <Text style={s.heading} accessibilityRole="header">Edit task</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel" style={s.cancel}>
              <Text style={s.cancelText}>Cancel</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>Title</Text>
            <TextInput value={draft.title} onChangeText={(v) => set('title', v)} placeholder="What needs doing?" placeholderTextColor={colors.textMuted} accessibilityLabel="Title" style={s.input} />

            <Text style={s.label} accessibilityRole="header">When</Text>
            <View style={s.chips} accessibilityLabel="When">
              {quick.map((q) => (
                <ChoiceChip key={q.label} label={q.label} selected={draft.due === q.date} onPress={() => set('due', q.date)} />
              ))}
              <ChoiceChip
                label={draft.due && !quickHit ? shortDate(draft.due) : 'Pick a date'}
                a11yLabel={draft.due && !quickHit ? `Due ${shortDate(draft.due)}, change date` : 'Pick a date'}
                selected={!!draft.due && !quickHit}
                onPress={() => { Keyboard.dismiss(); setPicking(true); }}
              />
              <ChoiceChip label="No date" selected={!draft.due} onPress={() => set('due', undefined)} />
            </View>

            <Text style={s.label} accessibilityRole="header">Group</Text>
            <View style={s.chips} accessibilityLabel="Group">
              {groups.map((g) => (
                <ChoiceChip key={g} label={g} selected={draft.group === g} onPress={() => set('group', draft.group === g ? undefined : g)} />
              ))}
            </View>

            <Text style={s.label} accessibilityRole="header">Who</Text>
            <View style={s.chips} accessibilityLabel="Who">
              {whoChoices.map((w) => (
                <ChoiceChip key={w.value} label={w.label} selected={draft.who === w.value} onPress={() => set('who', w.value)} />
              ))}
            </View>
            <Text style={s.hint}>
              {removing ? `Saving takes ${removing === 'you' ? 'you' : removing} off this task, with ${removing === 'you' ? 'your' : 'their'} steps. Undo puts it back.` : 'Each of us: you both get the task and tick it off separately.'}
            </Text>

            <SwitchRow label="Urgent" value={draft.urgent} onChange={(v) => set('urgent', v)} accessory={<UrgentBadge />} />

            <Text style={s.label}>Notes</Text>
            <TextInput value={draft.notes} onChangeText={(v) => set('notes', v)} multiline placeholder="Why it matters, what to bring" placeholderTextColor={colors.textMuted} accessibilityLabel="Notes" style={[s.input, s.multi]} />
            <Text style={s.label}>Reference</Text>
            <TextInput value={draft.reference} onChangeText={(v) => set('reference', v)} placeholder="Clause or source" placeholderTextColor={colors.textMuted} accessibilityLabel="Reference" style={s.input} />

            <Pressable onPress={() => { onClose(); onDelete(); }} accessibilityRole="button" accessibilityLabel="Delete task" accessibilityHint="Undo is offered for 10 seconds" style={({ pressed }) => [s.delete, pressed && { opacity: 0.7 }]}>
              <Text style={s.deleteText}>Delete task</Text>
            </Pressable>
          </ScrollView>
          <Pressable onPress={save} disabled={!canSave} accessibilityRole="button" accessibilityLabel="Save task" accessibilityState={{ disabled: !canSave }} style={[s.save, !canSave && s.saveOff]}>
            <Text style={[s.saveText, !canSave && { color: colors.textSecondary }]}>Save</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      <DatePickerSheet
        visible={picking}
        today={today}
        value={draft.due && !quickHit ? draft.due : undefined}
        onClose={() => setPicking(false)}
        onPick={(day) => {
          set('due', day);
          setPicking(false);
        }}
      />
    </Modal>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, paddingHorizontal: 20, paddingTop: 8, maxHeight: '92%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 34, color: colors.text },
  cancel: { minWidth: TARGET, minHeight: TARGET, justifyContent: 'center', alignItems: 'flex-end' },
  cancelText: { fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary },
  form: { gap: 6, paddingBottom: 12 },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, paddingTop: 8, paddingLeft: 4 },
  input: { minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)', backgroundColor: colors.bg, paddingHorizontal: 14, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  multi: { minHeight: 80, textAlignVertical: 'top' },
  // Chips wrap, so every choice (No date included) shows whole on any width.
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { marginHorizontal: 4, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary, paddingBottom: 4 },
  delete: { minHeight: 48, marginTop: 12, borderRadius: 24, borderWidth: 1, borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  deleteText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  save: { height: 52, borderRadius: 26, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveOff: { backgroundColor: colors.neutralFill },
  saveText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.onMint },
});
