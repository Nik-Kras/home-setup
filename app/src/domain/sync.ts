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

/**
 * Who `me` is. `known`: the account is one of the two people. `standIn`: a non-person account (the
 * Claude test account), which acts as the default person and says so on screen. `loading` and `failed`:
 * the member row has not been read yet; nothing that depends on `me` may be used until it is.
 */
export type Identity = 'loading' | 'failed' | 'known' | 'standIn';

/** From a member lookup or its cached copy; null when there is neither yet. */
export function identityFor(member: { me?: string; canDelete: boolean } | null): Identity {
  if (!member) return 'loading';
  return member.canDelete && member.me ? 'known' : 'standIn';
}

/**
 * Who the database stamps as the author of what this account writes: the person for a person's
 * account, Claude for the test account (which acts as a person on screen). Undefined until known.
 */
export function actorFor(member: { me?: string; canDelete: boolean } | null): 'nikita' | 'daryna' | 'claude' | undefined {
  const identity = identityFor(member);
  if (identity === 'loading') return undefined;
  return identity === 'known' && (member!.me === 'nikita' || member!.me === 'daryna') ? member!.me : 'claude';
}

/** Whether the signed-in screens can open: they wait for `me`, and offer a retry when it cannot be read. */
export function identityGate(identity: Identity, status: SyncStatus): LoadState {
  if (identity === 'known' || identity === 'standIn') return 'ready';
  return identity === 'failed' || status === 'offline' ? 'offline' : 'loading';
}

/**
 * The sync label to announce to screen readers, once it has settled: never the passing "Sending",
 * and not again when it equals the last one announced (an edit goes Synced, Sending 1, Synced).
 */
export function settledAnnouncement(view: SyncView, lastAnnounced: string | undefined): string | undefined {
  if (view.kind === 'sending' || view.kind === 'demo') return undefined;
  return view.label === lastAnnounced ? undefined : view.label;
}

/**
 * Who `me` is from the account's member row. No row at all means the account is not one of the
 * household: 'failed', never 'standIn', so a real person can never see the test-account line
 * ("Test account, acting as Nikita"). Only a member row that is not a person (the Claude account) is a stand-in.
 */
export function memberIdentity(row: { key: string; is_person: boolean } | null): { identity: Identity; me?: 'nikita' | 'daryna'; canDelete: boolean } {
  if (!row) return { identity: 'failed', canDelete: false };
  const person = row.is_person === true && (row.key === 'nikita' || row.key === 'daryna');
  return person ? { identity: 'known', me: row.key as 'nikita' | 'daryna', canDelete: true } : { identity: 'standIn', canDelete: false };
}

/** The status while an edit is being sent: offline stays offline until a send works (no "Sending" flicker). */
export function statusWhileSending(status: SyncStatus): SyncStatus {
  return status === 'offline' || status === 'demo' ? status : 'pending';
}

/**
 * The small pill in the screen headers: only when something is off. Hidden for demo data, when
 * synced, and while a first load runs with nothing waiting. "Sending" is shown only once it has
 * lasted a moment (see SyncPill), so a normal edit does not flash it.
 */
export function syncPill(status: SyncStatus, pending: number): { label: string; tone: 'amber' | 'neutral'; sending: boolean } | undefined {
  if (status === 'demo') return undefined;
  if (status === 'offline') return { label: pending > 0 ? `Offline · ${pending} unsent` : 'Offline', tone: pending > 0 ? 'amber' : 'neutral', sending: false };
  if (pending > 0) return { label: `Sending ${pending}`, tone: 'amber', sending: true };
  return undefined;
}
