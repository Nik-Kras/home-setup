import { useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../data/store';
import { formatMoney, parsePrice } from '../domain/items';
import type { Item, Person } from '../domain/types';
import { ChoiceChip } from './ChoiceChip';
import { colors, fonts, radius, TARGET } from '../theme/tokens';

/** How long the Undo snackbar stays. Longer with a screen reader, so there is time to reach the button. */
const SNACK_MS = 6_000;
const SNACK_MS_SCREEN_READER = 15_000;
/** Taps on Undo this soon after the snackbar appears are ignored: they were meant for what was there. */
const UNDO_GUARD_MS = 300;
/** An untouched "Paid?" prompt hides after this long. */
const PROMPT_MS = 20_000;
/** The floating tab bar: 64 high, at least 12 above the bottom edge (see TabBar). */
const TAB_BAR = 64;

function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/**
 * The app-wide bottom layer: the Undo snackbar ("Kettle → Ordered  Undo") after any edit, and the
 * optional "Paid?" prompt after an item arrives. It floats above the tab bar on the tabs, above the
 * footer on a task, and above the keyboard when one is open.
 */
export function UndoBar() {
  const { snack, undo, dismissSnack, pricePrompt, closePricePrompt, items } = useStore();
  const segments = useSegments() as string[];
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  // Android's keyboard height may leave out the navigation bar; a little extra gap is better than overlap.
  const bottom = keyboard > 0
    ? keyboard + (Platform.OS === 'android' ? insets.bottom : 0) + 8
    : segments[0] === '(tabs)' ? Math.max(insets.bottom, 12) + TAB_BAR + 10
      : segments[0] === 'task' ? insets.bottom + 92
        : insets.bottom + 16;

  const shownAt = useRef(0);
  useEffect(() => {
    if (!snack) return;
    shownAt.current = Date.now();
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    AccessibilityInfo.announceForAccessibility(snack.spoken);
    void AccessibilityInfo.isScreenReaderEnabled().catch(() => false).then((reader) => {
      if (alive) timer = setTimeout(() => dismissSnack(snack.key), reader ? SNACK_MS_SCREEN_READER : SNACK_MS);
    });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [snack, dismissSnack]);

  const arrived = items.find((i) => i.id === pricePrompt);
  // Hidden again if the item was moved back (Undo), got a price elsewhere, or was deleted.
  const ask = arrived && (arrived.status === 'delivered' || arrived.status === 'installed') && arrived.actualPrice === undefined ? arrived : undefined;
  if (!snack && !ask) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View pointerEvents="box-none" style={[s.stack, { bottom }]}>
        {ask ? <PricePrompt key={ask.id} item={ask} onDone={closePricePrompt} /> : null}
        {snack ? (
          <View style={s.snack}>
            <Text style={s.snackText} numberOfLines={2}>{snack.message}</Text>
            {snack.canUndo ? (
              <Pressable onPress={() => Date.now() - shownAt.current >= UNDO_GUARD_MS && undo()} accessibilityRole="button" accessibilityLabel={`Undo: ${snack.spoken.replace(/ Undo available\.$/, '')}`} hitSlop={4} style={({ pressed }) => [s.undo, pressed && s.pressed]}>
                <Text style={s.undoText}>Undo</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const PEOPLE: { value: Person; label: string }[] = [{ value: 'nikita', label: 'Nikita' }, { value: 'daryna', label: 'Daryna' }];

/**
 * "Paid for Kettle? Paid by [Nikita] [Daryna] £___ [Save] [Skip]". Who paid starts as the item's
 * buyer if known, otherwise me, and is saved with the price so the Budget split adds up. Optional,
 * never blocking, and it remembers nothing.
 */
function PricePrompt({ item, onDone }: { item: Item; onDone: () => void }) {
  const { updateItem, me } = useStore();
  const [text, setText] = useState('');
  const [payer, setPayer] = useState<Person>(item.boughtBy ?? me);
  // Left alone, it goes away by itself: nothing is asked twice and nothing is remembered.
  const [engaged, setEngaged] = useState(false);
  useEffect(() => {
    if (engaged) return;
    const timer = setTimeout(onDone, PROMPT_MS);
    return () => clearTimeout(timer);
  }, [engaged, onDone]);
  const price = parsePrice(text);
  const invalid = price === null;
  const save = () => {
    if (price === null || price === undefined) return;
    updateItem(item.id, { actualPrice: price, boughtBy: payer });
    Keyboard.dismiss();
    onDone();
  };
  const skip = () => {
    Keyboard.dismiss();
    onDone();
  };
  return (
    <View style={s.prompt} accessibilityLiveRegion="polite">
      <Text style={s.promptTitle} numberOfLines={2}>
        Paid for {item.name}?{item.estPrice !== undefined ? <Text style={s.promptHint}>  Estimate {formatMoney(item.estPrice)}</Text> : null}
      </Text>
      <View style={s.promptRow} accessibilityRole="radiogroup" accessibilityLabel="Paid by">
        <Text style={s.paidBy} importantForAccessibility="no" accessibilityElementsHidden>Paid by</Text>
        {PEOPLE.map((p) => (
          <ChoiceChip key={p.value} label={p.label} selected={payer === p.value} a11yLabel={`Paid by ${p.label}`} onPress={() => { setEngaged(true); setPayer(p.value); }} />
        ))}
      </View>
      <View style={s.promptRow}>
        <View style={[s.inputWrap, invalid && s.inputError]}>
          <Text style={s.pound} importantForAccessibility="no" accessibilityElementsHidden>£</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={save}
            onFocus={() => setEngaged(true)}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            returnKeyType="done"
            accessibilityLabel={`Price paid for ${item.name}, in pounds`}
            style={s.input}
          />
        </View>
        <Pressable onPress={save} disabled={price === null || price === undefined} accessibilityRole="button" accessibilityLabel="Save price" accessibilityState={{ disabled: price === null || price === undefined }} style={({ pressed }) => [s.save, (price === null || price === undefined) && s.disabled, pressed && s.pressed]}>
          <Text style={s.saveText}>Save</Text>
        </Pressable>
        <Pressable onPress={skip} accessibilityRole="button" accessibilityLabel="Skip, no price now" style={({ pressed }) => [s.skip, pressed && s.pressed]}>
          <Text style={s.skipText}>Skip</Text>
        </Pressable>
      </View>
      {invalid ? <Text style={s.error} accessibilityLiveRegion="polite">Enter an amount like 84.99</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  stack: { position: 'absolute', left: 16, right: 16, gap: 8 },
  snack: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, paddingLeft: 16, paddingRight: 6, paddingVertical: 4, borderRadius: radius.row, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairlineStrong, elevation: 10, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  snackText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.text },
  undo: { minHeight: TARGET, minWidth: TARGET, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  undoText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.mint },
  pressed: { opacity: 0.72 },
  prompt: { gap: 8, padding: 12, borderRadius: radius.row, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairlineStrong, elevation: 10, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  promptTitle: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.text, paddingHorizontal: 4 },
  promptHint: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  paidBy: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, paddingHorizontal: 4 },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', height: TARGET, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)', backgroundColor: colors.bg, paddingLeft: 14 },
  // Validation is neutral: amber means in transit and coral means urgent.
  inputError: { borderColor: colors.text },
  pound: { fontFamily: fonts.medium, fontSize: 16, color: colors.textSecondary, marginRight: 4 },
  input: { flex: 1, alignSelf: 'stretch', fontFamily: fonts.regular, fontSize: 16, color: colors.text, paddingRight: 12 },
  save: { height: TARGET, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onMint },
  disabled: { opacity: 0.4 },
  skip: { height: TARGET, paddingHorizontal: 12, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.textSecondary },
  error: { fontFamily: fonts.regular, fontSize: 13, color: colors.text, paddingHorizontal: 4 },
});
