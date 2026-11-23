import { router } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { EmptyState } from '../../components/EmptyState';
import { ListGate, useListState } from '../../components/LoadState';
import { PersonFilterDiscs } from '../../components/PersonFilterDiscs';
import { StatusChipButton } from '../../components/StatusChipButton';
import { StatusSheet } from '../../components/StatusSheet';
import { PriceSheet } from '../../components/PaidForm';
import { ROW_GAP, SectionScreen } from '../../components/SectionScreen';
import { NAME } from '../../components/TaskRow';
import { Card, Icon, IconTile, itemGlyph, PersonDot, SectionHeading, Sub, Title, UrgentBadge } from '../../components/ui';
import { useStore } from '../../data/store';
import { counts, isItemDone, leftByRoom, needsPrice, nextUpAction, nextUpFor, rowGotIt } from '../../domain/items';
import { itemsForPerson, type PersonFilter } from '../../domain/personFilter';
import type { Item, Person } from '../../domain/types';
import { colors, fonts, glow, radius, TARGET } from '../../theme/tokens';

const today = () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

function Ring({ done, total }: { done: number; total: number }) {
  const r = 23;
  const c = 2 * Math.PI * r;
  const frac = total === 0 ? 0 : done / total;
  return (
    <View style={{ width: 56, height: 56 }} accessible accessibilityLabel={`${done} of ${total} got`}>
      <Svg width={56} height={56} viewBox="0 0 56 56">
        <Circle cx={28} cy={28} r={r} stroke={colors.track} strokeWidth={6} fill="none" />
        <Circle cx={28} cy={28} r={r} stroke={colors.mint} strokeWidth={6} fill="none" strokeLinecap={frac > 0 ? 'round' : 'butt'} strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 28 28)" />
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <View style={s.ringLabel}><Text style={s.ringNum}>{done}</Text><Text style={s.ringTotal}>/{total}</Text></View>
      </View>
    </View>
  );
}

/**
 * "Add something..." opens the add screen (Add.png) with the keyboard up, where suggestions, the room,
 * who buys it and urgent can be chosen. One target: the whole bar, its mint plus included.
 */
function AddBar() {
  return (
    <Pressable onPress={() => router.push('/add-item')} accessibilityRole="button" accessibilityLabel="Add an item" accessibilityHint="Opens the add screen" style={({ pressed }) => [s.addBar, pressed && { opacity: 0.85 }]}>
      <Text style={s.addPlaceholder} numberOfLines={1}>Add something...</Text>
      <View style={s.addBtn}><Icon name="plus" size={20} color={colors.onMint} stroke={2.6} /></View>
    </Pressable>
  );
}

/**
 * Memoised: `item` keeps its identity until it changes and the callbacks are stable, so 300 rows stay
 * cheap. Compact as in the design: name and one meta line. Tile and name open the item; the status
 * chip (every stage, forwards or backwards) and one small pill change things here: "Got it" (straight
 * to Delivered) on my or an unclaimed item still Needed or Looking, or "Add price" on an ordered or got
 * item with no paid price. An unclaimed thing shows "I'll buy it" where the owner would be (one tap
 * claims it for me; Undo puts it back). A row just added is outlined in mint while its snackbar shows.
 */
