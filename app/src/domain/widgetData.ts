import { glyphFor } from './glyphs';
import { isItemDone, ITEM_STATUS_LABEL, leftByRoom } from './items';
import { localDate } from './taskOptions';
import { daysLeft, openTasksSorted } from './tasks';
import type { Item, Person, Task } from './types';

export function buildWidgetItemData(items: readonly Item[]) {
  const left = items.filter((item) => !isItemDone(item)).sort(
    (a, b) => Number(b.urgent) - Number(a.urgent) || a.addedAt.localeCompare(b.addedAt),
  );
  const next = left[0];
  const row = ({ id, name, status, urgent }: Item) => ({ id, name, status: ITEM_STATUS_LABEL[status], urgent });
  let remaining = 4;
  const rooms = leftByRoom(items).flatMap(({ room, items: group }) => {
    const rows = group.slice(0, remaining).map(row);
    remaining -= rows.length;
    return rows.length ? [{ room, items: rows }] : [];
  });

  return {
    leftCount: left.length,
    urgentCount: left.filter((item) => item.urgent).length,
    nextUp: next ? { id: next.id, name: next.name, room: next.room, urgent: next.urgent } : null,
    top: left.slice(0, 3).map((item) => ({ ...row(item), icon: glyphFor(item.name) })),
    rooms,
  };
}

export function buildWidgetData(items: readonly Item[], tasks: readonly Task[], me: Person, now: Date) {
  const today = localDate(now);
  const due = openTasksSorted(tasks, me).flatMap(({ id, title, due }) => {
    const days = due ? daysLeft(due, today) : NaN;
    return Number.isFinite(days) ? [{ id, title, daysLeft: days }] : [];
  }).sort((a, b) => a.daysLeft - b.daysLeft);

  return {
    v: 1 as const,
    updatedAt: now.toISOString(),
    ...buildWidgetItemData(items),
    tasksDue: { todayCount: due.filter((task) => task.daysLeft === 0).length, next: due[0] ?? null },
  };
}

export type WidgetData = ReturnType<typeof buildWidgetData>;
