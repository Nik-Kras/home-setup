import { useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../data/store';
import { assigneesFor, dueFor, localDate, TASK_GROUPS, type When, type Who } from '../domain/taskOptions';
import type { Person } from '../domain/types';
import { colors, fonts } from '../theme/tokens';
import { AddBar } from './AddBar';
import { ChipScroller } from './ChipScroller';
import { ChoiceChip } from './ChoiceChip';
import { DatePickerSheet, shortDate } from './DatePickerSheet';
import { SwitchRow } from './SwitchRow';
import { NAME } from './TaskRow';
import { UrgentBadge } from './ui';

/** The Task side of the add screen: when, group, who and urgent (AddTask.png). */
export function AddTaskForm({ text, setText, initialGroup, initialWho, onDone }: { text: string; setText: (t: string) => void; initialGroup?: string; initialWho?: string; onDone: () => void }) {
  const { me, addTask } = useStore();
  const insets = useSafeAreaInsets();
  const other: Person = me === 'nikita' ? 'daryna' : 'nikita';
  const today = localDate();

  const [when, setWhen] = useState<When>('none');
  const [picked, setPicked] = useState<string>();
  const [picking, setPicking] = useState(false);
  const [group, setGroup] = useState<string | undefined>(initialGroup || undefined);
  const [who, setWho] = useState<Who>(initialWho === 'other' || initialWho === 'both' ? initialWho : 'me');
  const [urgent, setUrgent] = useState(false);

  const submit = () => {
    if (!text.trim()) return;
    addTask(text, assigneesFor(who, me), { due: dueFor(when, today, picked), group, urgent });
    onDone();
  };

  const groups: string[] = group && !(TASK_GROUPS as readonly string[]).includes(group) ? [group, ...TASK_GROUPS] : [...TASK_GROUPS];
  const whenChips: { value: When; label: string; a11y?: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This week' },
    { value: 'date', label: picked ? shortDate(picked) : 'Pick a date', a11y: picked ? `Due ${shortDate(picked)}, change date` : 'Pick a date' },
    { value: 'none', label: 'No date' },
  ];

  return (
    <>
      <View style={s.barWrap}>
        <AddBar value={text} onChange={setText} onSubmit={submit} placeholder="New task..." label="New task" addLabel="Add task" />
      </View>

      <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Text style={s.label} accessibilityRole="header">When</Text>
        <ChipScroller id="whenFade" label="When">
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
        </ChipScroller>

        <Text style={[s.label, s.gapTop]} accessibilityRole="header">Group</Text>
        <ChipScroller id="groupFade" label="Group">
          {groups.map((g) => (
            <ChoiceChip key={g} label={g} selected={group === g} onPress={() => setGroup(group === g ? undefined : g)} />
          ))}
        </ChipScroller>

        <Text style={[s.label, s.gapTop]} accessibilityRole="header">Who</Text>
        <ChipScroller id="whoFade" label="Who">
          <ChoiceChip label="Me" selected={who === 'me'} onPress={() => setWho('me')} />
          <ChoiceChip label={NAME[other]} selected={who === 'other'} onPress={() => setWho('other')} />
          <ChoiceChip label="Each of us" selected={who === 'both'} onPress={() => setWho('both')} />
        </ChipScroller>
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
    </>
  );
}

const s = StyleSheet.create({
  barWrap: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  body: { paddingHorizontal: 16, gap: 8 },
  label: { marginHorizontal: 4, marginTop: 2, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 16, color: colors.textSecondary },
  gapTop: { marginTop: 4 },
  hint: { marginHorizontal: 4, marginTop: -2, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
});
