import { StyleSheet, Text, View } from 'react-native';
import { actorName } from '../domain/items';
import type { Actor } from '../domain/types';
import { colors, fonts, personColor } from '../theme/tokens';

/** Mint for Nikita, lilac for Daryna, neutral for Claude or when nobody is named. */
const dotColor = (actor?: Actor) => (actor && actor !== 'claude' ? personColor[actor] : colors.textMuted);

/**
 * One activity line: a dot and a sentence. With an actor the name comes first in bold
 * ("Nikita made the last change"); without one the text stands alone ("Added 20 Nov").
 */
export function ActivityLine({ actor, text }: { actor?: Actor; text: string }) {
  return (
    <View style={s.row}>
      <View style={[s.dot, { backgroundColor: dotColor(actor) }]} />
      <Text style={s.text}>
        {actor ? <Text style={s.name}>{actorName(actor)} </Text> : null}
        {text}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  text: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  name: { fontFamily: fonts.semibold, color: colors.text },
});
