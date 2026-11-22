import { addUserInteractionListener } from 'expo-widgets';
import { useEffect, type RefObject } from 'react';
import { AppState } from 'react-native';
import OurFlatIosWidget from '../components/widgets/OurFlatIosWidget';
import {
  applyGotLocally, createIosWidgetBridge, IOS_WIDGET_NAME, iosPublishMode, schedulePublish, type IosWidgetApp,
} from './iosWidget';
import type { State } from './reducer';
import type { AuthStatus } from './store';
import { syncQueue } from './syncQueue';
import { makeWidgetSnapshot } from './widgetSnapshot';

const bridge = createIosWidgetBridge(OurFlatIosWidget, syncQueue);
const warn = () => console.warn('Could not update the iPhone widget');

/** Another account took over the device: drop the old account's taps and show the signed-out widget. */
export function resetIosWidget(): Promise<void> {
  return bridge.publish(null, () => null).then(() => undefined, warn);
}

/** Taps show as got at once, like an edit in the app; the queued patch decides on the server. */
function storeApp(current: RefObject<State>, set: (next: State) => void): IosWidgetApp {
  return {
    applyGot(pending) {
      const live = current.current;
      const items = applyGotLocally(live.items, live.me, pending);
      if (items !== live.items) set({ ...live, items });
    },
  };
}

/** Write the snapshot to the App Group after store changes (debounced 500 ms) and take widget taps. */
export function useIosWidgetSync(
  state: State,
  current: RefObject<State>,
  set: (next: State) => void,
  auth: AuthStatus,
  ready: boolean,
) {
  // Taps made while the app was closed or in the background, taken at sign-in, on foreground and
  // when a tap arrives while the app runs.
  useEffect(() => {
    const queue = syncQueue;
    if (auth !== 'signedIn' || !queue) return;
    const app = storeApp(current, set);
    const consume = () => {
      void bridge.consume(app).then(async (taken) => { if (taken > 0) await queue.flush(); }).catch(warn);
    };
    consume();
    const foreground = AppState.addEventListener('change', (s) => s === 'active' && consume());
    const tap = addUserInteractionListener((event) => event.source === IOS_WIDGET_NAME && consume());
    return () => {
      foreground.remove();
      tap.remove();
    };
  }, [auth, current, set]);

  useEffect(() => {
    const mode = iosPublishMode(auth, !!syncQueue, ready);
    const app = mode === 'live' ? storeApp(current, set) : null;
    return schedulePublish(mode, () => {
      void bridge.publish(app, () => makeWidgetSnapshot(current.current.items, new Date()))
        .then(async (taken) => { if (taken > 0) await syncQueue?.flush(); }).catch(warn);
    });
  }, [state, auth, ready, current, set]);
}
