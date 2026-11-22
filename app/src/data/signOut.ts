/** How long sign-out waits for the queues to send before it asks instead. */
export const SIGN_OUT_FLUSH_MS = 5_000;

/** Resolves true when `work` settles within `ms`, false when it is still running then. Never rejects. */
export function settlesWithin(work: Promise<unknown>, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    work.then(
      () => { clearTimeout(timer); resolve(true); },
      () => { clearTimeout(timer); resolve(true); },
    );
  });
}

export interface SignOutDeps {
  /** Send queued edits and photos while the session is still valid. */
  flush: () => Promise<void>;
  /** Unsent edits plus unsent photos on this phone. */
  unsent: () => Promise<number>;
  signOut: () => Promise<void>;
}

/**
 * Sends what it can within `timeoutMs`, then signs out, unless something is still unsent: then it
 * returns how many so the screen can ask. `force` (the person said "Sign out anyway") skips the
 * wait. Returns 0 once signed out. A hung flush keeps running in the background; it cannot send
 * after the session is gone, and the unsent work stays queued for this account.
 */
export async function trySignOut(deps: SignOutDeps, opts: { force?: boolean; timeoutMs?: number } = {}): Promise<number> {
  if (!opts.force) {
    await settlesWithin(deps.flush(), opts.timeoutMs ?? SIGN_OUT_FLUSH_MS);
    const left = await deps.unsent().catch(() => 0);
    if (left > 0) return left;
  }
  await deps.signOut();
  return 0;
}
