/** What the store knows about syncing: demo data, everything sent, sending, or the last send failed. */
export type SyncStatus = 'demo' | 'synced' | 'pending' | 'offline';

export interface SyncView {
  kind: 'demo' | 'synced' | 'sending' | 'offline';
  /** Short label, such as "Synced", "Sending 2" or "Offline · 2 not sent". */
  label: string;
  /** Token colour role: mint for synced, amber only while changes are pending, neutral otherwise. */
  tone: 'mint' | 'amber' | 'neutral';
}

const changes = (n: number) => `${n} change${n === 1 ? '' : 's'}`;

/** The calm sync indicator, from the store status and the number of unsent changes in the queue. */
export function syncView(status: SyncStatus, pending: number): SyncView {
  if (status === 'demo') return { kind: 'demo', label: 'Demo data', tone: 'neutral' };
  if (status === 'offline') return { kind: 'offline', label: pending > 0 ? `Offline · ${pending} not sent` : 'Offline', tone: pending > 0 ? 'amber' : 'neutral' };
  if (pending > 0) return { kind: 'sending', label: `Sending ${pending}`, tone: 'amber' };
  if (status === 'pending') return { kind: 'sending', label: 'Syncing', tone: 'neutral' };
  return { kind: 'synced', label: 'Synced', tone: 'mint' };
}

/** The sign-out confirmation, or undefined when nothing is waiting to be sent. */
export function signOutPrompt(pending: number): string | undefined {
  return pending > 0 ? `${changes(pending)} not sent yet. Sign out anyway?` : undefined;
}

export type LoadState = 'ready' | 'loading' | 'offline';

/**
 * Whether a list can show its data. Demo data, a finished load or cached rows are shown at once.
 * With nothing to show, a failed load is the offline state (with a retry), never a blank screen.
 */
export function listState(status: SyncStatus, loaded: boolean, count: number): LoadState {
  if (status === 'demo' || loaded || count > 0) return 'ready';
  return status === 'offline' ? 'offline' : 'loading';
}

/**
 * A detail screen for one id. Missing only once the data has loaded (or is demo data); before that a
 * cold start or deep link shows loading, or offline with a retry.
 */
export function detailState(status: SyncStatus, loaded: boolean, found: boolean): LoadState | 'missing' {
  if (found) return 'ready';
  if (status === 'demo' || loaded) return 'missing';
  return status === 'offline' ? 'offline' : 'loading';
}
