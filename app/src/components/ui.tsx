import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { ItemStatus, Person, TaskStatus } from '../domain/types';
import { colors, fonts, personColor, radius, TARGET } from '../theme/tokens';

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
const PATHS: Record<string, string> = {
  buy: 'M4 6h10M4 12h10M4 18h6M16 15l2 2 4-4',
  tasks: 'M9 4h6v3H9zM7 5.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6.5a1 1 0 0 0-1-1h-1M9 14l2 2 4-4',
  home: 'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  budget: 'M5 20V10M12 20V4M19 20v-7',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 5l-7 7 7 7',
  check: 'M5 12l5 5 9-10',
  sliders: 'M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4',
  kettle: 'M6 10h9v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM15 12l4-3M6 12H4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h2M8 7h5',
  microwave: 'M3 6h18v12H3zM6 9h8v6H6zM17.5 10h.01M17.5 14h.01',
  toaster: 'M4 9h16v9H4zM8 9V6h3v3M13 9V6h3v3',
  wifi: 'M4.5 10a11 11 0 0 1 15 0M7.5 13.3a6.6 6.6 0 0 1 9 0M10.5 16.5a2.2 2.2 0 0 1 3 0M12 19.5h.01',
  curtain: 'M3 5h18M5 5v14M9 5c0 5-1 9-4 14M19 5v14M15 5c0 5 1 9 4 14',
  shelf: 'M4 9h16M4 17h16M7 9V5h4v4M14 17v-4h3v4',
  lamp: 'M8 4h8l2 8H6zM12 12v6M9 20h6',
  sofa: 'M4 12V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M3 12h18v5H3zM5 17v2M19 17v2',
  box: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8',
};
export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24, color = colors.textSecondary, stroke = 1.8 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={PATHS[name]} />
    </Svg>
  );
}

/** Picks a glyph from the item name. Falls back to a generic box. */
export function glyphFor(name: string): IconName {
  const n = name.toLowerCase();
  const table: [string, IconName][] = [['kettle', 'kettle'], ['microwave', 'microwave'], ['toast', 'toaster'], ['wifi', 'wifi'], ['router', 'wifi'], ['curtain', 'curtain'], ['shel', 'shelf'], ['lamp', 'lamp'], ['sofa', 'sofa']];
  return table.find(([k]) => n.includes(k))?.[1] ?? 'box';
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