const ItemRow = memo(function ItemRow({ item, me, fresh, onStatus, onPrice, onGot, onClaim }: { item: Item; me: Person; fresh: boolean; onStatus: (id: string) => void; onPrice: (id: string) => void; onGot: (id: string) => void; onClaim: (id: string) => void }) {
  const meta = [item.assignedTo ? NAME[item.assignedTo] : 'Not claimed yet', item.estPrice ? `£${item.estPrice}` : null].filter(Boolean).join(' · ');
  const price = needsPrice(item);
  const got = rowGotIt(item, me);
  const pill = price ? { label: 'Add price', action: 'addPrice', run: () => onPrice(item.id) } : got ? { label: 'Got it', action: 'gotIt', run: () => onGot(item.id) } : null;
  const claimable = !item.assignedTo && !isItemDone(item);
  const shown = claimable ? (item.estPrice ? `£${item.estPrice}` : '') : meta;
  const actions = [...(claimable ? [{ name: 'claim', label: "I'll buy it" }] : []), ...(pill ? [{ name: pill.action, label: pill.label === 'Got it' ? 'Got it, straight to Delivered' : pill.label }] : [])];
  return (
    <View style={[s.row, fresh && s.rowFresh]}>
      {/* Same target as the name; hidden from screen readers so the row is not announced twice. */}
      <Pressable onPress={() => router.push(`/item/${item.id}`)} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" hitSlop={2}>
        <IconTile {...itemGlyph(item)} />
      </Pressable>
      <Pressable
        onPress={() => router.push(`/item/${item.id}`)}
        accessibilityRole="button"
        accessibilityLabel={[item.name, item.urgent ? 'Urgent' : null, meta, price ? 'no price yet' : null].filter(Boolean).join(', ')}
        accessibilityHint="Opens details"
        // Screen readers reach the pill as an action on the row (it sits inside it).
        accessibilityActions={actions.length > 0 ? actions : undefined}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'claim') onClaim(item.id);
          else if (pill && e.nativeEvent.actionName === pill.action) pill.run();
        }}
        style={s.rowMid}
      >
        <View style={s.nameLine}><Text style={s.name} numberOfLines={1}>{item.name}</Text>{item.urgent ? <UrgentBadge /> : null}</View>
        <View style={s.metaLine}>
          {item.assignedTo ? <PersonDot person={item.assignedTo} /> : null}
          {claimable ? (
            // Same 44dp target as the other pill: 24 high plus 10 above and below.
            <Pressable onPress={() => onClaim(item.id)} hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }} importantForAccessibility="no" style={({ pressed }) => [s.rowPill, s.claimPill, pressed && { opacity: 0.7 }]}>
              <Text style={[s.rowPillText, s.claimText]}>I'll buy it</Text>
            </Pressable>
          ) : null}
          {!shown ? (item.urgent && !pill ? <UrgentMeta meta="" /> : null) : pill ? <Text style={s.metaOne} numberOfLines={1}>{shown}</Text> : item.urgent ? <UrgentMeta key={shown} meta={shown} /> : <Text style={s.metaOne} numberOfLines={1}>{shown}</Text>}
          {pill ? (
            // 24 high plus 10 above and below: a 44dp target in the compact row.
            <Pressable onPress={pill.run} hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }} importantForAccessibility="no" style={({ pressed }) => [s.rowPill, pressed && { opacity: 0.7 }]}>
              <Text style={s.rowPillText}>{pill.label}</Text>
            </Pressable>
          ) : null}
        </View>
      </Pressable>
      <StatusChipButton status={item.status} name={item.name} onPress={() => onStatus(item.id)} />
    </View>
  );
});

const DONE = 'done';
type BuySection = { key: string; title: string; meta?: string; data: Item[] };

/**
 * An urgent row's meta line ends with the coral word "Urgent" when it fits on one line. If it would
 * wrap, the word is dropped and the "!" badge (labelled Urgent) carries the meaning alone.
 */
function UrgentMeta({ meta }: { meta: string }) {
  const [fits, setFits] = useState(true);
  return (
    <Text
      style={s.metaOne}
      numberOfLines={fits ? undefined : 1}
      onTextLayout={fits ? (e) => { if (e.nativeEvent.lines.length > 1) setFits(false); } : undefined}
    >
      {meta}{fits ? <Text> · <Text style={s.urgentWord}>Urgent</Text></Text> : null}
    </Text>
  );
}

