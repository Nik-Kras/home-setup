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

/** Comments on one item or task, oldest first, so the newest sits just above the comment bar. */
export function commentsFor(comments: readonly Comment[] | undefined, targetType: Comment['targetType'], targetId: string): Comment[] {
  return (comments ?? [])
    .filter((c) => c.targetType === targetType && c.targetId === targetId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", then "21 Nov". */
export function relativeTime(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const ago = Math.max(0, now - t);
  if (ago < MIN) return 'just now';
  if (ago < HOUR) return `${Math.floor(ago / MIN)} min ago`;
  if (ago < DAY) return `${Math.floor(ago / HOUR)} h ago`;
  const days = Math.floor(ago / DAY);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
