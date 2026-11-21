import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { FlatNote } from '../domain/types';
import { colors, fonts, radius, TARGET } from '../theme/tokens';

/* Note glyphs, 24px stroke set like ui.tsx. Picked from the title; a generic note otherwise. */
const GLYPHS = {
  flame: 'M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z',
  drop: 'M12 3.5c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z',
  spark: 'M12 4v4M12 16v4M4 12h4M16 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M17.5 6.5L15 9M9 15l-2.5 2.5',
  bike: 'M3 17a3 3 0 1 0 6 0a3 3 0 1 0-6 0M15 17a3 3 0 1 0 6 0a3 3 0 1 0-6 0M6 17l4-6.5h5l3 6.5M10 10.5L8.5 7H7M15 10.5l-1.5-4H16',
  bolt: 'M13 3L5 13h6l-1 8 8-10h-6z',
  key: 'M14.5 4a5.5 5.5 0 1 1-4.9 8L4 17.6V20h3v-2h2v-2h2l1.1-1.1A5.5 5.5 0 0 1 14.5 4zM16 8h.01',
  note: 'M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M8.5 12h7M8.5 16h5',
} as const;
type Glyph = keyof typeof GLYPHS;

export function noteGlyph(title: string): Glyph {
  const t = title.toLowerCase();
  const table: [RegExp, Glyph][] = [[/gas|boiler|heat/, 'flame'], [/water|leak/, 'drop'], [/clean/, 'spark'], [/bike|scooter/, 'bike'], [/electric|meter|power/, 'bolt'], [/key|lock/, 'key']];
  return table.find(([re]) => re.test(t))?.[1] ?? 'note';
}

function Glyph({ name }: { name: Glyph }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={GLYPHS[name]} />
    </Svg>
  );
}

const KIND_LABEL = { to_confirm: 'To confirm', check: 'Check', info: null } as const;

/** Amber means "to confirm" only. "Check" is not urgent, so it stays neutral. */
function KindPill({ kind }: { kind: FlatNote['kind'] }) {
  const label = KIND_LABEL[kind];
  if (!label) return null;
  const amber = kind === 'to_confirm';
  return (
    <View style={[s.pill, amber && { backgroundColor: colors.amberFill }]}>
      <Text style={[s.pillText, amber && { color: colors.amber }]}>{label}</Text>
    </View>
  );
}

export function NoteCard({ note, onEdit, onMakeTask, taskAdded }: { note: FlatNote; onEdit: () => void; onMakeTask: () => void; taskAdded: boolean }) {
  const kind = KIND_LABEL[note.kind];
  const label = [note.title, kind, note.body, note.reference].filter(Boolean).join(', ');
  return (
    <View style={[s.card, note.kind === 'to_confirm' && s.cardConfirm]}>
      <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Edits the note" style={s.main}>
        <View style={s.tile}>
          <Glyph name={noteGlyph(note.title)} />
        </View>
        <View style={s.text}>
          <View style={s.titleRow}>
            <Text style={s.title}>{note.title}</Text>
            <KindPill kind={note.kind} />
          </View>
          {note.body ? <Text style={s.body}>{note.body}</Text> : null}
          {note.reference ? <Text style={s.ref}>{note.reference}</Text> : null}
        </View>
      </Pressable>
      {note.kind === 'to_confirm' ? (
        <Pressable
          onPress={onMakeTask}
          disabled={taskAdded}
          accessibilityRole="button"
          accessibilityLabel={taskAdded ? `Already in tasks: ${note.title}` : `Make it a task: ${note.title}`}
          accessibilityState={{ disabled: taskAdded }}
          style={[s.taskBtn, taskAdded && s.taskBtnDone]}
        >
          <Text style={[s.taskBtnText, taskAdded && { color: colors.mint }]}>{taskAdded ? 'Added to tasks' : 'Make it a task'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const TILE = 44;
const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: 12, paddingRight: 14, gap: 10 },
  cardConfirm: { borderColor: 'rgba(255,196,87,0.40)' },
  main: { flexDirection: 'row', gap: 14 },
  tile: { width: TILE, height: TILE, borderRadius: radius.tile, backgroundColor: colors.neutralFill, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 4, paddingTop: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, color: colors.text, paddingTop: 3 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20, color: colors.textSecondary },
  ref: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  pill: { height: 28, paddingHorizontal: 10, borderRadius: 14, justifyContent: 'center', backgroundColor: colors.neutralFill },
  pillText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  taskBtn: { alignSelf: 'flex-start', marginLeft: TILE + 14, minHeight: TARGET, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.hairlineStrong, justifyContent: 'center' },
  taskBtnDone: { borderColor: 'rgba(94,224,184,0.40)', backgroundColor: colors.mintFill },
  taskBtnText: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
});
