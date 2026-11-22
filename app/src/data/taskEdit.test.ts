import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { FlatNote, Item, Task } from '../domain/types';
import { diffToOps } from './diff';
import type { Op } from './queue';
import { reducer, type Action, type State } from './reducer';
import { makeExecutor, ops } from './repo';
import { applyUndo, DELETE_SNACK_MS, offerSnack, removalNotice, SNACK_MS, undoEntryFor, type UndoEntry } from './undo';

const rooms = new Map<string, string>();
const kettle: Item = { id: 'i1', name: 'Kettle', status: 'ordered', quantity: 1, urgent: false, needsInstall: false, addedAt: '2026-11-21T10:00:00Z', updatedBy: 'claude' };
const solo: Task = { id: 't1', title: 'Book the van', urgent: false, updatedBy: 'claude', assignments: [{ person: 'nikita', status: 'todo', steps: [] }] };
const shared: Task = {
  id: 't2', title: 'Register with a GP', urgent: false, group: 'Address', updatedBy: 'claude',
  assignments: [
    { person: 'nikita', status: 'in_progress', steps: [{ id: 's1', title: 'Pick a practice', done: true, sort: 0 }] },
    { person: 'daryna', status: 'done', steps: [{ id: 's2', title: 'Fill the form', done: true, sort: 0 }] },
  ],
};
const bins: FlatNote = { id: 'n1', title: 'Bin day', kind: 'info', sort: 1, updatedBy: 'claude' };
const start: State = { me: 'nikita', items: [kettle], tasks: [solo, shared], notes: [bins] };

function edit(state: State, action: Action): { next: State; entry: UndoEntry; out: Op[] } {
  const next = reducer(state, action);
  const entry = undoEntryFor(state, next, action, 1_000, 'u1');
  if (!entry) throw new Error(`no undo entry for ${action.type}`);
  return { next, entry, out: diffToOps(state, next, rooms) };
}
const task = (s: State, id: string) => s.tasks.find((t) => t.id === id)!;
const people = (t: Task) => t.assignments.map((a) => a.person);

describe('a price saved without a buyer', () => {
  it('counts as bought by me, so Budget never has spend in nobody\'s share by accident', () => {
    const next = reducer(start, { type: 'updateItem', id: 'i1', patch: { actualPrice: 40 } });
    expect(next.items[0]).toMatchObject({ actualPrice: 40, boughtBy: 'nikita' });
  });

  it('keeps a buyer already recorded, and an explicit choice wins', () => {
    const hers: State = { ...start, items: [{ ...kettle, boughtBy: 'daryna' }] };
    expect(reducer(hers, { type: 'updateItem', id: 'i1', patch: { actualPrice: 40 } }).items[0]!.boughtBy).toBe('daryna');
    expect(reducer(start, { type: 'updateItem', id: 'i1', patch: { actualPrice: 40, boughtBy: 'daryna' } }).items[0]!.boughtBy).toBe('daryna');
  });

  it('clearing a price does not invent a buyer', () => {
    const priced: State = { ...start, items: [{ ...kettle, actualPrice: 40 }] };
    expect(reducer(priced, { type: 'updateItem', id: 'i1', patch: { actualPrice: undefined } }).items[0]!.boughtBy).toBeUndefined();
  });

  it('sends the price and the buyer in one patch', () => {
    const next = reducer(start, { type: 'updateItem', id: 'i1', patch: { actualPrice: 40 } });
    expect(diffToOps(start, next, rooms)).toEqual([expect.objectContaining({ kind: 'patch', table: 'items', match: { id: 'i1' }, row: { actual_price: 40, bought_by: 'nikita' } })]);
  });
});

