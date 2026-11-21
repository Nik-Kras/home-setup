import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from '@expo-google-fonts/geist';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { useFonts } from 'expo-font';
import { Tabs } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TabBar } from '../components/TabBar';
import { StoreProvider } from '../data/store';
import { colors } from '../theme/tokens';

SplashScreen.preventAutoHideAsync();

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
        <Tabs
          tabBar={(props) => <TabBar {...props} />}
          screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
        >
          <Tabs.Screen name="index" options={{ title: 'Buy' }} />
          <Tabs.Screen name="tasks" options={{ title: 'Tasks' }} />
          <Tabs.Screen name="home" options={{ title: 'Home' }} />
          <Tabs.Screen name="budget" options={{ title: 'Budget' }} />
        </Tabs>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
