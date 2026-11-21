import { describe, expect, it } from 'vitest';
import { diffToOps } from './diff';
import { reducer, type State } from './reducer';
import type { Item, Task } from '../domain/types';

const item: Item = { id: 'i1', name: 'Kettle', status: 'needed', quantity: 1, urgent: false, needsInstall: true, room: 'Kitchen', addedAt: '2026-11-21T10:00:00Z', updatedBy: 'claude' };
const task: Task = {
  id: 't1', title: 'Register with a new GP', urgent: false, updatedBy: 'claude',
  assignments: [{ person: 'nikita', status: 'todo', steps: [] }, { person: 'daryna', status: 'done', steps: [] }],
};
const state: State = { me: 'daryna', items: [item], tasks: [task], notes: [] };

describe('updateItem', () => {
  it('applies the patch, keeps the id and stamps who changed it', () => {
    const next = reducer(state, { type: 'updateItem', id: 'i1', patch: { estPrice: 30, room: 'Living room' } });
    expect(next.items[0]).toMatchObject({ id: 'i1', name: 'Kettle', estPrice: 30, room: 'Living room', updatedBy: 'daryna' });
  });

  it('a patch that changes nothing returns the same state', () => {
    expect(reducer(state, { type: 'updateItem', id: 'i1', patch: { name: 'Kettle' } })).toBe(state);
  });

  it('an empty name is refused', () => {
    expect(reducer(state, { type: 'updateItem', id: 'i1', patch: { name: '  ' } })).toBe(state);
  });

  it('trims the name on save', () => {
    expect(reducer(state, { type: 'updateItem', id: 'i1', patch: { name: '  Kettle 2 ' } }).items[0]!.name).toBe('Kettle 2');
    expect(reducer(state, { type: 'updateItem', id: 'i1', patch: { name: ' Kettle ' } })).toBe(state);
  });

  it('ignores status, its timestamps and addedAt, which go through setItemStatus', () => {
    const sneaky = { status: 'installed', deliveredAt: 'x', installedAt: 'y', addedAt: 'z', id: 'other', updatedBy: 'claude' } as unknown as { notes: string };
    expect(reducer(state, { type: 'updateItem', id: 'i1', patch: sneaky })).toBe(state);
    const next = reducer(state, { type: 'updateItem', id: 'i1', patch: { ...sneaky, notes: 'Matte' } }).items[0]!;
    expect(next).toEqual({ ...item, notes: 'Matte', updatedBy: 'daryna' });
  });

  it('an unknown id is a no-op', () => {
    expect(reducer(state, { type: 'updateItem', id: 'nope', patch: { name: 'Toaster' } })).toBe(state);
  });
});

