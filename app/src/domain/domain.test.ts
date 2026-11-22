import { describe, expect, it } from 'vitest';
import { advance, budget, guessRoom, counts, isItemDone, leftByRoom, nextStatus, nextUp } from './items';
import {
  daysLeft,
  isShared,
  isTaskDone,
  openTasksSorted,
  parseTaskDate,
  setAssignmentStatus,
  sharedTasks,
  taskProgress,
  taskProgressLabel,
  tasksFor,
  toggleStep,
  waitingOn,
} from './tasks';
import type { Item, Task } from './types';

const item = (over: Partial<Item> = {}): Item => ({
  id: 'i1',
  name: 'Kettle',
  status: 'needed',
  quantity: 1,
  urgent: false,
  needsInstall: false,
  addedAt: '2026-11-21T10:00:00Z',
  updatedBy: 'nikita',
  ...over,
});

const shared = (over: Partial<Task> = {}): Task => ({
  id: 't1',
  title: 'Register with a new GP',
  urgent: false,
  updatedBy: 'claude',
  assignments: [
    { person: 'nikita', status: 'todo', steps: [{ id: 's1', title: 'Pick a practice', done: false }] },
    { person: 'daryna', status: 'todo', steps: [{ id: 's1', title: 'Pick a practice', done: false }] },
  ],
  ...over,
});

describe('items', () => {
  it('a delivered kettle is done; a delivered router is not until installed', () => {
    expect(isItemDone(item({ status: 'delivered' }))).toBe(true);
    expect(isItemDone(item({ status: 'delivered', needsInstall: true }))).toBe(false);
    expect(isItemDone(item({ status: 'installed', needsInstall: true }))).toBe(true);
  });

  it('status never skips past delivered for items that need no install', () => {
    expect(nextStatus(item({ status: 'ordered' }))).toBe('delivered');
    expect(nextStatus(item({ status: 'delivered' }))).toBe('delivered');
    expect(nextStatus(item({ status: 'delivered', needsInstall: true }))).toBe('installed');
  });

  it('advance stamps the delivery time and the actor', () => {
    const out = advance(item({ status: 'ordered' }), '2026-11-22T09:00:00Z', 'claude');
    expect(out.status).toBe('delivered');
    expect(out.deliveredAt).toBe('2026-11-22T09:00:00Z');
    expect(out.updatedBy).toBe('claude');
  });

  it('guesses the room from the name, and stays quiet when unsure', () => {
    expect(guessRoom('Kettle')).toBe('Kitchen');
    expect(guessRoom('Curtain rods')).toBe('Bedroom');
    expect(guessRoom('Floor lamp')).toBe('Living room');
    expect(guessRoom('Picture hooks')).toBeUndefined();
  });

  it('counts done and left', () => {
    const list = [item(), item({ id: 'i2', status: 'delivered' }), item({ id: 'i3', status: 'delivered', needsInstall: true })];
    expect(counts(list)).toEqual({ done: 1, left: 2, total: 3 });
  });

  it('groups left items by room, urgent first, no-room under Other', () => {
    const list = [
      item({ id: 'a', name: 'Toaster', room: 'Kitchen' }),
      item({ id: 'b', name: 'Kettle', room: 'Kitchen', urgent: true }),
      item({ id: 'c', name: 'Bin' }),
      item({ id: 'd', name: 'Done thing', room: 'Kitchen', status: 'delivered' }),
    ];
    const groups = leftByRoom(list);
    expect(groups.map((g) => g.room)).toEqual(['Kitchen', 'Other']);
    expect(groups[0]!.items.map((i) => i.name)).toEqual(['Kettle', 'Toaster']);
  });

  it('next up prefers urgent, then oldest', () => {
    const list = [
      item({ id: 'a', name: 'Old', addedAt: '2026-11-01T00:00:00Z' }),
      item({ id: 'b', name: 'Urgent', urgent: true, addedAt: '2026-11-20T00:00:00Z' }),
    ];
    expect(nextUp(list)?.name).toBe('Urgent');
    expect(nextUp([])).toBeUndefined();
  });

  it('budget counts only entered prices and splits by person and room', () => {
    const list = [
      item({ id: 'a', status: 'delivered', actualPrice: 84.99, boughtBy: 'nikita', room: 'Kitchen' }),
      item({ id: 'b', status: 'delivered', actualPrice: 40, boughtBy: 'daryna', room: 'Bedroom' }),
      item({ id: 'c', estPrice: 25 }),
      item({ id: 'd' }),
    ];
    const b = budget(list);
    expect(b.spent).toBeCloseTo(124.99);
    expect(b.toBuy).toBe(25);
    expect(b.estimatedTotal).toBeCloseTo(149.99);
    expect(b.byPerson.nikita).toBeCloseTo(84.99);
    expect(b.byPerson.daryna).toBe(40);
    expect(b.byRoom).toEqual({ Kitchen: 84.99, Bedroom: 40 });
  });
});

