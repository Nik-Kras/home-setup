/**
 * Over-the-air updates (EAS Update): when to look for one and what to show. Pure, so it is tested;
 * `data/appUpdates.ts` wires it to expo-updates.
 *
 * The flow: expo-updates checks once at launch by itself (checkAutomatically ON_LOAD, no waiting),
 * the app checks again when it comes back to the foreground, at most every 15 minutes. A downloaded
 * update is applied only when the person taps Restart, or by itself at the next cold start.
 */

/** Foreground checks are at most this often (launch counts as a check). */
export const UPDATE_CHECK_EVERY_MS = 15 * 60_000;
/** How long the "Update ready" snackbar stays; the Home account card keeps the Restart after that. */
export const UPDATE_BANNER_MS = 10_000;

export interface CheckInput {
  /** `__DEV__`: a dev build loads from Metro, so updates do not apply. */
  dev: boolean;
  /** `Updates.isEnabled`: false without a URL or runtime version, or when storage failed. */
  enabled: boolean;
  now: number;
  /** The last check, by expo-updates at launch or by the app, in ms. */
  lastCheckAt: number | undefined;
  /** A check or download is running now. */
  busy: boolean;
  /** An update is already downloaded and waiting for a restart. */
  ready: boolean;
}

/** Whether to check for an update now (on returning to the foreground). */
export function shouldCheckForUpdate({ dev, enabled, now, lastCheckAt, busy, ready }: CheckInput): boolean {
  if (dev || !enabled || busy || ready) return false;
  return lastCheckAt === undefined || now - lastCheckAt >= UPDATE_CHECK_EVERY_MS;
}

export interface BannerInput {
  /** Key of the downloaded update waiting for a restart, if any. */
  readyKey: string | undefined;
  /** The update the snackbar was already shown for: it is shown once per update. */
  shownKey: string | undefined;
  /** The keyboard is open or an add form is on screen: a restart now could lose what is typed. */
  editing: boolean;
  /** An Undo snackbar is up: one message at a time, and its Undo must not sit next to Restart. */
  snackVisible: boolean;
}

/** Whether the "Update ready · Restart" snackbar shows now. It waits until the person is not editing. */
export function showUpdateBanner({ readyKey, shownKey, editing, snackVisible }: BannerInput): boolean {
  return readyKey !== undefined && readyKey !== shownKey && !editing && !snackVisible;
}

export interface UpdateStatusInput {
  dev: boolean;
  enabled: boolean;
  /** `currentlyRunning.updateId`: the running update (the one built into the app until one is downloaded). */
  runningId: string | undefined | null;
  /** `currentlyRunning.isEmbeddedLaunch`. */
  embedded: boolean;
  ready: boolean;
}

export interface UpdateStatusView {
  /** "Up to date", "Update ready" or "Updates off". */
  label: string;
  /** Short id of the running update, such as "1a2b3c4d · built in". Empty when updates are off. */
  detail: string;
  /** Restart applies a downloaded update. */
  canRestart: boolean;
}

/** The "App" row of the Home account card. */
export function updateStatusView({ dev, enabled, runningId, embedded, ready }: UpdateStatusInput): UpdateStatusView {
  if (dev || !enabled) return { label: 'Updates off', detail: '', canRestart: false };
  const id = runningId ? runningId.slice(0, 8) : '';
  const detail = embedded ? (id ? `${id} · built in` : 'built in') : id;
  return ready ? { label: 'Update ready', detail, canRestart: true } : { label: 'Up to date', detail, canRestart: false };
}
