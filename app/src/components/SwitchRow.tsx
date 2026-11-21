import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';

/** A card row with a label and an on/off switch. The whole row is the control; the thumb side shows the state. */
export function SwitchRow({ label, value, onChange, accessory }: { label: string; value: boolean; onChange: (v: boolean) => void; accessory?: ReactNode }) {
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label} style={s.row}>
      <View style={s.labelLine}>
        <Text style={s.label}>{label}</Text>
        {accessory}
      </View>
      <View style={[s.track, value && s.trackOn]}>
        <View style={[s.thumb, value && s.thumbOn]} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, paddingLeft: 16, paddingRight: 16, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline },
  labelLine: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  label: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  track: { width: 50, height: 30, borderRadius: 15, padding: 3, justifyContent: 'center', alignItems: 'flex-start', backgroundColor: colors.track },
  trackOn: { backgroundColor: colors.mint, alignItems: 'flex-end' },
  thumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.textSecondary },
  thumbOn: { backgroundColor: colors.onMint },
});
