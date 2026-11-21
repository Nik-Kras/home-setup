import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme/tokens';
import { Icon, type IconName } from './ui';

const TABS: { route: string; label: string; icon: IconName }[] = [
  { route: 'index', label: 'Buy', icon: 'buy' },
  { route: 'tasks', label: 'Tasks', icon: 'tasks' },
  { route: 'home', label: 'Home', icon: 'home' },
  { route: 'budget', label: 'Budget', icon: 'budget' },
];

/** Floating pill tab bar. The active tab shows its label; the others are icon-only. */
export function TabBar({ state, navigateToTab }: { state: { index: number; routes: { key: string; name: string }[] }; navigateToTab: (routeKey: string) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.wrap, { bottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View style={s.bar} accessibilityRole="tablist">
        {state.routes.map((route, i) => {
          const tab = TABS.find((t) => t.route === route.name);
          if (!tab) return null;
          const on = state.index === i;
          return (
            <Pressable key={route.key} onPress={() => navigateToTab(route.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={tab.label} style={[s.tab, on && s.tabOn]}>
              <Icon name={tab.icon} size={22} color={on ? colors.mint : colors.textSecondary} stroke={on ? 2 : 1.8} />
              {on ? <Text style={s.label}>{tab.label}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Space the screens must leave at the bottom so content never sits under the bar. */
export const TAB_BAR_SPACE = 96;

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
  bar: { height: 64, flexDirection: 'row', alignItems: 'center', padding: 8, gap: 4, borderRadius: 32, backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', elevation: 8, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  tab: { flex: 1, height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  tabOn: { flex: 2.4, backgroundColor: colors.mintFill },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.mint },
});