describe('task edit: fields and who it is for', () => {
  it('changes group, date, urgent, notes and reference in one task patch and one Undo', () => {
    const { next, entry, out } = edit(start, { type: 'updateTask', id: 't1', patch: { group: 'Utilities', due: '2026-12-01', urgent: true, notes: ' Ask about stairs ', reference: '' } });
    expect(task(next, 't1')).toMatchObject({ group: 'Utilities', due: '2026-12-01', urgent: true, notes: 'Ask about stairs', reference: undefined });
    expect(out).toEqual([expect.objectContaining({ table: 'tasks', match: { id: 't1' }, row: { grp: 'Utilities', due: '2026-12-01', urgent: true, notes: 'Ask about stairs' } })]);
    expect(entry.message).toBe('Book the van → updated');
  });

  it('describes a single change in plain words', () => {
    expect(edit(start, { type: 'updateTask', id: 't1', patch: { due: '2026-12-01' } }).entry.message).toBe('Book the van → due 1 Dec');
    expect(edit(start, { type: 'updateTask', id: 't1', patch: { urgent: true } }).entry.message).toBe('Book the van → urgent');
    expect(edit(start, { type: 'updateTask', id: 't1', patch: { title: 'Book a van' } }).entry.message).toBe('Renamed to Book a van');
    expect(edit(start, { type: 'updateTask', id: 't1', patch: {}, assignees: ['nikita', 'daryna'] }).entry.message).toBe('Book the van → for both of you');
    expect(edit(start, { type: 'updateTask', id: 't2', patch: {}, assignees: ['daryna'] }).entry.message).toBe('Register with a GP → for Daryna');
  });

  it('adding the other person is one insert-only op for their part; my part is not touched', () => {
    const { next, out } = edit(start, { type: 'updateTask', id: 't1', patch: {}, assignees: ['nikita', 'daryna'] });
    expect(people(task(next, 't1'))).toEqual(['nikita', 'daryna']);
    expect(task(next, 't1').assignments[0]).toBe(solo.assignments[0]);
    expect(out).toEqual([{ id: expect.any(String), kind: 'upsert', table: 'task_assignments', onConflict: 'task_id,person', ignoreDuplicates: true, row: { task_id: 't1', person: 'daryna', status: 'todo' } }]);
  });

  it('taking someone off removes only their part; the other person\'s status and steps stay', () => {
    const { next, out } = edit(start, { type: 'updateTask', id: 't2', patch: {}, assignees: ['daryna'] });
    expect(task(next, 't2').assignments).toEqual([shared.assignments[1]]);
    // Conditional on the status this phone saw, and reported when it removed nothing.
    expect(out).toEqual([{ id: expect.any(String), kind: 'delete', table: 'task_assignments', match: { task_id: 't2', person: 'nikita', status: 'in_progress' }, row: {}, reportMiss: true }]);
  });

  it('never leaves a task with nobody, and the same people change nothing', () => {
    expect(reducer(start, { type: 'updateTask', id: 't1', patch: {}, assignees: [] })).toBe(start);
    expect(reducer(start, { type: 'updateTask', id: 't2', patch: {}, assignees: ['daryna', 'nikita'] })).toBe(start);
  });
});

describe('task edit Undo', () => {
  it('puts every field back with conditional patches', () => {
    const { next, entry } = edit(start, { type: 'updateTask', id: 't2', patch: { group: undefined, due: '2026-12-01' } });
    const undone = applyUndo(next, entry, rooms);
    expect(undone.outcome).toBe('done');
    expect(task(undone.state, 't2')).toMatchObject({ group: 'Address', due: undefined });
    expect(undone.ops.map((o) => [o.kind, (o as Extract<Op, { kind: 'patch' }>).match, o.row])).toEqual([
      ['patch', { id: 't2', due: '2026-12-01' }, { due: null }],
      ['patch', { id: 't2', grp: null }, { grp: 'Address' }],
    ]);
  });

  it('keeps a field the other person changed since (partial)', () => {
    const { next, entry } = edit(start, { type: 'updateTask', id: 't1', patch: { urgent: true, title: 'Book a van' } });
    const theirs: State = { ...next, tasks: next.tasks.map((t) => (t.id === 't1' ? { ...t, title: 'Book the big van' } : t)) };
    const undone = applyUndo(theirs, entry, rooms);
    expect(undone.outcome).toBe('partial');
    expect(task(undone.state, 't1')).toMatchObject({ title: 'Book the big van', urgent: false });
  });

  it('a person taken off comes back with their status and steps', () => {
    const { next, entry } = edit(start, { type: 'updateTask', id: 't2', patch: {}, assignees: ['daryna'] });
    const undone = applyUndo(next, entry, rooms);
    expect(undone.outcome).toBe('done');
    expect(task(undone.state, 't2').assignments).toEqual(shared.assignments);
    expect(undone.ops).toEqual([
      expect.objectContaining({ kind: 'upsert', table: 'task_assignments', ignoreDuplicates: true, row: { task_id: 't2', person: 'nikita', status: 'in_progress' } }),
      expect.objectContaining({ kind: 'upsert', table: 'task_steps', ignoreDuplicates: true, row: expect.objectContaining({ id: 's1', person: 'nikita', done: true }) }),
    ]);
  });

  it('a person added goes again only while their part is untouched; the delete is conditional', () => {
    const { next, entry } = edit(start, { type: 'updateTask', id: 't1', patch: {}, assignees: ['nikita', 'daryna'] });
    const undone = applyUndo(next, entry, rooms);
    expect(people(task(undone.state, 't1'))).toEqual(['nikita']);
    expect(undone.ops).toEqual([{ id: expect.any(String), kind: 'delete', table: 'task_assignments', match: { task_id: 't1', person: 'daryna', status: 'todo' }, row: {}, reportMiss: true }]);
    // She started her part on her phone meanwhile: it stays.
    const started: State = { ...next, tasks: next.tasks.map((t) => (t.id === 't1' ? { ...t, assignments: t.assignments.map((a) => (a.person === 'daryna' ? { ...a, status: 'in_progress' as const } : a)) } : t)) };
    const kept = applyUndo(started, entry, rooms);
    expect(kept.outcome).toBe('none');
    expect(people(task(kept.state, 't1'))).toEqual(['nikita', 'daryna']);
  });
});

