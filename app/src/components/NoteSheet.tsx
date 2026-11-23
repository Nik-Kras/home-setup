import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NoteDraft } from '../domain/notes';
import type { FlatNote, NoteKind } from '../domain/types';
import { colors, fonts, radius, TARGET } from '../theme/tokens';
import { Icon } from './ui';

export type { NoteDraft };

const KINDS: { value: NoteKind; label: string }[] = [
  { value: 'info', label: 'Fact' },
  { value: 'to_confirm', label: 'To confirm' },
  { value: 'check', label: 'Check' },
];

/** Bottom sheet to add a note (note undefined) or edit one. Editing offers Delete (soft, with Undo). */
export function NoteSheet({ visible, note, onClose, onSave, onDelete }: { visible: boolean; note?: FlatNote; onClose: () => void; onSave: (draft: NoteDraft) => void; onDelete?: (note: FlatNote) => void }) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<NoteDraft>({ title: '', body: '', reference: '', kind: 'info' });

  // Fill the form each time the sheet opens.
  useEffect(() => {
    if (visible) setDraft({ title: note?.title ?? '', body: note?.body ?? '', reference: note?.reference ?? '', kind: note?.kind ?? 'info' });
  }, [visible, note]);

  const canSave = draft.title.trim().length > 0;
  const save = () => {
    if (!canSave) return;
    onSave(draft);
    onClose();
  };
  const field = (key: 'title' | 'body' | 'reference') => (v: string) => setDraft((d) => ({ ...d, [key]: v }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={s.fill}>
        {/* Tap outside to close; hidden from screen readers, which use Cancel. */}
        <Pressable style={s.backdrop} onPress={onClose} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.head}>
            <Text style={s.heading} accessibilityRole="header">{note ? 'Edit note' : 'New note'}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel" style={s.cancel}>
              <Text style={s.cancelText}>Cancel</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>Title</Text>
            <TextInput value={draft.title} onChangeText={field('title')} autoFocus={!note} placeholder="Which day is bin collection?" placeholderTextColor={colors.textMuted} accessibilityLabel="Title" style={s.input} />
            <Text style={s.label}>Details</Text>
            <TextInput value={draft.body} onChangeText={field('body')} multiline placeholder="What we know so far" placeholderTextColor={colors.textMuted} accessibilityLabel="Details" style={[s.input, s.multi]} />
            <Text style={s.label}>Reference</Text>
            <TextInput value={draft.reference} onChangeText={field('reference')} placeholder="Clause or source" placeholderTextColor={colors.textMuted} accessibilityLabel="Reference" style={s.input} />
            <Text style={s.label}>Kind</Text>
            <View style={s.kinds} accessibilityRole="radiogroup">
              {KINDS.map((k) => {
                const on = draft.kind === k.value;
                return (
                  <Pressable key={k.value} onPress={() => setDraft((d) => ({ ...d, kind: k.value }))} accessibilityRole="radio" accessibilityState={{ selected: on, checked: on }} accessibilityLabel={k.label} style={[s.kind, on && s.kindOn]}>
                    {on ? <Icon name="check" size={14} color={colors.mint} stroke={3} /> : null}
                    <Text style={[s.kindText, on && s.kindTextOn]}>{k.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {note && onDelete ? (
              <Pressable onPress={() => { onClose(); onDelete(note); }} accessibilityRole="button" accessibilityLabel="Delete note" accessibilityHint="Undo is offered for 10 seconds" style={({ pressed }) => [s.delete, pressed && { opacity: 0.7 }]}>
                <Text style={s.deleteText}>Delete note</Text>
              </Pressable>
            ) : null}
          </ScrollView>
          <Pressable onPress={save} disabled={!canSave} accessibilityRole="button" accessibilityLabel={note ? 'Save note' : 'Add note'} accessibilityState={{ disabled: !canSave }} style={[s.save, !canSave && s.saveOff]}>
            <Text style={[s.saveText, !canSave && { color: colors.textSecondary }]}>{note ? 'Save' : 'Add note'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, paddingHorizontal: 20, paddingTop: 8, maxHeight: '88%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 34, color: colors.text },
  cancel: { minWidth: TARGET, minHeight: TARGET, justifyContent: 'center', alignItems: 'flex-end' },
  cancelText: { fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary },
  form: { gap: 6, paddingBottom: 12 },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, paddingTop: 8, paddingLeft: 4 },
  input: { minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)', backgroundColor: colors.bg, paddingHorizontal: 14, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  multi: { minHeight: 88, textAlignVertical: 'top' },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: TARGET, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.hairlineStrong },
  kindOn: { backgroundColor: colors.mintFill, borderColor: 'rgba(94,224,184,0.5)' },
  kindText: { fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary },
  kindTextOn: { color: colors.mint },
  delete: { minHeight: 48, marginTop: 14, borderRadius: 24, borderWidth: 1, borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  deleteText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  save: { height: 52, borderRadius: 26, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveOff: { backgroundColor: colors.neutralFill },
  saveText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.onMint },
});
