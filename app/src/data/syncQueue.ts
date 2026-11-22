import { OpQueue, type Op } from './queue';
import { makeExecutor } from './repo';
import { db, kv } from './supabase';

/** Told when a conditional patch (an Undo) matched nothing: the other person's newer value stayed. */
export const missListeners = new Set<(op: Op) => void>();

// One writer and flusher for both the foreground store and Android headless tasks.
export const syncQueue = db && new OpQueue(kv, makeExecutor(db), (op) => {
  console.warn('server refused a change, dropped:', op.table);
}, (op) => missListeners.forEach((listener) => listener(op)));
