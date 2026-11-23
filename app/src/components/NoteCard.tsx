import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { IconName, Tone } from '../domain/glyphs';
import type { FlatNote } from '../domain/types';
import { colors, fonts, radius, TARGET, tileTone } from '../theme/tokens';
import { Icon } from './ui';

/* Note glyphs from the design, tinted as in the design: gas amber, water and cleaning mint, others neutral. */
const NOTE_GLYPHS: [RegExp, IconName, Tone][] = [
  [/gas|boiler|heat/, 'flame', 'amber'],
  [/water|leak/, 'drop', 'mint'],
  [/clean/, 'brush', 'mint'],
  [/bike|scooter/, 'bike', 'neutral'],
  [/key|lock/, 'key', 'neutral'],
  [/bin|rubbish|recycl/, 'bin', 'neutral'],
  [/electric|meter|power/, 'plug', 'neutral'],
];

export function noteGlyph(title: string): { icon: IconName; tone: Tone } {
  const t = title.toLowerCase();
  const hit = NOTE_GLYPHS.find(([re]) => re.test(t));
  return hit ? { icon: hit[1], tone: hit[2] } : { icon: 'info', tone: 'neutral' };
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

function NoteTile({ icon, tone }: { icon: IconName; tone: Tone }) {
  const t = tileTone[tone];
  return (
    <View style={[s.tile, { backgroundColor: tone === 'neutral' ? 'rgba(255,255,255,0.10)' : t.fill }]}>
      <Icon name={icon} size={22} color={t.fg} stroke={1.7} />
    </View>
  );
}

export function NoteCard({ note, onEdit, onMakeTask, taskAdded }: { note: FlatNote; onEdit: () => void; onMakeTask: () => void; taskAdded: boolean }) {
  const kind = KIND_LABEL[note.kind];
  const label = [note.title, kind, note.body, note.reference].filter(Boolean).join(', ');
  return (
    <View style={[s.card, note.kind === 'to_confirm' && s.cardConfirm]}>
      <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Edits the note" style={s.main}>
        <NoteTile {...noteGlyph(note.title)} />
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

const TILE = 40;
const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.hairline, padding: 12, paddingRight: 14, gap: 10 },
  cardConfirm: { borderColor: 'rgba(255,196,87,0.40)' },
  main: { flexDirection: 'row', gap: 12 },
  tile: { width: TILE, height: TILE, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontFamily: fonts.medium, fontSize: 16, lineHeight: 20, color: colors.text, paddingTop: 4 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: '#C9D1CC' },
  ref: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 16, color: colors.textSecondary },
  pill: { height: 28, paddingHorizontal: 9, borderRadius: 12, justifyContent: 'center', backgroundColor: colors.neutralFill },
  pillText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  taskBtn: { alignSelf: 'flex-start', marginLeft: TILE + 12, minHeight: TARGET, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.hairlineStrong, justifyContent: 'center' },
  taskBtnDone: { borderColor: 'rgba(94,224,184,0.40)', backgroundColor: colors.mintFill },
  taskBtnText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
});
