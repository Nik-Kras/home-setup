import { describe, expect, it } from 'vitest';
import { localDate } from './taskOptions';
import type { Item, Person, Task } from './types';
import { buildWidgetData } from './widgetData';

const me = 'member' as Person;
const other = 'other' as Person;
const now = new Date(2026, 10, 24, 12);

const item = (id: string, patch: Partial<Item> = {}): Item => ({
  id, name: id, addedAt: '2026-11-22T00:00:00Z', status: 'needed',
  updatedBy: me, quantity: 1, urgent: false, needsInstall: false, ...patch,
});

const task = (id: string, patch: Partial<Task> = {}): Task => ({
  id, title: id, updatedBy: me, urgent: false, due: localDate(now),
  assignments: [{ person: me, status: 'todo', steps: [] }], ...patch,
});

describe('buildWidgetData', () => {
  it('counts what is left, takes urgent items first and groups up to four left rows', () => {
    const data = buildWidgetData([
      item('kettle', { room: 'Kitchen', status: 'looking' }),
      item('sofa', { room: 'Living room', urgent: true }),
      item('router', { room: 'Living room', status: 'delivered', needsInstall: true }),
      item('curtains', { urgent: true, status: 'ordered' }),
      item('towels'),
      item('cups', { status: 'delivered', urgent: true }),
      item('shelf', { status: 'installed', needsInstall: true }),
    ], [], me, now);
    expect(data).toMatchObject({
      v: 1, updatedAt: now.toISOString(), leftCount: 5, urgentCount: 2,
      nextUp: { id: 'sofa', name: 'sofa', room: 'Living room', urgent: true },
      top: [
        { id: 'sofa', status: 'Needed', urgent: true, icon: 'sofa' },
        { id: 'curtains', status: 'Ordered', urgent: true, icon: 'curtain' },
        { id: 'kettle', status: 'Looking', urgent: false, icon: 'kettle' },
      ],
      rooms: [
        { room: 'Kitchen', items: [{ id: 'kettle', status: 'Looking' }] },
        { room: 'Living room', items: [{ id: 'sofa' }, { id: 'router', status: 'Delivered' }] },
        { room: 'Other', items: [{ id: 'curtains' }] },
      ],
    });
  });

  it('uses local dates and only counts my unfinished part of assigned tasks', () => {
    const data = buildWidgetData([], [
      task('future', { due: localDate(new Date(2026, 10, 26)), urgent: true }),
      task('today'),
      task('overdue', { due: localDate(new Date(2026, 10, 23)) }),
      task('undated', { due: undefined }),
      task('other', { assignments: [{ person: other, status: 'todo', steps: [] }] }),
      task('shared', { assignments: [
        { person: me, status: 'done', steps: [] },
        { person: other, status: 'todo', steps: [] },
      ] }),
    ], me, now);
    expect(data.tasksDue).toEqual({ todayCount: 1, next: { id: 'overdue', title: 'overdue', daysLeft: -1 } });
    expect(data.nextUp).toBeNull();
    expect(data.rooms).toEqual([]);
  });
});
