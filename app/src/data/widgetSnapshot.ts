import { markGot } from '../domain/items';
import type { Item, Person, Task } from '../domain/types';
import { buildWidgetData, buildWidgetItemData, type WidgetData } from '../domain/widgetData';
import { diffToOps } from './diff';
import type { KV, OpQueue } from './queue';

/** JSON envelope with the v1 public widget payload and the local fields needed for offline taps. */
export const WIDGET_SNAPSHOT_KEY = 'homesetup.widget.v1';

export interface WidgetSnapshot {
  data: WidgetData;
  items: Item[];
  me: Person;
}

export function makeWidgetSnapshot(items: readonly Item[], tasks: readonly Task[], me: Person, now: Date): WidgetSnapshot {
  // Keep only fields needed to rebuild the widget and diff item status. Exclude links, notes and prices.
  const editable = items.map(({ id, name, room, status, urgent, needsInstall, addedAt, deliveredAt, quantity }) => ({
    id, name, room, status, urgent, needsInstall, addedAt, deliveredAt, quantity, updatedBy: me,
  }));
  return { data: buildWidgetData(editable, tasks, me, now), items: editable, me };
}

export function createWidgetStorage(storage: KV) {
  let tail: Promise<unknown> = Promise.resolve();
  function serialize<T>(work: () => Promise<T>): Promise<T> {
    const next = tail.then(work);
    tail = next.catch(() => undefined);
    return next;
  }

  async function read(): Promise<WidgetSnapshot | null> {
    const raw = await storage.getItem(WIDGET_SNAPSHOT_KEY);
    if (!raw) return null;
    try {
      const snapshot = JSON.parse(raw) as WidgetSnapshot | null;
      return snapshot?.data?.v === 1 && Array.isArray(snapshot.items) ? snapshot : null;
    } catch {
      return null;
    }
  }

  const write = (snapshot: WidgetSnapshot | null) => storage.setItem(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));

  return {
    read: () => serialize(read),
    publish: (getSnapshot: () => WidgetSnapshot | null) => serialize(async () => {
      const snapshot = getSnapshot();
      await write(snapshot);
      return snapshot?.data ?? null;
    }),
    markGot: (
      id: string,
      now: Date,
      queue: Pick<OpQueue, 'enqueueAll'>,
      current?: () => WidgetSnapshot | null | undefined,
      onChange?: (before: Item, after: Item) => void,
    ) => serialize(async () => {
      const stored = await read();
      const live = current?.();
      const snapshot = live === undefined ? stored : live;
      if (!snapshot) return null;
      const before = snapshot.items.find((item) => item.id === id);
      if (!before) return null;
      const updatedAt = now.toISOString();
      const after = markGot(before, updatedAt, snapshot.me);
      if (after === before) return null;
      const ops = diffToOps({ items: [before], tasks: [] }, { items: [after], tasks: [] }, new Map());
      await queue.enqueueAll(ops);
      onChange?.(before, after);
      const items = snapshot.items.map((item) => item.id === id ? after : item);
      const data = { ...snapshot.data, ...buildWidgetItemData(items), updatedAt };
      await write({ ...snapshot, items, data });
      return data;
    }),
  };
}
