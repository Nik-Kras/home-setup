import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme/tokens';

/**
 * The design's fade under the floating tab bar: 112dp above the safe area, transparent at the top and
 * solid background from 62% down, so list rows never end in a hard edge or show below the bar.
 */
export function Scrim({ height = 112 }: { height?: number }) {
  const { bottom } = useSafeAreaInsets();
  const h = height + bottom;
  const solidFrom = (height * 0.62) / h;
  return (
    <View pointerEvents="none" style={[s.wrap, { height: h }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="tabScrim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.bg} stopOpacity={0} />
            <Stop offset={solidFrom} stopColor={colors.bg} stopOpacity={1} />
            <Stop offset="1" stopColor={colors.bg} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#tabScrim)" />
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({ wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 } });
