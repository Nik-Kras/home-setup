import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/tokens';

/** Soft fade so list rows do not end in a hard edge under the floating tab bar. Plain views: no native module. */
export function Scrim({ height = 120 }: { height?: number }) {
  const steps = 10;
  return (
    <View pointerEvents="none" style={[s.wrap, { height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: steps }, (_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: colors.bg, opacity: Math.min(1, (i + 1) / steps) }} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({ wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 } });
