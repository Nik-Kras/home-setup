import { describe, expect, it } from 'vitest';
import { taskFromRow, type TaskRow } from './mappers';
import type { Person } from '../domain/types';

describe('taskFromRow', () => {
  it('uses the latest task or assignment actor and preserves stored step order', () => {
    const person: Person = 'nikita';
    const row: TaskRow = {
      id: 't1', title: 'Submit the form', grp: null, due: null, urgent: false, reference: null, notes: null,
      updated_by: 'claude', updated_at: '2026-11-20T10:00:00Z',
      task_assignments: [{
        person, status: 'in_progress', updated_by: person, updated_at: '2026-11-20T11:00:00Z',
        task_steps: [
          { id: 's2', title: 'Send the form', done: false, sort: 10 },
          { id: 's1', title: 'Check the details', done: true, sort: 0 },
        ],
      }],
    };

    const task = taskFromRow(row);
    expect(task.updatedBy).toBe(person);
    expect(task.assignments[0]!.steps.map((step) => [step.id, step.sort])).toEqual([['s1', 0], ['s2', 10]]);
    expect(taskFromRow({ ...row, updated_at: '2026-11-20T12:00:00Z' }).updatedBy).toBe('claude');
  });
});
