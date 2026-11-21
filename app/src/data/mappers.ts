import type { Assignment, Item, Person, Task, TaskStatus } from '../domain/types';

/** Row shapes as PostgREST returns them. Only the columns the app reads. */
export interface ItemRow {
  id: string; name: string; status: Item['status']; quantity: number; urgent: boolean; needs_install: boolean;
  room_id: string | null; est_price: number | null; actual_price: number | null;
  assigned_to: Person | null; bought_by: Person | null; link: string | null; notes: string | null;
  added_at: string; delivered_at: string | null; installed_at: string | null; updated_by: string;
}
export interface TaskRow {
  id: string; title: string; grp: string | null; due: string | null; urgent: boolean;
  reference: string | null; notes: string | null; updated_by: string;
  /** Steps hang off each person's assignment, not off the task. */
  task_assignments: { person: Person; status: TaskStatus; task_steps: { id: string; title: string; done: boolean; sort: number }[] }[];
}

const opt = <T>(v: T | null): T | undefined => (v === null ? undefined : v);
const asActor = (s: string): Item['updatedBy'] => (s === 'nikita' || s === 'daryna' || s === 'claude' ? s : 'claude');

export function itemFromRow(r: ItemRow, roomNames: ReadonlyMap<string, string>): Item {
  return {
    id: r.id, name: r.name, status: r.status, quantity: r.quantity, urgent: r.urgent, needsInstall: r.needs_install,
    room: r.room_id ? roomNames.get(r.room_id) : undefined,
    estPrice: opt(r.est_price), actualPrice: opt(r.actual_price),
    assignedTo: opt(r.assigned_to), boughtBy: opt(r.bought_by), link: opt(r.link), notes: opt(r.notes),
    addedAt: r.added_at, deliveredAt: opt(r.delivered_at), installedAt: opt(r.installed_at),
    updatedBy: asActor(r.updated_by),
  };
}

/** Domain item to a row for upsert. The server stamps updated_by, so it is never sent. */
export function itemToRow(i: Item, roomIds: ReadonlyMap<string, string>): Record<string, unknown> {
  return {
    id: i.id, name: i.name, status: i.status, quantity: i.quantity, urgent: i.urgent, needs_install: i.needsInstall,
    room_id: i.room ? roomIds.get(i.room) ?? null : null,
    est_price: i.estPrice ?? null, actual_price: i.actualPrice ?? null,
    assigned_to: i.assignedTo ?? null, bought_by: i.boughtBy ?? null, link: i.link ?? null, notes: i.notes ?? null,
    added_at: i.addedAt, delivered_at: i.deliveredAt ?? null, installed_at: i.installedAt ?? null,
  };
}

/**
 * Only the item columns that differ between two versions of the same item, for a field-level patch.
 * id never changes and updated_by is never sent. Empty when nothing would change in the database.
 */
export function itemChangedColumns(before: Item, after: Item, roomIds: ReadonlyMap<string, string>): Record<string, unknown> {
  const was = itemToRow(before, roomIds);
  const now = itemToRow(after, roomIds);
  const out: Record<string, unknown> = {};
  for (const col of Object.keys(now)) if (col !== 'id' && now[col] !== was[col]) out[col] = now[col];
  return out;
}

export function taskFromRow(r: TaskRow): Task {
  const assignments: Assignment[] = r.task_assignments.map((a) => ({
    person: a.person,
    status: a.status,
    steps: [...a.task_steps].sort((x, y) => x.sort - y.sort).map((s) => ({ id: s.id, title: s.title, done: s.done })),
  }));
  return {
    id: r.id, title: r.title, group: opt(r.grp), due: opt(r.due), urgent: r.urgent,
    reference: opt(r.reference), notes: opt(r.notes), assignments, updatedBy: asActor(r.updated_by),
  };
}

export function taskToRow(t: Task): Record<string, unknown> {
  return { id: t.id, title: t.title, grp: t.group ?? null, due: t.due ?? null, urgent: t.urgent, reference: t.reference ?? null, notes: t.notes ?? null };
}

/** v4-style id made on the device, so an offline-created row keeps the same id once it syncs. */
export function newId(): string {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(Math.random() * 4)]}${hex(3)}-${hex(12)}`;
}
