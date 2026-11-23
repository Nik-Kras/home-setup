import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../data/store';
import { colors, fonts, TARGET } from '../theme/tokens';
import { Sub, Title } from './ui';

/** Two people only: accounts are created by hand in Supabase, there is no sign-up. */
export function SignIn() {
  const { signIn } = useStore();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(await signIn(email, password));
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.root, { paddingTop: insets.top + 48 }]}>
      <Title>Our flat</Title>
      <Sub>Sign in to see the shared list</Sub>
      <View style={s.form}>
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="Email" placeholderTextColor={colors.textSecondary} accessibilityLabel="Email" style={s.input} />
        <TextInput value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" placeholder="Password" placeholderTextColor={colors.textSecondary} accessibilityLabel="Password" onSubmitEditing={submit} style={s.input} />
        {error ? <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text> : null}
        <Pressable onPress={submit} disabled={busy || !email || !password} accessibilityRole="button" accessibilityState={{ disabled: busy || !email || !password }} style={[s.btn, (busy || !email || !password) && s.btnOff]}>
          <Text style={[s.btnText, (busy || !email || !password) && s.btnTextOff]}>{busy ? 'Signing in...' : 'Sign in'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
  form: { marginTop: 32, gap: 12 },
  input: { height: 54, borderRadius: 27, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface, paddingHorizontal: 20, fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  btn: { height: TARGET + 8, borderRadius: 26, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.onMint },
  btnOff: { backgroundColor: colors.neutralFill },
  btnTextOff: { color: colors.textMuted },
  error: { fontFamily: fonts.regular, fontSize: 14, color: colors.coral, paddingHorizontal: 4 },
});
