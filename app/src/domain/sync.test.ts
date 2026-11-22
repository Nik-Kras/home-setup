import { describe, expect, it } from 'vitest';
import { detailState, listState, signOutPrompt, syncView } from './sync';

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
