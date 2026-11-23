import { timeAgo, type ActivityItem } from './activity';
import type { Actor } from './types';

/** A comment on an item or a task. The author is stamped by the database from the signed-in account. */
export interface Comment {
  id: string;
  targetType: 'item' | 'task';
  targetId: string;
  author: Actor;
  body: string;
  /** ISO time. */
  createdAt: string;
}

/** At most this many comments show per item or task: the newest. */
export const COMMENTS_SHOWN = 200;

/** The newest comments on one item or task (at most COMMENTS_SHOWN), oldest first. */
export function commentsFor(comments: readonly Comment[] | undefined, targetType: Comment['targetType'], targetId: string): Comment[] {
  return (comments ?? [])
    .filter((c) => c.targetType === targetType && c.targetId === targetId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .slice(-COMMENTS_SHOWN);
}

/**
 * Comments as activity lines, newest first, in the same words as the item history:
 * "commented: the 800 W one is enough, 2 h ago".
 */
export function commentActivity(comments: readonly Comment[] | undefined, targetType: Comment['targetType'], targetId: string, now: number): ActivityItem[] {
  return commentsFor(comments, targetType, targetId).reverse().map((c) => ({ actor: c.author, text: `commented: ${c.body}, ${timeAgo(c.createdAt, now)}`, at: c.createdAt, commentId: c.id }));
}

/** History and comments together, newest first. Lines without a time keep their place after the dated ones. */
export function mergeActivity(history: readonly ActivityItem[], comments: readonly ActivityItem[]): ActivityItem[] {
  const dated = [...history.filter((h) => h.at), ...comments].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  return [...dated, ...history.filter((h) => !h.at)];
}
