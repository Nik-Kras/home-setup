import { describe, expect, it } from 'vitest';
import { shouldCheckForUpdate, showUpdateBanner, UPDATE_CHECK_EVERY_MS, updateStatusView, type CheckInput } from './appUpdate';

const NOW = 1_800_000_000_000;
const check = (over: Partial<CheckInput> = {}): CheckInput => ({ dev: false, enabled: true, now: NOW, lastCheckAt: NOW - UPDATE_CHECK_EVERY_MS, busy: false, ready: false, ...over });

describe('shouldCheckForUpdate', () => {
  it('checks when the last check is 15 minutes old or more', () => {
    expect(shouldCheckForUpdate(check())).toBe(true);
    expect(shouldCheckForUpdate(check({ lastCheckAt: NOW - 3 * UPDATE_CHECK_EVERY_MS }))).toBe(true);
  });

  it('checks when nothing was checked yet', () => {
    expect(shouldCheckForUpdate(check({ lastCheckAt: undefined }))).toBe(true);
  });

  it('waits when the last check was under 15 minutes ago', () => {
    expect(shouldCheckForUpdate(check({ lastCheckAt: NOW - UPDATE_CHECK_EVERY_MS + 1 }))).toBe(false);
    expect(shouldCheckForUpdate(check({ lastCheckAt: NOW }))).toBe(false);
  });

  it('never checks in a dev build or when expo-updates is off', () => {
    expect(shouldCheckForUpdate(check({ dev: true }))).toBe(false);
    expect(shouldCheckForUpdate(check({ enabled: false }))).toBe(false);
  });

  it('does not check while a check or download runs, or with an update waiting', () => {
    expect(shouldCheckForUpdate(check({ busy: true }))).toBe(false);
    expect(shouldCheckForUpdate(check({ ready: true }))).toBe(false);
  });
});

describe('showUpdateBanner', () => {
  const idle = { readyKey: 'u1', shownKey: undefined, editing: false, snackVisible: false };

  it('shows once an update is downloaded', () => {
    expect(showUpdateBanner(idle)).toBe(true);
  });

  it('shows nothing without a downloaded update', () => {
    expect(showUpdateBanner({ ...idle, readyKey: undefined })).toBe(false);
  });

  it('waits while the person is editing or an Undo snackbar is up', () => {
    expect(showUpdateBanner({ ...idle, editing: true })).toBe(false);
    expect(showUpdateBanner({ ...idle, snackVisible: true })).toBe(false);
  });

  it('shows once per update, and again for a newer one', () => {
    expect(showUpdateBanner({ ...idle, shownKey: 'u1' })).toBe(false);
    expect(showUpdateBanner({ ...idle, readyKey: 'u2', shownKey: 'u1' })).toBe(true);
  });
});

describe('updateStatusView', () => {
  const base = { dev: false, enabled: true, runningId: '1a2b3c4d-0000-4000-8000-000000000000', embedded: false, ready: false };

  it('is up to date with the short id of the running update', () => {
    expect(updateStatusView(base)).toEqual({ label: 'Up to date', detail: '1a2b3c4d', canRestart: false });
  });

  it('marks the update built into the app', () => {
    expect(updateStatusView({ ...base, embedded: true }).detail).toBe('1a2b3c4d · built in');
    expect(updateStatusView({ ...base, embedded: true, runningId: null }).detail).toBe('built in');
  });

  it('offers Restart when an update is waiting', () => {
    expect(updateStatusView({ ...base, ready: true })).toEqual({ label: 'Update ready', detail: '1a2b3c4d', canRestart: true });
  });

  it('is off in a dev build or when expo-updates is off', () => {
    expect(updateStatusView({ ...base, dev: true })).toEqual({ label: 'Updates off', detail: '', canRestart: false });
    expect(updateStatusView({ ...base, enabled: false, ready: true }).canRestart).toBe(false);
  });
});
