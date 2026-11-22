import type { RefObject } from 'react';
import type { State } from './reducer';
import type { AuthStatus } from './store';

// The iPhone widget lives in iosWidgetSync.ios.ts. Android, web and tests get these no-ops, so they
// never bundle expo-widgets.

export function resetIosWidget(): Promise<void> {
  return Promise.resolve();
}

export function useIosWidgetSync(
  _state: State,
  _current: RefObject<State>,
  _set: (next: State) => void,
  _auth: AuthStatus,
  _ready: boolean,
): void {}
