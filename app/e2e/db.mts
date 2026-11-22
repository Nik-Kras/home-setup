/**
 * Database helper for the e2e flows. Signs in as the Claude account (credentials from app/.env, never
 * printed), reads rows, makes "other phone" changes and cleans up by soft delete only.
 *
 *   npx -y tsx e2e/db.mts <command> [args]
 *
 * Commands (exit 0 on success, 1 on a failed check):
 *   list                              rows whose name/title starts with "ZZ" (items, tasks, notes)
 *   cleanup                           soft-delete every live "ZZ..." item, task and note (sets deleted_at)
 *   item <name>                       print the live item named <name> as JSON (or "null")
 *   expect-item <name> k=v [k=v ...]  wait up to 15 s until exactly one live item <name> has these fields
 *   expect-count <table> <name> <n>   wait up to 15 s until <n> live rows in items|tasks|flat_notes have this name/title
 *   expect-task <title> person=status [person=status]   wait until the task's assignments match
 *   expect-note <title> k=v [k=v ...] wait until one live note <title> has these fields
 *   expect-photo <itemName> [n]       wait until the item has at least n (default 1) photo rows
 *   set-item <name> k=v [k=v ...]     update the live item named <name> (as Claude, like another phone)
 *   set-assignment <title> <person> <status>   update one person's part of a task
 *   add-item <name>                   insert a live item (status needed)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const db = createClient(env.EXPO_PUBLIC_SUPABASE_URL!, env.EXPO_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const { error: authErr } = await db.auth.signInWithPassword({ email: env.CLAUDE_EMAIL!, password: env.CLAUDE_PASSWORD! });
if (authErr) fail(`sign in as Claude failed: ${authErr.message}`);

const now = () => new Date().toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function fail(msg: string): never {
  console.error(`DB FAIL  ${msg}`);
  process.exit(1);
}
function pairs(args: string[]): Record<string, string> {
  return Object.fromEntries(args.map((a) => [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)]));
}
/** Compare a stored value with a k=v string: null, true/false and numbers are matched loosely. */
function same(value: unknown, want: string): boolean {
  if (want === 'null') return value === null || value === undefined;
  if (want === 'notnull') return value !== null && value !== undefined;
  return String(value) === want;
}
async function poll<T>(what: string, read: () => Promise<T>, ok: (v: T) => boolean, seconds = 15): Promise<T> {
  let last: T | undefined;
  for (let i = 0; i < seconds * 2; i++) {
    last = await read();
    if (ok(last)) return last;
    await sleep(500);
  }
  fail(`${what}; last seen ${JSON.stringify(last)}`);
}

const NAME_COL: Record<string, string> = { items: 'name', tasks: 'title', flat_notes: 'title' };
async function liveRows(table: string, name: string) {
  const { data, error } = await db.from(table).select('*').eq(NAME_COL[table]!, name).is('deleted_at', null);
  if (error) fail(error.message);
  return data ?? [];
}
async function oneItem(name: string) {
  const rows = await liveRows('items', name);
  if (rows.length !== 1) fail(`expected one live item "${name}", found ${rows.length}`);
  return rows[0]!;
}
async function oneTask(title: string) {
  const rows = await liveRows('tasks', title);
  if (rows.length !== 1) fail(`expected one live task "${title}", found ${rows.length}`);
  return rows[0]!;
}
function guardName(name: string | undefined): string {
  if (!name?.startsWith('ZZ-e2e-')) fail('test rows must be named with the prefix "ZZ-e2e-"');
  return name;
}

