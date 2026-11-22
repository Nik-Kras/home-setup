/**
 * The path Expo Router should open at launch.
 *
 * When the widget's background task has started the app (no screen), Android keeps the app's task
 * and, on the next widget link, recreates the Activity with its old launcher intent and hands the
 * link (`homesetup://item/<id>`, `homesetup://add-item`) over as a new intent. React Native's
 * initial URL is then empty and its `url` event fires before the router listens, so the router
 * opened the plain Buy list. `launchUrl` is the last link the Activity received (expo-linking):
 * when the router fell back to the root, use it instead.
 */
export function launchPath(routerPath: string, launchUrl: string | null | undefined): string {
  if (!launchUrl || !isRootPath(routerPath)) return routerPath;
  return launchUrl.startsWith('homesetup://') && !isRootPath(launchUrl) ? launchUrl : routerPath;
}

/** `''`, `/` or `homesetup:///`: what Expo Router opens when it has no launch URL. */
function isRootPath(path: string): boolean {
  return /^(homesetup:\/\/)?\/*$/.test(path);
}
