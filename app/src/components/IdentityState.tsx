import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../data/store';
import { identityGate } from '../domain/sync';
import { colors, fonts, TARGET } from '../theme/tokens';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadState';

/** True once `me` is known, so the signed-in screens (add bars, "Mine") can open. */
export function useIdentityReady(): boolean {
  const { identity, sync } = useStore();
  return identityGate(identity, sync) === 'ready';
}

/**
 * Shown after sign-in until the account's member row has been read: a spinner, or when it cannot be
 * read, a retry and a way to sign out. Nothing guesses who "me" is in the meantime.
 */
export function IdentityState() {
  const { identity, sync, retry, signOut } = useStore();
  const insets = useSafeAreaInsets();
  const state = identityGate(identity, sync);
  return (
    <View style={[s.root, { paddingTop: insets.top + 48 }]}>
      {state === 'offline' ? (
        <>
          <EmptyState
            icon="wifi"
            title="Can’t check your account"
            line="The app needs to know who is signed in before you can add or tick things. Check the connection and try again."
            action={{ label: 'Try again', onPress: retry, icon: null, testID: 'retry-identity' }}
          />
          <Pressable onPress={() => void signOut({ force: true }).catch(() => undefined)} accessibilityRole="button" style={({ pressed }) => [s.signOut, pressed && { opacity: 0.6 }]}>
            <Text style={s.signOutText}>Sign out</Text>
          </Pressable>
        </>
      ) : (
        <LoadingState label="Checking your account" />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  signOut: { minHeight: TARGET, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 8 },
  signOutText: { fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary },
});
