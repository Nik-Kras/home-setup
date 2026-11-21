import { router } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { NoteCard } from '../components/NoteCard';
import { NoteSheet, type NoteDraft } from '../components/NoteSheet';
import { Screen } from '../components/Screen';
import { Icon, Sub, Title } from '../components/ui';
import { useStore } from '../data/store';
import { notesSorted, toConfirmCount } from '../domain/notes';
import type { FlatNote } from '../domain/types';
import { colors, fonts, TARGET } from '../theme/tokens';

export default function Notes() {
  const { notes, me, addNote, updateNote, addTask } = useStore();
  const [sheet, setSheet] = useState<{ open: boolean; note?: FlatNote }>({ open: false });
  const [madeTasks, setMadeTasks] = useState<ReadonlySet<string>>(new Set());

  const list = notesSorted(notes);
  const toConfirm = toConfirmCount(notes);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/tasks'));

  const save = (d: NoteDraft) => {
    const fields = { title: d.title, body: d.body, reference: d.reference, kind: d.kind };
    if (sheet.note) updateNote(sheet.note.id, fields);
    else addNote(d.title, fields);
  };

  // The add-task modal is not built yet, so the note becomes one of my tasks directly.
  const makeTask = (note: FlatNote) => {
    addTask(note.title, [me]);
    setMadeTasks((s) => new Set(s).add(note.id));
    AccessibilityInfo.announceForAccessibility(`Added to your tasks: ${note.title}`);
  };

  return (
    <Screen
      header={
        <View style={{ gap: 4 }}>
          <View style={s.topRow}>
            <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back" style={s.back}>
              <Icon name="back" size={24} color={colors.text} stroke={2} />
            </Pressable>
            <Pressable onPress={() => setSheet({ open: true })} accessibilityRole="button" accessibilityLabel="Add a note" style={s.add}>
              <Icon name="plus" size={22} color={colors.onMint} stroke={2.6} />
            </Pressable>
          </View>
          <Title>Flat notes</Title>
          <Sub>From the tenancy contract · {toConfirm} to confirm</Sub>
        </View>
      }
    >
      {list.map((n) => (
        <NoteCard key={n.id} note={n} onEdit={() => setSheet({ open: true, note: n })} onMakeTask={() => makeTask(n)} taskAdded={madeTasks.has(n.id)} />
      ))}
      {list.length === 0 ? <Text style={s.empty}>No notes yet. Add facts about the flat, such as house rules or things to confirm.</Text> : null}
      <NoteSheet visible={sheet.open} note={sheet.note} onClose={() => setSheet((v) => ({ ...v, open: false }))} onSave={save} />
    </Screen>
  );
}

const s = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  back: { width: TARGET, height: TARGET, marginLeft: -12, alignItems: 'center', justifyContent: 'center' },
  add: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  empty: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.textSecondary, padding: 16 },
});
