import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, TARGET } from '../theme/tokens';
import { Icon } from './ui';

/**
 * Small bottom sheet on an RN Modal. Tapping the scrim, the Android back button or the visible close
 * button closes it. The sheet is marked modal, which hides the scrim from screen readers, so the close
 * button is always there for them.
 * Android is edge-to-edge, so the keyboard does not resize the window; padding keeps inputs visible.
 */
export function Sheet({ visible, title, onClose, children, closeLabel = 'Close' }: { visible: boolean; title: string; onClose: () => void; children: ReactNode; closeLabel?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={s.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]} accessibilityViewIsModal>
          <View style={s.grabber} />
          <Text style={s.title} accessibilityRole="header">{title}</Text>
          {children}
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel} style={({ pressed }) => [s.close, pressed && s.pressed]}>
            <Text style={s.closeText}>{closeLabel}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** One choice in a sheet. Selected shows a mint check. */
export function SheetOption({ label, selected, onPress, dot }: { label: string; selected: boolean; onPress: () => void; dot?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={label} style={({ pressed }) => [s.option, pressed && s.pressed]}>
      {dot ? <View style={[s.dot, { backgroundColor: dot }]} /> : null}
      <Text style={[s.optionText, selected && s.optionOn]}>{label}</Text>
      {selected ? <Icon name="check" size={20} color={colors.mint} stroke={2.4} /> : null}
    </Pressable>
  );
}

/** Full-width sheet button. Primary is mint, the other is a hairline outline. */
export function SheetButton({ label, onPress, primary, disabled }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} style={[s.button, primary ? s.buttonPrimary : s.buttonPlain, disabled && s.disabled]}>
      <Text style={[s.buttonText, primary && s.buttonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

interface TextSheetProps {
  visible: boolean;
  title: string;
  initial: string;
  placeholder?: string;
  /** Short line under the input, such as the estimate. */
  helper?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences';
  /** Error message for the current text, or undefined when it can be saved. */
  validate: (text: string) => string | undefined;
  onSave: (text: string) => void;
  onClose: () => void;
}

/** A sheet with one text input and Save. The text starts from `initial` each time it opens. */
export function TextSheet(props: TextSheetProps) {
  return (
    <Sheet visible={props.visible} title={props.title} onClose={props.onClose} closeLabel="Cancel">
      {props.visible ? <TextSheetBody {...props} /> : null}
    </Sheet>
  );
}

export function TextSheetBody({ title, initial, placeholder, helper, keyboardType, autoCapitalize = 'sentences', validate, onSave, onClose }: Omit<TextSheetProps, 'visible'>) {
  const [text, setText] = useState(initial);
  const error = validate(text);
  const save = () => {
    if (error) return;
    onSave(text);
    onClose();
  };
  return (
    <View style={s.form}>
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={save}
        autoFocus
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCapitalize !== 'none'}
        returnKeyType="done"
        accessibilityLabel={title}
        style={[s.input, error && text.trim() !== '' && s.inputError]}
      />
      {error && text.trim() !== '' ? (
        <View style={s.errorRow} accessible accessibilityLabel={error} accessibilityLiveRegion="polite">
          <Text style={s.errorGlyph}>!</Text>
          <Text style={s.error}>{error}</Text>
        </View>
      ) : helper ? <Text style={s.helper}>{helper}</Text> : null}
      <SheetButton label="Save" onPress={save} primary disabled={!!error} />
    </View>
  );
}

const s = StyleSheet.create({
  form: { gap: 10, paddingTop: 2 },
  input: { height: 52, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)', backgroundColor: colors.bg, paddingHorizontal: 18, fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  // Validation is neutral: amber means in transit and coral means urgent, so neither is used here.
  inputError: { borderColor: colors.text },
  helper: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary, paddingHorizontal: 18 },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 18 },
  errorGlyph: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.text, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15, color: colors.text },
  error: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.text },
  close: { minHeight: TARGET, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  closeText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.textSecondary },
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.hairline, paddingHorizontal: 16, paddingTop: 8, gap: 6 },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.track, marginBottom: 6 },
  title: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 30, color: colors.text, paddingHorizontal: 4, paddingBottom: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 12, borderRadius: 14 },
  pressed: { backgroundColor: colors.neutralFill },
  dot: { width: 8, height: 8, borderRadius: 4 },
  optionText: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  optionOn: { fontFamily: fonts.medium, color: colors.mint },
  button: { height: 52, minHeight: TARGET, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  buttonPrimary: { backgroundColor: colors.mint },
  buttonPlain: { borderWidth: 1, borderColor: colors.hairlineStrong },
  disabled: { opacity: 0.4 },
  buttonText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  buttonTextPrimary: { color: colors.onMint },
});
