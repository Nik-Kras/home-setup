import { useEffect, useState } from 'react';
import type { ActivityRow } from '../domain/activity';
import { db } from './supabase';

/** A second read after an edit, in case the queue had not sent it yet when the first read ran. */
const SETTLE_MS = 2_000;

/**
 * The activity log rows for one item, read from the database (members may read it; only the trigger
 * writes it). Null when there is no database (demo data), while loading, or when it cannot be read
 * (offline): the screen then falls back to the item's own "made the last change" line.
 * It reads again when the item changes (`version`), once the offline queue is empty again (`settled`,
 * so the line written by my own edit is there) and once more shortly after, so it never lags one
 * change behind ("marked it looking" after Mark ordered).
 */
export function useItemActivity(itemId: string, version: unknown, settled: boolean): ActivityRow[] | null {
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  useEffect(() => {
    const client = db;
    if (!client || !settled) return;
    let alive = true;
    const load = () => void client.from('activity').select('actor,op,change,at').eq('target_table', 'items').eq('target_id', itemId).order('at', { ascending: false }).limit(20)
      .then(({ data, error }) => { if (alive && !error && data) setRows(data as ActivityRow[]); }, () => undefined);
    load();
    const timer = setTimeout(load, SETTLE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [itemId, version, settled]);
  return rows;
}
