import { nextStage, type StageStep } from '../domain/items';
import type { Item } from '../domain/types';
import { buildWidgetView, type WidgetItem, type WidgetView } from '../domain/widgetData';
import type { KV, OpQueue } from './queue';
import { ops } from './repo';

/**
 * AsyncStorage key of the Android widget snapshot, stored as JSON:
 *
 *   {
 *     data: {                                    // what the widgets draw (WidgetView)
 *       v: 1, updatedAt: ISO string, leftCount: number,
 *       top: [{ id, name, status, urgent, action, icon }],          // medium widget, 3 rows
 *       rooms: [{ room, items: [{ id, name, status, urgent, action }] }],  // large widget, 4 rows
 *     },
 *     items: [{ id, name, room?, status, urgent, needsInstall, addedAt }],  // for the headless stage tap
 *   }
 *
 * `items` holds only what the tap needs: the status the widget showed (for the conditional patch) and the
 * fields that rebuild `data` afterwards. No prices, links, notes, people, dates other than addedAt, or tasks.
 * null means signed out.
 */
export const WIDGET_SNAPSHOT_KEY = 'homesetup.widget.v1';

export interface WidgetSnapshot {
  data: WidgetView;
  items: WidgetItem[];
}

export function makeWidgetSnapshot(items: readonly Item[], now: Date): WidgetSnapshot {
  const kept = items.map(({ id, name, room, status, urgent, needsInstall, addedAt }): WidgetItem => (
    { id, name, room, status, urgent, needsInstall, addedAt }
  ));
  return { data: buildWidgetView(kept, now), items: kept };
}

/** Where the periodic refresh gets fresh data. Fakes in tests; Supabase in widgetSync.ts. */
export interface WidgetSource {
  /** True when a Supabase session is stored. Throws when it cannot tell (for example a failed token refresh). */
  hasSession(): Promise<boolean>;
  /** Local edits not sent yet. Fresh server data would hide them, so the stored snapshot stays. */
  pending(): Promise<number>;
  loadItems(): Promise<Item[]>;
}

/** Skip the fetch when the stored snapshot is this fresh (each widget size runs its own periodic update). */
export const WIDGET_FRESH_MS = 5 * 60_000;

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

  const api = {
    read: () => serialize(read),
    publish: (getSnapshot: () => WidgetSnapshot | null) => serialize(async () => {
      const snapshot = getSnapshot();
      await write(snapshot);
      return snapshot?.data ?? null;
    }),
    /** Write `next` unless `keep` says the stored snapshot must stay. Returns the data now stored. */
    replace: (next: WidgetSnapshot, keep: (stored: WidgetSnapshot | null) => Promise<boolean>) => serialize(async () => {
      const stored = await read();
      if (await keep(stored)) return stored?.data ?? null;
      await write(next);
      return next.data;
    }),
    /**
     * The large widget's circle: one stage on (domain nextStage, as the app's buttons), never straight
     * to the end. Returns the redrawn data, or null when there is nothing to do.
     */
    advance: (
      id: string,
      now: Date,
      queue: Pick<OpQueue, 'enqueueAll'>,
      current?: () => WidgetSnapshot | null | undefined,
      onChange?: (before: WidgetItem, step: StageStep) => void,
    ) => serialize(async () => {
      const stored = await read();
      const live = current?.();
      const snapshot = live === undefined ? stored : live;
      if (!snapshot) return null;
      const before = snapshot.items.find((item) => item.id === id);
      const step = before && nextStage(before, now.toISOString());
      if (!before || !step) return null;
      // Conditional on the status shown: if it changed on the server meanwhile, the patch matches no row.
      await queue.enqueueAll([ops.advanceIf(id, before.status, step)]);
      onChange?.(before, step);
      // Optimistic: the row shows its new stage now (and leaves once done); the next refresh corrects it
      // if the patch matched nothing.
      const items = snapshot.items.map((item): WidgetItem => item.id === id ? { ...item, status: step.status } : item);
      const data = buildWidgetView(items, now);
      await write({ items, data });
      return data;
    }),
    /**
     * Periodic refresh while the app may be closed: fetch fresh items and store a new snapshot. Keeps the
     * stored snapshot (so its "Updated" age shows how old it is) when signed out, when local edits are
     * unsent, when it is still fresh, or on any failure. Never flushes the offline queue.
     */
    async refresh(source: WidgetSource, now: () => Date): Promise<WidgetView | null> {
      const stored = await api.read();
      try {
        if (stored && now().getTime() - Date.parse(stored.data.updatedAt) < WIDGET_FRESH_MS) return stored.data;
        if (!(await source.hasSession()) || (await source.pending()) > 0) return stored?.data ?? null;
        const next = makeWidgetSnapshot(await source.loadItems(), now());
        // A tap or the app may have written meanwhile; their snapshot is newer than this fetch.
        return await api.replace(next, async (latest) =>
          latest?.data.updatedAt !== stored?.data.updatedAt || (await source.pending()) > 0);
      } catch {
        return stored?.data ?? null;
      }
    },
  };
  return api;
}
