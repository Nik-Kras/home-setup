import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { ICON_PATHS, type IconName } from '../domain/glyphs';
import type { ItemStatus, Person, TaskStatus } from '../domain/types';
import { colors, fonts, personColor, radius, TARGET } from '../theme/tokens';

export { glyphFor, type IconName } from '../domain/glyphs';

/* ---------- Text ---------- */
export function Title({ children }: { children: ReactNode }) {
  return <Text style={s.title} accessibilityRole="header">{children}</Text>;
}
export function Sub({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.sub, style]}>{children}</Text>;
}
export function SectionHeading({ children, meta }: { children: ReactNode; meta?: string }) {
  return (
    <View style={s.sectionRow}>
      <Text style={s.section} accessibilityRole="header">{children}</Text>
      {meta ? <Text style={s.sectionMeta}>{meta}</Text> : null}
    </View>
  );
}

/* ---------- Icons (24px stroke set) ---------- */
export function Icon({ name, size = 24, color = colors.textSecondary, stroke = 1.8 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={ICON_PATHS[name]} />
    </Svg>
  );
}

/* ---------- Status ---------- */
const STATUS_LABEL: Record<ItemStatus, string> = { needed: 'Needed', looking: 'Looking', ordered: 'Ordered', delivered: 'Delivered', installed: 'Installed' };
const TASK_LABEL: Record<TaskStatus, string> = { todo: 'To do', in_progress: 'In progress', waiting: 'Waiting', done: 'Done' };

/** Amber means in transit or to confirm only. Mint means done. Neutral for everything else. */
export function StatusChip({ status }: { status: ItemStatus | TaskStatus }) {
  const label = (STATUS_LABEL as Record<string, string>)[status] ?? TASK_LABEL[status as TaskStatus];
  const tone = status === 'ordered' || status === 'in_progress' ? 'amber' : status === 'delivered' || status === 'installed' || status === 'done' ? 'mint' : 'neutral';
  const bg = tone === 'amber' ? colors.amberFill : tone === 'mint' ? colors.mintFill : colors.neutralFill;
  const fg = tone === 'amber' ? colors.amber : tone === 'mint' ? colors.mint : '#D5DBD7';
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      <Text style={[s.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/** Coral, only for urgent. Always has text for screen readers. */
export function UrgentBadge() {
  return (
    <View style={s.urgent} accessible accessibilityLabel="Urgent">
      <Text style={s.urgentText}>!</Text>
    </View>
  );
}

/** Owner as an initial disc. Filled = done, outline = waiting. */
export function PersonDisc({ person, done = true, size = 24 }: { person: Person; done?: boolean; size?: number }) {
  const c = personColor[person];
  return (
    <View style={[s.disc, { width: size, height: size, borderRadius: size / 2, borderColor: c, backgroundColor: done ? c : colors.surface }]} accessible accessibilityLabel={`${person}, ${done ? 'done' : 'waiting'}`}>
      <Text style={[s.discText, { color: done ? colors.onMint : c, fontSize: size * 0.46 }]}>{person === 'nikita' ? 'N' : 'D'}</Text>
    </View>
  );
}

/* ---------- Controls ---------- */
export function IconTile({ icon }: { icon: IconName }) {
  return (
    <View style={s.tile}>
      <Icon name={icon} size={26} color={colors.textSecondary} stroke={1.6} />
    </View>
  );
}

export function CheckCircle({ done, onPress, label }: { done: boolean; onPress?: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="checkbox" accessibilityState={{ checked: done, disabled: !onPress }} accessibilityLabel={label} style={s.checkHit} hitSlop={4}>
      <View style={[s.check, done && s.checkDone]}>{done ? <Icon name="check" size={14} color={colors.onMint} stroke={3.5} /> : null}</View>
    </Pressable>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (v: T) => void }) {
  return (
    <View style={s.seg} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[s.segItem, on && s.segOn]}>
            <Text style={[s.segText, on && s.segTextOn]}>
              {o.label}{o.count !== undefined ? <Text style={s.segCount}>  {o.count}</Text> : null}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export const Rule = () => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline }} />;
export { Circle, Rect };

const s = StyleSheet.create({
  title: { fontFamily: fonts.serif, fontSize: 36, lineHeight: 40, letterSpacing: -0.5, color: colors.text },
  sub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 18, color: colors.textSecondary },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 10, paddingHorizontal: 4 },
  section: { fontFamily: fonts.serif, fontSize: 21, lineHeight: 24, color: colors.text },
  sectionMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  chip: { height: 28, paddingHorizontal: 12, borderRadius: 14, justifyContent: 'center' },
  chipText: { fontFamily: fonts.medium, fontSize: 13 },
  urgent: { width: 18, height: 18, borderRadius: 9, flexShrink: 0, backgroundColor: colors.coralFill, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  urgentText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.coral, lineHeight: 14 },
  disc: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  discText: { fontFamily: fonts.semibold },
  tile: { width: 44, height: 44, borderRadius: radius.tile, backgroundColor: colors.neutralFill, alignItems: 'center', justifyContent: 'center' },
  checkHit: { width: TARGET, height: TARGET, alignItems: 'center', justifyContent: 'center' },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: colors.mint, borderColor: colors.mint },
  seg: { flexDirection: 'row', gap: 4, padding: 4, backgroundColor: colors.surface, borderRadius: 26, borderWidth: 1, borderColor: colors.hairline },
  segItem: { flex: 1, height: TARGET, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.mintFill },
  segText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
  segTextOn: { color: colors.mint, fontFamily: fonts.semibold },
  segCount: { fontFamily: fonts.regular, fontSize: 12 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: 16 },
});
