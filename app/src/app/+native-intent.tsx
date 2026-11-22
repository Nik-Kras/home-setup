import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { launchPath } from '../domain/launchLink';

// See domain/launchLink.ts: when the widget's background task started the app, Android delivers a
// widget link to the recreated Activity as a new intent, which the router never sees. expo-linking
// records that link too, so use it when the router fell back to the root.
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string {
  if (!initial || Platform.OS !== 'android') return path;
  const url = Linking.getLinkingURL();
  // Cleared so a later plain launch in the same process does not reopen this link.
  Linking.clearInitialURL();
  return launchPath(path, url);
}
