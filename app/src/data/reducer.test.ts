import { describe, expect, it } from 'vitest';
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
