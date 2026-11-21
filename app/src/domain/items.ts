import type { Item, ItemStatus, Person } from './types';
import { ITEM_STATUSES } from './types';

/**
 * An item is finished when it is installed, or when it is delivered and needs no installing
 * (a kettle). A delivered router or shelf is still "left" until it is installed.
 */
export function isItemDone(item: Item): boolean {
  return item.status === 'installed' || (item.status === 'delivered' && !item.needsInstall);
}

/** Next status in the flow, skipping 'installed' for items that need no installing. */
export function nextStatus(item: Item): ItemStatus {
  const i = ITEM_STATUSES.indexOf(item.status);
  const next = ITEM_STATUSES[Math.min(i + 1, ITEM_STATUSES.length - 1)]!;
  if (next === 'installed' && !item.needsInstall) return item.status;
  return next;
}

export function advance(item: Item, now: string, actor: Item['updatedBy']): Item {
  const status = nextStatus(item);
  if (status === item.status) return item;
  return {
    ...item,
    status,
    updatedBy: actor,
    deliveredAt: status === 'delivered' ? now : item.deliveredAt,
    installedAt: status === 'installed' ? now : item.installedAt,
  };
}

/** One-tap "Got it": jump to delivered (skips looking and ordered). Items already got are unchanged. */
export function markGot(item: Item, now: string, actor: Item['updatedBy']): Item {
  const i = ITEM_STATUSES.indexOf(item.status);
  if (i >= ITEM_STATUSES.indexOf('delivered')) return item;
  return { ...item, status: 'delivered', deliveredAt: now, updatedBy: actor };
}

export function counts(items: readonly Item[]): { done: number; left: number; total: number } {
  const done = items.filter(isItemDone).length;
  return { done, left: items.length - done, total: items.length };
}

/** Left items grouped by room, urgent first within a room. Items with no room go under "Other". */
export function leftByRoom(items: readonly Item[]): { room: string; items: Item[] }[] {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    if (isItemDone(item)) continue;
    const room = item.room ?? 'Other';
    groups.set(room, [...(groups.get(room) ?? []), item]);
  }
  return [...groups.entries()].map(([room, list]) => ({
    room,
    items: [...list].sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.name.localeCompare(b.name)),
  }));
}

/** The most useful single thing to show on a widget or the Next-up card. */
export function nextUp(items: readonly Item[]): Item | undefined {
  return items
    .filter((i) => !isItemDone(i))
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.addedAt.localeCompare(b.addedAt))[0];
}

/** Money. Only entered prices count; nothing is guessed. */
export function budget(items: readonly Item[]): {
  spent: number;
  toBuy: number;
  estimatedTotal: number;
  byPerson: Record<Person, number>;
  byRoom: Record<string, number>;
} {
  let spent = 0;
  let toBuy = 0;
  const byPerson: Record<Person, number> = { nikita: 0, daryna: 0 };
  const byRoom: Record<string, number> = {};
  for (const item of items) {
    if (item.actualPrice !== undefined) {
      spent += item.actualPrice;
      if (item.boughtBy) byPerson[item.boughtBy] += item.actualPrice;
      const room = item.room ?? 'Other';
      byRoom[room] = (byRoom[room] ?? 0) + item.actualPrice;
    } else if (item.estPrice !== undefined && !isItemDone(item)) {
      toBuy += item.estPrice;
    }
  }
  return { spent, toBuy, estimatedTotal: spent + toBuy, byPerson, byRoom };
}

/** Best-guess room from an item name, so adding "kettle" needs no extra taps. Undefined when unsure. */
export function guessRoom(name: string): string | undefined {
  const n = name.toLowerCase();
  const rules: [RegExp, string][] = [
    [/kettle|toast|microwave|pan\b|pot\b|plate|cutlery|fridge|oven|mug|cup|knife/, 'Kitchen'],
    [/sofa|tv\b|lamp|rug|shelf|shelves|bookcase|router|wifi|speaker/, 'Living room'],
    [/bed|mattress|pillow|duvet|curtain|wardrobe|hanger/, 'Bedroom'],
    [/towel|shower|toilet|bath|mirror|bin\b/, 'Bathroom'],
  ];
  return rules.find(([re]) => re.test(n))?.[1];
}
