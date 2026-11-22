import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NoteCard } from '../components/NoteCard';
import { NoteSheet } from '../components/NoteSheet';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon, Sub, Title } from '../components/ui';
import { useStore } from '../data/store';
import { hasOpenTask, noteDraftChanges, notesSorted, toConfirmCount, type NoteDraft } from '../domain/notes';
import type { FlatNote } from '../domain/types';
import { colors, fonts, radius, TARGET } from '../theme/tokens';

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
      <ScreenHeader
        onBack={back}
        right={
          <Pressable onPress={openNew} accessibilityRole="button" accessibilityLabel="Add a note" style={({ pressed }) => [s.add, pressed && s.pressed]}>
            <Icon name="plus" size={22} color={colors.onMint} stroke={2.6} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <View style={s.titleBlock}>
          <Title>Flat notes</Title>
          <Sub>From the tenancy contract · {toConfirm} to confirm</Sub>
        </View>
        {list.map((n) => (
          <NoteCard key={n.id} note={n} onEdit={() => setSheet({ open: true, note: n })} onMakeTask={() => makeTask(n)} taskAdded={hasOpenTask(tasks, n.title)} />
        ))}
        {list.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyText}>No notes yet. Add facts about the flat, such as house rules or things to confirm.</Text>
            <Pressable onPress={openNew} accessibilityRole="button" style={({ pressed }) => [s.emptyButton, pressed && s.pressed]}>
              <Text style={s.emptyButtonText}>Add a note</Text>
            </Pressable>
          </View>
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
  add: { width: TARGET, height: TARGET, borderRadius: TARGET / 2, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
  empty: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: 16, gap: 14 },
  emptyText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.textSecondary },
  emptyButton: { alignSelf: 'flex-start', minHeight: TARGET, paddingHorizontal: 20, borderRadius: radius.pill, backgroundColor: colors.mint, justifyContent: 'center' },
  emptyButtonText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onMint },
});
