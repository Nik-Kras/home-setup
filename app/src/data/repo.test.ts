import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { Task } from '../domain/types';
import { makeExecutor, ops } from './repo';

const shared: Task = {
  id: 't1',
  title: 'Register to vote',
  urgent: false,
  updatedBy: 'nikita',
  assignments: [
    { person: 'nikita', status: 'todo', steps: [{ id: 's1', title: 'Form', done: false }] },
    { person: 'daryna', status: 'todo', steps: [] },
  ],
};

describe('saveTask (creation)', () => {
  it('every creation upsert is insert-only, so a retry cannot reset a part ticked since', () => {
    const out = ops.saveTask(shared);
    expect(out.map((o) => o.table)).toEqual(['tasks', 'task_assignments', 'task_steps', 'task_assignments']);
    for (const op of out) expect(op).toMatchObject({ kind: 'upsert', ignoreDuplicates: true });
    expect(out[1]).toMatchObject({ onConflict: 'task_id,person', row: { task_id: 't1', person: 'nikita', status: 'todo' } });
  });
});

describe('makeExecutor', () => {
  const fakeDb = () => {
    const calls: { table: string; row: unknown; opts: unknown }[] = [];
    const db = { from: (table: string) => ({ upsert: async (row: unknown, opts: unknown) => (calls.push({ table, row, opts }), { error: null }) }) };
    return { db: db as unknown as SupabaseClient, calls };
  };

  it('passes ignoreDuplicates and onConflict to supabase upsert', async () => {
    const { db, calls } = fakeDb();
    const run = makeExecutor(db);
    for (const op of ops.saveTask(shared)) expect(await run(op)).toBe('ok');
    expect(calls[0]!.opts).toEqual({ ignoreDuplicates: true });
    expect(calls[1]!.opts).toEqual({ onConflict: 'task_id,person', ignoreDuplicates: true });
  });

  it('a plain upsert still overwrites (no options)', async () => {
    const { db, calls } = fakeDb();
    await makeExecutor(db)({ id: 'o1', kind: 'upsert', table: 'items', row: { id: 'i1' } });
    expect(calls[0]!.opts).toBeUndefined();
  });
});
