import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { currentStepTone, ITEM_STATUS_LABEL, itemSteps, nextActionLabel } from '../domain/items';
import type { Item, ItemStatus } from '../domain/types';
import { colors, fonts, TARGET } from '../theme/tokens';
import { Icon } from './ui';

/** Five-step status (four when nothing needs installing) and the one next action. */
export function StatusCard({ item, onSet, onNext }: { item: Item; onSet: (s: ItemStatus) => void; onNext: () => void }) {
  const steps = itemSteps(item);
  const action = nextActionLabel(item);
  // Amber only for Ordered (in transit); a finished item's current step is done; otherwise neutral.
  const tone = currentStepTone(item);
  const cur = tone === 'done' ? { bar: s.barDone, text: s.stepTextCurrentDone } : tone === 'transit' ? { bar: s.barTransit, text: s.stepTextTransit } : { bar: s.barCurrent, text: s.stepTextCurrent };
  return (
    <View style={s.card}>
      <View style={s.steps} accessibilityRole="radiogroup" accessibilityLabel="Status">
        {steps.map(({ status, state }, n) => (
          <Pressable
            key={status}
            onPress={() => onSet(status)}
            accessibilityRole="radio"
            accessibilityState={{ checked: state === 'current' }}
            accessibilityLabel={`${ITEM_STATUS_LABEL[status]}, step ${n + 1} of ${steps.length}${state === 'done' || (state === 'current' && tone === 'done') ? ', done' : ''}`}
            style={s.step}
          >
            <View style={[s.bar, state === 'done' && s.barDone, state === 'current' && cur.bar]}>
              {state === 'done' || (state === 'current' && tone === 'done') ? <Icon name="check" size={12} color={colors.onMint} stroke={3.5} /> : null}
              {state === 'current' && tone !== 'done' ? <View style={s.currentDot} /> : null}
            </View>
            {/* Equal widths; the label never shrinks below 13px and wraps to a second line instead (hyphenated on Android). */}
            <Text numberOfLines={2} android_hyphenationFrequency="normal" style={[s.stepText, state === 'done' && s.stepTextDone, state === 'current' && cur.text]}>
              {ITEM_STATUS_LABEL[status]}
            </Text>
          </Pressable>
        ))}
      </View>
      {action ? (
        <Pressable onPress={onNext} accessibilityRole="button" style={({ pressed }) => [s.primary, pressed && s.primaryPressed]}>
          <Text style={s.primaryText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * A tappable field row: key on the left, value and a chevron on the right. Tone sets the value's weight:
 * a real value is bright and semibold, an empty one ("Nobody", an estimate) is secondary, and an
 * invitation to fill it in ("Add") is mint like other actions.
 */
export function FieldRow({ label, value, a11yValue, onPress, first, dot, tone = 'value' }: { label: string; value: string; a11yValue?: string; onPress: () => void; first?: boolean; dot?: string; tone?: 'value' | 'empty' | 'action' }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}, ${a11yValue ?? value}`} accessibilityHint="Opens a sheet to change it" style={({ pressed }) => [s.row, !first && s.rowRule, pressed && s.pressed]}>
      <Text style={s.key}>{label}</Text>
      <View style={s.value}>
        {dot ? <View style={[s.dot, { backgroundColor: dot }]} /> : null}
        <Text style={[s.valueText, tone === 'empty' && s.valueEmpty, tone === 'action' && s.valueAction]} numberOfLines={1}>{value}</Text>
        <Chevron />
      </View>
    </Pressable>
  );
}

/** Product page with a link: the row edits the link, "Open" opens the page. Two sibling controls. */
export function LinkRow({ onEdit, onOpen }: { onEdit: () => void; onOpen: () => void }) {
  return (
    <View style={[s.row, s.rowRule, s.linkRow]}>
      <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel="Product page, edit link" style={({ pressed }) => [s.linkEdit, pressed && s.pressed]}>
        <Text style={s.key}>Product page</Text>
      </Pressable>
      <Pressable onPress={onOpen} accessibilityRole="link" accessibilityLabel="Open product page" style={({ pressed }) => [s.open, pressed && s.pressed]}>
        <Text style={[s.valueText, s.openText]}>Open</Text>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.mint} strokeWidth={2} strokeLinecap="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Path d="M7 17 17 7M9 7h8v8" />
        </Svg>
      </Pressable>
    </View>
  );
}

/** A whole-row switch. Coral is used only for the urgent switch. */
export function ToggleRow({ label, value, onChange, first, tone = 'mint' }: { label: string; value: boolean; onChange: (v: boolean) => void; first?: boolean; tone?: 'mint' | 'coral' }) {
  const on = tone === 'coral' ? colors.coral : colors.mint;
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label} style={({ pressed }) => [s.row, !first && s.rowRule, pressed && s.pressed]}>
      <Text style={s.key}>{label}</Text>
      <View style={[s.track, value && { backgroundColor: on }]}>
        <View style={[s.knob, value ? s.knobOn : null]} />
      </View>
    </Pressable>
  );
}

export function FieldGroup({ children }: { children: ReactNode }) {
  return <View style={s.group}>{children}</View>;
}

function Chevron() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="m9 6 6 6-6 6" />
    </Svg>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, borderRadius: 24, padding: 16, gap: 14 },
  steps: { flexDirection: 'row', gap: 6 },
  // Top-aligned so the bars stay level when one label wraps to two lines.
  step: { flex: 1, minWidth: 0, minHeight: TARGET, alignItems: 'stretch', justifyContent: 'flex-start', gap: 6, paddingTop: 2 },
  bar: { alignSelf: 'stretch', height: 18, borderRadius: 9, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  barDone: { backgroundColor: colors.mint },
  barCurrent: { backgroundColor: colors.text },
  barTransit: { backgroundColor: colors.amber, boxShadow: '0 0 12px rgba(255,196,87,0.5)' },
  currentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.bg },
  stepText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 16, color: colors.textMuted, textAlign: 'center' },
  stepTextDone: { color: colors.textSecondary },
  stepTextCurrent: { color: colors.text },
  stepTextTransit: { color: colors.amber },
  stepTextCurrentDone: { color: colors.mint },
  primary: { height: 52, borderRadius: 26, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryPressed: { opacity: 0.85 },
  primaryText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.onMint },
  group: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, borderRadius: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 50, paddingLeft: 16, paddingRight: 14 },
  rowRule: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  pressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  key: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary },
  value: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  valueText: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  valueEmpty: { fontFamily: fonts.regular, color: colors.textSecondary },
  valueAction: { fontFamily: fonts.medium, color: colors.mint },
  linkRow: { paddingLeft: 0, paddingRight: 0, gap: 0 },
  linkEdit: { flex: 1, alignSelf: 'stretch', justifyContent: 'center', paddingLeft: 16 },
  open: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', minWidth: TARGET, paddingLeft: 12, paddingRight: 14 },
  openText: { color: colors.mint },
  track: { width: 46, height: 28, borderRadius: 14, backgroundColor: colors.track, padding: 3, justifyContent: 'center' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.text },
  knobOn: { alignSelf: 'flex-end', backgroundColor: colors.bg },
});