describe('setItemStatus', () => {
  it('delivered stamps deliveredAt', () => {
    const got = reducer(state, { type: 'setItemStatus', id: 'i1', status: 'delivered' }).items[0]!;
    expect(got.status).toBe('delivered');
    expect(got.deliveredAt).toBeTruthy();
    expect(got.installedAt).toBeUndefined();
    expect(got.updatedBy).toBe('daryna');
  });

  it('installed stamps installedAt and keeps an earlier deliveredAt', () => {
    const delivered: State = { ...state, items: [{ ...item, status: 'delivered', deliveredAt: '2026-11-22T09:00:00Z' }] };
    const got = reducer(delivered, { type: 'setItemStatus', id: 'i1', status: 'installed' }).items[0]!;
    expect(got).toMatchObject({ status: 'installed', deliveredAt: '2026-11-22T09:00:00Z' });
    expect(got.installedAt).toBeTruthy();
  });

  it('going back to ordered clears the timestamps', () => {
    const done: State = { ...state, items: [{ ...item, status: 'installed', deliveredAt: '2026-11-22T09:00:00Z', installedAt: '2026-11-23T09:00:00Z' }] };
    const got = reducer(done, { type: 'setItemStatus', id: 'i1', status: 'ordered' }).items[0]!;
    expect(got.status).toBe('ordered');
    expect(got.deliveredAt).toBeUndefined();
    expect(got.installedAt).toBeUndefined();
  });

  it('the same status returns the same state', () => {
    expect(reducer(state, { type: 'setItemStatus', id: 'i1', status: 'needed' })).toBe(state);
  });

  it('installed straight from needed stamps both timestamps', () => {
    const got = reducer(state, { type: 'setItemStatus', id: 'i1', status: 'installed' }).items[0]!;
    expect(got.status).toBe('installed');
    expect(got.deliveredAt).toBeTruthy();
    expect(got.installedAt).toBe(got.deliveredAt);
  });

  it('installed back to delivered keeps the original deliveredAt and clears installedAt', () => {
    const done: State = { ...state, items: [{ ...item, status: 'installed', deliveredAt: '2026-11-22T09:00:00Z', installedAt: '2026-11-23T09:00:00Z' }] };
    const got = reducer(done, { type: 'setItemStatus', id: 'i1', status: 'delivered' }).items[0]!;
    expect(got).toMatchObject({ status: 'delivered', deliveredAt: '2026-11-22T09:00:00Z' });
    expect(got.installedAt).toBeUndefined();
  });

  it('an unknown id is a no-op', () => {
    expect(reducer(state, { type: 'setItemStatus', id: 'nope', status: 'delivered' })).toBe(state);
  });
});

describe('updateTask', () => {
  it('changes only the task fields and leaves assignments alone', () => {
    const next = reducer(state, { type: 'updateTask', id: 't1', patch: { due: '2026-12-01', urgent: true, group: 'Address' } }).tasks[0]!;
    expect(next).toMatchObject({ title: 'Register with a new GP', due: '2026-12-01', urgent: true, group: 'Address', updatedBy: 'daryna' });
    expect(next.assignments).toBe(task.assignments);
  });

  it('ignores fields outside the allowed set', () => {
    const sneaky = { title: 'GP', assignments: [] } as unknown as { title: string };
    const next = reducer(state, { type: 'updateTask', id: 't1', patch: sneaky }).tasks[0]!;
    expect(next.title).toBe('GP');
    expect(next.assignments).toBe(task.assignments);
  });

  it('clearing a field sets it to undefined', () => {
    const withNotes: State = { ...state, tasks: [{ ...task, notes: 'Bring ID', due: '2026-12-01' }] };
    const next = reducer(withNotes, { type: 'updateTask', id: 't1', patch: { notes: undefined } }).tasks[0]!;
    expect(next.notes).toBeUndefined();
    expect(next).toMatchObject({ due: '2026-12-01', updatedBy: 'daryna' });
  });

  it('trims the title on save', () => {
    expect(reducer(state, { type: 'updateTask', id: 't1', patch: { title: '  GP visit  ' } }).tasks[0]!.title).toBe('GP visit');
  });

  it('an unknown id is a no-op', () => {
    expect(reducer(state, { type: 'updateTask', id: 'nope', patch: { title: 'GP' } })).toBe(state);
  });

  it('an empty title is refused and an unchanged patch is a no-op', () => {
    expect(reducer(state, { type: 'updateTask', id: 't1', patch: { title: '' } })).toBe(state);
    expect(reducer(state, { type: 'updateTask', id: 't1', patch: { urgent: false } })).toBe(state);
  });
});