describe('tasks', () => {
  it('a shared task is done only when both are done', () => {
    let t = shared();
    expect(isShared(t)).toBe(true);
    t = setAssignmentStatus(t, 'nikita', 'done', 'nikita');
    expect(isTaskDone(t)).toBe(false);
    expect(taskProgress(t)).toEqual({ done: 1, total: 2 });
    expect(taskProgressLabel(t)).toBe('1 of 2 done');
    t = setAssignmentStatus(t, 'daryna', 'done', 'daryna');
    expect(isTaskDone(t)).toBe(true);
    expect(taskProgressLabel(t)).toBe('2 of 2 done');
  });

  it('marking one person done leaves the other untouched', () => {
    const t = setAssignmentStatus(shared(), 'nikita', 'done', 'nikita');
    expect(t.assignments.find((a) => a.person === 'daryna')?.status).toBe('todo');
  });

  it('reports who is waiting after the first person finishes', () => {
    expect(waitingOn(shared())).toEqual([]);
    const t = setAssignmentStatus(shared(), 'nikita', 'done', 'nikita');
    expect(waitingOn(t)).toEqual(['daryna']);
    expect(waitingOn(setAssignmentStatus(t, 'daryna', 'done', 'daryna'))).toEqual([]);
  });

  it('accepts real dates from the due date input', () => {
    expect(parseTaskDate(' 20280229 ')).toBe('2028-02-29');
    expect(parseTaskDate('2028-02-29')).toBe('2028-02-29');
    expect(parseTaskDate('20270229')).toBeUndefined();
    expect(parseTaskDate('20281301')).toBeUndefined();
    expect(parseTaskDate('2028113')).toBeUndefined();
  });

  it('steps are per person', () => {
    const t = toggleStep(shared(), 'nikita', 's1', 'nikita');
    expect(t.assignments[0]!.steps[0]!.done).toBe(true);
    expect(t.assignments[1]!.steps[0]!.done).toBe(false);
  });

  it('each person has a separate list; shared tasks appear in both', () => {
    const solo: Task = {
      id: 't2',
      title: 'Council Tax',
      urgent: true,
      updatedBy: 'nikita',
      assignments: [{ person: 'nikita', status: 'todo', steps: [] }],
    };
    const all = [shared(), solo];
    expect(tasksFor(all, 'nikita').map((t) => t.id)).toEqual(['t1', 't2']);
    expect(tasksFor(all, 'daryna').map((t) => t.id)).toEqual(['t1']);
    expect(sharedTasks(all).map((t) => t.id)).toEqual(['t1']);
  });

  it('counts days to a deadline, negative when overdue', () => {
    expect(daysLeft('2026-11-27', '2026-11-21')).toBe(6);
    expect(daysLeft('2026-11-20', '2026-11-21')).toBe(-1);
  });

  it('sorts open tasks: urgent, then due date, then undated; hides my finished ones', () => {
    const mk = (id: string, over: Partial<Task>): Task => ({
      id,
      title: id,
      urgent: false,
      updatedBy: 'nikita',
      assignments: [{ person: 'nikita', status: 'todo', steps: [] }],
      ...over,
    });
    const done = setAssignmentStatus(mk('done', {}), 'nikita', 'done', 'nikita');
    const list = [mk('undated', {}), mk('later', { due: '2026-12-17' }), mk('soon', { due: '2026-11-27' }), mk('urgent', { urgent: true }), done];
    expect(openTasksSorted(list, 'nikita').map((t) => t.id)).toEqual(['urgent', 'soon', 'later', 'undated']);
  });
});
