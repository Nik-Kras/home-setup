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

/**
 * Set any status directly (detail screen). Reaching delivered or installed stamps that time, keeping
 * an existing one (moving back from installed keeps the original deliveredAt); going back before a
 * step clears its timestamp.
 */
export function setStatus(item: Item, status: ItemStatus, now: string, actor: Item['updatedBy']): Item {
  if (status === item.status) return item;
  const at = ITEM_STATUSES.indexOf(status);
  return {
    ...item,
    status,
    updatedBy: actor,
    deliveredAt: at >= ITEM_STATUSES.indexOf('delivered') ? item.deliveredAt ?? now : undefined,
    installedAt: status === 'installed' ? item.installedAt ?? now : undefined,
  };
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

/* ---------- Item detail screen ---------- */

export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = { needed: 'Needed', looking: 'Looking', ordered: 'Ordered', delivered: 'Delivered', installed: 'Installed' };

/** Display name of a person or Claude. */
export function actorName(actor: Item['updatedBy']): string {
  return actor === 'nikita' ? 'Nikita' : actor === 'daryna' ? 'Daryna' : 'Claude';
}

/**
 * Statuses that do not apply to this item: 'installed' for things that need no installing. Kept when
 * the item already sits there, so its current status never disappears from the stepper.
 */
export function skippedStatuses(item: Item): ItemStatus[] {
  return !item.needsInstall && item.status !== 'installed' ? ['installed'] : [];
}

/** The steps the stepper shows, in order, each as done, current or pending. */
export function itemSteps(item: Item): { status: ItemStatus; state: 'done' | 'current' | 'pending' }[] {
  const skipped = skippedStatuses(item);
  const at = ITEM_STATUSES.indexOf(item.status);
  return ITEM_STATUSES.filter((s) => !skipped.includes(s)).map((status) => {
    const i = ITEM_STATUSES.indexOf(status);
    return { status, state: i < at ? 'done' : i === at ? 'current' : 'pending' };
  });
}

/**
 * Colour of the current step. Amber means only "in transit", so it is used for Ordered alone; a
 * finished item shows its current step as done (mint); any other current step is a neutral highlight.
 */
export function currentStepTone(item: Item): 'done' | 'transit' | 'neutral' {
  if (isItemDone(item)) return 'done';
  return item.status === 'ordered' ? 'transit' : 'neutral';
}

/**
 * The confirmation line for a stepper tap that would clear a delivered or installed date, such as
 * "This clears the delivered date." Undefined when nothing would be lost, so no confirmation is needed.
 */
export function clearedDatesWarning(item: Item, status: ItemStatus): string | undefined {
  const after = setStatus(item, status, item.addedAt, item.updatedBy);
  const lost = [item.deliveredAt && !after.deliveredAt ? 'delivered' : undefined, item.installedAt && !after.installedAt ? 'installed' : undefined].filter(Boolean);
  if (lost.length === 0) return undefined;
  return lost.length === 1 ? `This clears the ${lost[0]} date.` : `This clears the ${lost.join(' and ')} dates.`;
}

/** Label of the one primary button, or undefined when the item is finished. */
export function nextActionLabel(item: Item): string | undefined {
  if (isItemDone(item)) return undefined;
  const next = nextStatus(item);
  if (next === item.status) return undefined;
  return next === 'looking' ? 'Start looking' : `Mark as ${ITEM_STATUS_LABEL[next].toLowerCase()}`;
}

/** £90 for whole pounds, £84.99 otherwise. */
export function formatMoney(n: number): string {
  return Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2)}`;
}

/** "Kitchen · 1 item · £90 est.", leaving out what is missing. */
export function itemMeta(item: Item): string {
  return [
    item.room,
    `${item.quantity} ${item.quantity === 1 ? 'item' : 'items'}`,
    item.estPrice !== undefined ? `${formatMoney(item.estPrice)} est.` : undefined,
  ].filter(Boolean).join(' · ');
}

/**
 * A typed price. Empty means "no price" (undefined); anything that is not a non-negative amount is
 * null (invalid). Accepts "84.99", "84,99" and a leading £. Rounded to pence.
 * Commas: a comma followed by groups of exactly three digits is a thousands separator ("1,200" is
 * 1200, "12,345.50" is 12345.50), as written in the UK. Any other single comma is the decimal point,
 * for keyboards that type one ("84,99" and "12,5" are 84.99 and 12.50).
 */
export function parsePrice(text: string): number | undefined | null {
  let t = text.trim().replace(/^£\s*/, '');
  if (t === '') return undefined;
  if (/^\d{1,3}(,\d{3})+(\.\d*)?$/.test(t)) t = t.replace(/,/g, '');
  else t = t.replace(/^(\d*),(\d*)$/, '$1.$2');
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(t)) return null;
  const n = Math.round(Number(t) * 100) / 100;
  return n >= 100_000_000 ? null : n; // numeric(10, 2) in the database
}

/**
 * A typed product link. Empty means none (undefined); a bare address gets https://. Only http and
 * https links with a dotted host are accepted (null otherwise), so the app never opens other schemes.
 */
export function parseLink(text: string): string | undefined | null {
  const t = text.trim();
  if (t === '') return undefined;
  const url = /^https?:\/\//i.test(t) ? t : /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(t) ? null : `https://${t}`;
  return url && /^https?:\/\/[^\s/?#.]+(\.[^\s/?#.]+)+(:\d+)?([/?#]\S*)?$/i.test(url) ? url : null;
}

/**
 * Room choices: the rooms the store loaded (the database's rooms, or the demo rooms), plus the item's
 * own room if it is somehow not among them, so the current choice still shows as selected.
 */
export function roomOptions(rooms: readonly string[], current?: string): string[] {
  return current && !rooms.includes(current) ? [...rooms, current] : [...rooms];
}
