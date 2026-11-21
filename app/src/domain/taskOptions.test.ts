import { describe, expect, it } from 'vitest';
import { addDays, addedSince, assigneesFor, dueFor, dueLabel, endOfWeek, groupFromParam, groupsFor, groupTasks, groupToParam, localDate, monthGrid } from './taskOptions';
import type { Assignment, Task } from './types';

const a = (person: Assignment['person'], status: Assignment['status'] = 'todo'): Assignment => ({ person, status, steps: [] });
const task = (id: string, group: string | undefined, assignments: Assignment[], over: Partial<Task> = {}): Task => ({ id, title: id, group, urgent: false, updatedBy: 'claude', assignments, ...over });

describe('dates', () => {
  it('localDate formats the local calendar day', () => {
    expect(localDate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('addDays crosses month and year ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('end of week is the coming Sunday, and a Sunday is its own', () => {
    expect(endOfWeek('2026-11-23')).toBe('2026-11-29'); // Monday
    expect(endOfWeek('2026-11-21')).toBe('2026-11-22'); // Saturday
    expect(endOfWeek('2026-11-22')).toBe('2026-11-22'); // Sunday
  });

  it('dueFor maps each choice', () => {
    expect(dueFor('today', '2026-11-25')).toBe('2026-11-25');
    expect(dueFor('week', '2026-11-25')).toBe('2026-11-29');
    expect(dueFor('date', '2026-11-25', '2026-12-10')).toBe('2026-12-10');
    expect(dueFor('date', '2026-11-25')).toBeUndefined();
    expect(dueFor('none', '2026-11-25')).toBeUndefined();
  });

  it('monthGrid starts on Monday and pads with nulls', () => {
    const weeks = monthGrid(2026, 11); // 1 Nov 2026 is a Sunday
    expect(weeks[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(weeks.at(-1)).toEqual(['2026-11-30', null, null, null, null, null, null]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
    expect(monthGrid(2027, 2).flat().filter(Boolean)).toHaveLength(28);
  });
});

describe('dueLabel', () => {
  it('reads Overdue, Today, Tomorrow, N days, then the date', () => {
    expect(dueLabel('2026-11-20', '2026-11-21')).toEqual({ text: 'Overdue', tone: 'coral' });
    expect(dueLabel('2026-11-21', '2026-11-21')).toEqual({ text: 'Today', tone: 'coral' });
    expect(dueLabel('2026-11-22', '2026-11-21')).toEqual({ text: 'Tomorrow', tone: 'amber' });
    expect(dueLabel('2026-11-23', '2026-11-21')).toEqual({ text: '2 days', tone: 'amber' });
    expect(dueLabel('2026-11-28', '2026-11-21')).toEqual({ text: '7 days', tone: 'amber' });
    expect(dueLabel('2026-11-29', '2026-11-21')).toEqual({ text: '29 Nov', tone: 'neutral' });
  });

  it('turns over at local midnight, not UTC midnight', () => {
    const lateEvening = localDate(new Date(2026, 10, 21, 23, 59));
    const justAfterMidnight = localDate(new Date(2026, 10, 22, 0, 1));
    expect(dueLabel('2026-11-22', lateEvening).text).toBe('Tomorrow');
    expect(dueLabel('2026-11-22', justAfterMidnight).text).toBe('Today');
    expect(dueLabel('2026-11-21', justAfterMidnight).text).toBe('Overdue');
  });

  it('crosses month and year ends', () => {
    expect(dueLabel('2026-12-01', '2026-11-30').text).toBe('Tomorrow');
    expect(dueLabel('2026-11-30', '2026-12-01').text).toBe('Overdue');
    expect(dueLabel('2027-01-01', '2026-12-31').text).toBe('Tomorrow');
    expect(dueLabel('2027-03-01', '2027-02-28').text).toBe('Tomorrow');
    expect(dueLabel('2027-01-08', '2026-12-31').text).toBe('8 Jan');
  });
});

describe('addedSince', () => {
  const before = new Set(['t1']);
  it('is true only for a new task added by that person', () => {
    expect(addedSince(before, [task('t1', undefined, [a('nikita')], { updatedBy: 'nikita' })], 'nikita')).toBe(false);
    expect(addedSince(before, [task('t2', undefined, [a('nikita')], { updatedBy: 'daryna' })], 'nikita')).toBe(false);
    expect(addedSince(before, [task('t2', undefined, [a('nikita')], { updatedBy: 'nikita' })], 'nikita')).toBe(true);
  });
});

describe('group route param', () => {
  it('round-trips names with route characters', () => {
    for (const name of ['Move-in', 'Gas / electric', '100% done', 'Why?', 'Flat #2', 'a%2Fb']) {
      const param = groupToParam(name);
      expect(param).not.toMatch(/[/?#]/);
      expect(groupFromParam(param)).toBe(name);
    }
  });

  it('keeps a segment that is not valid encoding, and an empty one', () => {
    expect(groupFromParam('100%')).toBe('100%');
    expect(groupFromParam(undefined)).toBe('');
  });
});

describe('assigneesFor', () => {
  it('me, the other person, or each of us', () => {
    expect(assigneesFor('me', 'daryna')).toEqual(['daryna']);
    expect(assigneesFor('other', 'daryna')).toEqual(['nikita']);
    expect(assigneesFor('both', 'nikita')).toEqual(['nikita', 'daryna']);
  });
});

describe('groups', () => {
  const tasks: Task[] = [
    task('Banks', 'Address', [a('nikita')]),
    task('GP', 'Address', [a('nikita', 'done'), a('daryna')]),
    task('Phone', 'Address', [a('daryna')]),
    task('Meters', 'Utilities', [a('nikita')]),
    task('Deposit', 'Move-in', [a('nikita')]),
    task('Loose', undefined, [a('nikita')]),
  ];

  it('groupsFor lists the distinct groups on a person\'s list with open counts, known groups first', () => {
    expect(groupsFor(tasks, 'nikita')).toEqual([
      { name: 'Utilities', open: 1, done: 0, total: 1 },
      { name: 'Address', open: 1, done: 1, total: 2 },
      { name: 'Move-in', open: 1, done: 0, total: 1 },
    ]);
    expect(groupsFor(tasks, 'daryna')).toEqual([{ name: 'Address', open: 2, done: 0, total: 2 }]);
  });

  it('groupTasks splits a person\'s tasks in a group into open (urgent first) and done', () => {
    const more = [...tasks, task('Council', 'Address', [a('nikita')], { urgent: true })];
    const { open, done } = groupTasks(more, 'Address', 'nikita');
    expect(open.map((t) => t.title)).toEqual(['Council', 'Banks']);
    expect(done.map((t) => t.title)).toEqual(['GP']);
  });
});
