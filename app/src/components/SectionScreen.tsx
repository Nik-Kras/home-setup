import type { ReactNode } from 'react';
import { SectionList, StyleSheet, View, type SectionListProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/tokens';
import { TAB_BAR_SPACE } from './TabBar';

/** Gap between rows inside a section. */
export const ROW_GAP = 6;

const RowGap = () => <View style={{ height: ROW_GAP }} />;

/**
 * The tab `Screen` layout on a virtualised SectionList, for lists that can grow to hundreds of rows
 * (Buy, Tasks): same safe-area top, header padding and room for the floating tab bar.
 */
export function SectionScreen<T, S>({ header, ...list }: { header: ReactNode } & SectionListProps<T, S>) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      <View style={s.header}>{header}</View>
      <SectionList<T, S>
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        ItemSeparatorComponent={RowGap}
        initialNumToRender={14}
        maxToRenderPerBatch={12}
        windowSize={9}
        contentContainerStyle={[s.content, { paddingBottom: TAB_BAR_SPACE + insets.bottom + 16 }]}
        {...list}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingBottom: 10 },
  content: { paddingHorizontal: 16 },
});
