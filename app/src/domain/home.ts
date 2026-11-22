import { isItemDone } from './items';
import type { Item, Person } from './types';

/** How the Home grid is arranged: one grid, or one section per person who bought the things. */
export type HomeMode = 'room' | 'owner';

/** Things with no room are shown and filtered under this name, as on the Buy list. */
export const NO_ROOM = 'Other';

export interface HomeChip { room: string; count: number }
export interface HomeGroup { key: Person | 'none' | 'all'; title?: string; items: Item[] }
export interface HomeView {
  /** Everything in place, before the room filter. */
  total: number;
  /** Rooms that have something in place, in room order; the screen adds "All" in front. */
  chips: HomeChip[];
  /** The room filter in effect. A room that no longer has anything in place falls back to all. */
  room?: string;
  groups: HomeGroup[];
}

const OWNER_TITLE: Record<Person | 'none', string> = { nikita: 'Nikita', daryna: 'Daryna', none: 'Not recorded' };

const roomOf = (item: Item) => item.room ?? NO_ROOM;

/** Rooms in the store's order, then any others alphabetically, then "Other" last. */
function roomRank(roomOrder: readonly string[]) {
  return (a: string, b: string) => {
    const rank = (r: string) => (r === NO_ROOM ? Number.MAX_SAFE_INTEGER : roomOrder.includes(r) ? roomOrder.indexOf(r) : roomOrder.length);
    return rank(a) - rank(b) || a.localeCompare(b);
  };
}

/**
 * The Home inventory: only things that are really in place (delivered, or installed when they need
 * installing). Room mode is one grid; owner mode is one section per buyer, unrecorded buyers last.
 */
export function homeView(items: readonly Item[], opts: { mode: HomeMode; room?: string; roomOrder: readonly string[] }): HomeView {
  const byRoom = roomRank(opts.roomOrder);
  const placed = items.filter(isItemDone).sort((a, b) => byRoom(roomOf(a), roomOf(b)) || a.name.localeCompare(b.name));

  const counts = new Map<string, number>();
  for (const item of placed) counts.set(roomOf(item), (counts.get(roomOf(item)) ?? 0) + 1);
  const chips = [...counts.entries()].sort(([a], [b]) => byRoom(a, b)).map(([room, count]) => ({ room, count }));

  const room = opts.room && counts.has(opts.room) ? opts.room : undefined;
  const shown = room ? placed.filter((i) => roomOf(i) === room) : placed;

  const groups: HomeGroup[] = opts.mode === 'room'
    ? (shown.length ? [{ key: 'all', items: shown }] : [])
    : (['nikita', 'daryna', 'none'] as const)
        .map((key) => ({ key, title: OWNER_TITLE[key], items: shown.filter((i) => (i.boughtBy ?? 'none') === key) }))
        .filter((g) => g.items.length > 0);

  return { total: placed.length, chips, room, groups };
}

/** "7 things in place", "1 thing in place". */
export function placedLabel(n: number): string {
  return `${n} ${n === 1 ? 'thing' : 'things'} in place`;
}
