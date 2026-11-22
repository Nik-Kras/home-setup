import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NoteCard } from '../components/NoteCard';
import { NoteSheet } from '../components/NoteSheet';
import { EmptyState } from '../components/EmptyState';
import { HeaderIconButton, ScreenHeader } from '../components/ScreenHeader';
import { Sub, Title } from '../components/ui';
import { useStore } from '../data/store';
import { hasOpenTask, noteDraftChanges, notesSorted, toConfirmCount, type NoteDraft } from '../domain/notes';
import type { FlatNote } from '../domain/types';
import { colors } from '../theme/tokens';

export default function Notes() {
  const { notes, tasks, addNote, updateNote } = useStore();
  const { bottom } = useSafeAreaInsets();
  const [sheet, setSheet] = useState<{ open: boolean; note?: FlatNote }>({ open: false });

  const list = notesSorted(notes);
  const toConfirm = toConfirmCount(notes);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/tasks'));
  const openNew = () => setSheet({ open: true });

  const save = (d: NoteDraft) => {
    if (!sheet.note) return addNote(d.title, { body: d.body, reference: d.reference, kind: d.kind });
    // Only what changed since the sheet opened, so another person's edit made meanwhile survives.
    const changes = noteDraftChanges(sheet.note, d);
    if (Object.keys(changes).length > 0) updateNote(sheet.note.id, changes);
  };

  const makeTask = (note: FlatNote) => router.push({ pathname: '/add-task', params: { title: note.title } });

  return (
    <View style={s.root}>
      {/* One add control: the header plus, or the empty state's button when there are no notes. */}
      <ScreenHeader onBack={back} backLabel="Back to tasks" right={list.length > 0 ? <HeaderIconButton icon="plus" onPress={openNew} accessibilityLabel="Add a note" /> : undefined} />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <View style={s.titleBlock}>
          <Title>Flat notes</Title>
          <Sub>From the tenancy contract{toConfirm > 0 ? ` · ${toConfirm} to confirm` : ''}</Sub>
        </View>
        {list.map((n) => (
          <NoteCard key={n.id} note={n} onEdit={() => setSheet({ open: true, note: n })} onMakeTask={() => makeTask(n)} taskAdded={hasOpenTask(tasks, n.title)} />
        ))}
        {list.length === 0 ? (
          <EmptyState icon="home" title="No notes yet" line="Add facts about the flat, such as house rules or things to confirm." action={{ label: 'Add a note', onPress: openNew }} />
        ) : null}
      </ScrollView>
      <NoteSheet visible={sheet.open} note={sheet.note} onClose={() => setSheet((v) => ({ ...v, open: false }))} onSave={save} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, gap: 8 },
  // Same left edge as the other pushed screens' titles (20 from the screen edge).
  titleBlock: { paddingHorizontal: 4, gap: 4, paddingBottom: 6 },
});
