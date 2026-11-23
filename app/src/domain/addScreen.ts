/**
 * Where the add screen goes when it closes. Opened by a link (the widget's "+"), it goes to the Buy
 * list, so the new item is in view even if the app was already open on another screen. Opened from a
 * screen, it goes back there; with nothing to go back to, to the list for its kind.
 */
export function addScreenExit(opts: { byLink: boolean; canGoBack: boolean; mode: 'item' | 'task' }): 'back' | '/' | '/tasks' {
  if (opts.byLink) return '/';
  if (opts.canGoBack) return 'back';
  return opts.mode === 'item' ? '/' : '/tasks';
}
