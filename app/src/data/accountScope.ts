import type { KV, OpQueue } from './queue';

/** Which account the queued Ops on this device belong to. */
export const QUEUE_OWNER_KEY = 'homesetup.queue-owner.v1';

/**
 * Called before an account's first flush. Ops queued by another account (app edits or widget
 * taps) must never be sent under this session, so they are dropped and the caller resets the
 * widget snapshot. The same account signing in again keeps its unsent Ops.
 * Returns true when the device changed hands.
 */
export async function claimDevice(storage: KV, queue: Pick<OpQueue, 'clear'> | null, account: string): Promise<boolean> {
  const owner = await storage.getItem(QUEUE_OWNER_KEY);
  if (owner === account) return false;
  const switched = owner !== null;
  if (switched) await queue?.clear();
  await storage.setItem(QUEUE_OWNER_KEY, account);
  return switched;
}
