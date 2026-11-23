import { useState, type ReactNode } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '../data/store';
import { formatMoney, parsePrice } from '../domain/items';
import type { Item, Person } from '../domain/types';
import { colors, fonts, TARGET } from '../theme/tokens';
import { ChoiceChip } from './ChoiceChip';
import { Sheet } from './Sheet';

const PEOPLE: { value: Person; label: string }[] = [{ value: 'nikita', label: 'Nikita' }, { value: 'daryna', label: 'Daryna' }];

/**
 * "Paid by [Nikita] [Daryna]  £___  [Save]". Who paid starts as the item's buyer if known, otherwise
 * me, and is saved with the price so the Budget split adds up. Used by the floating "Paid?" prompt and
 * by the "Add price" sheet a row opens. `onEngage` fires on the first touch (the prompt then stays).
 */
export function PaidForm({ item, onDone, onEngage, autoFocus, extra }: { item: Item; onDone: () => void; onEngage?: () => void; autoFocus?: boolean; extra?: ReactNode }) {
  const { updateItem, me } = useStore();
  const [text, setText] = useState('');
  const [payer, setPayer] = useState<Person>(item.boughtBy ?? me);
  const price = parsePrice(text);
  const invalid = price === null;
  const ready = price !== null && price !== undefined;
  const save = () => {
    if (!ready) return;
    updateItem(item.id, { actualPrice: price, boughtBy: payer });
    Keyboard.dismiss();
    onDone();
  };
  return (
    <View style={s.form}>
      <View style={s.row} accessibilityRole="radiogroup" accessibilityLabel="Paid by">
        <Text style={s.paidBy} importantForAccessibility="no" accessibilityElementsHidden>Paid by</Text>
        {PEOPLE.map((p) => (
          <ChoiceChip key={p.value} label={p.label} selected={payer === p.value} a11yLabel={`Paid by ${p.label}`} onPress={() => { onEngage?.(); setPayer(p.value); }} />
        ))}
      </View>
      <View style={s.row}>
        <View style={[s.inputWrap, invalid && s.inputError]}>
          <Text style={s.pound} importantForAccessibility="no" accessibilityElementsHidden>£</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={save}
            onFocus={onEngage}
            autoFocus={autoFocus}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            returnKeyType="done"
            accessibilityLabel={`Price paid for ${item.name}, in pounds`}
            style={s.input}
          />
        </View>
        <Pressable onPress={save} disabled={!ready} accessibilityRole="button" accessibilityLabel="Save price" accessibilityState={{ disabled: !ready }} style={({ pressed }) => [s.save, !ready && s.disabled, pressed && s.pressed]}>
          <Text style={s.saveText}>Save</Text>
        </Pressable>
        {extra}
      </View>
      {invalid ? <Text style={s.error} accessibilityLiveRegion="polite">Enter an amount like 84.99</Text> : null}
    </View>
  );
}

/** The sheet a row's "Add price" chip opens: the same form, with the estimate as a hint. */
export function PriceSheet({ item, onClose }: { item: Item | undefined; onClose: () => void }) {
  return (
    <Sheet visible={item !== undefined} title={item ? `Paid for ${item.name}?` : ''} onClose={onClose} closeLabel="Cancel">
      {item ? (
        <>
          {item.estPrice !== undefined ? <Text style={s.hint}>Estimate {formatMoney(item.estPrice)}</Text> : null}
          <PaidForm key={item.id} item={item} onDone={onClose} autoFocus />
        </>
      ) : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  form: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  paidBy: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, paddingHorizontal: 4 },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, paddingHorizontal: 4, marginTop: -4 },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', height: TARGET, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)', backgroundColor: colors.bg, paddingLeft: 14 },
  // Validation is neutral: amber means in transit and coral means urgent.
  inputError: { borderColor: colors.text },
  pound: { fontFamily: fonts.medium, fontSize: 16, color: colors.textSecondary, marginRight: 4 },
  input: { flex: 1, alignSelf: 'stretch', fontFamily: fonts.regular, fontSize: 16, color: colors.text, paddingRight: 12 },
  save: { height: TARGET, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onMint },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.72 },
  error: { fontFamily: fonts.regular, fontSize: 13, color: colors.text, paddingHorizontal: 4 },
});
