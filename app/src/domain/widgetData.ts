import { glyphFor, roomTone } from './glyphs';
import { guessRoom, isItemDone, ITEM_STATUS_LABEL, leftByRoom, nextActionLabel } from './items';
import { localDate } from './taskOptions';
import { daysLeft, openTasksSorted } from './tasks';
import type { Item, Person, Task } from './types';

/** The item fields the widgets need: what they draw, plus status, needsInstall and addedAt to order and count. */
export type WidgetItem = Pick<Item, 'id' | 'name' | 'room' | 'status' | 'urgent' | 'needsInstall' | 'addedAt'>;

/**
 * Rows stored for the large widget. It draws as many as its height allows (fitRooms), then "+n more";
 * 12 rows of 44dp fill even a tall launcher cell.
 */
export const WIDGET_MAX_ROWS = 12;
/** Rows stored for the medium widget (with glyph tiles); it draws as many as fit its height. */
export const WIDGET_TOP_ROWS = 6;

/**
 * Keep at most `max` rows across room groups, chosen by priority: urgent rows first (in room order),
 * then the rest in room order. The output keeps the room grouping and the order within each room.
 */
export function capRows<T extends { urgent: boolean }>(rooms: readonly { room: string; items: readonly T[] }[], max: number) {
  const all = rooms.flatMap(({ items }) => items);
  const kept = new Set([...all.filter((row) => row.urgent), ...all.filter((row) => !row.urgent)].slice(0, Math.max(0, max)));
  return rooms.flatMap(({ room, items }) => {
    const rows = items.filter((row) => kept.has(row));
    return rows.length ? [{ room, items: rows }] : [];
  });
}

/**
 * For the large widget: the most of its stored rows that fit in `space` dp (heights of a room label, a row
 * and the "+n more" line given in dp), dropped by priority as in capRows, and how many left items are not shown.
 */
export function fitRooms<T extends { urgent: boolean }>(
  data: { rooms: readonly { room: string; items: readonly T[] }[]; leftCount: number },
  space: number,
  height: { room: number; row: number; more: number },
) {
  const total = data.rooms.reduce((sum, { items }) => sum + items.length, 0);
  for (let n = total; n > 0; n--) {
    const rooms = capRows(data.rooms, n);
    const more = data.leftCount - n;
    if (rooms.length * height.room + n * height.row + (more > 0 ? height.more : 0) <= space) return { rooms, more };
  }
  return { rooms: [], more: data.leftCount };
}

export function buildWidgetItemData(items: readonly WidgetItem[]) {
  const left = items.filter((item) => !isItemDone(item)).sort(
    (a, b) => Number(b.urgent) - Number(a.urgent) || a.addedAt.localeCompare(b.addedAt),
  );
  // `action` names the stage a tap on the row's circle moves it to ("Mark ordered", "Got it"); every
  // row shown is left, so it always has a next stage.
  const row = ({ id, name, status, urgent, needsInstall }: WidgetItem) => (
    { id, name, status: ITEM_STATUS_LABEL[status], urgent, action: nextActionLabel({ status, needsInstall }) ?? 'Next stage' }
  );
  const grouped = leftByRoom(items).map(({ room, items: group }) => ({ room, items: group.map(row) }));
  return {
    left,
    leftCount: left.length,
    // Glyph and its room colour, as on the list rows (the room is guessed from the name when unset).
    top: left.slice(0, WIDGET_TOP_ROWS).map((item) => {
      const room = item.room ?? guessRoom(item.name);
      return { ...row(item), icon: glyphFor(item.name, room), tone: roomTone(room) };
    }),
    rooms: capRows(grouped, WIDGET_MAX_ROWS),
  };
}

/** What the Android widgets draw. This is the payload stored for them (see widgetSnapshot.ts). */
export function buildWidgetView(items: readonly WidgetItem[], now: Date) {
  const { leftCount, top, rooms } = buildWidgetItemData(items);
  return { v: 1 as const, updatedAt: now.toISOString(), leftCount, top, rooms };
}

export type WidgetView = ReturnType<typeof buildWidgetView>;

/** The full widget contract (the Android view plus the counts and next task the iPhone widgets may use). */
export function buildWidgetData(items: readonly Item[], tasks: readonly Task[], me: Person, now: Date) {
  const today = localDate(now);
  const due = openTasksSorted(tasks, me).flatMap(({ id, title, due }) => {
    const days = due ? daysLeft(due, today) : NaN;
    return Number.isFinite(days) ? [{ id, title, daysLeft: days }] : [];
  }).sort((a, b) => a.daysLeft - b.daysLeft);
  const { left } = buildWidgetItemData(items);
  const next = left[0];

  return {
    ...buildWidgetView(items, now),
    urgentCount: left.filter((item) => item.urgent).length,
    nextUp: next ? { id: next.id, name: next.name, room: next.room, urgent: next.urgent } : null,
    tasksDue: { todayCount: due.filter((task) => task.daysLeft === 0).length, next: due[0] ?? null },
  };
}

export type WidgetData = ReturnType<typeof buildWidgetData>;
