import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/tokens';
import { TAB_BAR_SPACE } from './TabBar';

/** Scrolling screen with safe-area top padding and room for the floating tab bar at the bottom. */
export function Screen({ children, header }: { children: ReactNode; header?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      {header ? <View style={s.header}>{header}</View> : null}
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: TAB_BAR_SPACE + insets.bottom + 16 }]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingBottom: 10 },
  content: { paddingHorizontal: 16, gap: 8 },
});
