import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AccountCard } from '../../components/AccountCard';
import { HomeEmpty, HomeGrid, ModeSwitch, RoomChips } from '../../components/HomeParts';
import { useListState, ListGate } from '../../components/LoadState';
import { Screen } from '../../components/Screen';
import { SectionHeading, Sub, Title } from '../../components/ui';
import { SyncPill } from '../../components/SyncPill';
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
        <View>
          <View style={s.header}>
            <Title>Home</Title>
            {empty || !ready ? null : <ModeSwitch value={mode} onChange={setMode} />}
          </View>
          {/* The sync pill sits on the count line, right of it (the switch takes the title line's right side). */}
          <View style={s.subRow}>
            <Sub style={s.subText}>{ready ? placedLabel(view.total) : ''}</Sub>
            <View style={s.pillSlot}><SyncPill compact /></View>
          </View>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 },
  // One text line high whether or not the pill shows (the pill overhangs it a little), so the list never moves.
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 18, marginTop: 6 },
  subText: { flex: 1 },
  pillSlot: { height: 18, justifyContent: 'center', alignItems: 'flex-end', flexShrink: 0 },
  groups: { gap: 14, paddingTop: 4 },
  group: { gap: 10 },
});
