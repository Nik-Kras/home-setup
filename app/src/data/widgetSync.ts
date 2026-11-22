import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, type RefObject } from 'react';
import { Platform } from 'react-native';
import { requestWidgetUpdate, type WidgetTaskHandler } from 'react-native-android-widget';
import { MARK_GOT, renderOurFlatWidget, WIDGET_NAMES } from '../components/widgets/OurFlatWidget';
import type { WidgetItem, WidgetView } from '../domain/widgetData';
import type { OpQueue } from './queue';
import type { State } from './reducer';
import { loadAll } from './repo';
import type { AuthStatus } from './store';
import { db, kv } from './supabase';
import { syncQueue } from './syncQueue';
import { createWidgetStorage, makeWidgetSnapshot, type WidgetSnapshot, type WidgetSource } from './widgetSnapshot';

const storage = createWidgetStorage(kv);

/** Fresh data for the periodic update, through the app's own client and loader. Never flushes the queue. */
function supabaseSource(client: SupabaseClient, queue: OpQueue): WidgetSource {
  return {
    async hasSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session !== null;
    },
    pending: () => queue.size(),
    loadItems: async () => (await loadAll(client)).items,
  };
}
const source = db && syncQueue ? supabaseSource(db, syncQueue) : null;

let foreground: {
  getSnapshot?: () => WidgetSnapshot | null;
  onChange: (before: WidgetItem, deliveredAt: string) => void;
} | undefined;

const redraw = (data: WidgetView | null) => Promise.all(WIDGET_NAMES.map((widgetName) =>
  requestWidgetUpdate({ widgetName, renderWidget: (info) => renderOurFlatWidget(info, data) }),
));

export function useWidgetSync(
  state: State,
  current: RefObject<State>,
  set: (next: State) => void,
  auth: AuthStatus,
  ready: boolean,
) {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const getSnapshot = auth === 'signedOut' || !syncQueue
      ? () => null
      : auth === 'signedIn' && ready
        ? () => {
            return makeWidgetSnapshot(current.current.items, new Date());
          }
        : undefined; // Keep the previous snapshot while signing in or loading offline.
    foreground = {
      getSnapshot,
      onChange(before, deliveredAt) {
        if (auth !== 'signedIn' || !ready) return;
        const live = current.current;
        const items = live.items.map((item) => {
          if (item.id !== before.id || item.status !== before.status) return item;
          return { ...item, status: 'delivered' as const, deliveredAt, updatedBy: live.me };
        });
        if (items.some((item, index) => item !== live.items[index])) set({ ...live, items });
      },
    };
    return () => { foreground = undefined; };
  }, [auth, ready, current, set]);

  useEffect(() => {
    const source = foreground?.getSnapshot;
    if (Platform.OS !== 'android' || !source) return;
    const publish = () => {
      void storage.publish(source).then(redraw).catch(() => console.warn('Could not update home widgets'));
    };
    if (!syncQueue || auth === 'signedOut') {
      publish();
      return;
    }
    const timer = setTimeout(publish, 500);
    return () => clearTimeout(timer);
  }, [state, auth, ready]);
}

export const widgetTaskHandler: WidgetTaskHandler = async (task) => {
  if (task.widgetAction === 'WIDGET_DELETED' || !WIDGET_NAMES.some((name) => name === task.widgetInfo.widgetName)) return;
  const id = task.clickActionData?.id;

  if (syncQueue && task.widgetAction === 'WIDGET_CLICK' && task.clickAction === MARK_GOT && typeof id === 'string') {
    const updated = await storage.markGot(
      id, new Date(), syncQueue,
      () => foreground?.getSnapshot?.(),
      (before, deliveredAt) => foreground?.onChange(before, deliveredAt),
    );
    if (updated) {
      await Promise.all([redraw(updated), syncQueue.flush()]);
      return;
    }
  }

  // The 30 minute update fetches fresh data so the other person's changes show while the app is closed.
  const data = !syncQueue ? null : task.widgetAction === 'WIDGET_UPDATE' && source
    ? await storage.refresh(source, () => new Date())
    : (await storage.read())?.data;
  task.renderWidget(renderOurFlatWidget(task.widgetInfo, data ?? null));
};
