import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useStore } from '../data/store';
import { detailState, listState, type LoadState } from '../domain/sync';
import { colors } from '../theme/tokens';
import { EmptyState } from './EmptyState';

/** A quiet spinner while the first load runs. */
export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <View style={s.loading} accessible accessibilityLabel={label} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.textSecondary} />
    </View>
  );
}

/** Nothing on this phone yet and the load failed: say so and offer a retry. */
export function OfflineState({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      icon="wifi"
      title="Can’t reach the server"
      line="Nothing is saved on this phone yet. Check the connection and try again."
      action={{ label: 'Try again', onPress: onRetry, icon: null, testID: 'retry-load' }}
    />
  );
}

/** A deleted or unknown item or task: a friendly note and a way back. */
export function NotFoundState({ title, line, backLabel, onBack }: { title: string; line: string; backLabel: string; onBack: () => void }) {
  return <EmptyState icon="box" title={title} line={line} action={{ label: backLabel, onPress: onBack, icon: 'back' }} />;
}

/** The store's view of whether a list with `count` rows can be shown yet. */
export function useListState(count: number): LoadState {
  const { sync, loaded } = useStore();
  return listState(sync, loaded, count);
}

/** The store's view of a detail screen for one id that was or was not `found`. */
export function useDetailState(found: boolean): LoadState | 'missing' {
  const { sync, loaded } = useStore();
  return detailState(sync, loaded, found);
}

/** Shows `children` when the list is ready, else the loading or offline state. */
export function ListGate({ count, children }: { count: number; children: ReactNode }) {
  const state = useListState(count);
  const { retry } = useStore();
  if (state === 'loading') return <LoadingState />;
  if (state === 'offline') return <OfflineState onRetry={retry} />;
  return <>{children}</>;
}

const s = StyleSheet.create({
  loading: { paddingTop: 32, paddingBottom: 16, alignItems: 'center' },
});
