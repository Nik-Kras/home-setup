import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChoiceChip } from '../components/ChoiceChip';
import { DatePickerSheet, shortDate } from '../components/DatePickerSheet';
import { SwitchRow } from '../components/SwitchRow';
import { NAME } from '../components/TaskRow';
import { Icon, UrgentBadge } from '../components/ui';
import { useStore } from '../data/store';
import { assigneesFor, dueFor, localDate, TASK_GROUPS, type When, type Who } from '../domain/taskOptions';
import type { Person } from '../domain/types';
import { colors, fonts, TARGET } from '../theme/tokens';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Add a task with options. Opened from the Tasks add bar (carrying the typed text) or a group screen. */
export default function AddTask() {
  const params = useLocalSearchParams<{ title?: string; group?: string; who?: string }>();
  const { me, addTask } = useStore();
  const insets = useSafeAreaInsets();
  const other: Person = me === 'nikita' ? 'daryna' : 'nikita';
  const today = localDate();

  const [title, setTitle] = useState(one(params.title) ?? '');
  const [when, setWhen] = useState<When>('none');
  const [picked, setPicked] = useState<string>();
  const [picking, setPicking] = useState(false);
  const [group, setGroup] = useState<string | undefined>(one(params.group) || undefined);
  const initialWho = one(params.who);
  const [who, setWho] = useState<Who>(initialWho === 'other' || initialWho === 'both' ? initialWho : 'me');
  const [urgent, setUrgent] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/tasks'));
  const ready = title.trim().length > 0;
  const submit = () => {
    if (!ready) return;
    addTask(title, assigneesFor(who, me), { due: dueFor(when, today, picked), group, urgent });
    close();
  };

  const groups: string[] = group && !(TASK_GROUPS as readonly string[]).includes(group) ? [group, ...TASK_GROUPS] : [...TASK_GROUPS];
  const whenChips: { value: When; label: string; a11y?: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This week' },
    { value: 'date', label: picked ? shortDate(picked) : 'Pick a date', a11y: picked ? `Due ${shortDate(picked)}, change date` : 'Pick a date' },
    { value: 'none', label: 'No date' },
  ];

  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      <View style={s.head}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Back to tasks" style={s.back}>
          <Icon name="back" size={24} color={colors.text} stroke={2} />
        </Pressable>
        <Text style={s.heading} accessibilityRole="header">New task</Text>
      </View>

      <View style={s.barWrap}>
        <View style={s.bar}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            onSubmitEditing={submit}
            submitBehavior="submit"
            returnKeyType="done"
            autoFocus
            placeholder="New task..."
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel="New task"
            style={s.input}
          />
          <Pressable onPress={submit} disabled={!ready} accessibilityRole="button" accessibilityLabel="Add task" accessibilityState={{ disabled: !ready }} style={[s.add, !ready && { opacity: 0.5 }]}>
            <Text style={s.addText}>Add</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Text style={s.label} accessibilityRole="header">When</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={s.rowScroll} contentContainerStyle={s.chips}>
          {whenChips.map((c) => (
            <ChoiceChip
              key={c.value}
              label={c.label}
              a11yLabel={c.a11y}
              selected={when === c.value}
              onPress={() => {
                if (c.value !== 'date') return setWhen(c.value);
                Keyboard.dismiss(); // otherwise the keyboard can cover the calendar sheet
                setPicking(true);
              }}
            />
          ))}
        </ScrollView>

        <Text style={[s.label, s.gapTop]} accessibilityRole="header">Group</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={s.rowScroll} contentContainerStyle={s.chips}>
          {groups.map((g) => (
            <ChoiceChip key={g} label={g} selected={group === g} onPress={() => setGroup(group === g ? undefined : g)} />
          ))}
        </ScrollView>

        <Text style={[s.label, s.gapTop]} accessibilityRole="header">Who</Text>
        <View style={s.chips}>
          <ChoiceChip label="Me" selected={who === 'me'} onPress={() => setWho('me')} />
          <ChoiceChip label={NAME[other]} selected={who === 'other'} onPress={() => setWho('other')} />
          <ChoiceChip label="Each of us" selected={who === 'both'} onPress={() => setWho('both')} />
        </View>
        <Text style={s.hint}>Each of us: you both get the task and tick it off separately.</Text>

        <SwitchRow label="Urgent" value={urgent} onChange={setUrgent} accessory={<UrgentBadge />} />
      </ScrollView>

      <DatePickerSheet
        visible={picking}
        today={today}
        value={picked}
        onClose={() => setPicking(false)}
        onPick={(day) => {
          setPicked(day);
          setWhen('date');
          setPicking(false);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  back: { width: TARGET, height: TARGET, marginLeft: -8, alignItems: 'center', justifyContent: 'center' },
  heading: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  barWrap: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, height: 54, borderRadius: 27, borderWidth: 1.5, borderColor: colors.mint, backgroundColor: colors.surface, paddingLeft: 18, paddingRight: 5,
    boxShadow: '0 0 0 4px rgba(94,224,184,0.12), 0 8px 28px -10px rgba(94,224,184,0.5)',
  },
  input: { flex: 1, minWidth: 0, height: '100%', fontFamily: fonts.medium, fontSize: 17, color: colors.text },
  add: { height: TARGET, paddingHorizontal: 20, borderRadius: 22, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  addText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onMint },
  body: { paddingHorizontal: 16, gap: 10 },
  label: { marginHorizontal: 4, marginTop: 2, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 16, color: colors.textSecondary },
  gapTop: { marginTop: 4 },
  rowScroll: { marginRight: -16, flexGrow: 0 },
  chips: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  hint: { marginHorizontal: 4, marginTop: -2, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
});
