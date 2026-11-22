import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme/tokens';

/**
 * One row of chips that scrolls sideways, running to the screen's right edge with a fade there, so a
 * group of options never wraps. Placed inside 16dp page padding; `id` keeps each fade gradient distinct.
 */
export function ChipScroller({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <View style={s.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.row} accessibilityLabel={label}>
        {children}
      </ScrollView>
      <View pointerEvents="none" style={s.fade} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.bg} stopOpacity={0} />
              <Stop offset="1" stopColor={colors.bg} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${id})`} />
        </Svg>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: -16 },
  row: { gap: 8, paddingHorizontal: 16 },
  fade: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 32 },
});
