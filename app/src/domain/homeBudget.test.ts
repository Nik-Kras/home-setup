import { describe, expect, it } from 'vitest';
import { budgetView, gbp } from './budgetView';
import { homeView, placedLabel } from './home';
import type { Item } from './types';

let n = 0;
const item = (over: Partial<Item> = {}): Item => ({
  id: `i${++n}`,
  name: 'Kettle',
  status: 'needed',
  quantity: 1,
  urgent: false,
  needsInstall: false,
  addedAt: '2026-11-21T10:00:00Z',
  updatedBy: 'nikita',
  ...over,
});

const ROOMS = ['Kitchen', 'Living room', 'Bedroom'];

describe('homeView', () => {
  const items = [
    item({ name: 'Sofa', status: 'delivered', room: 'Living room', boughtBy: 'nikita' }),
    item({ name: 'Floor lamp', status: 'installed', needsInstall: true, room: 'Living room', boughtBy: 'daryna' }),
    item({ name: 'Kettle', status: 'delivered', room: 'Kitchen' }),
    item({ name: 'Shelves', status: 'delivered', needsInstall: true, room: 'Bedroom' }), // not in place yet
    item({ name: 'Doormat', status: 'delivered' }), // no room
    item({ name: 'Mirror', status: 'delivered', room: 'Attic', boughtBy: 'daryna' }),
    item({ name: 'Toaster', status: 'ordered', room: 'Kitchen' }),
  ];

  it('shows only things in place, with chips for rooms that have them in room order and Other last', () => {
    const v = homeView(items, { mode: 'room', roomOrder: ROOMS });
    expect(v.total).toBe(5);
    expect(v.chips).toEqual([{ room: 'Kitchen', count: 1 }, { room: 'Living room', count: 2 }, { room: 'Attic', count: 1 }, { room: 'Other', count: 1 }]);
    expect(v.groups).toHaveLength(1);
    expect(v.groups[0]!.items.map((i) => i.name)).toEqual(['Kettle', 'Floor lamp', 'Sofa', 'Mirror', 'Doormat']);
  });

  it('filters by room, and falls back to all when that room has nothing in place', () => {
    expect(homeView(items, { mode: 'room', room: 'Living room', roomOrder: ROOMS }).groups[0]!.items.map((i) => i.name)).toEqual(['Floor lamp', 'Sofa']);
    expect(homeView(items, { mode: 'room', room: 'Other', roomOrder: ROOMS }).groups[0]!.items.map((i) => i.name)).toEqual(['Doormat']);
    const gone = homeView(items, { mode: 'room', room: 'Bedroom', roomOrder: ROOMS });
    expect(gone.room).toBeUndefined();
    expect(gone.groups[0]!.items).toHaveLength(5);
  });

  it('groups by who bought it in owner mode, unrecorded last, empty groups left out', () => {
    const v = homeView(items, { mode: 'owner', roomOrder: ROOMS });
    expect(v.groups.map((g) => [g.title, g.items.map((i) => i.name)])).toEqual([
      ['Nikita', ['Sofa']],
      ['Daryna', ['Floor lamp', 'Mirror']],
      ['Not recorded', ['Kettle', 'Doormat']],
    ]);
    expect(homeView(items, { mode: 'owner', room: 'Living room', roomOrder: ROOMS }).groups.map((g) => g.key)).toEqual(['nikita', 'daryna']);
  });

  it('is empty when nothing is in place', () => {
    const v = homeView([item(), item({ status: 'ordered' })], { mode: 'owner', roomOrder: ROOMS });
    expect(v).toEqual({ total: 0, chips: [], room: undefined, groups: [] });
  });

  it('counts things in place in words', () => {
    expect(placedLabel(1)).toBe('1 thing in place');
    expect(placedLabel(7)).toBe('7 things in place');
  });
});

describe('budgetView', () => {
  it('shows no split and a note when nothing is spent, and rooms with only estimates', () => {
    const v = budgetView([item({ estPrice: 25, room: 'Kitchen' }), item({ estPrice: 90, room: 'Kitchen' }), item({ estPrice: 40, room: 'Bedroom' }), item({ room: 'Bedroom' })]);
    expect(v.spent).toBe(0);
    expect(v.split).toEqual([]);
    expect(v.splitNote).toBe('No spending yet');
    expect(v.rooms).toEqual([
      { room: 'Kitchen', spent: 0, total: 115, label: '£0 of £115', fill: 0 },
      { room: 'Bedroom', spent: 0, total: 40, label: '£0 of £40', fill: 0 },
    ]);
  });

  it('hides the room card only when there is nothing at all', () => {
    const v = budgetView([item({ room: 'Kitchen' })]);
    expect(v.rooms).toEqual([]);
    expect(v.percent).toBe(0);
  });

  it('splits by who paid, leaving out a person who paid nothing', () => {
    const v = budgetView([
      item({ status: 'delivered', actualPrice: 300, boughtBy: 'nikita', room: 'Living room' }),
      item({ status: 'delivered', actualPrice: 100, boughtBy: 'daryna', room: 'Living room' }),
    ]);
    expect(v.split).toEqual([{ person: 'nikita', share: 0.75 }, { person: 'daryna', share: 0.25 }]);
    expect(v.splitNote).toBeUndefined();
    expect(budgetView([item({ status: 'delivered', actualPrice: 50, boughtBy: 'daryna' })]).split).toEqual([{ person: 'daryna', share: 1 }]);
  });

  it('shows spend with no buyer as its own Unassigned share, so the split adds up to Spent', () => {
    const v = budgetView([item({ status: 'delivered', actualPrice: 20 })]);
    expect(v.split).toEqual([{ person: 'unassigned', share: 1 }]);
    expect(v.unassigned).toBe(20);
    expect(v.splitNote).toBeUndefined();
    const mixed = budgetView([
      item({ status: 'delivered', actualPrice: 30, boughtBy: 'nikita' }),
      item({ status: 'ordered', actualPrice: 10 }),
    ]);
    expect(mixed.split).toEqual([{ person: 'nikita', share: 0.75 }, { person: 'unassigned', share: 0.25 }]);
    expect(mixed.unassigned).toBe(10);
  });

  it('never shows a float crumb as unassigned', () => {
    const v = budgetView([item({ actualPrice: 0.1, boughtBy: 'nikita' }), item({ actualPrice: 0.2, boughtBy: 'daryna' })]);
    expect(v.unassigned).toBe(0);
    expect(v.split.map((x) => x.person)).toEqual(['nikita', 'daryna']);
  });

  it('room rows add up to the estimated total and show spend of total', () => {
    const items = [
      item({ status: 'delivered', actualPrice: 380, boughtBy: 'nikita', room: 'Living room' }),
      item({ estPrice: 120, room: 'Living room' }),
      item({ status: 'delivered', estPrice: 30, room: 'Living room' }), // got, no price: counts nowhere
      item({ status: 'delivered', actualPrice: 25, room: 'Kitchen' }),
      item({ estPrice: 10 }),
    ];
    const v = budgetView(items);
    expect(v.rooms.map((r) => [r.room, r.label])).toEqual([['Living room', '£380 of £500'], ['Kitchen', '£25'], ['Other', '£0 of £10']]);
    expect(v.rooms.reduce((sum, r) => sum + r.total, 0)).toBe(v.estimatedTotal);
    expect(v.rooms[0]!.fill).toBeCloseTo(0.76);
    expect(v.percent).toBe(76); // 405 of 535
  });

  it('formats pounds with separators', () => {
    expect(gbp(1284.4)).toBe('£1,284');
    expect(gbp(0)).toBe('£0');
  });
});