describe('Undo of who a task is for restores exactly the people it had', () => {
  const hers: Task = { id: 't3', title: 'Call the bank', urgent: false, updatedBy: 'claude', assignments: [{ person: 'daryna', status: 'done', steps: [] }] };
  const base: State = { ...start, tasks: [solo, shared, hers] };
  const parts = (t: Task) => t.assignments.map((a) => [a.person, a.status]);

  it('Me -> Daryna -> Undo: back to me alone, as it was, not shared', () => {
    const { next, entry } = edit(base, { type: 'updateTask', id: 't1', patch: {}, assignees: ['daryna'] });
    expect(parts(task(next, 't1'))).toEqual([['daryna', 'todo']]);
    const undone = applyUndo(next, entry, rooms);
    expect(undone.outcome).toBe('done');
    expect(task(undone.state, 't1').assignments).toEqual(solo.assignments);
    expect(undone.ops.map((o) => [o.kind, o.table, o.kind === 'upsert' ? o.row : o.match])).toEqual([
      ['upsert', 'task_assignments', { task_id: 't1', person: 'nikita', status: 'todo' }],
      ['delete', 'task_assignments', { task_id: 't1', person: 'daryna', status: 'todo' }],
    ]);
  });

  it('both -> Me -> Undo: Daryna comes back with her status and steps, insert-only', () => {
    const { next, entry } = edit(base, { type: 'updateTask', id: 't2', patch: {}, assignees: ['nikita'] });
    const undone = applyUndo(next, entry, rooms);
    expect(undone.outcome).toBe('done');
    expect(task(undone.state, 't2').assignments).toEqual(shared.assignments);
    expect(undone.ops.every((o) => o.kind === 'upsert' && o.ignoreDuplicates)).toBe(true);
  });

  it('Daryna -> both -> Undo: I go again and her finished part is untouched', () => {
    const { next, entry } = edit(base, { type: 'updateTask', id: 't3', patch: {}, assignees: ['daryna', 'nikita'] });
    const undone = applyUndo(next, entry, rooms);
    expect(undone.outcome).toBe('done');
    expect(task(undone.state, 't3').assignments).toEqual(hers.assignments);
    expect(undone.ops).toEqual([expect.objectContaining({ kind: 'delete', match: { task_id: 't3', person: 'nikita', status: 'todo' }, reportMiss: true })]);
  });

  it('leaves who it is for alone when someone changed it since', () => {
    const { next, entry } = edit(base, { type: 'updateTask', id: 't1', patch: {}, assignees: ['daryna'] });
    const readded: State = { ...next, tasks: next.tasks.map((t) => (t.id === 't1' ? { ...t, assignments: [...t.assignments, { person: 'nikita' as const, status: 'done' as const, steps: [] }] } : t)) };
    const undone = applyUndo(readded, entry, rooms);
    expect(undone.outcome).toBe('none');
    expect(undone.ops).toEqual([]);
  });

  it('keeps a person added by the edit who has started their part since (partial), never leaving nobody', () => {
    const { next, entry } = edit(base, { type: 'updateTask', id: 't1', patch: {}, assignees: ['daryna'] });
    const started: State = { ...next, tasks: next.tasks.map((t) => (t.id === 't1' ? { ...t, assignments: [{ person: 'daryna' as const, status: 'in_progress' as const, steps: [] }] } : t)) };
    const undone = applyUndo(started, entry, rooms);
    expect(undone.outcome).toBe('partial');
    expect(parts(task(undone.state, 't1'))).toEqual([['nikita', 'todo'], ['daryna', 'in_progress']]);
  });
});

