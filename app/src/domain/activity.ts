import { ITEM_STATUS_LABEL } from './items';
import type { Actor, ItemStatus } from './types';

/** One row of the database's activity log (written by trigger), as PostgREST returns it. */
export interface ActivityRow {
  actor: string;
  op: string;
  /** INSERT/DELETE: the row; UPDATE: { old, new }. */
  change: Record<string, unknown> | null;
  at: string;
}

export interface ActivityItem {
  actor: Actor;
  /** "marked it ordered, 2 h ago" (the name is shown before it). */
  text: string;
}

const asActor = (s: string): Actor => (s === 'nikita' || s === 'daryna' ? s : 'claude');

/** "just now", "5 min ago", "2 h ago", "yesterday", "21 Nov". */
export function timeAgo(at: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(at)) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  if (minutes < 48 * 60) return 'yesterday';
  return new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** What one change to an item did, in a few words, or undefined when nothing a person would notice changed. */
function itemChangeText(row: ActivityRow): string | undefined {
  if (row.op === 'INSERT') return 'added it';
  if (row.op === 'DELETE') return 'removed it';
  const old = (row.change?.old ?? {}) as Record<string, unknown>;
  const now = (row.change?.new ?? {}) as Record<string, unknown>;
  if (old.deleted_at == null && now.deleted_at != null) return 'deleted it';
  if (old.deleted_at != null && now.deleted_at == null) return 'brought it back';
  if (old.status !== now.status && typeof now.status === 'string') {
    const label = ITEM_STATUS_LABEL[now.status as ItemStatus]?.toLowerCase() ?? now.status;
    return `marked it ${label}`;
  }
  if (old.actual_price !== now.actual_price) return now.actual_price == null ? 'cleared the price paid' : `noted the price paid`;
  const watched = ['name', 'quantity', 'urgent', 'needs_install', 'room_id', 'est_price', 'assigned_to', 'bought_by', 'link', 'notes'];
  return watched.some((k) => JSON.stringify(old[k]) !== JSON.stringify(now[k])) ? 'edited it' : undefined;
}

/**
 * The item screen's short history, newest first: "Daryna marked it ordered, 2 h ago". Changes nobody
 * would notice (only a timestamp moved) are left out; at most `limit` lines.
 */
export function itemActivity(rows: readonly ActivityRow[], now: number, limit = 3): ActivityItem[] {
  const out: ActivityItem[] = [];
  for (const row of [...rows].sort((a, b) => b.at.localeCompare(a.at))) {
    const what = itemChangeText(row);
    if (!what) continue;
    out.push({ actor: asActor(row.actor), text: `${what}, ${timeAgo(row.at, now)}` });
    if (out.length >= limit) break;
  }
  return out;
}
