import { describe, expect, it } from 'vitest';
import { itemChangedColumns, itemFromRow, itemToRow, taskFromRow, type ItemRow, type TaskRow } from './mappers';
import type { Item } from '../domain/types';
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
  it('lists a shared task\'s parts in a fixed order whatever order the database returns', () => {
    const part = (person: Person) => ({ person, status: 'todo' as const, updated_by: person, updated_at: '2026-11-20T10:00:00Z', task_steps: [] });
    const row: TaskRow = {
      id: 't2', title: 'Register', grp: null, due: null, urgent: false, reference: null, notes: null,
      updated_by: 'claude', updated_at: '2026-11-20T10:00:00Z',
      task_assignments: [part('nikita'), part('daryna')],
    };
    expect(taskFromRow(row).assignments.map((a) => a.person)).toEqual(['nikita', 'daryna']);
    expect(taskFromRow({ ...row, task_assignments: [part('daryna'), part('nikita')] }).assignments.map((a) => a.person)).toEqual(['nikita', 'daryna']);
  });
});

describe('price_paid_at', () => {
  const base: Item = { id: 'i1', name: 'Kettle', status: 'ordered', quantity: 1, urgent: false, needsInstall: false, addedAt: '2026-11-01T10:00:00Z', updatedBy: 'nikita' };
  const rooms = new Map<string, string>();
  it('is read from the row, and left out of a row until there is one (works before migration 0008)', () => {
    const row = { ...itemToRow(base, rooms), updated_by: 'nikita', price_paid_at: '2026-11-20T10:00:00Z' } as unknown as ItemRow;
    expect(itemFromRow(row, rooms).pricePaidAt).toBe('2026-11-20T10:00:00Z');
    expect(itemFromRow({ ...row, price_paid_at: null }, rooms).pricePaidAt).toBeUndefined();
    expect(itemToRow(base, rooms)).not.toHaveProperty('price_paid_at');
    expect(itemToRow({ ...base, pricePaidAt: '2026-11-20T10:00:00Z' }, rooms).price_paid_at).toBe('2026-11-20T10:00:00Z');
  });
  it('setting and clearing it are both field changes', () => {
    const paid = { ...base, actualPrice: 20, pricePaidAt: '2026-11-20T10:00:00Z' };
    expect(itemChangedColumns(base, paid, rooms)).toEqual({ actual_price: 20, price_paid_at: '2026-11-20T10:00:00Z' });
    expect(itemChangedColumns(paid, base, rooms)).toEqual({ actual_price: null, price_paid_at: null });
  });
});
