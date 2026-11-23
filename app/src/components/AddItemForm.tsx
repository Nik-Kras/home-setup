import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../data/store';
import { kv } from '../data/supabase';
import { defaultRoom, isExactSuggestion, quickPicks, suggestItems, type Suggestion } from '../domain/suggestions';
import type { Person } from '../domain/types';
import { colors, fonts, radius, TARGET } from '../theme/tokens';
import { AddBar } from './AddBar';
import { ChipScroller } from './ChipScroller';
import { ChoiceChip } from './ChoiceChip';
import { NAME } from './TaskRow';
import { Icon, IconTile, itemGlyph } from './ui';

const LAST_ROOM = 'homesetup.last-room.v1';
type Who = 'me' | 'other' | 'none';

/**
 * The Item side of the add screen (Add.png): suggestions as you type with their glyph and room, "Add
 * as new", and the optional details: room, who buys it and urgent. The room always shows which one
 * the item goes in: the suggestion's, else guessed from the name, else the last one used.
 */
export function AddItemForm({ text, setText, onDone }: { text: string; setText: (t: string) => void; onDone: () => void }) {
  const { me, items, rooms, addItem } = useStore();
  const insets = useSafeAreaInsets();
  const other: Person = me === 'nikita' ? 'daryna' : 'nikita';
  const [picked, setPicked] = useState<string>();
  const [suggested, setSuggested] = useState<string>();
  const [lastUsed, setLastUsed] = useState<string>();
  const [who, setWho] = useState<Who>('me');
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    let alive = true;
    void kv.getItem(LAST_ROOM).then((r) => { if (alive && r) setLastUsed(r); }, () => undefined);
    return () => { alive = false; };
  }, []);

  const roomNames = useMemo(() => rooms.map((r) => r.name), [rooms]);
  const room = defaultRoom({ picked, suggested, name: text, lastUsed, rooms: roomNames });
  const list = useMemo(() => suggestItems(text, items), [text, items]);
  const picks = useMemo(() => (text.trim() ? [] : quickPicks(items, 6)), [text, items]);
  const typed = text.trim();

  const type = (t: string) => {
    setText(t);
    setSuggested(undefined); // a suggestion's room no longer applies once the name is changed by hand
  };
  const fill = (s: Suggestion) => {
    setText(s.name);
    setSuggested(s.room);
  };
  const add = (name: string, itemRoom = room) => {
    if (!name.trim()) return;
    addItem(name, { room: itemRoom, urgent, assignedTo: who === 'me' ? me : who === 'other' ? other : undefined });
    if (itemRoom) void kv.setItem(LAST_ROOM, itemRoom).catch(() => undefined);
    onDone();
  };
  // A suggestion's own room wins over the default, unless the person picked one.
  const addSuggestion = (s: Suggestion) => add(s.name, defaultRoom({ picked, suggested: s.room, name: s.name, lastUsed, rooms: roomNames }));

  return (
    <>
      <View style={s.barWrap}>
        <AddBar value={text} onChange={type} onSubmit={() => add(text)} placeholder="Add something..." label="Add an item" addLabel="Add item" />
      </View>

      <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        {list.length > 0 || picks.length > 0 ? <Text style={s.label} accessibilityRole="header">Suggestions</Text> : null}
        {list.map((sg) => {
          const g = itemGlyph(sg);
          const meta = sg.onList ? `Already on the list${sg.room ? ` · ${sg.room}` : ''}` : sg.room ? `Goes in ${sg.room}` : 'No room';
          return (
            <View key={sg.name} style={s.row}>
              <Pressable onPress={() => fill(sg)} accessibilityRole="button" accessibilityLabel={`${sg.name}, ${meta}`} accessibilityHint="Fills in the name and room" style={s.rowMain}>
                <IconTile icon={g.icon} tone={g.tone} />
                <View style={s.mid}>
                  <Text style={s.name} numberOfLines={1}>{sg.name}</Text>
                  <Text style={s.meta} numberOfLines={1}>{meta}</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => addSuggestion(sg)} accessibilityRole="button" accessibilityLabel={`Add ${sg.name}`} hitSlop={6} style={({ pressed }) => [s.plusHit, pressed && { opacity: 0.6 }]}>
                <View style={s.plus}><Icon name="plus" size={16} color={colors.text} stroke={2.4} /></View>
              </Pressable>
            </View>
          );
        })}
        {typed && !isExactSuggestion(typed, list) ? (
          <Pressable onPress={() => add(typed)} accessibilityRole="button" accessibilityLabel={`Add ${typed} as new`} style={({ pressed }) => [s.row, s.newRow, pressed && { opacity: 0.7 }]}>
            <View style={s.newTile}><Icon name="plus" size={22} color={colors.text} stroke={2.2} /></View>
            <Text style={[s.name, s.mid]} numberOfLines={2}>Add "{typed}" as new</Text>
          </Pressable>
        ) : null}
        {picks.length > 0 ? (
          <ChipScroller id="quickFade" label="Common things">
            {picks.map((p) => <ChoiceChip key={p.name} label={p.name} selected={false} hint="Fills in the name and room" onPress={() => fill(p)} />)}
          </ChipScroller>
        ) : null}

        <Text style={[s.label, s.gapTop]} accessibilityRole="header">Details (optional)</Text>
        <ChipScroller id="roomFade" label="Room">
          {roomNames.map((r) => <ChoiceChip key={r} label={r} selected={room === r} onPress={() => setPicked(r)} />)}
        </ChipScroller>
        <View style={s.wrapRow} accessibilityLabel="Who buys it">
          <ChoiceChip label="Me" selected={who === 'me'} onPress={() => setWho('me')} />
          <ChoiceChip label={NAME[other]} selected={who === 'other'} onPress={() => setWho('other')} />
          <ChoiceChip label="Unclaimed" selected={who === 'none'} onPress={() => setWho('none')} />
          <Pressable onPress={() => setUrgent((u) => !u)} accessibilityRole="switch" accessibilityState={{ checked: urgent }} accessibilityLabel="Urgent" style={[s.urgent, urgent && s.urgentOn]}>
            <Text style={s.urgentMark}>!</Text>
            <Text style={s.urgentText}>Urgent</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  barWrap: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  body: { paddingHorizontal: 16, gap: 8 },
  label: { marginHorizontal: 4, marginTop: 2, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 16, color: colors.textSecondary },
  gapTop: { marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 8, paddingLeft: 8, paddingRight: 12, backgroundColor: colors.surface, borderRadius: radius.row, borderWidth: 1, borderColor: colors.hairline },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  mid: { flex: 1, minWidth: 0, gap: 1 },
  name: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 20, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  plusHit: { width: TARGET, height: TARGET, alignItems: 'center', justifyContent: 'center', marginRight: -6 },
  plus: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  newRow: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.38)' },
  newTile: { width: 44, height: 44, borderRadius: radius.tile, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  // Wraps rather than scrolls, so Urgent is never hidden off the edge.
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  urgent: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: TARGET, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface },
  urgentOn: { borderWidth: 1.5, borderColor: colors.coral, backgroundColor: colors.coralFill, paddingHorizontal: 15 },
  urgentMark: { fontFamily: fonts.semibold, fontSize: 15, color: colors.coral },
  urgentText: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18, color: colors.coral },
});
