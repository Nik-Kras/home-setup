import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * The design's soft colour wash behind the top-left of a detail screen (a blurred 320px circle at 10%
 * of the hue). Drawn as a radial gradient so it needs no blur filter. Decorative only.
 */
export function TintWash({ color, opacity = 0.1 }: { color: string; opacity?: number }) {
  return (
    <View pointerEvents="none" style={s.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="tintWash" cx="120" cy="100" r="260" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={color} stopOpacity={opacity * 1.6} />
            <Stop offset="0.5" stopColor={color} stopOpacity={opacity * 0.8} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#tintWash)" />
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({ wrap: { position: 'absolute', left: 0, top: 0, width: 420, height: 420 } });
