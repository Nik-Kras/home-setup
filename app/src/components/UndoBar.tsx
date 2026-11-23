import { router, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../data/store';
import { formatMoney, needsPrice } from '../domain/items';
import type { Item } from '../domain/types';
import { PaidForm } from './PaidForm';
import { colors, fonts, radius, TARGET } from '../theme/tokens';

/** The snackbar stays snack.ms (6 s, 10 s for a delete); longer with a screen reader, to reach the button. */
const SNACK_MS_SCREEN_READER = 15_000;
/** Taps on Undo this soon after the snackbar appears are ignored: they were meant for what was there. */
const UNDO_GUARD_MS = 300;
/** An untouched "Paid?" prompt hides after this long; a row's "Add price" chip brings it back. */
const PROMPT_MS = 30_000;
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
  const { snack, undo, dismissSnack, pricePrompt, pricePromptKey, closePricePrompt, items } = useStore();
  const segments = useSegments() as string[];
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  // Android's keyboard height may leave out the navigation bar; a little extra gap is better than overlap.
  const bottom = keyboard > 0
    ? keyboard + (Platform.OS === 'android' ? insets.bottom : 0) + 8
    : segments[0] === '(tabs)' || segments[0] === 'notes' || segments[0] === 'group' ? Math.max(insets.bottom, 12) + TAB_BAR + 10
      // Above the comment bar (68) on an item, and above the comment bar and footer on a task.
      : segments[0] === 'task' ? insets.bottom + 150
        : segments[0] === 'item' ? insets.bottom + 80
          : insets.bottom + 16;

  const shownAt = useRef(0);
  useEffect(() => {
    if (!snack) return;
    shownAt.current = Date.now();
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    AccessibilityInfo.announceForAccessibility(snack.spoken);
    void AccessibilityInfo.isScreenReaderEnabled().catch(() => false).then((reader) => {
      if (alive) timer = setTimeout(() => dismissSnack(snack.key), reader ? Math.max(SNACK_MS_SCREEN_READER, snack.ms) : snack.ms);
    });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [snack, dismissSnack]);

  const arrived = items.find((i) => i.id === pricePrompt);
  // Hidden again if the item was moved back (Undo), got a price elsewhere, or was deleted.
  const ask = arrived && needsPrice(arrived) ? arrived : undefined;
  if (!snack && !ask) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View pointerEvents="box-none" style={[s.stack, { bottom }]}>
        {ask ? <PricePrompt key={`${ask.id}:${pricePromptKey}`} item={ask} onDone={closePricePrompt} /> : null}
        {snack ? (
          <View style={s.snack}>
            <Text style={s.snackText} numberOfLines={2}>{snack.message}</Text>
            {snack.canUndo ? (
              <Pressable onPress={() => Date.now() - shownAt.current >= UNDO_GUARD_MS && undo()} accessibilityRole="button" accessibilityLabel={`Undo: ${snack.spoken.replace(/ Undo available\.$/, '')}`} hitSlop={4} style={({ pressed }) => [s.undo, pressed && s.pressed]}>
                <Text style={s.undoText}>Undo</Text>
              </Pressable>
            ) : null}
            {/* After adding an item: open it to set the price, room or anything else. */}
            {snack.changeItemId ? (
              <Pressable onPress={() => { const id = snack.changeItemId; dismissSnack(snack.key); router.push(`/item/${id}`); }} accessibilityRole="button" accessibilityLabel="Change the new item" hitSlop={4} style={({ pressed }) => [s.undo, pressed && s.pressed]}>
                <Text style={s.undoText}>Change</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * "Paid for Kettle? Paid by [Nikita] [Daryna] £___ [Save] [Skip]", after an item is ordered or
 * arrives. Optional, never blocking, and it remembers nothing; left untouched it goes away by itself.
 * A row's "Add price" chip is the way back to it later.
 */
function PricePrompt({ item, onDone }: { item: Item; onDone: () => void }) {
  const [engaged, setEngaged] = useState(false);
  useEffect(() => {
    if (engaged) return;
    const timer = setTimeout(onDone, PROMPT_MS);
    return () => clearTimeout(timer);
  }, [engaged, onDone]);
  const skip = () => {
    Keyboard.dismiss();
    onDone();
  };
  return (
    <View style={s.prompt} accessibilityLiveRegion="polite">
      <Text style={s.promptTitle} numberOfLines={2}>
        Paid for {item.name}?{item.estPrice !== undefined ? <Text style={s.promptHint}>  Estimate {formatMoney(item.estPrice)}</Text> : null}
      </Text>
      <PaidForm
        item={item}
        onDone={onDone}
        onEngage={() => setEngaged(true)}
        extra={(
          <Pressable onPress={skip} accessibilityRole="button" accessibilityLabel="Skip, no price now" style={({ pressed }) => [s.skip, pressed && s.pressed]}>
            <Text style={s.skipText}>Skip</Text>
          </Pressable>
        )}
      />
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
  skip: { height: TARGET, paddingHorizontal: 12, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.textSecondary },
});
