import { guessRoom, isItemDone } from './items';
import type { Item } from './types';

/**
 * A name to add and the room it goes in. `id` is set when it is one of the household's own items;
 * `onList` marks one that is on the list and not got yet.
 */
export interface Suggestion {
  name: string;
  room?: string;
  id?: string;
  onList?: boolean;
}

type OwnItem = Pick<Item, 'id' | 'name' | 'room' | 'status' | 'needsInstall'>;

/** Common things a new flat needs, with the room each goes in. Generic names only. */
export const COMMON_ITEMS: readonly Suggestion[] = [
  { name: 'Kettle', room: 'Kitchen' },
  { name: 'Kettle descaler', room: 'Kitchen' },
  { name: 'Toaster', room: 'Kitchen' },
  { name: 'Microwave', room: 'Kitchen' },
  { name: 'Frying pan', room: 'Kitchen' },
  { name: 'Saucepans', room: 'Kitchen' },
  { name: 'Cutlery set', room: 'Kitchen' },
  { name: 'Plates and bowls', room: 'Kitchen' },
  { name: 'Mugs', room: 'Kitchen' },
  { name: 'Glasses', room: 'Kitchen' },
  { name: 'Chopping board', room: 'Kitchen' },
  { name: 'Kitchen knives', room: 'Kitchen' },
  { name: 'Tea towels', room: 'Kitchen' },
  { name: 'Kitchen bin', room: 'Kitchen' },
  { name: 'Dish rack', room: 'Kitchen' },
  { name: 'Washing-up liquid', room: 'Kitchen' },
  { name: 'Food containers', room: 'Kitchen' },
  { name: 'Sofa', room: 'Living room' },
  { name: 'Coffee table', room: 'Living room' },
  { name: 'Floor lamp', room: 'Living room' },
  { name: 'Bookshelf', room: 'Living room' },
  { name: 'Rug', room: 'Living room' },
  { name: 'TV', room: 'Living room' },
  { name: 'TV stand', room: 'Living room' },
  { name: 'WiFi router', room: 'Living room' },
  { name: 'Cushions', room: 'Living room' },
  { name: 'Plant', room: 'Living room' },
  { name: 'Extension lead', room: 'Living room' },
  { name: 'Bed frame', room: 'Bedroom' },
  { name: 'Mattress', room: 'Bedroom' },
  { name: 'Duvet', room: 'Bedroom' },
  { name: 'Pillows', room: 'Bedroom' },
  { name: 'Bed sheets', room: 'Bedroom' },
  { name: 'Bedside table', room: 'Bedroom' },
  { name: 'Bedside lamp', room: 'Bedroom' },
  { name: 'Curtains', room: 'Bedroom' },
  { name: 'Curtain rods', room: 'Bedroom' },
  { name: 'Wardrobe', room: 'Bedroom' },
  { name: 'Hangers', room: 'Bedroom' },
  { name: 'Chest of drawers', room: 'Bedroom' },
  { name: 'Towels', room: 'Bathroom' },
  { name: 'Bath mat', room: 'Bathroom' },
  { name: 'Shower curtain', room: 'Bathroom' },
  { name: 'Toilet brush', room: 'Bathroom' },
  { name: 'Bathroom bin', room: 'Bathroom' },
  { name: 'Bathroom mirror', room: 'Bathroom' },
  { name: 'Hall mirror', room: 'Hallway' },
  { name: 'Shoe rack', room: 'Hallway' },
  { name: 'Coat hooks', room: 'Hallway' },
  { name: 'Doormat', room: 'Hallway' },
  { name: 'Light bulbs', room: 'Hallway' },
  { name: 'Vacuum cleaner', room: 'Hallway' },
  { name: 'Mop and bucket', room: 'Hallway' },
  { name: 'Iron', room: 'Hallway' },
  { name: 'Ironing board', room: 'Hallway' },
  { name: 'Clothes airer', room: 'Hallway' },
  { name: 'Smoke alarm', room: 'Hallway' },
  { name: 'Drill', room: 'Hallway' },
  { name: 'Toolkit', room: 'Hallway' },
];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** 0: the name starts with the query, 1: a later word does, 2: it appears inside a word. Undefined: no match. */
function rank(name: string, q: string): number | undefined {
  const n = norm(name);
  if (n.startsWith(q)) return 0;
  if (n.split(/[\s-]+/).some((w) => w.startsWith(q))) return 1;
  if (q.length >= 3 && n.includes(q)) return 2;
  return undefined;
}

