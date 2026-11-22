import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { focusEyebrow, stepProgress } from '../domain/focus';
import type { Person, Task } from '../domain/types';
import { colors, fonts, glow, radius, TARGET } from '../theme/tokens';

/**
 * The Tasks screen's focal card (its one accent glow): the task due soonest, with its own steps' progress
 * and a Continue button that opens it. Only the button is interactive.
 */
export function DeadlineCard({ task, person, today }: { task: Task; person: Person; today: string }) {
  const eyebrow = focusEyebrow(task, today);
  const { done, total } = stepProgress(task, person);
  return (
    <View style={s.card}>
      <Text style={[s.eyebrow, eyebrow.alert && { color: colors.coral }]}>{eyebrow.text}</Text>
      <Text style={s.title} numberOfLines={3}>{task.title}</Text>
      <View style={s.foot}>
        {total > 0 ? (
          <View style={s.progress} accessible accessibilityRole="progressbar" accessibilityLabel={`${done} of ${total} steps done`} accessibilityValue={{ min: 0, max: total, now: done }}>
            <Text style={s.progressText}>{done} of {total} steps</Text>
            <View style={s.track}><View style={[s.fill, { width: `${(done / total) * 100}%` }]} /></View>
          </View>
        ) : <View style={{ flex: 1 }} />}
        <Pressable onPress={() => router.push(`/task/${task.id}`)} accessibilityRole="button" accessibilityLabel={`Continue: ${task.title}`} accessibilityHint="Opens the task" style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}>
          <Text style={s.btnText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { gap: 6, padding: 16, paddingTop: 14, borderRadius: radius.card, borderWidth: 1, ...glow },
  eyebrow: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  title: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 32, color: colors.text },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  progress: { flex: 1, gap: 8 },
  progressText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 18, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.mint },
  btn: { minHeight: TARGET, paddingHorizontal: 20, borderRadius: 22, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  btnText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onMint },
});
