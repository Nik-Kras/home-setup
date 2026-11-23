import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { shouldCheckForUpdate, updateStatusView } from '../domain/appUpdate';
import { colors } from '../theme/tokens';

/**
 * Over-the-air updates through expo-updates (see domain/appUpdate.ts for the rules). expo-updates
 * itself checks at launch without waiting; this adds the foreground check and the Restart.
 */

/** Launch counts as a check: expo-updates checks then by itself (checkAutomatically ON_LOAD). */
let lastCheckAt = Date.now();
let checking = false;

async function checkNow() {
  checking = true;
  lastCheckAt = Date.now();
  try {
    const result = await Updates.checkForUpdateAsync();
    // Downloaded in the background; useUpdates() then reports it as pending.
    if (result.isAvailable || result.isRollBackToEmbedded) await Updates.fetchUpdateAsync();
  } catch {
    // Offline or server trouble: the next foreground after 15 minutes tries again. Never blocks.
  } finally {
    checking = false;
  }
}

/** Mount once: checks for an update each time the app comes back to the foreground, at most every 15 minutes. */
export function useForegroundUpdateChecks() {
  const { isChecking, isDownloading, isUpdatePending, lastCheckForUpdateTimeSinceRestart } = Updates.useUpdates();
  const latest = useRef({ isChecking, isDownloading, isUpdatePending, lastCheckForUpdateTimeSinceRestart });
  latest.current = { isChecking, isDownloading, isUpdatePending, lastCheckForUpdateTimeSinceRestart };

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const s = latest.current;
      const last = Math.max(lastCheckAt, s.lastCheckForUpdateTimeSinceRestart?.getTime() ?? 0);
      if (shouldCheckForUpdate({ dev: __DEV__, enabled: Updates.isEnabled, now: Date.now(), lastCheckAt: last, busy: checking || s.isChecking || s.isDownloading, ready: s.isUpdatePending })) {
        void checkNow();
      }
    });
    return () => sub.remove();
  }, []);
}

/** Applies the downloaded update now. Only ever called from a tap on Restart. */
export function restartWithUpdate() {
  return Updates.reloadAsync({ reloadScreenOptions: { backgroundColor: colors.bg, fade: true, spinner: { enabled: false } } }).catch(() => undefined);
}

/** The downloaded update waiting for a restart (its key, to show the snackbar once) and the account card row. */
export function useAppUpdate() {
  const { isUpdatePending, downloadedUpdate, currentlyRunning } = Updates.useUpdates();
  const ready = isUpdatePending && !__DEV__ && Updates.isEnabled;
  // A rollback directive has no update id; its time tells two apart.
  const readyKey = ready ? (downloadedUpdate?.updateId ?? `rollback:${downloadedUpdate?.createdAt?.getTime() ?? 0}`) : undefined;
  const view = updateStatusView({ dev: __DEV__, enabled: Updates.isEnabled, runningId: currentlyRunning.updateId, embedded: currentlyRunning.isEmbeddedLaunch, createdAt: currentlyRunning.createdAt, ready });
  return { readyKey, view };
}
