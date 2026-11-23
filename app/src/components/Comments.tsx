import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../data/store';
import type { ActivityItem } from '../domain/activity';
import { commentActivity, type Comment } from '../domain/comments';
import { colors, fonts, TARGET } from '../theme/tokens';
import { ActivityLine } from './ActivityLine';
import { Icon } from './ui';

/** Re-render once a minute so "just now" turns into "1 min ago". */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * Activity lines; a comment of mine also gets a "Delete" (a soft delete the snackbar can undo).
 * Mine means written by this account: the database stamps the author, so it is `actor` (Claude for
 * the test account), not the person the test account acts as.
 */
export function ActivityLines({ lines }: { lines: readonly ActivityItem[] }) {
  const { me, actor, deleteComment } = useStore();
  const self = actor ?? me;
  return (
    <>
      {lines.map((l, i) => (
        <View key={l.commentId ?? `${i}-${l.text}`} style={s.line}>
          <View style={s.lineText}><ActivityLine actor={l.actor} text={l.text} /></View>
          {l.commentId && l.actor === self ? (
            <Pressable onPress={() => deleteComment(l.commentId!)} accessibilityRole="button" accessibilityLabel={`Delete comment: ${l.text.replace(/^commented: /, '')}`} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }} style={({ pressed }) => [s.delete, pressed && { opacity: 0.6 }]}>
              <Text style={s.deleteText}>Delete</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </>
  );
}

/** Comments on a task as activity lines, newest first: "Daryna commented: the 800 W one is enough, 2 h ago". */
export function CommentLines({ targetType, targetId }: { targetType: Comment['targetType']; targetId: string }) {
  const { comments } = useStore();
  const now = useNow();
  return <ActivityLines lines={commentActivity(comments, targetType, targetId, now)} />;
}

/**
 * The comment bar fixed at the bottom of an item or task (Item.png): "Add a comment" and a round mint
 * send button. It rides above the keyboard. `safeBottom: false` when a footer sits below it.
 * The comment goes through the offline queue.
 */
export function CommentBar({ targetType, targetId, safeBottom = true }: { targetType: Comment['targetType']; targetId: string; safeBottom?: boolean }) {
  const { addComment } = useStore();
  const { bottom } = useSafeAreaInsets();
  const [text, setText] = useState('');
  // With the keyboard up the bar sits on it, so the home-indicator gap is not needed.
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const ready = text.trim().length > 0;
  const send = () => {
    if (!ready) return;
    addComment(targetType, targetId, text);
    setText('');
  };
  return (
    <KeyboardAvoidingView behavior="position">
      <View style={[s.bar, { paddingBottom: (safeBottom && !keyboard ? bottom : 0) + 12 }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={send}
          submitBehavior="blurAndSubmit"
          returnKeyType="send"
          placeholder="Add a comment"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Comment"
          style={s.input}
        />
        <Pressable onPress={send} disabled={!ready} accessibilityRole="button" accessibilityLabel="Send comment" accessibilityState={{ disabled: !ready }} style={({ pressed }) => [s.send, !ready && s.idle, pressed && { opacity: 0.75 }]}>
          <Icon name="arrowRight" size={20} color={colors.onMint} stroke={2.2} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lineText: { flex: 1 },
  delete: { minHeight: 20, paddingHorizontal: 4, justifyContent: 'center' },
  deleteText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, paddingHorizontal: 16, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.hairline },
  input: { flex: 1, minWidth: 0, height: TARGET, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)', backgroundColor: colors.surface, paddingHorizontal: 16, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  send: { width: TARGET, height: TARGET, borderRadius: 22, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  idle: { opacity: 0.5 },
});
