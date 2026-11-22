import { useEffect, useState } from 'react';
import type { ActivityRow } from '../domain/activity';
import { db } from './supabase';

/**
 * The activity log rows for one item, read from the database (members may read it; only the trigger
 * writes it). Null when there is no database (demo data), while loading, or when it cannot be read
 * (offline): the screen then falls back to the item's own "made the last change" line. `version`
 * reloads it when the item changes.
 */
export function useItemActivity(itemId: string, version: unknown): ActivityRow[] | null {
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  useEffect(() => {
    const client = db;
    if (!client) return;
    let alive = true;
    void client.from('activity').select('actor,op,change,at').eq('target_table', 'items').eq('target_id', itemId).order('at', { ascending: false }).limit(20)
      .then(({ data, error }) => { if (alive && !error && data) setRows(data as ActivityRow[]); }, () => undefined);
    return () => { alive = false; };
  }, [itemId, version]);
  return rows;
}
