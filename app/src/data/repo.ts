import type { SupabaseClient } from '@supabase/supabase-js';
import type { FlatNote, Item, Person, Task, TaskStatus } from '../domain/types';
import { itemFromRow, itemToRow, newId, noteFromRow, noteToRow, taskFromRow, taskToRow, type FlatNoteRow, type ItemRow, type TaskRow } from './mappers';
import type { Op, Outcome } from './queue';

export interface Snapshot {
  rooms: { id: string; name: string }[];
  items: Item[];
  tasks: Task[];
  notes: FlatNote[];
}

/** Read everything the app shows. Deleted rows are hidden. */
export async function loadAll(db: SupabaseClient): Promise<Snapshot> {
  const [rooms, items, tasks, notes] = await Promise.all([
    db.from('rooms').select('id,name').order('sort'),
    db.from('items').select('*').is('deleted_at', null).order('added_at', { ascending: false }),
    db.from('tasks').select('*, task_assignments(person,status, task_steps(id,title,done,sort))').is('deleted_at', null).order('created_at', { ascending: false }),
    db.from('flat_notes').select('id,title,body,reference,kind,sort,updated_by').is('deleted_at', null).order('sort').order('created_at'),
  ]);
  const err = rooms.error ?? items.error ?? tasks.error;
  if (err) throw err;
  // Until migration 0005 is run the table does not exist; show no notes rather than failing the whole load.
  if (notes.error && !isMissingTable(notes.error)) throw notes.error;
  const roomNames = new Map((rooms.data ?? []).map((r) => [r.id as string, r.name as string]));
  return {
    rooms: (rooms.data ?? []) as Snapshot['rooms'],
    items: ((items.data ?? []) as ItemRow[]).map((r) => itemFromRow(r, roomNames)),
    tasks: ((tasks.data ?? []) as TaskRow[]).map(taskFromRow),
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
  saveTask(task: Task): Op[] {
    const out: Op[] = [{ id: newId(), kind: 'upsert', table: 'tasks', row: taskToRow(task) }];
    for (const a of task.assignments) {
      out.push({ id: newId(), kind: 'upsert', table: 'task_assignments', onConflict: 'task_id,person', row: { task_id: task.id, person: a.person, status: a.status } });
      a.steps.forEach((s, i) => out.push({ id: newId(), kind: 'upsert', table: 'task_steps', row: { id: s.id, task_id: task.id, person: a.person, title: s.title, done: s.done, sort: i } }));
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
  softDelete(table: 'items' | 'tasks' | 'flat_notes', id: string): Op {
    return { id: newId(), kind: 'patch', table: table, match: { id }, row: { deleted_at: new Date().toISOString() } };
  },
};

/** Run one op against Supabase and say what the queue should do next. */
export function makeExecutor(db: SupabaseClient) {
  return async (op: Op): Promise<Outcome> => {
    let error: { code?: string; message: string; status?: number } | null;
    if (op.kind === 'upsert') {
      ({ error } = await db.from(op.table).upsert(op.row, op.onConflict ? { onConflict: op.onConflict } : undefined));
    } else {
      let q = db.from(op.table).update(op.row);
      for (const [k, v] of Object.entries(op.match)) q = q.eq(k, v);
      ({ error } = await q);
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
