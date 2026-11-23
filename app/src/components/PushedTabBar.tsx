import { router } from 'expo-router';
import { Scrim } from './Scrim';
import { TabBar } from './TabBar';

const ROUTES = ['index', 'tasks', 'home', 'budget'] as const;
const PATH: Record<(typeof ROUTES)[number], '/' | '/tasks' | '/home' | '/budget'> = { index: '/', tasks: '/tasks', home: '/home', budget: '/budget' };

/**
 * The floating tab bar on a screen pushed over the tabs (Flat notes, a task group), as in FlatNotes.png
 * and TaskGroup.png: Tasks stays lit, and a tab goes back down to that tab. Leave TAB_BAR_SPACE at the
 * bottom of the screen's scroll content.
 */
export function PushedTabBar({ active = 'tasks' }: { active?: (typeof ROUTES)[number] }) {
  const state = { index: ROUTES.indexOf(active), routes: ROUTES.map((name) => ({ key: name, name })) };
  return (
    <>
      <Scrim />
      <TabBar state={state} navigateToTab={(key) => router.navigate(PATH[key as (typeof ROUTES)[number]])} />
    </>
  );
}