describe('addTask', () => {
  it('a title alone makes an open, undated, ungrouped task for one person', () => {
    const next = reducer(state, { type: 'addTask', title: '  Test smoke alarms ', assignees: ['daryna'] });
    expect(next.tasks).toHaveLength(2);
    expect(next.tasks[0]).toMatchObject({ title: 'Test smoke alarms', urgent: false, updatedBy: 'daryna', assignments: [{ person: 'daryna', status: 'todo', steps: [] }] });
    expect(next.tasks[0]!.group).toBeUndefined();
    expect(next.tasks[0]!.due).toBeUndefined();
  });

  it('keeps group, due and urgent', () => {
    const next = reducer(state, { type: 'addTask', title: 'Test smoke alarms', assignees: ['nikita'], group: 'Safety', due: '2026-11-29', urgent: true });
    expect(next.tasks[0]).toMatchObject({ group: 'Safety', due: '2026-11-29', urgent: true });
  });

  it('a blank group is no group', () => {
    expect(reducer(state, { type: 'addTask', title: 'Fit a lock', assignees: ['nikita'], group: '  ' }).tasks[0]!.group).toBeUndefined();
  });

  it('"each of us" is one task with two assignments, sent as one task row and two assignment rows', () => {
    const next = reducer(state, { type: 'addTask', title: 'Register to vote', assignees: ['nikita', 'daryna', 'nikita'], group: 'Address' });
    const created = next.tasks[0]!;
    expect(created.assignments.map((a) => a.person)).toEqual(['nikita', 'daryna']);
    const out = diffToOps(state, next, new Map());
    expect(out.filter((o) => o.table === 'tasks')).toHaveLength(1);
    expect(out.find((o) => o.table === 'tasks')).toMatchObject({ kind: 'upsert', row: { id: created.id, grp: 'Address' } });
    expect(out.filter((o) => o.table === 'task_assignments')).toHaveLength(2);
  });

  it('an empty title or no assignee is refused', () => {
    expect(reducer(state, { type: 'addTask', title: '   ', assignees: ['nikita'] })).toBe(state);
    expect(reducer(state, { type: 'addTask', title: 'GP', assignees: [] })).toBe(state);
  });
});

describe('task assignment edits', () => {
  const withSteps: State = {
    ...state,
    tasks: [{
      ...task,
      assignments: task.assignments.map((a) => ({
        ...a,
        steps: [{ id: `step-${a.person}`, title: 'Check details', done: false, sort: 10 }],
      })),
    }],
  };

  it('appends my step in stored order and queues only that step', () => {
    const next = reducer(withSteps, { type: 'addStep', id: 't1', title: '  Send form  ' });
    const before = withSteps.tasks[0]!;
    const after = next.tasks[0]!;
    expect(after.assignments[0]).toBe(before.assignments[0]);
    expect(after.assignments[1]!.steps[0]).toBe(before.assignments[1]!.steps[0]);
    const added = after.assignments[1]!.steps[1]!;
    expect(added).toMatchObject({ title: 'Send form', done: false, sort: 11 });
    expect(diffToOps(withSteps, next, new Map())).toEqual([{
      id: expect.any(String), kind: 'upsert', table: 'task_steps',
      row: { id: added.id, task_id: 't1', person: state.me, title: 'Send form', done: false, sort: 11 },
    }]);
  });

  it('leaves the other assignment untouched when I tick a step or update my status', () => {
    const updated = reducer(withSteps, { type: 'toggleStep', id: 't1', person: state.me, stepId: `step-${state.me}` });
    const latest = reducer(updated, { type: 'setTaskStatus', id: 't1', person: state.me, status: 'waiting' });
    expect(latest.tasks[0]!.assignments[0]).toBe(withSteps.tasks[0]!.assignments[0]);
    expect(diffToOps(withSteps, latest, new Map())).toEqual([
      { id: expect.any(String), kind: 'patch', table: 'task_assignments', match: { task_id: 't1', person: state.me }, row: { status: 'waiting' } },
      { id: expect.any(String), kind: 'patch', table: 'task_steps', match: { id: `step-${state.me}` }, row: { done: true } },
    ]);
  });

  it('ignores other-assignee edits and blank additions', () => {
    const other = withSteps.tasks[0]!.assignments[0]!;
    expect(reducer(withSteps, { type: 'setTaskStatus', id: 't1', person: other.person, status: 'done' })).toBe(withSteps);
    expect(reducer(withSteps, { type: 'toggleStep', id: 't1', person: other.person, stepId: other.steps[0]!.id })).toBe(withSteps);
    expect(reducer(withSteps, { type: 'addStep', id: 't1', title: ' ' })).toBe(withSteps);
  });
});
