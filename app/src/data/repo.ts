import type { SupabaseClient } from '@supabase/supabase-js';
import type { StageStep } from '../domain/items';
import type { ItemPhoto } from '../domain/photos';
import type { FlatNote, Item, ItemStatus, Person, Task, TaskStatus, TaskStep } from '../domain/types';
import { itemFromRow, itemToRow, newId, noteFromRow, noteToRow, taskFromRow, taskToRow, type FlatNoteRow, type ItemRow, type TaskRow } from './mappers';
import type { Op, Outcome } from './queue';

export interface Snapshot {
  rooms: { id: string; name: string }[];
  items: Item[];
  tasks: Task[];
  notes: FlatNote[];
  photos: ItemPhoto[];
}

/** Read everything the app shows. Deleted rows are hidden. */
export async function loadAll(db: SupabaseClient): Promise<Snapshot> {
  const [rooms, items, tasks, notes] = await Promise.all([
    db.from('rooms').select('id,name').order('sort'),
    db.from('items').select('*, item_photos(id,path,created_at)').is('deleted_at', null).order('added_at', { ascending: false }),
    db.from('tasks').select('*, task_assignments(person,status,updated_by,updated_at, task_steps(id,title,done,sort))').is('deleted_at', null).order('created_at', { ascending: false }),
    db.from('flat_notes').select('id,title,body,reference,kind,sort,updated_by').is('deleted_at', null).order('sort').order('created_at'),
  ]);
  const err = rooms.error ?? items.error ?? tasks.error;
  if (err) throw err;
  // Until migration 0005 is run the table does not exist; show no notes rather than failing the whole load.
  if (notes.error && !isMissingTable(notes.error)) throw notes.error;
  const roomNames = new Map((rooms.data ?? []).map((r) => [r.id as string, r.name as string]));
  const itemRows = (items.data ?? []) as (ItemRow & { item_photos?: { id: string; path: string; created_at: string }[] })[];
  return {
    rooms: (rooms.data ?? []) as Snapshot['rooms'],
    items: itemRows.map((r) => itemFromRow(r, roomNames)),
    tasks: ((tasks.data ?? []) as TaskRow[]).map(taskFromRow),
    photos: itemRows.flatMap((item) => (item.item_photos ?? []).map((row) => ({ id: row.id, itemId: item.id, path: row.path, createdAt: row.created_at }))),
    notes: notes.error ? [] : ((notes.data ?? []) as FlatNoteRow[]).map(noteFromRow),
  };
}

/** PostgREST says PGRST205 (Postgres 42P01) when a table is not in the schema yet. */
export function isMissingTable(error: { code?: string }): boolean {
  return error.code === 'PGRST205' || error.code === '42P01';
}

