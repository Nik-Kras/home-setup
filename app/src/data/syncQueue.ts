import { OpQueue } from './queue';
import { makeExecutor } from './repo';
import { db, kv } from './supabase';

// One writer and flusher for both the foreground store and Android headless tasks.
export const syncQueue = db && new OpQueue(kv, makeExecutor(db), (op) => {
  console.warn('server refused a change, dropped:', op.table);
});
