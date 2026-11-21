import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Screen } from '../../components/Screen';
import { Card, Icon, IconTile, SectionHeading, StatusChip, Sub, Title, UrgentBadge, glyphFor, PersonDisc } from '../../components/ui';
import { useStore } from '../../data/store';
import { counts, guessRoom, isItemDone, leftByRoom, nextUp } from '../../domain/items';
import type { Item } from '../../domain/types';
import { colors, fonts, radius, TARGET } from '../../theme/tokens';

const today = () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

function Ring({ done, total }: { done: number; total: number }) {
  const r = 23;
  const c = 2 * Math.PI * r;
  const frac = total === 0 ? 0 : done / total;
  return (
    <View style={{ width: 56, height: 56 }} accessible accessibilityLabel={`${done} of ${total} got`}>
      <Svg width={56} height={56} viewBox="0 0 56 56">
        <Circle cx={28} cy={28} r={r} stroke={colors.track} strokeWidth={6} fill="none" />
        <Circle cx={28} cy={28} r={r} stroke={colors.mint} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 28 28)" />
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <View style={s.ringLabel}><Text style={s.ringNum}>{done}</Text><Text style={s.ringTotal}>/{total}</Text></View>
      </View>
    </View>
  );
}

function AddBar({ onAdd }: { onAdd: (name: string) => void }) {
  const [text, setText] = useState('');
  const ref = useRef<ComponentRef<typeof TextInput>>(null);
  const submit = () => {
    if (!text.trim()) return;
    onAdd(text);
    setText('');
    ref.current?.focus(); // keyboard stays open for the next item
  };
  return (
    <View style={s.addBar}>
      <TextInput
        ref={ref}
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        submitBehavior="submit"
        returnKeyType="done"
        placeholder="Add something..."
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel="Add an item"
        style={s.addInput}
      />
      <Pressable onPress={submit} accessibilityRole="button" accessibilityLabel="Add item" style={s.addBtn}>
        <Icon name="plus" size={20} color={colors.onMint} stroke={2.6} />
      </Pressable>
    </View>
  );
}

function ItemRow({ item, onGot }: { item: Item; onGot: () => void }) {
  const meta = [item.assignedTo ? (item.assignedTo === 'nikita' ? 'Nikita' : 'Daryna') : 'Not claimed yet', item.estPrice ? `£${item.estPrice}` : null].filter(Boolean).join(' · ');
  return (
    <View style={s.row}>
      <Pressable onPress={onGot} accessibilityRole="button" accessibilityLabel={`Mark ${item.name} as got`} hitSlop={2}>
        <IconTile icon={glyphFor(item.name)} />
      </Pressable>
      <Pressable onPress={() => router.push(`/item/${item.id}`)} accessibilityRole="button" accessibilityLabel={`Open ${item.name}`} style={s.rowMid}>
        <View style={s.nameLine}><Text style={s.name} numberOfLines={2}>{item.name}</Text>{item.urgent ? <UrgentBadge /> : null}</View>
        <View style={s.metaLine}>
          {item.assignedTo ? <PersonDisc person={item.assignedTo} size={16} /> : null}
          <Text style={s.meta}>{meta}{item.urgent ? ' · Urgent' : ''}</Text>
        </View>
      </Pressable>
      <StatusChip status={item.status} />
    </View>
  );
}

export default function Buy() {
  const { items, addItem, gotItem } = useStore();
  const [showDone, setShowDone] = useState(false);
  const { done, left, total } = counts(items);
  const next = nextUp(items);
  const groups = leftByRoom(items);
  const doneItems = items.filter(isItemDone);

  return (
    <Screen
      header={
        <View>
          <Title>Our flat</Title>
          <Sub>{today()} · {left} left</Sub>
        </View>
      }
    >
      {next ? (
        <Card style={s.next}>
          <Ring done={done} total={total} />
          <View style={{ flex: 1 }}>
            <Text style={s.nextEyebrow}>{next.urgent ? 'Next up · urgent' : 'Next up'}</Text>
            <Text style={s.nextName} numberOfLines={1}>{next.name}</Text>
            <Text style={s.meta}>{[next.room, next.estPrice ? `about £${next.estPrice}` : null].filter(Boolean).join(' · ')}</Text>
          </View>
          <Pressable onPress={() => gotItem(next.id)} accessibilityRole="button" accessibilityLabel={`Mark ${next.name} as got`} style={s.gotBtn}>
            <Text style={s.gotText}>Got it</Text>
          </Pressable>
        </Card>
      ) : null}

      <AddBar onAdd={(name) => addItem(name, { room: guessRoom(name) })} />

      {groups.map((g) => (
        <View key={g.room} style={{ gap: 6 }}>
          <SectionHeading meta={`${g.items.length} left`}>{g.room}</SectionHeading>
          {g.items.map((i) => <ItemRow key={i.id} item={i} onGot={() => gotItem(i.id)} />)}
        </View>
      ))}

      <Pressable onPress={() => setShowDone((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showDone }} style={s.doneToggle}>
        <Text style={s.doneText}>Got it ({done})</Text>
      </Pressable>
      {showDone ? doneItems.map((i) => <ItemRow key={i.id} item={i} onGot={() => undefined} />) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  next: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, backgroundColor: colors.surfaceRaised, borderColor: 'rgba(94,224,184,0.38)' },
  nextEyebrow: { fontFamily: fonts.medium, fontSize: 12, color: colors.coral },
  nextName: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 30, color: colors.text },
  gotBtn: { height: TARGET, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  gotText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onMint },
  ringLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ringNum: { fontFamily: fonts.serif, fontSize: 21, color: colors.text },
  ringTotal: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  addBar: { flexDirection: 'row', alignItems: 'center', height: 54, borderRadius: 27, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: colors.surface, paddingLeft: 18, paddingRight: 5, marginVertical: 4 },
  addInput: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.text, height: '100%' },
  addBtn: { width: TARGET, height: TARGET, borderRadius: 22, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 8, paddingLeft: 8, paddingRight: 12, backgroundColor: colors.surface, borderRadius: radius.row, borderWidth: 1, borderColor: colors.hairline },
  rowMid: { flex: 1, gap: 1, alignSelf: 'stretch', justifyContent: 'center' },
  nameLine: { flexDirection: 'row', alignItems: 'center' },
  name: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 20, color: colors.text, flexShrink: 1 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  doneToggle: { minHeight: TARGET, justifyContent: 'center', paddingHorizontal: 4 },
  doneText: { fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary },
});
