import { describe, expect, it } from 'vitest';
import { actorFor, detailState, identityFor, memberIdentity, statusWhileSending, syncPill, identityGate, listState, settledAnnouncement, signOutPrompt, syncView } from './sync';

describe('syncView', () => {
  it('says Synced in mint when the queue is empty', () => {
    expect(syncView('synced', 0)).toEqual({ kind: 'synced', label: 'Synced', tone: 'mint' });
  });

  it('counts unsent changes while sending, in amber', () => {
    expect(syncView('pending', 2)).toEqual({ kind: 'sending', label: 'Sending 2', tone: 'amber' });
    // A queue that grew after the last confirmed send still shows as sending.
    expect(syncView('synced', 1).label).toBe('Sending 1');
  });

  it('is neutral while the first load runs with nothing queued', () => {
    expect(syncView('pending', 0)).toEqual({ kind: 'sending', label: 'Syncing', tone: 'neutral' });
  });

  it('says Offline, with the unsent count in amber when there is one', () => {
    expect(syncView('offline', 0)).toEqual({ kind: 'offline', label: 'Offline', tone: 'neutral' });
    expect(syncView('offline', 3)).toEqual({ kind: 'offline', label: 'Offline · 3 not sent', tone: 'amber' });
  });

  it('labels demo data', () => {
    expect(syncView('demo', 0).kind).toBe('demo');
  });
});

describe('signOutPrompt', () => {
  it('asks only when changes are unsent, with the right plural', () => {
    expect(signOutPrompt(0)).toBeUndefined();
    expect(signOutPrompt(1)).toBe('1 change not sent yet. Sign out anyway?');
    expect(signOutPrompt(2)).toBe('2 changes not sent yet. Sign out anyway?');
  });
});

describe('listState', () => {
  it('shows data at once when it is demo, loaded or cached', () => {
    expect(listState('demo', false, 0)).toBe('ready');
    expect(listState('synced', true, 0)).toBe('ready');
    expect(listState('offline', false, 5)).toBe('ready');
  });

  it('shows loading, or offline with nothing cached, instead of a blank screen', () => {
    expect(listState('pending', false, 0)).toBe('loading');
    expect(listState('offline', false, 0)).toBe('offline');
  });
});

describe('detailState', () => {
  it('is missing only after the data has loaded', () => {
    expect(detailState('synced', true, true)).toBe('ready');
    expect(detailState('synced', true, false)).toBe('missing');
    expect(detailState('demo', false, false)).toBe('missing');
    expect(detailState('pending', false, false)).toBe('loading');
    expect(detailState('offline', false, false)).toBe('offline');
  });
});

describe('identity', () => {
  it('is loading until a member row or its cache is known', () => {
    expect(identityFor(null)).toBe('loading');
    expect(identityFor({ me: 'daryna', canDelete: true })).toBe('known');
    // A non-person account is a stand-in, never silently a person.
    expect(identityFor({ canDelete: false })).toBe('standIn');
  });

  it('keeps the signed-in screens closed until `me` is known, with a retry when it cannot be read', () => {
    expect(identityGate('known', 'pending')).toBe('ready');
    expect(identityGate('standIn', 'synced')).toBe('ready');
    expect(identityGate('loading', 'pending')).toBe('loading');
    expect(identityGate('loading', 'offline')).toBe('offline');
    expect(identityGate('failed', 'synced')).toBe('offline');
  });
});

describe('settledAnnouncement', () => {
  it('announces only settled changes', () => {
    // An edit: Synced, Sending 1, Synced. Nothing to announce.
    expect(settledAnnouncement(syncView('pending', 1), 'Synced')).toBeUndefined();
    expect(settledAnnouncement(syncView('synced', 0), 'Synced')).toBeUndefined();
    // Going offline and coming back are announced once each.
    expect(settledAnnouncement(syncView('offline', 1), 'Synced')).toBe('Offline · 1 not sent');
    expect(settledAnnouncement(syncView('offline', 1), 'Offline · 1 not sent')).toBeUndefined();
    expect(settledAnnouncement(syncView('synced', 0), 'Offline · 1 not sent')).toBe('Synced');
  });
});

describe('memberIdentity', () => {
  it('a person is known, the Claude account a stand-in, and no member row is never a stand-in', () => {
    expect(memberIdentity({ key: 'daryna', is_person: true })).toEqual({ identity: 'known', me: 'daryna', canDelete: true });
    expect(memberIdentity({ key: 'claude', is_person: false })).toEqual({ identity: 'standIn', canDelete: false });
    expect(memberIdentity(null)).toEqual({ identity: 'failed', canDelete: false });
  });
});

describe('syncPill', () => {
  it('shows only when something is off, in the header\'s short words', () => {
    expect(syncPill('synced', 0)).toBeUndefined();
    expect(syncPill('demo', 3)).toBeUndefined();
    expect(syncPill('pending', 0)).toBeUndefined();
    expect(syncPill('offline', 3)).toEqual({ label: 'Offline · 3 unsent', tone: 'amber', sending: false });
    expect(syncPill('offline', 0)).toEqual({ label: 'Offline', tone: 'neutral', sending: false });
    expect(syncPill('pending', 2)).toEqual({ label: 'Sending 2', tone: 'amber', sending: true });
  });
});

describe('statusWhileSending', () => {
  it('an edit made offline keeps the pill on Offline instead of flipping to Sending', () => {
    expect(statusWhileSending('offline')).toBe('offline');
    expect(statusWhileSending('synced')).toBe('pending');
    expect(statusWhileSending('pending')).toBe('pending');
    expect(syncPill(statusWhileSending('offline'), 4)).toEqual({ label: 'Offline · 4 unsent', tone: 'amber', sending: false });
  });
});

describe('actorFor', () => {
  it('is the person for a person, Claude for the test account, unknown until loaded', () => {
    expect(actorFor({ me: 'daryna', canDelete: true })).toBe('daryna');
    expect(actorFor({ canDelete: false })).toBe('claude');
    expect(actorFor(null)).toBeUndefined();
  });
});