/**
 * Names to offer while typing in the add bar: the household's own item names first (their room as
 * stored), then the built-in list. Case-insensitive, one entry per name, best match first.
 */
export function suggestItems(query: string, items: readonly OwnItem[], limit = 3): Suggestion[] {
  const q = norm(query);
  if (!q) return [];
  const seen = new Set<string>();
  const pool: (Suggestion & { r: number; own: number })[] = [];
  const consider = (s: Suggestion, own: number) => {
    const key = norm(s.name);
    if (seen.has(key)) return;
    const r = rank(s.name, q);
    if (r === undefined) return;
    seen.add(key);
    pool.push({ ...s, r, own });
  };
  // Open items first, so a name both got and still on the list suggests the open one.
  const own = [...items].sort((a, b) => Number(isItemDone(a)) - Number(isItemDone(b)));
  for (const item of own) consider({ name: item.name, room: item.room ?? guessRoom(item.name), id: item.id, onList: !isItemDone(item) }, 0);
  for (const s of COMMON_ITEMS) consider(s, 1);
  return pool
    .sort((a, b) => a.r - b.r || a.own - b.own || a.name.length - b.name.length || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ r: _r, own: _own, ...s }) => ({ name: s.name, room: s.room, ...(s.id ? { id: s.id } : {}), ...(s.onList ? { onList: true } : {}) }));
}

/** True when the typed text is already one of the suggestions, so "Add as new" is not offered twice. */
export function isExactSuggestion(query: string, list: readonly Suggestion[]): boolean {
  const q = norm(query);
  return list.some((s) => norm(s.name) === q);
}

/** Quick chips before anything is typed: common things not on the list yet. */
export function quickPicks(items: readonly Pick<Item, 'name'>[], count = 6): Suggestion[] {
  const have = new Set(items.map((i) => norm(i.name)));
  return COMMON_ITEMS.filter((s) => !have.has(norm(s.name))).slice(0, count);
}

/**
 * The room a typed name goes in, so the "Goes in <room>" hint and the added item agree: the room of a
 * suggestion with exactly that name (own items first), else of the best suggestion the name begins,
 * else the keyword guess. Undefined when nothing fits.
 */
export function roomForName(name: string, items: readonly OwnItem[]): string | undefined {
  const q = norm(name);
  if (!q) return undefined;
  const exact = items.find((i) => norm(i.name) === q);
  if (exact) return exact.room ?? guessRoom(exact.name);
  const common = COMMON_ITEMS.find((c) => norm(c.name) === q);
  if (common) return common.room;
  const best = suggestItems(name, items, 1)[0];
  if (best && norm(best.name).startsWith(q)) return best.room;
  return guessRoom(name);
}

/** An item already called this (trimmed, any case), open ones first; adding it again would make a copy. */
export function findExisting<T extends Pick<Item, 'name' | 'status' | 'needsInstall'>>(name: string, items: readonly T[]): T | undefined {
  const q = norm(name);
  if (!q) return undefined;
  const same = items.filter((i) => norm(i.name) === q);
  return same.find((i) => !isItemDone(i)) ?? same[0];
}

/**
 * The room the add screen starts on: the one the person picked, else the suggestion's room, else the
 * room for the typed name (see roomForName), else the last room used, else the first room. Only rooms
 * that exist are returned, so the screen always shows which room the item goes in.
 */
export function defaultRoom(opts: { picked?: string; suggested?: string; name: string; lastUsed?: string; rooms: readonly string[]; items?: readonly OwnItem[] }): string | undefined {
  const known = (r?: string) => (r && opts.rooms.includes(r) ? r : undefined);
  return known(opts.picked) ?? known(opts.suggested) ?? known(roomForName(opts.name, opts.items ?? [])) ?? known(opts.lastUsed) ?? opts.rooms[0];
}
