import { afterEach, describe, expect, it, vi } from 'vitest';
import { SIGN_OUT_FLUSH_MS, settlesWithin, trySignOut } from './signOut';

const deps = (over: { flush?: () => Promise<void>; unsent?: number }) => {
  let unsent = over.unsent ?? 0;
  const signOut = vi.fn(async () => undefined);
  const flush = vi.fn(over.flush ?? (async () => { unsent = 0; }));
  return { flush, unsent: vi.fn(async () => unsent), signOut };
};

afterEach(() => { vi.useRealTimers(); });

describe('trySignOut', () => {
  it('signs out when the flush sends everything', async () => {
    const d = deps({ unsent: 2 });
    expect(await trySignOut(d)).toBe(0);
    expect(d.flush).toHaveBeenCalledOnce();
    expect(d.signOut).toHaveBeenCalledOnce();
  });

  it('asks instead of signing out while edits or photos are unsent', async () => {
    const d = deps({ unsent: 3, flush: async () => undefined }); // offline: nothing sent
    expect(await trySignOut(d)).toBe(3);
    expect(d.signOut).not.toHaveBeenCalled();
  });

  it('stops waiting for a hung flush after 5 s and offers the choice', async () => {
    vi.useFakeTimers();
    const d = deps({ unsent: 1, flush: () => new Promise<void>(() => undefined) });
    const result = trySignOut(d);
    await vi.advanceTimersByTimeAsync(SIGN_OUT_FLUSH_MS - 1);
    expect(d.unsent).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toBe(1);
    expect(d.signOut).not.toHaveBeenCalled();
  });

  it('"Sign out anyway" skips the wait and signs out', async () => {
    const d = deps({ unsent: 4, flush: () => new Promise<void>(() => undefined) });
    expect(await trySignOut(d, { force: true })).toBe(0);
    expect(d.flush).not.toHaveBeenCalled();
    expect(d.signOut).toHaveBeenCalledOnce();
  });

  it('treats a failed flush as settled', async () => {
    const d = deps({ unsent: 0, flush: async () => { throw new Error('offline'); } });
    expect(await trySignOut(d)).toBe(0);
  });
});

describe('settlesWithin', () => {
  it('reports false for work still running at the deadline', async () => {
    vi.useFakeTimers();
    const pending = settlesWithin(new Promise(() => undefined), 100);
    await vi.advanceTimersByTimeAsync(100);
    expect(await pending).toBe(false);
    expect(await settlesWithin(Promise.resolve(), 100)).toBe(true);
  });
});
