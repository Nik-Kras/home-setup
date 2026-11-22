import { budget, isItemDone } from './items';
import type { Item, Person } from './types';

/** Whole pounds with thousands separators: £1,284. */
export const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

export interface BudgetRoomRow {
  room: string;
  spent: number;
  /** Spent plus the estimates of what is still to buy in this room. */
  total: number;
  /** "£0 of £25" while something is still to buy, otherwise just the spend: "£444". */
  label: string;
  /** Share of the room's total already spent, 0 to 1. */
  fill: number;
}

export interface BudgetView {
  spent: number;
  toBuy: number;
  estimatedTotal: number;
  /** Whole percent of the estimate already spent. */
  percent: number;
  byPerson: Record<Person, number>;
  /** Split-bar segments for people who paid something; empty means only the neutral track shows. */
  split: { person: Person; share: number }[];
  /** Shown instead of the split when there is nothing to split. */
  splitNote?: string;
  /** Rooms with any spend or estimate, largest first; empty means the card is hidden. */
  rooms: BudgetRoomRow[];
}

/**
 * Everything the Budget screen shows, from the prices entered on items. Room totals use the same rule
 * as the overall estimate (paid prices, plus estimates of unfinished unpaid items), so they add up.
 */
export function budgetView(items: readonly Item[]): BudgetView {
  const b = budget(items);
  const perRoom = new Map<string, { spent: number; total: number }>();
  for (const item of items) {
    const amount = item.actualPrice ?? (item.estPrice !== undefined && !isItemDone(item) ? item.estPrice : undefined);
    if (amount === undefined) continue;
    const room = item.room ?? 'Other';
    const row = perRoom.get(room) ?? { spent: 0, total: 0 };
    perRoom.set(room, { spent: row.spent + (item.actualPrice ?? 0), total: row.total + amount });
  }
  const rooms = [...perRoom.entries()]
    .filter(([, r]) => r.total > 0)
    .map(([room, r]) => ({
      room,
      spent: r.spent,
      total: r.total,
      label: r.spent < r.total ? `${gbp(r.spent)} of ${gbp(r.total)}` : gbp(r.spent),
      fill: r.spent / r.total,
    }))
    .sort((a, c) => c.total - a.total || a.room.localeCompare(c.room));

  const paid = b.byPerson.nikita + b.byPerson.daryna;
  const split = paid === 0 ? [] : (['nikita', 'daryna'] as const).filter((p) => b.byPerson[p] > 0).map((person) => ({ person, share: b.byPerson[person] / paid }));
  const splitNote = b.spent === 0 ? 'No spending yet' : paid === 0 ? 'Nobody is recorded as the buyer yet' : undefined;

  return {
    spent: b.spent,
    toBuy: b.toBuy,
    estimatedTotal: b.estimatedTotal,
    percent: b.estimatedTotal === 0 ? 0 : Math.round((b.spent / b.estimatedTotal) * 100),
    byPerson: b.byPerson,
    split,
    splitNote,
    rooms,
  };
}
