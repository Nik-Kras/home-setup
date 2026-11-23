import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, TARGET } from '../theme/tokens';
import { AddItemForm } from './AddItemForm';
import { AddTaskForm } from './AddTaskForm';
import { HEADER_TOP } from './ScreenHeader';
import { Icon, Segmented } from './ui';

export type AddMode = 'item' | 'task';

/**
 * One add screen for both things (Add.png, AddTask.png): back, an Item / Task switch, then the bar and
 * the options for the chosen kind. The typed text carries over when switching.
 */
export function AddScreen({ initialMode, initialText = '', initialGroup, initialWho }: { initialMode: AddMode; initialText?: string; initialGroup?: string; initialWho?: string }) {
  const { top } = useSafeAreaInsets();
  const [mode, setMode] = useState<AddMode>(initialMode);
  const [text, setText] = useState(initialText);
  const fallback = mode === 'item' ? '/' : '/tasks';
  const close = () => (router.canGoBack() ? router.back() : router.replace(fallback));

  return (
    <View style={s.root}>
      <View style={[s.header, { marginTop: top + HEADER_TOP }]}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={initialMode === 'item' ? 'Back to list' : 'Back to tasks'} style={({ pressed }) => [s.back, pressed && { opacity: 0.6 }]}>
          <Icon name="back" size={24} color={colors.text} stroke={2} />
        </Pressable>
        <View style={s.switch}>
          <Segmented<AddMode> value={mode} onChange={setMode} options={[{ value: 'item', label: 'Item' }, { value: 'task', label: 'Task' }]} />
        </View>
      </View>
      {mode === 'item'
        ? <AddItemForm key="item" text={text} setText={setText} onDone={close} />
        : <AddTaskForm key="task" text={text} setText={setText} initialGroup={initialGroup} initialWho={initialWho} onDone={close} />}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 8, paddingRight: 16, paddingBottom: 10 },
  back: { width: TARGET, height: TARGET, alignItems: 'center', justifyContent: 'center', borderRadius: TARGET / 2 },
  switch: { flex: 1 },
});
