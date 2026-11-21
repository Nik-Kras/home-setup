/**
 * Live check of the sync layer against the real Supabase project, as the Claude account.
 * Run: npx tsx scripts/sync-check.ts   (reads app/.env; never prints secrets)
 * Creates test rows, round-trips them through the same code the app uses, then soft-deletes them.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { OpQueue, type KV } from '../src/data/queue';
import { loadAll, makeExecutor, ops, subscribe } from '../src/data/repo';
import { newId } from '../src/data/mappers';
import type { Item, Task } from '../src/domain/types';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const db = createClient(env.EXPO_PUBLIC_SUPABASE_URL!, env.EXPO_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const mem = new Map<string, string>();
const kv: KV = { getItem: async (k) => mem.get(k) ?? null, setItem: async (k, v) => void mem.set(k, v) };

let failed = 0;
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) failed++;
};

const { error: authErr } = await db.auth.signInWithPassword({ email: env.CLAUDE_EMAIL!, password: env.CLAUDE_PASSWORD! });
check('sign in as Claude', !authErr, authErr?.message ?? '');
if (authErr) process.exit(1);

const q = new OpQueue(kv, makeExecutor(db));
const snap0 = await loadAll(db);
check('load rooms', snap0.rooms.length >= 5, `${snap0.rooms.length} rooms`);
const roomIds = new Map(snap0.rooms.map((r) => [r.name, r.id]));

// realtime: another "device" (this script) writes; the subscription must fire
let events = 0;
const off = subscribe(db, () => events++);
await new Promise((r) => setTimeout(r, 1500));

const item: Item = { id: newId(), name: 'sync-check kettle', status: 'needed', quantity: 1, urgent: true, needsInstall: false, room: 'Kitchen', estPrice: 25, addedAt: new Date().toISOString(), updatedBy: 'claude' };
const task: Task = {
  id: newId(), title: 'sync-check shared task', urgent: false, updatedBy: 'claude',
  assignments: [
    { person: 'nikita', status: 'todo', steps: [{ id: newId(), title: 'step one', done: false }] },
    { person: 'daryna', status: 'todo', steps: [{ id: newId(), title: 'step one', done: false }] },
  ],
};

// Create offline-style: enqueue first, flush after.
await q.enqueue(ops.saveItem(item, roomIds));
for (const o of ops.saveTask(task)) await q.enqueue(o);
check('queued before sending', (await q.size()) >= 4, `${await q.size()} ops`);
await q.flush();
check('queue emptied after flush', (await q.size()) === 0);

let snap = await loadAll(db);
const gotItem = snap.items.find((i) => i.id === item.id);
check('item round-trips with room and price', gotItem?.room === 'Kitchen' && gotItem.estPrice === 25 && gotItem.urgent === true);
check('server stamped the actor', gotItem?.updatedBy === 'claude');
const gotTask = snap.tasks.find((t) => t.id === task.id);
check('shared task has two assignments', gotTask?.assignments.length === 2);
check('steps are per person', gotTask?.assignments.every((a) => a.steps.length === 1) === true);

// one person finishes; the other must be untouched
await q.enqueue(ops.setAssignment(task.id, 'nikita', 'done'));
await q.flush();
snap = await loadAll(db);
const after = snap.tasks.find((t) => t.id === task.id);
check('one assignee done, other still to do', after?.assignments.find((a) => a.person === 'nikita')?.status === 'done' && after.assignments.find((a) => a.person === 'daryna')?.status === 'todo');

// retry is safe: send the same op twice
const dup = ops.setAssignment(task.id, 'daryna', 'in_progress');
await q.enqueue(dup);
await q.enqueue(dup);
await q.flush();
snap = await loadAll(db);
check('duplicate op is harmless', snap.tasks.find((t) => t.id === task.id)?.assignments.find((a) => a.person === 'daryna')?.status === 'in_progress');

await new Promise((r) => setTimeout(r, 1500));
check('realtime events arrived', events > 0, `${events} events`);
off();

// cleanup: soft delete (Claude cannot hard delete)
await q.enqueue(ops.softDelete('items', item.id));
await q.enqueue(ops.softDelete('tasks', task.id));
await q.flush();
snap = await loadAll(db);
check('soft-deleted rows are hidden', !snap.items.some((i) => i.id === item.id) && !snap.tasks.some((t) => t.id === task.id));

const forge = await db.from('items').insert({ id: newId(), name: 'sync-check forge', updated_by: 'nikita' }).select('id,updated_by');
check('actor cannot be forged (needs migration 0003)', forge.data?.[0]?.updated_by === 'claude', forge.data?.[0] ? `stored as ${forge.data[0].updated_by}` : String(forge.error?.message));
if (forge.data?.[0]) await db.from('items').update({ deleted_at: new Date().toISOString() }).eq('id', forge.data[0].id);

const hard = await db.from('items').delete().eq('id', item.id).select();
check('Claude cannot hard-delete', (hard.data?.length ?? 0) === 0);

console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
await db.removeAllChannels();
process.exit(failed === 0 ? 0 : 1);
