import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { HomeEmpty, HomeGrid, ModeSwitch, RoomChips } from '../../components/HomeParts';
import { Screen } from '../../components/Screen';
import { SectionHeading, Sub, Title } from '../../components/ui';
import { useStore } from '../../data/store';
import { homeView, placedLabel, type HomeMode } from '../../domain/home';

/** Inventory of what is in place. */
export default function Home() {
  const { items, rooms, photos } = useStore();
  const [mode, setMode] = useState<HomeMode>('room');
  const [room, setRoom] = useState<string | undefined>();
  const view = homeView(items, { mode, room, roomOrder: rooms.map((r) => r.name) });
  const empty = view.total === 0;

  return (
    <Screen
      header={
        <View style={s.header}>
          <View style={s.titleText}>
            <Title>Home</Title>
            <Sub>{placedLabel(view.total)}</Sub>
          </View>
          {empty ? null : <ModeSwitch value={mode} onChange={setMode} />}
        </View>
      }
    >
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
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  titleText: { flexShrink: 1 },
  groups: { gap: 14, paddingTop: 4 },
  group: { gap: 10 },
});
