import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityLine } from '../../components/ActivityLine';
import { FieldGroup, FieldRow, LinkRow, StatusCard, ToggleRow } from '../../components/ItemParts';
import { ItemPhotos } from '../../components/ItemPhotos';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Sheet, SheetButton, SheetOption, TextSheet } from '../../components/Sheet';
import { glyphFor, Icon } from '../../components/ui';
import { useStore } from '../../data/store';
import { actorName, clearedDatesWarning, formatMoney, ITEM_STATUS_LABEL, itemMeta, nextStatus, parseLink, parsePrice, roomOptions } from '../../domain/items';
import type { ItemStatus, Person } from '../../domain/types';
import { colors, fonts, personColor, TARGET } from '../../theme/tokens';

type SheetName = 'name' | 'assignedTo' | 'price' | 'boughtBy' | 'link' | 'room';

const PEOPLE: { value: Person | undefined; label: string }[] = [
  { value: undefined, label: 'Nobody' },
  { value: 'nikita', label: 'Nikita' },
  { value: 'daryna', label: 'Daryna' },
];

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, rooms, auth, sync, updateItem, setItemStatus } = useStore();
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState<SheetName | null>(null);
  /** A backward stepper tap that would clear a date waits here for confirmation. */
  const [moveBack, setMoveBack] = useState<{ status: ItemStatus; warning: string } | null>(null);
  const item = items.find((i) => i.id === id);
  const close = () => setSheet(null);
  const loading = auth === 'loading' || sync === 'pending';

  const header = <ScreenHeader onBack={back} backLabel="Back to list" />;

  if (!item) {
    // On a cold start items are not loaded yet: show a neutral loading state, not "gone".
    return (
      <View style={s.root}>
        {header}
        {loading ? (
          <View style={s.loading} accessible accessibilityLabel="Loading item" accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.textSecondary} />
          </View>
        ) : (
          <Text style={s.missing}>This item is no longer on the list.</Text>
        )}
      </View>
    );
  }

  const link = item.link ? parseLink(item.link) : undefined;
  const person = (p: Person | undefined) => (p ? actorName(p) : 'Nobody');
  const priceValue = item.actualPrice !== undefined ? formatMoney(item.actualPrice) : item.estPrice !== undefined ? `${formatMoney(item.estPrice)} est.` : 'Add';
  const pick = (patch: Parameters<typeof updateItem>[1]) => {
    updateItem(item.id, patch);
    close();
  };
  const setStatus = (status: ItemStatus) => {
    const warning = clearedDatesWarning(item, status);
    if (warning) setMoveBack({ status, warning });
    else setItemStatus(item.id, status);
  };

  return (
    <View style={s.root}>
      {header}
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={s.titleBlock}>
          <View style={s.glyph}>
            <Icon name={glyphFor(item.name)} size={38} color="#D5DBD7" stroke={1.5} />
          </View>
          <View style={s.titleText}>
            <Pressable onPress={() => setSheet('name')} style={s.nameTarget} accessibilityRole="button" accessibilityLabel={`${item.name}${item.urgent ? ', urgent' : ''}`} accessibilityHint="Edit the name">
              <Text style={s.name}>{item.name}</Text>
            </Pressable>
            <Text style={s.meta}>{itemMeta(item)}</Text>
          </View>
        </View>

        <StatusCard item={item} onSet={setStatus} onNext={() => setItemStatus(item.id, nextStatus(item))} />

        <FieldGroup>
          <FieldRow first label="Assigned to" value={person(item.assignedTo)} tone={item.assignedTo ? 'value' : 'empty'} dot={item.assignedTo && personColor[item.assignedTo]} onPress={() => setSheet('assignedTo')} />
          <FieldRow label="Price" value={priceValue} tone={item.actualPrice !== undefined ? 'value' : item.estPrice !== undefined ? 'empty' : 'action'} a11yValue={item.actualPrice === undefined ? (item.estPrice !== undefined ? `not paid yet, estimate ${formatMoney(item.estPrice)}` : 'not set') : undefined} onPress={() => setSheet('price')} />
          <FieldRow label="Bought by" value={person(item.boughtBy)} tone={item.boughtBy ? 'value' : 'empty'} dot={item.boughtBy && personColor[item.boughtBy]} onPress={() => setSheet('boughtBy')} />
          {link ? (
            <LinkRow onEdit={() => setSheet('link')} onOpen={() => void Linking.openURL(link).catch(() => undefined)} />
          ) : (
            <FieldRow label="Product page" value={item.link ? 'Fix link' : 'Add'} tone="action" onPress={() => setSheet('link')} />
          )}
          <FieldRow label="Room" value={item.room ?? 'None'} tone={item.room ? 'value' : 'empty'} onPress={() => setSheet('room')} />
          <ItemPhotos itemId={item.id} itemName={item.name} />
        </FieldGroup>

        <FieldGroup>
          <ToggleRow first label="Urgent" tone="coral" value={item.urgent} onChange={(urgent) => updateItem(item.id, { urgent })} />
          <ToggleRow label="Needs installing" value={item.needsInstall} onChange={(needsInstall) => updateItem(item.id, { needsInstall })} />
        </FieldGroup>

        <View style={s.activity}>
          <ActivityLine text={`Added ${shortDate(item.addedAt)}`} />
          <ActivityLine actor={item.updatedBy} text="made the last change" />
        </View>
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
      <TextSheet
        visible={sheet === 'price'}
        title="Price paid"
        initial={item.actualPrice !== undefined ? String(item.actualPrice) : ''}
        placeholder="0.00"
        helper={item.estPrice !== undefined ? `Estimate ${formatMoney(item.estPrice)}. Leave empty if not paid yet.` : 'Leave empty if not paid yet.'}
        keyboardType="decimal-pad"
        autoCapitalize="none"
        validate={(t) => (parsePrice(t) === null ? 'Enter an amount like 84.99' : undefined)}
        onSave={(t) => updateItem(item.id, { actualPrice: parsePrice(t) ?? undefined })}
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
      <Sheet visible={moveBack !== null} title={moveBack ? `Move back to ${ITEM_STATUS_LABEL[moveBack.status]}?` : ''} onClose={() => setMoveBack(null)} closeLabel="Cancel">
        <Text style={s.confirmText}>{moveBack?.warning}</Text>
        <SheetButton
          label="Move back"
          primary
          onPress={() => {
            if (moveBack) setItemStatus(item.id, moveBack.status);
            setMoveBack(null);
          }}
        />
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loading: { paddingTop: 32, alignItems: 'center' },
  missing: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, paddingHorizontal: 20, paddingTop: 12 },
  content: { paddingHorizontal: 16, gap: 12 },
  titleBlock: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 4 },
  glyph: { width: 72, height: 72, borderRadius: 22, backgroundColor: colors.neutralFill, borderWidth: 1, borderColor: colors.hairline, alignItems: 'center', justifyContent: 'center' },
  titleText: { flex: 1, gap: 2 },
  nameTarget: { minHeight: TARGET, justifyContent: 'center' },
  name: { fontFamily: fonts.serif, fontSize: 38, lineHeight: 42, letterSpacing: -0.5, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  activity: { gap: 8, paddingHorizontal: 16, paddingTop: 4 },
  roomList: { maxHeight: 360 },
  confirmText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.textSecondary, paddingHorizontal: 4, paddingBottom: 8 },
});
