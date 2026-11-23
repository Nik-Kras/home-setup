import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AccountCard } from '../../components/AccountCard';
import { HomeEmpty, HomeGrid, ModeSwitch, RoomChips } from '../../components/HomeParts';
import { useListState, ListGate } from '../../components/LoadState';
import { Screen } from '../../components/Screen';
import { SectionHeading, Sub } from '../../components/ui';
import { HeaderTitle } from '../../components/SyncPill';
import { useStore } from '../../data/store';
import { homeView, placedLabel, type HomeMode } from '../../domain/home';

/** Inventory of what is in place. */
export default function Home() {
  const { items, rooms, photos } = useStore();
  const [mode, setMode] = useState<HomeMode>('room');
  const [room, setRoom] = useState<string | undefined>();
  const view = useMemo(() => homeView(items, { mode, room, roomOrder: rooms.map((r) => r.name) }), [items, mode, room, rooms]);
  const ready = useListState(items.length) === 'ready';
  const empty = view.total === 0;

  return (
    <Screen
      header={
        // As in Home.png: title and count on the left, the Room/Owner switch centred beside both lines.
        // The sync pill sits on the title line (as on the other tabs), so the header stays two lines tall
        // and the chips and cards start right below it.
        <View style={s.header}>
          <View style={s.headerText}>
            <HeaderTitle>Home</HeaderTitle>
            <Sub>{ready ? placedLabel(view.total) : ''}</Sub>
          </View>
          {empty || !ready ? null : <ModeSwitch value={mode} onChange={setMode} />}
        </View>
      }
    >
      <ListGate count={items.length}>
        {empty ? (
          <HomeEmpty onGoToBuy={() => router.navigate('/')} />
        ) : (
          <>
            <RoomChips chips={view.chips} total={view.total} room={view.room} onChange={setRoom} />
            <View style={s.groups}>
              {view.groups.map((g) => (
                <View key={g.key} style={s.group}>
                  {g.title ? <SectionHeading meta={String(g.items.length)}>{g.title}</SectionHeading> : null}
                  <HomeGrid items={g.items} photos={photos} />
                </View>
              ))}
            </View>
          </>
        )}
      </ListGate>
      <AccountCard />
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  groups: { gap: 14, paddingTop: 4 },
  group: { gap: 10 },
});