const [cmd, ...args] = process.argv.slice(2);
switch (cmd) {
  case 'list': {
    for (const [table, col] of Object.entries(NAME_COL)) {
      const { data, error } = await db.from(table).select(`id,${col},deleted_at`).like(col, 'ZZ%').is('deleted_at', null);
      if (error) fail(error.message);
      for (const r of data ?? []) console.log(`${table}\t${(r as Record<string, string>)[col]}`);
    }
    break;
  }
  case 'cleanup': {
    let n = 0;
    for (const [table, col] of Object.entries(NAME_COL)) {
      const { data, error } = await db.from(table).update({ deleted_at: now() }).like(col, 'ZZ%').is('deleted_at', null).select('id');
      if (error) fail(`${table}: ${error.message}`);
      n += data?.length ?? 0;
    }
    console.log(`soft-deleted ${n} ZZ row(s)`);
    break;
  }
  case 'item': {
    const rows = await liveRows('items', args[0]!);
    console.log(JSON.stringify(rows[0] ?? null));
    break;
  }
  case 'expect-item': {
    const [name, ...kv] = args;
    const want = pairs(kv);
    const row = await poll(`item "${name}" with ${kv.join(' ')}`, () => liveRows('items', name!), (rows) => rows.length === 1 && Object.entries(want).every(([k, v]) => same(rows[0]![k], v)));
    console.log(`DB OK  item "${name}" ${kv.join(' ')} (updated_by=${row[0]!.updated_by})`);
    break;
  }
  case 'expect-count': {
    const [table, name, n] = args;
    if (!NAME_COL[table!]) fail(`unknown table ${table}`);
    await poll(`${n} live ${table} row(s) named "${name}"`, () => liveRows(table!, name!), (rows) => rows.length === Number(n));
    console.log(`DB OK  ${n} live ${table} row(s) named "${name}"`);
    break;
  }
  case 'expect-task': {
    const [title, ...kv] = args;
    const want = pairs(kv);
    await poll(`task "${title}" with ${kv.join(' ')}`, async () => {
      const task = await oneTask(title!);
      const { data } = await db.from('task_assignments').select('person,status').eq('task_id', task.id);
      return Object.fromEntries((data ?? []).map((a) => [a.person, a.status]));
    }, (got) => Object.keys(got).length === Object.keys(want).length && Object.entries(want).every(([p, s]) => got[p] === s));
    console.log(`DB OK  task "${title}" ${kv.join(' ')}`);
    break;
  }
  case 'expect-note': {
    const [title, ...kv] = args;
    const want = pairs(kv);
    await poll(`note "${title}" with ${kv.join(' ')}`, () => liveRows('flat_notes', title!), (rows) => rows.length === 1 && Object.entries(want).every(([k, v]) => same(rows[0]![k], v)));
    console.log(`DB OK  note "${title}" ${kv.join(' ')}`);
    break;
  }
  case 'expect-photo': {
    const [name, n = '1'] = args;
    await poll(`item "${name}" with ${n} photo(s)`, async () => {
      const item = await oneItem(name!);
      const { data } = await db.from('item_photos').select('id,path').eq('item_id', item.id);
      return data ?? [];
    }, (rows) => rows.length >= Number(n), 30);
    console.log(`DB OK  item "${name}" has a photo`);
    break;
  }
  case 'set-item': {
    const [name, ...kv] = args;
    const item = await oneItem(guardName(name));
    const row: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(pairs(kv))) row[k] = v === 'null' ? null : v === 'true' ? true : v === 'false' ? false : v;
    const { error } = await db.from('items').update(row).eq('id', item.id);
    if (error) fail(error.message);
    console.log(`DB SET  item "${name}" ${kv.join(' ')}`);
    break;
  }
  case 'set-assignment': {
    const [title, person, status] = args;
    const task = await oneTask(guardName(title));
    const { data, error } = await db.from('task_assignments').update({ status }).eq('task_id', task.id).eq('person', person!).select('person');
    if (error || !data?.length) fail(error?.message ?? `no ${person} assignment on "${title}"`);
    console.log(`DB SET  task "${title}" ${person}=${status}`);
    break;
  }
  case 'add-item': {
    const { error } = await db.from('items').insert({ name: guardName(args[0]) });
    if (error) fail(error.message);
    console.log(`DB SET  added item "${args[0]}"`);
    break;
  }
  default:
    console.error('usage: npx -y tsx e2e/db.mts list|cleanup|item|expect-item|expect-count|expect-task|expect-note|expect-photo|set-item|set-assignment|add-item ...');
    process.exit(2);
}
await db.auth.signOut().catch(() => undefined);
process.exit(0);
