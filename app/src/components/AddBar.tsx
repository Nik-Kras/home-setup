import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, TARGET } from '../theme/tokens';

/** The add screen's text bar: mint glow ring, the keyboard open, and one Add button (Add.png, AddTask.png). */
export function AddBar({ value, onChange, onSubmit, placeholder, label, addLabel }: { value: string; onChange: (t: string) => void; onSubmit: () => void; placeholder: string; label: string; addLabel: string }) {
  const ready = value.trim().length > 0;
  return (
    <View style={s.bar}>
      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        submitBehavior="submit"
        returnKeyType="done"
        autoFocus
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={label}
        style={s.input}
      />
      <Pressable onPress={onSubmit} disabled={!ready} accessibilityRole="button" accessibilityLabel={addLabel} accessibilityState={{ disabled: !ready }} style={[s.add, !ready && { opacity: 0.5 }]}>
        <Text style={s.addText}>Add</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 54, paddingVertical: 4, borderRadius: 27, borderWidth: 1.5, borderColor: colors.mint, backgroundColor: colors.surface, paddingLeft: 18, paddingRight: 5,
    boxShadow: '0 0 0 4px rgba(94,224,184,0.12), 0 8px 28px -10px rgba(94,224,184,0.5)',
  },
  input: { flex: 1, minWidth: 0, alignSelf: 'stretch', fontFamily: fonts.medium, fontSize: 17, color: colors.text },
  add: { minHeight: TARGET, paddingHorizontal: 20, borderRadius: 22, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  addText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onMint },
});
