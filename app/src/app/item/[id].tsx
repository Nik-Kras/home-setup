import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityLine } from '../../components/ActivityLine';
import { FieldGroup, FieldRow, LinkRow, StatusCard, ToggleRow } from '../../components/ItemParts';
import { ItemPhotos } from '../../components/ItemPhotos';
import { QuantityRow } from '../../components/QuantityRow';
import { LoadingState, NotFoundState, OfflineState, useDetailState } from '../../components/LoadState';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Sheet, SheetButton, SheetOption, TextSheet, TextSheetBody } from '../../components/Sheet';
import { Icon, itemGlyph } from '../../components/ui';
import { TintWash } from '../../components/TintWash';
import { useStore } from '../../data/store';
import { useItemActivity } from '../../data/useActivity';
import { itemActivity } from '../../domain/activity';
import { actorName, formatMoney, itemMeta, parseLink, parsePrice, roomOptions } from '../../domain/items';
import type { Person } from '../../domain/types';
import { colors, fonts, personColor, TARGET, tileTone } from '../../theme/tokens';

type SheetName = 'name' | 'assignedTo' | 'estPrice' | 'actualPrice' | 'boughtBy' | 'link' | 'room' | 'notes';

const PEOPLE: { value: Person | undefined; label: string }[] = [
  { value: undefined, label: 'Nobody' },
  { value: 'nikita', label: 'Nikita' },
  { value: 'daryna', label: 'Daryna' },
];

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, rooms, retry, updateItem, setItemStatus, advanceItem, deleteItem } = useStore();
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState<SheetName | null>(null);
  /** Set by Delete, so the screen sliding away shows nothing rather than "Item not found". */
  const [leaving, setLeaving] = useState(false);
  const item = items.find((i) => i.id === id);
  const close = () => setSheet(null);
  const state = useDetailState(item !== undefined);
  // The real history from the activity log when it can be read; reloads only when the item really
  // changes (a periodic refresh hands over new but equal objects).
  const rows = useItemActivity(id, item ? JSON.stringify(item) : '');
  const history = useMemo(() => (rows ? itemActivity(rows, Date.now()) : null), [rows]);

  const header = <ScreenHeader onBack={back} backLabel="Back to list" />;

  if (!item && leaving) return <View style={s.root}>{header}</View>;
  if (!item) {
    // On a cold start items are not loaded yet: show a neutral loading state, not "gone".
    return (
      <View style={s.root}>
        {header}
        <View style={s.missing}>
          {state === 'loading' ? <LoadingState label="Loading item" /> : null}
          {state === 'offline' ? <OfflineState onRetry={retry} /> : null}
          {state === 'missing' ? (
            <NotFoundState title="Item not found" line="It may have been removed on the other phone." backLabel="Back to list" onBack={back} />
          ) : null}
        </View>
      </View>
    );
  }

  const link = item.link ? parseLink(item.link) : undefined;
  const person = (p: Person | undefined) => (p ? actorName(p) : 'Nobody');
  const pick = (patch: Parameters<typeof updateItem>[1]) => {
    updateItem(item.id, patch);
    close();
  };
  // Leave first, then delete: the snackbar on the list offers Undo.
  const remove = () => {
    setLeaving(true);
    back();
    deleteItem(item.id);
  };

  const glyph = itemGlyph(item);
  const tone = tileTone[glyph.tone];
  return (
    <View style={s.root}>
      <TintWash color={tone.fg} />
      {header}
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={s.titleBlock}>
          <View style={[s.glyph, { backgroundColor: tone.fill, borderColor: tone.ring }]}>
            <Icon name={glyph.icon} size={38} color={tone.fg} stroke={1.5} />
          </View>
          <View style={s.titleText}>
            <Pressable onPress={() => setSheet('name')} style={s.nameTarget} accessibilityRole="button" accessibilityLabel={`${item.name}${item.urgent ? ', urgent' : ''}`} accessibilityHint="Edit the name">
              <Text style={s.name}>{item.name}</Text>
            </Pressable>
            <Text style={s.meta}>{itemMeta(item)}</Text>
          </View>
        </View>

        {/* Any stage, forwards or backwards; every change offers Undo, which also restores the dates. */}
        <StatusCard item={item} onSet={(status) => setItemStatus(item.id, status)} onNext={() => advanceItem(item.id)} />

        {/* Right under the stages: whether it needs installing decides where the main button stops. */}
        <FieldGroup>
          <ToggleRow first label="Needs installing" value={item.needsInstall} onChange={(needsInstall) => updateItem(item.id, { needsInstall })} />
          <ToggleRow label="Urgent" tone="coral" value={item.urgent} onChange={(urgent) => updateItem(item.id, { urgent })} />
        </FieldGroup>

        <FieldGroup>
          <FieldRow first label="Assigned to" value={person(item.assignedTo)} tone={item.assignedTo ? 'value' : 'empty'} dot={item.assignedTo && personColor[item.assignedTo]} onPress={() => setSheet('assignedTo')} />
          <FieldRow label="Estimated price" value={item.estPrice !== undefined ? formatMoney(item.estPrice) : 'Add'} tone={item.estPrice !== undefined ? 'value' : 'action'} a11yValue={item.estPrice === undefined ? 'not set' : undefined} onPress={() => setSheet('estPrice')} />
          <FieldRow label="Price paid" value={item.actualPrice !== undefined ? formatMoney(item.actualPrice) : 'Add'} tone={item.actualPrice !== undefined ? 'value' : 'action'} a11yValue={item.actualPrice === undefined ? 'not paid yet' : undefined} onPress={() => setSheet('actualPrice')} />
          <FieldRow label="Bought by" value={person(item.boughtBy)} tone={item.boughtBy ? 'value' : 'empty'} dot={item.boughtBy && personColor[item.boughtBy]} onPress={() => setSheet('boughtBy')} />
          {link ? (
            <LinkRow onEdit={() => setSheet('link')} onOpen={() => void Linking.openURL(link).catch(() => undefined)} />
          ) : (
            <FieldRow label="Product page" value={item.link ? 'Fix link' : 'Add'} tone="action" onPress={() => setSheet('link')} />
          )}
          <FieldRow label="Room" value={item.room ?? 'None'} tone={item.room ? 'value' : 'empty'} onPress={() => setSheet('room')} />
          <QuantityRow value={item.quantity} onChange={(quantity) => quantity >= 1 && updateItem(item.id, { quantity })} />
          <FieldRow label="Notes" value={item.notes ?? 'Add'} tone={item.notes ? 'value' : 'action'} onPress={() => setSheet('notes')} />
          <ItemPhotos itemId={item.id} itemName={item.name} />
        </FieldGroup>

        <View style={s.activity}>
          {history && history.length > 0 ? history.map((h, i) => <ActivityLine key={i} actor={h.actor} text={h.text} />) : (
            <>
              <ActivityLine actor={item.updatedBy} text="made the last change" />
              <ActivityLine text={`Added ${shortDate(item.addedAt)}`} />
            </>
          )}
        </View>

        <SheetButton label="Delete item" onPress={remove} />
      </ScrollView>

      <TextSheet
        visible={sheet === 'name'}
        title="Name"
        initial={item.name}
        placeholder="What is it?"
        validate={(t) => (t.trim() ? undefined : 'Enter a name')}
        onSave={(name) => updateItem(item.id, { name })}
        onClose={close}
      />
      {/* One sheet per price, so the title never changes while a sheet fades out. */}
      {(['estPrice', 'actualPrice'] as const).map((field) => (
        <Sheet key={field} visible={sheet === field} title={field === 'estPrice' ? 'Estimated price' : 'Price paid'} onClose={close} closeLabel="Cancel">
          {sheet === field ? (
            <PriceForm
              title={field === 'estPrice' ? 'Estimated price' : 'Price paid'}
              value={item[field]}
              helper={field === 'estPrice' ? 'What you expect to pay, in pounds.' : item.estPrice !== undefined ? `Estimate ${formatMoney(item.estPrice)}. Leave empty if not paid yet.` : 'Leave empty if not paid yet.'}
              onSave={(n) => updateItem(item.id, { [field]: n })}
              onClose={close}
            />
          ) : null}
        </Sheet>
      ))}
      <TextSheet
        visible={sheet === 'notes'}
        title="Notes"
        initial={item.notes ?? ''}
        placeholder="Size, colour, where to buy..."
        helper="Leave empty to remove the notes."
        validate={() => undefined}
        onSave={(t) => updateItem(item.id, { notes: t.trim() || undefined })}
        onClose={close}
      />
      <TextSheet
        visible={sheet === 'link'}
        title="Product page"
        initial={item.link ?? ''}
        placeholder="shop.example.com/..."
        helper="Leave empty to remove the link."
        keyboardType="url"
        autoCapitalize="none"
        validate={(t) => (parseLink(t) === null ? 'Enter a web address' : undefined)}
        onSave={(t) => updateItem(item.id, { link: parseLink(t) ?? undefined })}
        onClose={close}
      />
      <Sheet visible={sheet === 'assignedTo'} title="Assigned to" onClose={close}>
        {PEOPLE.map((p) => (
          <SheetOption key={p.label} label={p.label} dot={p.value && personColor[p.value]} selected={item.assignedTo === p.value} onPress={() => pick({ assignedTo: p.value })} />
        ))}
      </Sheet>
      <Sheet visible={sheet === 'boughtBy'} title="Bought by" onClose={close}>
        {PEOPLE.map((p) => (
          <SheetOption key={p.label} label={p.label} dot={p.value && personColor[p.value]} selected={item.boughtBy === p.value} onPress={() => pick({ boughtBy: p.value })} />
        ))}
      </Sheet>
      <Sheet visible={sheet === 'room'} title="Room" onClose={close}>
        <ScrollView style={s.roomList}>
          {[undefined, ...roomOptions(rooms.map((r) => r.name), item.room)].map((r) => (
            <SheetOption key={r ?? 'none'} label={r ?? 'None'} selected={item.room === r} onPress={() => pick({ room: r })} />
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}

/** A price in pounds: Save checks it, Clear removes it (shown only when there is one). */
function PriceForm({ title, value, helper, onSave, onClose }: { title: string; value?: number; helper: string; onSave: (n: number | undefined) => void; onClose: () => void }) {
  return (
    <>
      <TextSheetBody
        title={title}
        initial={value !== undefined ? String(value) : ''}
        placeholder="0.00"
        helper={helper}
        keyboardType="decimal-pad"
        autoCapitalize="none"
        validate={(t) => (parsePrice(t) === null ? 'Enter an amount like 84.99' : undefined)}
        onSave={(t) => onSave(parsePrice(t) ?? undefined)}
        onClose={onClose}
      />
      {value !== undefined ? (
        <SheetButton label="Clear price" onPress={() => { onSave(undefined); onClose(); }} />
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  missing: { paddingHorizontal: 16, paddingTop: 12 },
  content: { paddingHorizontal: 16, gap: 12 },
  titleBlock: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 4 },
  glyph: { width: 72, height: 72, borderRadius: 22, backgroundColor: colors.neutralFill, borderWidth: 1, borderColor: colors.hairline, alignItems: 'center', justifyContent: 'center' },
  titleText: { flex: 1, gap: 2 },
  nameTarget: { minHeight: TARGET, justifyContent: 'center' },
  name: { fontFamily: fonts.serif, fontSize: 38, lineHeight: 42, letterSpacing: -0.5, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  activity: { gap: 8, paddingHorizontal: 16, paddingTop: 4 },
  roomList: { maxHeight: 360 },
});
