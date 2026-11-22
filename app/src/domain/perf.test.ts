import { describe, expect, it } from 'vitest';
import { budgetView } from './budgetView';
import { focusTask } from './focus';
import { homeView } from './home';
import { counts, isItemDone, leftByRoom, nextUp } from './items';
import { itemsForPerson } from './personFilter';
import { groupsFor, groupTasks } from './taskOptions';
import { openTasksSorted, sharedTasks, tasksFor } from './tasks';
import type { Item, ItemStatus, Person, Task } from './types';

const N = 300;
const ROOMS = ['Kitchen', 'Living room', 'Bedroom', 'Bathroom', 'Hallway', undefined];
const STATUSES: ItemStatus[] = ['needed', 'looking', 'ordered', 'delivered', 'installed'];
const PEOPLE: (Person | undefined)[] = ['nikita', 'daryna', undefined];
const GROUPS = ['Utilities', 'Address', 'Safety', undefined];

const items: Item[] = Array.from({ length: N }, (_, i) => ({
  id: `i${i}`,
  name: `Thing ${(i * 7919) % N}`,
  status: STATUSES[i % STATUSES.length],
  quantity: 1,
  urgent: i % 11 === 0,
  needsInstall: i % 3 === 0,
  room: ROOMS[i % ROOMS.length],
  assignedTo: PEOPLE[i % PEOPLE.length],
  boughtBy: PEOPLE[(i + 1) % PEOPLE.length],
  estPrice: (i % 50) * 3,
  actualPrice: i % 4 === 0 ? (i % 50) * 3 : undefined,
  addedAt: new Date(Date.UTC(2026, 10, 1) + i * 60_000).toISOString(),
  updatedBy: 'claude',
}));

const tasks: Task[] = Array.from({ length: N }, (_, i) => ({
  id: `t${i}`,
  title: `Task ${(i * 7919) % N}`,
  group: GROUPS[i % GROUPS.length],
  due: i % 2 === 0 ? `2026-12-${String((i % 28) + 1).padStart(2, '0')}` : undefined,
  urgent: i % 9 === 0,
  updatedBy: 'claude',
  assignments: (i % 3 === 0 ? ['nikita', 'daryna'] as const : [i % 2 ? 'nikita' : 'daryna'] as const).map((person) => ({
    person,
    status: i % 5 === 0 ? 'done' : 'todo',
    steps: [],
  })),
}));

/** Every selector the Buy, Tasks, Home and Budget screens derive on a render. */
function deriveAll() {
  counts(items);
  nextUp(items);
  for (const filter of [null, 'nikita', 'daryna'] as const) {
    const shown = itemsForPerson(items, filter);
    leftByRoom(shown);
    shown.filter(isItemDone);
  }
  homeView(items, { mode: 'room', roomOrder: ['Kitchen', 'Living room', 'Bedroom'] });
  homeView(items, { mode: 'owner', roomOrder: [] });
  budgetView(items);
  for (const person of ['nikita', 'daryna'] as const) {
    const list = openTasksSorted(tasks, person);
    focusTask(list, person);
    groupsFor(tasks, person);
    groupTasks(tasks, 'Utilities', person);
  }
  const shared = sharedTasks(tasksFor(tasks, 'nikita'));
  focusTask(sharedTasks(tasks), null);
  return shared;
}

describe('derived selectors with 300 items and 300 tasks', () => {
  it('run under 50 ms', () => {
    deriveAll(); // warm up the JIT, as a second render would
    const start = performance.now();
    deriveAll();
    const ms = performance.now() - start;
    expect(ms).toBeLessThan(50);
  });

  it('group every left item exactly once', () => {
    const left = leftByRoom(items).reduce((n, g) => n + g.items.length, 0);
    expect(left).toBe(counts(items).left);
  });
});