describe('a removal that did not happen on the server', () => {
  it('names the person and the task; other ops get no notice', () => {
    const op = ops.removeAssignment('t2', 'daryna', { status: 'done' });
    expect(removalNotice(op, start.tasks)).toBe('Could not remove Daryna from Register with a GP');
    expect(removalNotice(ops.patchTask('t2', { title: 'x' }), start.tasks)).toBeUndefined();
  });
});

describe('deleting tasks and notes', () => {
  it('a task delete hides it, offers a 10 s Undo, and Undo puts it back in place with deleted_at cleared', () => {
    const { next, entry } = edit(start, { type: 'deleteTask', id: 't1' });
    expect(next.tasks.map((t) => t.id)).toEqual(['t2']);
    expect(entry.message).toBe('Book the van deleted');
    expect(offerSnack(entry).ms).toBe(DELETE_SNACK_MS);
    const undone = applyUndo(next, entry, rooms);
    expect(undone.state.tasks.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(undone.ops).toEqual([{ id: expect.any(String), kind: 'patch', table: 'tasks', match: { id: 't1' }, row: { deleted_at: null } }]);
  });

  it('a note delete works the same way', () => {
    const { next, entry } = edit(start, { type: 'deleteNote', id: 'n1' });
    expect(next.notes).toEqual([]);
    expect(offerSnack(entry).ms).toBe(DELETE_SNACK_MS);
    const undone = applyUndo(next, entry, rooms);
    expect(undone.state.notes.map((n) => n.id)).toEqual(['n1']);
    expect(undone.ops).toEqual([expect.objectContaining({ table: 'flat_notes', match: { id: 'n1' }, row: { deleted_at: null } })]);
  });

  it('a status change keeps the short 6 s snackbar', () => {
    const { entry } = edit(start, { type: 'setTaskStatus', id: 't1', person: 'nikita', status: 'done' });
    expect(offerSnack(entry).ms).toBe(SNACK_MS);
  });

  it('diffToOps never turns a missing task or note into a delete (the store sends the soft delete)', () => {
    expect(diffToOps(start, reducer(start, { type: 'deleteTask', id: 't1' }), rooms)).toEqual([]);
    expect(diffToOps(start, reducer(start, { type: 'deleteNote', id: 'n1' }), rooms)).toEqual([]);
  });
});

describe('executor: deletes', () => {
  const fakeDb = (count: number) => {
    const calls: { table: string; filters: [string, unknown][]; opts: unknown }[] = [];
    const db = {
      from: (table: string) => ({
        delete: (opts?: unknown) => {
          const call = { table, filters: [] as [string, unknown][], opts };
          calls.push(call);
          const q = {
            eq: (k: string, v: unknown) => (call.filters.push([k, v]), q),
            is: (k: string, v: unknown) => (call.filters.push([k, v]), q),
            then: (res: (r: { error: null; count: number }) => unknown) => Promise.resolve({ error: null, count }).then(res),
          };
          return q;
        },
      }),
    };
    return { db: db as unknown as SupabaseClient, calls };
  };

  it('deletes by every match column; a conditional delete that matched nothing is "missed"', async () => {
    const { db, calls } = fakeDb(0);
    const run = makeExecutor(db);
    expect(await run(ops.removeAssignment('t1', 'daryna'))).toBe('ok');
    expect(await run(ops.removeAssignment('t1', 'daryna', { status: 'todo' }))).toBe('missed');
    expect(calls[0]).toEqual({ table: 'task_assignments', filters: [['task_id', 't1'], ['person', 'daryna']], opts: undefined });
    expect(calls[1]!.opts).toEqual({ count: 'exact' });
    expect(calls[1]!.filters).toContainEqual(['status', 'todo']);
  });
});
