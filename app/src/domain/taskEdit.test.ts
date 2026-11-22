import { describe, expect, it } from 'vitest';
import { canSaveTask, taskDraft, taskEditChanges } from './taskEdit';
import { rowControl, setAssignees, whoFor } from './tasks';
import type { Task } from './types';

const solo: Task = { id: 't1', title: 'Book the van', urgent: false, updatedBy: 'claude', assignments: [{ person: 'nikita', status: 'todo', steps: [] }] };
const hers: Task = { id: 't3', title: 'Call the bank', urgent: false, updatedBy: 'claude', assignments: [{ person: 'daryna', status: 'done', steps: [] }] };
const shared: Task = {
  id: 't2', title: 'Register with a GP', urgent: true, group: 'Address', notes: 'Bring ID', updatedBy: 'claude',
  assignments: [
    { person: 'nikita', status: 'in_progress', steps: [] },
    { person: 'daryna', status: 'done', steps: [{ id: 's2', title: 'Form', done: true }] },
  ],
};

describe('whoFor and setAssignees', () => {
  it('reads who a task is for from my side', () => {
    expect(whoFor(solo, 'nikita')).toBe('me');
    expect(whoFor(solo, 'daryna')).toBe('other');
    expect(whoFor(shared, 'daryna')).toBe('both');
  });

  it('adds a fresh part and keeps existing parts untouched', () => {
    const both = setAssignees(solo, ['nikita', 'daryna'], 'nikita');
    expect(both.assignments).toEqual([solo.assignments[0], { person: 'daryna', status: 'todo', steps: [] }]);
    expect(both.assignments[0]).toBe(solo.assignments[0]);
    const onlyHers = setAssignees(shared, ['daryna'], 'nikita');
    expect(onlyHers.assignments).toEqual([shared.assignments[1]]);
    expect(setAssignees(shared, [], 'nikita')).toBe(shared);
    expect(setAssignees(shared, ['daryna', 'nikita'], 'nikita')).toBe(shared);
  });
});

describe('task edit sheet', () => {
  it('starts from the task as it is', () => {
    expect(taskDraft(shared, 'nikita')).toEqual({ title: 'Register with a GP', group: 'Address', due: undefined, urgent: true, who: 'both', notes: 'Bring ID', reference: '' });
  });

  it('sends only what changed, so a stale sheet keeps the other person\'s edits to other fields', () => {
    const draft = taskDraft(shared, 'nikita');
    expect(taskEditChanges(shared, draft, 'nikita')).toEqual({ patch: {} });
    expect(taskEditChanges(shared, { ...draft, title: '  Register with a GP ', urgent: false, notes: '  ' }, 'nikita')).toEqual({ patch: { urgent: false, notes: undefined } });
    expect(taskEditChanges(shared, { ...draft, group: undefined, due: '2026-12-01', reference: ' Clause 4 ' }, 'nikita')).toEqual({ patch: { group: undefined, due: '2026-12-01', reference: 'Clause 4' } });
  });

  it('names the people only when Who changed', () => {
    const draft = taskDraft(solo, 'nikita');
    expect(taskEditChanges(solo, { ...draft, who: 'both' }, 'nikita')).toEqual({ patch: {}, assignees: ['nikita', 'daryna'] });
    expect(taskEditChanges(solo, { ...draft, who: 'other' }, 'nikita')).toEqual({ patch: {}, assignees: ['daryna'] });
    expect(taskEditChanges(shared, { ...taskDraft(shared, 'daryna'), who: 'me' }, 'daryna')).toEqual({ patch: {}, assignees: ['daryna'] });
  });

  it('needs a title', () => {
    expect(canSaveTask({ ...taskDraft(solo, 'nikita'), title: '  ' })).toBe(false);
    expect(canSaveTask(taskDraft(solo, 'nikita'))).toBe(true);
  });
});

describe('task row control', () => {
  it('ticks my part wherever I have one, on any list', () => {
    expect(rowControl(solo, 'nikita', 'nikita')).toEqual({ kind: 'tick', person: 'nikita', done: false });
    expect(rowControl(shared, 'daryna', 'nikita')).toEqual({ kind: 'tick', person: 'nikita', done: false });
    expect(rowControl(shared, null, 'daryna')).toEqual({ kind: 'tick', person: 'daryna', done: true });
  });

  it('shows the other person\'s disc, never a dead circle, on a task that is only theirs', () => {
    expect(rowControl(hers, 'daryna', 'nikita')).toEqual({ kind: 'disc', person: 'daryna', done: true });
    expect(rowControl(solo, 'nikita', 'daryna')).toEqual({ kind: 'disc', person: 'nikita', done: false });
  });
});
