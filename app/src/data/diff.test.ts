import { describe, expect, it } from 'vitest';
import { diffToOps } from './diff';
import { setAssignmentStatus, toggleStep } from '../domain/tasks';
import { markGot, setStatus } from '../domain/items';
import type { Item, Task } from '../domain/types';

const rooms = new Map([['Kitchen', 'room-1']]);
const item: Item = { id: 'i1', name: 'Kettle', status: 'needed', quantity: 1, urgent: false, needsInstall: false, room: 'Kitchen', addedAt: '2026-11-21T10:00:00Z', updatedBy: 'nikita' };
const task: Task = {
  id: 't1', title: 'Register with a new GP', urgent: false, updatedBy: 'claude',
  assignments: [
    { person: 'nikita', status: 'todo', steps: [{ id: 's1', title: 'Pick', done: false }] },
    { person: 'daryna', status: 'todo', steps: [{ id: 's2', title: 'Pick', done: false }] },
  ],
};

describe('diffToOps', () => {
  it('sends nothing when nothing changed', () => {
    expect(diffToOps({ items: [item], tasks: [task] }, { items: [item], tasks: [task] }, rooms)).toEqual([]);
  });

  it('marking an item got is one patch of status and deliveredAt', () => {
    const out = diffToOps({ items: [item], tasks: [] }, { items: [markGot(item, '2026-11-22T00:00:00Z', 'nikita')], tasks: [] }, rooms);
    expect(out).toEqual([{ id: expect.any(String), kind: 'patch', table: 'items', match: { id: 'i1' }, row: { status: 'delivered', delivered_at: '2026-11-22T00:00:00Z' } }]);
  });

  it('an item field edit patches only the changed columns, never updated_by', () => {
    const next: Item = { ...item, estPrice: 30, needsInstall: true, room: undefined, updatedBy: 'daryna' };
    const out = diffToOps({ items: [item], tasks: [] }, { items: [next], tasks: [] }, rooms);
    expect(out).toEqual([{ id: expect.any(String), kind: 'patch', table: 'items', match: { id: 'i1' }, row: { est_price: 30, needs_install: true, room_id: null } }]);
  });

  it('a new item is one upsert of the whole row', () => {
    const out = diffToOps({ items: [], tasks: [] }, { items: [item], tasks: [] }, rooms);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'upsert', table: 'items', row: { id: 'i1', name: 'Kettle', status: 'needed', quantity: 1, room_id: 'room-1', added_at: '2026-11-21T10:00:00Z' } });
    expect(out[0]!.row).not.toHaveProperty('updated_by');
  });

  it('an item change that only touches updatedBy sends nothing', () => {
    expect(diffToOps({ items: [item], tasks: [] }, { items: [{ ...item, updatedBy: 'daryna' }], tasks: [] }, rooms)).toEqual([]);
  });

  it('my part of a shared task sends only my assignment, never the other person', () => {
    const next = setAssignmentStatus(task, 'nikita', 'done', 'nikita');
    const out = diffToOps({ items: [], tasks: [task] }, { items: [], tasks: [next] }, rooms);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'patch', table: 'task_assignments', match: { task_id: 't1', person: 'nikita' }, row: { status: 'done' } });
  });

  it('ticking a step patches just that step', () => {
    const next = toggleStep(task, 'daryna', 's2', 'daryna');
    const out = diffToOps({ items: [], tasks: [task] }, { items: [], tasks: [next] }, rooms);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'patch', table: 'task_steps', match: { id: 's2' }, row: { done: true } });
  });

  it('a task field change is one patch on tasks with only the changed columns', () => {
    const next: Task = { ...task, due: '2026-12-01', group: 'Address', updatedBy: 'nikita' };
    const out = diffToOps({ items: [], tasks: [task] }, { items: [], tasks: [next] }, rooms);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ id: expect.any(String), kind: 'patch', table: 'tasks', match: { id: 't1' }, row: { due: '2026-12-01', grp: 'Address' } });
  });

  it('clearing a task field sends null', () => {
    const before: Task = { ...task, notes: 'Bring ID' };
    const out = diffToOps({ items: [], tasks: [before] }, { items: [], tasks: [{ ...before, notes: undefined }] }, rooms);
    expect(out).toEqual([expect.objectContaining({ kind: 'patch', table: 'tasks', row: { notes: null } })]);
  });

  it('an item status change is one patch with the new status and timestamps', () => {
    const next = setStatus(item, 'installed', '2026-11-23T00:00:00Z', 'daryna');
    const out = diffToOps({ items: [item], tasks: [] }, { items: [next], tasks: [] }, rooms);
    expect(out).toEqual([{ id: expect.any(String), kind: 'patch', table: 'items', match: { id: 'i1' }, row: { status: 'installed', installed_at: '2026-11-23T00:00:00Z', delivered_at: '2026-11-23T00:00:00Z' } }]);
  });

  it('a task field change and my assignment change send one task patch and my assignment only', () => {
    const next: Task = { ...setAssignmentStatus(task, 'daryna', 'in_progress', 'daryna'), due: '2026-12-05' };
    const out = diffToOps({ items: [], tasks: [task] }, { items: [], tasks: [next] }, rooms);
    expect(out).toEqual([
      { id: expect.any(String), kind: 'patch', table: 'tasks', match: { id: 't1' }, row: { due: '2026-12-05' } },
      { id: expect.any(String), kind: 'patch', table: 'task_assignments', match: { task_id: 't1', person: 'daryna' }, row: { status: 'in_progress' } },
    ]);
  });

  it('a new task sends the task, each assignment and each step', () => {
    const out = diffToOps({ items: [], tasks: [] }, { items: [], tasks: [task] }, rooms);
    expect(out.map((o) => o.table)).toEqual(['tasks', 'task_assignments', 'task_steps', 'task_assignments', 'task_steps']);
  });
});
