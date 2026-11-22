import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from '@expo-google-fonts/geist';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { IdentityState, useIdentityReady } from '../components/IdentityState';
import { SignIn } from '../components/SignIn';
import { UndoBar } from '../components/UndoBar';
import { StoreProvider, useStore } from '../data/store';
import { colors } from '../theme/tokens';

SplashScreen.preventAutoHideAsync();

function Gate() {
  const { auth } = useStore();
  const identityReady = useIdentityReady();
  if (auth === 'loading') return null;
  if (auth === 'signedOut') return <SignIn />;
  // `me` must be known before any screen can add or tick something for "me".
  if (!identityReady) return <IdentityState />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add-task" options={{ presentation: 'modal' }} />
      </Stack>
      {/* Undo snackbar and the "Paid?" prompt, above every screen. */}
      <UndoBar />
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, InstrumentSerif_400Regular });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="light" />
        <Gate />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
