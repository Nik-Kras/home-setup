import { useEffect, type RefObject } from 'react';
import { Platform } from 'react-native';
import { requestWidgetUpdate, type WidgetTaskHandler } from 'react-native-android-widget';
import { MARK_GOT, renderOurFlatWidget, WIDGET_NAMES } from '../components/widgets/OurFlatWidget';
import type { Item } from '../domain/types';
import type { WidgetData } from '../domain/widgetData';
import type { State } from './reducer';
import type { AuthStatus } from './store';
import { kv } from './supabase';
import { syncQueue } from './syncQueue';
import { createWidgetStorage, makeWidgetSnapshot, type WidgetSnapshot } from './widgetSnapshot';

const storage = createWidgetStorage(kv);

let foreground: {
  getSnapshot?: () => WidgetSnapshot | null;
  onChange: (before: Item, after: Item) => void;
} | undefined;

const redraw = (data: WidgetData | null) => Promise.all(WIDGET_NAMES.map((widgetName) =>
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
            const { items, tasks, me } = current.current;
            return makeWidgetSnapshot(items, tasks, me, new Date());
          }
        : undefined; // Keep the previous snapshot while signing in or loading offline.
    foreground = {
      getSnapshot,
      onChange(before, after) {
        if (auth !== 'signedIn' || !ready) return;
        const live = current.current;
        const items = live.items.map((item) => {
          if (item.id !== before.id || item.status !== before.status || item.deliveredAt !== before.deliveredAt) return item;
          return { ...item, status: after.status, deliveredAt: after.deliveredAt, updatedBy: after.updatedBy };
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
      (before, after) => foreground?.onChange(before, after),
    );
    if (updated) {
      await Promise.all([redraw(updated), syncQueue.flush()]);
      return;
    }
  }

  const data = syncQueue && (await storage.read())?.data;
  task.renderWidget(renderOurFlatWidget(task.widgetInfo, data ?? null));
};