export default function Buy() {
  const { items, me, snack, advanceItem, setItemStatus, updateItem } = useStore();
  const claim = useCallback((id: string) => updateItem(id, { assignedTo: me }), [updateItem, me]);
  // The item just added (its "Added to <room>" snackbar is up) is outlined so it is easy to spot.
  const fresh = snack?.changeItemId;
  const [statusFor, setStatusFor] = useState<string | null>(null);
  const closeStatus = useCallback(() => setStatusFor(null), []);
  const [priceFor, setPriceFor] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [person, setPerson] = useState<PersonFilter>(null);
  const ready = useListState(items.length) === 'ready';
  const { done, left, total } = useMemo(() => counts(items), [items]);
  // Next up follows the person filter; with no filter it prefers what is mine or not claimed yet.
  const next = useMemo(() => nextUpFor(items, person, me), [items, person, me]);
  const nextAction = next ? nextUpAction(next, person, me) : null;
  const gotIt = useCallback((id: string) => setItemStatus(id, 'delivered'), [setItemStatus]);
  // The filter narrows Next up, the room list and the "Got it" list; the ring stays for the whole flat.
  const sections = useMemo<BuySection[]>(() => {
    const shown = itemsForPerson(items, person);
    const list: BuySection[] = leftByRoom(shown).map((g) => ({ key: g.room, title: g.room, meta: `${g.items.length} left`, data: g.items }));
    const doneItems = shown.filter(isItemDone);
    if (doneItems.length > 0) list.push({ key: DONE, title: `Got it (${doneItems.length})`, meta: String(doneItems.length), data: showDone ? doneItems : [] });
    return list;
  }, [items, person, showDone]);

  const empty = person
    ? <Text style={s.emptyFilter}>Nothing assigned to {NAME[person]} yet.</Text>
    : <EmptyState icon="buy" title="Nothing on the list yet" line="Type what you need in the bar above, such as a kettle or curtains." />;

  return (
    <SectionScreen<Item, BuySection>
      header={
        <View style={s.header}>
          <View style={s.headerText}>
            <Title>Our flat</Title>
            <Sub>{ready ? `${today()} · ${left} left` : today()}</Sub>
          </View>
          <PersonFilterDiscs value={person} onChange={setPerson} />
        </View>
      }
      sections={ready ? sections : []}
      keyExtractor={(i) => i.id}
      ListHeaderComponent={
        <View style={s.listHeader}>
          {next && nextAction ? (
            <Card style={s.next}>
              <Ring done={done} total={total} />
              <View style={{ flex: 1 }}>
                <Text style={[s.nextEyebrow, next.urgent && { color: colors.coral }]}>{next.urgent ? 'Next up · urgent' : 'Next up'}</Text>
                {/* A single word stays on one line and shrinks to fit, so it never breaks mid-word beside a long button label. */}
                <Text style={[s.nextName, next.name.length > 14 && s.nextNameLong]} numberOfLines={/\s/.test(next.name.trim()) ? 2 : 1} adjustsFontSizeToFit minimumFontScale={0.6}>{next.name}</Text>
                <Text style={s.meta} numberOfLines={1}>{[next.room, next.estPrice ? `about £${next.estPrice}` : null, next.assignedTo === undefined ? 'Not claimed yet' : next.assignedTo !== me ? `For ${NAME[next.assignedTo]}` : null].filter(Boolean).join(' · ')}</Text>
              </View>
              <View style={s.nextActions}>
                {nextAction.kind === 'open' ? (
                  // The other person's item (no filter on): not pushed on me as a step; opens it instead.
                  <Pressable onPress={() => router.push(`/item/${next.id}`)} accessibilityRole="button" accessibilityLabel={`${nextAction.label}, open ${next.name}`} style={({ pressed }) => [s.jumpBtn, s.openBtn, pressed && { opacity: 0.7 }]}>
                    <Text style={s.jumpText}>{nextAction.label}</Text>
                  </Pressable>
                ) : (
                  <>
                    {/* One stage at a time, never straight to the end: "Mark looking", "Mark ordered", "Got it", "Mark installed". */}
                    <Pressable onPress={() => advanceItem(next.id)} accessibilityRole="button" accessibilityLabel={`${nextAction.label}: ${next.name}`} style={s.gotBtn}>
                      <Text style={s.gotText}>{nextAction.label}</Text>
                    </Pressable>
                    {/* The shop case, clearly labelled: bought on the spot, straight to Delivered (Undo puts it back). */}
                    {nextAction.jump ? (
                      <Pressable onPress={() => setItemStatus(next.id, 'delivered')} accessibilityRole="button" accessibilityLabel={`Got it (straight to Delivered): ${next.name}`} hitSlop={{ top: 4, bottom: 4 }} style={({ pressed }) => [s.jumpBtn, pressed && { opacity: 0.7 }]}>
                        <Text style={s.jumpText}>Got it</Text>
                      </Pressable>
                    ) : null}
                  </>
                )}
              </View>
            </Card>
          ) : null}
          <AddBar />
          <StatusSheet item={items.find((i) => i.id === statusFor)} visible={statusFor !== null} onClose={closeStatus} onPick={(status) => statusFor && setItemStatus(statusFor, status)} />
          <PriceSheet item={items.find((i) => i.id === priceFor)} onClose={() => setPriceFor(null)} />
        </View>
      }
      ListEmptyComponent={<View style={s.gap}><ListGate count={items.length}>{empty}</ListGate></View>}
      renderSectionHeader={({ section }) => section.key === DONE ? (
        <Pressable onPress={() => setShowDone((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showDone }} accessibilityLabel={`Got it, ${section.meta}`} style={[s.doneToggle, showDone && { marginBottom: ROW_GAP }]}>
          <Text style={s.doneText}>{section.title}</Text>
          <View style={{ transform: [{ rotate: showDone ? '180deg' : '0deg' }] }}>
            <Icon name="chevronDown" size={20} color={colors.textSecondary} stroke={2} />
          </View>
        </Pressable>
      ) : (
        <View style={s.sectionBelow}><SectionHeading meta={section.meta}>{section.title}</SectionHeading></View>
      )}
      renderItem={({ item }) => <ItemRow item={item} me={me} fresh={item.id === fresh} onStatus={setStatusFor} onPrice={setPriceFor} onGot={gotIt} onClaim={claim} />}
    />
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  listHeader: { gap: 8 },
  gap: { paddingTop: 8 },
  // The Screen layout's 8 between blocks, then the 6 between a heading and its first row.
  sectionBelow: { paddingTop: ROW_GAP, marginBottom: ROW_GAP },
  headerText: { flex: 1 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 84, paddingVertical: 12, paddingLeft: 14, paddingRight: 12, ...glow },
  nextEyebrow: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  nextName: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 30, color: colors.text },
  nextNameLong: { fontSize: 24, lineHeight: 26 },
  nextActions: { flexShrink: 0, alignItems: 'stretch', gap: 4 },
  gotBtn: { flexShrink: 0, minHeight: TARGET, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  jumpBtn: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  jumpText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  openBtn: { minHeight: TARGET, borderRadius: 22 },
  gotText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onMint },
  ringLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ringNum: { fontFamily: fonts.serif, fontSize: 21, color: colors.text },
  ringTotal: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  addBar: { flexDirection: 'row', alignItems: 'center', minHeight: 54, paddingVertical: 4, borderRadius: 27, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: colors.surface, paddingLeft: 18, paddingRight: 5 },
  addPlaceholder: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.textSecondary },
  addBtn: { width: TARGET, height: TARGET, borderRadius: 22, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  // Compact, as in the design (about six rows on a phone): 44 tile, name and one meta line.
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 5, paddingLeft: 6, paddingRight: 10, backgroundColor: colors.surface, borderRadius: radius.row, borderWidth: 1, borderColor: colors.hairline },
  rowMid: { flex: 1, gap: 1, alignSelf: 'stretch', justifyContent: 'center' },
  nameLine: { flexDirection: 'row', alignItems: 'center' },
  name: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 20, color: colors.text, flexShrink: 1 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  metaOne: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary, flexShrink: 1 },
  urgentWord: { color: colors.coral },
  rowPill: { height: 24, minWidth: TARGET, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(94,224,184,0.5)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowFresh: { borderColor: colors.mint, backgroundColor: colors.surfaceRaised },
  claimPill: { backgroundColor: colors.mintFill, borderColor: 'transparent' },
  claimText: { fontFamily: fonts.semibold },
  rowPillText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 17, color: colors.mint },
  emptyFilter: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, padding: 16 },
  doneToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: TARGET, paddingHorizontal: 4, marginTop: 8 },
  doneText: { fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary },
});
