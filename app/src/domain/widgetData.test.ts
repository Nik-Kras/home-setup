import { describe, expect, it } from 'vitest';
import { localDate } from './taskOptions';
import type { Item, Person, Task } from './types';
import { buildWidgetData, capRows, fitRooms, WIDGET_MAX_ROWS } from './widgetData';

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
  it('counts what is left, takes urgent items first and groups the left rows by room', () => {
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
        { id: 'router', status: 'Delivered' },
        { id: 'towels', status: 'Needed' },
      ],
      rooms: [
        { room: 'Kitchen', items: [{ id: 'kettle', status: 'Looking' }] },
        { room: 'Living room', items: [{ id: 'sofa' }, { id: 'router', status: 'Delivered' }] },
        { room: 'Other', items: [{ id: 'curtains' }, { id: 'towels' }] },
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

  it('keeps an urgent item in a later room when the row cap applies, grouped in room order', () => {
    const kitchen = Array.from({ length: WIDGET_MAX_ROWS - 1 }, (_, n) => item(`k${String(n).padStart(2, '0')}`, { room: 'Kitchen' }));
    const data = buildWidgetData([
      ...kitchen,
      item('lamp', { room: 'Living room' }),
      item('rug', { room: 'Living room' }),
      item('bed', { room: 'Bedroom', urgent: true }),
    ], [], me, now);
    expect(data.rooms.map(({ room, items }) => [room, items.length])).toEqual([['Kitchen', WIDGET_MAX_ROWS - 1], ['Bedroom', 1]]);
    expect(data.rooms[1]!.items[0]).toMatchObject({ id: 'bed', urgent: true });
    // The medium widget's rows: up to six, urgent first.
    expect(data.top).toHaveLength(6);
    expect(data.top[0]).toMatchObject({ id: 'bed' });
  });
});

describe('capRows and fitRooms', () => {
  const rooms = [
    { room: 'A', items: [{ id: 'a1', urgent: false }, { id: 'a2', urgent: false }] },
    { room: 'B', items: [{ id: 'b1', urgent: true }, { id: 'b2', urgent: false }] },
  ];
  const ids = (out: { items: { id: string }[] }[]) => out.flatMap((r) => r.items.map((i) => i.id));

  it('takes urgent rows first across rooms, then room order, keeping grouping', () => {
    expect(ids(capRows(rooms, 1))).toEqual(['b1']);
    expect(capRows(rooms, 2)).toEqual([{ room: 'A', items: [rooms[0]!.items[0]] }, { room: 'B', items: [rooms[1]!.items[0]] }]);
    expect(ids(capRows(rooms, 10))).toEqual(['a1', 'a2', 'b1', 'b2']);
    expect(capRows(rooms, 0)).toEqual([]);
  });

  it('shows the rows that fit and counts the rest for the "+n more" line', () => {
    const height = { room: 28, row: 44, more: 20 };
    expect(fitRooms({ rooms, leftCount: 4 }, 2 * 28 + 4 * 44, height)).toMatchObject({ more: 0 });
    // One room label, one row and the more line: only the urgent row is left.
    const small = fitRooms({ rooms, leftCount: 6 }, 28 + 44 + 20, height);
    expect(ids(small.rooms)).toEqual(['b1']);
    expect(small.more).toBe(5);
    expect(fitRooms({ rooms, leftCount: 4 }, 10, height)).toEqual({ rooms: [], more: 4 });
  });
});