/** Ops for the offline queue. Each is idempotent, so a retry after a dropped connection is safe. */
export const ops = {
  saveItem(item: Item, roomIds: ReadonlyMap<string, string>): Op {
    return { id: newId(), kind: 'upsert', table: 'items', row: itemToRow(item, roomIds) };
  },
  /** Only the changed item columns, so a stale device cannot undo another person's edit to a different field. */
  patchItem(itemId: string, row: Record<string, unknown>): Op {
    return { id: newId(), kind: 'patch', table: 'items', match: { id: itemId }, row };
  },
  /**
   * Widget tap: one stage on (see nextStage), with the date that stage stamps. Matches only while the
   * row still has the status the widget showed, so a stale tap changes nothing if the item moved since.
   */
  advanceIf(itemId: string, seen: ItemStatus, step: StageStep): Op {
    const row: Record<string, unknown> = { status: step.status };
    if (step.deliveredAt) row.delivered_at = step.deliveredAt;
    if (step.installedAt) row.installed_at = step.installedAt;
    return { id: newId(), kind: 'patch', table: 'items', match: { id: itemId, status: seen }, row };
  },
  /**
   * A new task. Insert-only (ignoreDuplicates): if the first send succeeded but its reply was lost, the retry
   * must not reset a title edit or a part the other person has ticked since.
   */
  saveTask(task: Task): Op[] {
    const out: Op[] = [{ id: newId(), kind: 'upsert', table: 'tasks', ignoreDuplicates: true, row: taskToRow(task) }];
    for (const a of task.assignments) {
      out.push({ id: newId(), kind: 'upsert', table: 'task_assignments', onConflict: 'task_id,person', ignoreDuplicates: true, row: { task_id: task.id, person: a.person, status: a.status } });
      a.steps.forEach((s, i) => out.push(saveStep(task.id, a.person, s, i, true)));
    }
    return out;
  },
  /** Only the changed task columns. Never touches assignments. */
  patchTask(taskId: string, row: Record<string, unknown>): Op {
    return { id: newId(), kind: 'patch', table: 'tasks', match: { id: taskId }, row };
  },
  setAssignment(taskId: string, person: Person, status: TaskStatus): Op {
    return { id: newId(), kind: 'patch', table: 'task_assignments', match: { task_id: taskId, person }, row: { status } };
  },
  saveStep,
  toggleStep(stepId: string, done: boolean): Op {
    return { id: newId(), kind: 'patch', table: 'task_steps', match: { id: stepId }, row: { done } };
  },
  saveNote(note: FlatNote): Op {
    return { id: newId(), kind: 'upsert', table: 'flat_notes', row: noteToRow(note) };
  },
  /** Only the changed note columns, so two people editing different fields of a note do not clash. */
  patchNote(noteId: string, row: Record<string, unknown>): Op {
    return { id: newId(), kind: 'patch', table: 'flat_notes', match: { id: noteId }, row };
  },
  /**
   * Conditional patch, for Undo: changes the row only while every `match` column still has the value
   * this device set. If the other person has changed it since, their newer value stays.
   */
  patchIf(table: 'items' | 'task_assignments' | 'task_steps', match: Record<string, string | number | boolean | null>, row: Record<string, unknown>): Op {
    return { id: newId(), kind: 'patch', table, match, row, reportMiss: true };
  },
  /** Undo of a soft delete. */
  restore(table: 'items' | 'tasks' | 'flat_notes', id: string): Op {
    return { id: newId(), kind: 'patch', table, match: { id }, row: { deleted_at: null } };
  },
  softDelete(table: 'items' | 'tasks' | 'flat_notes', id: string): Op {
    return { id: newId(), kind: 'patch', table: table, match: { id }, row: { deleted_at: new Date().toISOString() } };
  },
};

function saveStep(taskId: string, person: Person, step: TaskStep, index: number, ignoreDuplicates = false): Op {
  return { id: newId(), kind: 'upsert', table: 'task_steps', ...(ignoreDuplicates ? { ignoreDuplicates: true } : {}), row: { id: step.id, task_id: taskId, person, title: step.title, done: step.done, sort: step.sort ?? index } };
}

/** Run one op against Supabase and say what the queue should do next. */
export function makeExecutor(db: SupabaseClient) {
  return async (op: Op): Promise<Outcome> => {
    let error: { code?: string; message: string; status?: number } | null;
    if (op.kind === 'upsert') {
      const opts = { ...(op.onConflict ? { onConflict: op.onConflict } : {}), ...(op.ignoreDuplicates ? { ignoreDuplicates: true } : {}) };
      ({ error } = await db.from(op.table).upsert(op.row, Object.keys(opts).length ? opts : undefined));
    } else {
      // A conditional patch asks for the row count, to tell "kept the other person's value" apart.
      let q = op.reportMiss ? db.from(op.table).update(op.row, { count: 'exact' }) : db.from(op.table).update(op.row);
      for (const [k, v] of Object.entries(op.match)) q = v === null ? q.is(k, null) : q.eq(k, v);
      let count: number | null | undefined;
      ({ error, count } = await q);
      if (!error && op.reportMiss && count === 0) return 'missed';
    }
    if (!error) return 'ok';
    // Network trouble has no Postgres code; 5xx and auth expiry are worth retrying. Anything else is a refusal.
    const status = error.status ?? 0;
    if (!error.code || status >= 500 || status === 401 || status === 408 || status === 429) return 'retry';
    // A table not created yet (migration pending): keep the op queued instead of losing the write.
    if (isMissingTable(error)) return 'retry';
    return 'drop';
  };
}

/** Call onChange whenever another device changes items, tasks, assignments or flat notes. Returns an unsubscribe. */
export function subscribe(db: SupabaseClient, onChange: () => void): () => void {
  const channel = db
    .channel('household')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignments' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'task_steps' }, onChange)
    .subscribe();
  // Own channel, so realtime for the other tables keeps working if migration 0005 has not been run yet.
  const notes = db.channel('household-notes').on('postgres_changes', { event: '*', schema: 'public', table: 'flat_notes' }, onChange).subscribe();
  return () => {
    void db.removeChannel(channel);
    void db.removeChannel(notes);
  };
}
