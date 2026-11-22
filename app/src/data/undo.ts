import { formatMoney, ITEM_STATUS_LABEL } from '../domain/items';
import type { Item, Person, Task, TaskStatus } from '../domain/types';
import { itemToRow } from './mappers';
import type { Op } from './queue';
import { ITEM_FIELDS, type Action, type State } from './reducer';
import { ops } from './repo';

/**
 * One reusable Undo for every edit a person makes (status, ticks, assignment, prices, fields, delete).
 *
 * An entry keeps the edited thing as it was before and right after the edit. Undo puts back only
 * the fields that still hold the value this edit set, both on screen and in the database:
 * - On screen, a field the other phone has changed since (it arrived by realtime) is left alone.
 * - In the database each field goes back through a conditional patch that matches the value this
 *   edit set, so if the other person changed it in the meantime (even while this phone was offline),
 *   the patch changes nothing and their newer value stays. The next refresh shows it.
 * The rule in one line: Undo never overwrites someone else's newer change.
 */

type ItemChange = { kind: 'item'; before: Item; after: Item | null; index: number };
type TaskChange = { kind: 'task'; before: Task; after: Task };
/** A new item: Undo soft-deletes it (or takes its insert back from the queue if it was never sent). */
type AddedChange = { kind: 'added'; item: Item };

export interface UndoEntry {
  id: string;
  /** On the snackbar, such as "Kettle → Ordered". */
  message: string;
  /** Read out by screen readers, such as "Kettle moved to Ordered". */
  spoken: string;
  /** When the edit was made, in ms. */
  at: number;
  change: ItemChange | TaskChange | AddedChange;
  /** The queue Ops the edit sent. If none has gone out yet (offline), Undo takes them back instead. */
  opIds?: readonly string[];
}

/** What the snackbar shows. `canUndo` is false for a plain notice such as "Undone". */
export interface Snack {
  key: string;
  message: string;
  spoken: string;
  canUndo: boolean;
  /** An item the snackbar's "Change" button opens (after adding one). */
  changeItemId?: string;
}

export type UndoOutcome = 'done' | 'partial' | 'none';

export const UNDO_LIMIT = 10;

const TASK_LABEL: Record<TaskStatus, string> = { todo: 'To do', in_progress: 'In progress', waiting: 'Waiting', done: 'Done' };
const PERSON: Record<Person, string> = { nikita: 'Nikita', daryna: 'Daryna' };

/** The item columns each editable field is stored in. Status and its dates go together, see below. */
const COLUMN: Record<(typeof ITEM_FIELDS)[number], string> = {
  name: 'name', quantity: 'quantity', urgent: 'urgent', needsInstall: 'needs_install', room: 'room_id',
  estPrice: 'est_price', actualPrice: 'actual_price', assignedTo: 'assigned_to', boughtBy: 'bought_by', link: 'link', notes: 'notes',
};

/** "Kettle → paid £25" and friends. Undefined when nothing a person would recognise changed. */
export function describeItemChange(before: Item, after: Item | null): { message: string; spoken: string } | undefined {
  const name = before.name;
  if (!after) return { message: `${name} deleted`, spoken: `${name} deleted` };
  if (before.status !== after.status) {
    const label = ITEM_STATUS_LABEL[after.status];
    return { message: `${name} → ${label}`, spoken: `${name} moved to ${label}` };
  }
  const changed = ITEM_FIELDS.filter((f) => before[f] !== after[f]);
  if (changed.length === 0) return undefined;
  // The "Paid?" prompt saves the price and who paid together.
  const paidBy = changed.length === 2 && changed[0] === 'actualPrice' && changed[1] === 'boughtBy' && after.actualPrice !== undefined && after.boughtBy;
  const what = paidBy ? `paid ${formatMoney(after.actualPrice!)} by ${PERSON[after.boughtBy!]}` : changed.length > 1 ? 'updated' : fieldText(changed[0]!, after);
  const message = changed[0] === 'name' && changed.length === 1 ? `Renamed to ${after.name}` : `${name} → ${what}`;
  return { message, spoken: message.replace(' → ', ', ') };
}

function fieldText(field: (typeof ITEM_FIELDS)[number], after: Item): string {
  const person = (p?: Person) => (p ? PERSON[p] : 'nobody');
  switch (field) {
    case 'name': return `renamed to ${after.name}`;
    case 'quantity': return `quantity ${after.quantity}`;
    case 'urgent': return after.urgent ? 'urgent' : 'not urgent';
    case 'needsInstall': return after.needsInstall ? 'needs installing' : 'no installing needed';
    case 'room': return after.room ?? 'no room';
    case 'estPrice': return after.estPrice !== undefined ? `estimate ${formatMoney(after.estPrice)}` : 'estimate cleared';
    case 'actualPrice': return after.actualPrice !== undefined ? `paid ${formatMoney(after.actualPrice)}` : 'paid price cleared';
    case 'assignedTo': return `assigned to ${person(after.assignedTo)}`;
    case 'boughtBy': return `bought by ${person(after.boughtBy)}`;
    case 'link': return after.link ? 'link saved' : 'link removed';
    case 'notes': return after.notes ? 'notes saved' : 'notes cleared';
  }
}

/** "Marked done: Register with a GP", "Step ticked: Pick a practice". */
export function describeTaskChange(before: Task, after: Task): { message: string; spoken: string } | undefined {
  for (const a of after.assignments) {
    const was = before.assignments.find((x) => x.person === a.person);
    if (!was) continue;
    if (was.status !== a.status) {
      const message = a.status === 'done' ? `Marked done: ${after.title}`
        : was.status === 'done' && a.status === 'todo' ? `Marked not done: ${after.title}`
          : `${after.title} → ${TASK_LABEL[a.status]}`;
      return { message, spoken: message.replace(' → ', ', ') };
    }
    for (const step of a.steps) {
      const prev = was.steps.find((s) => s.id === step.id);
      if (prev && prev.done !== step.done) {
        const message = `${step.done ? 'Step ticked' : 'Step unticked'}: ${step.title}`;
        return { message, spoken: message };
      }
    }
  }
  return undefined;
}

/** The Undo entry for an edit, or undefined when the action is not undoable (adding things) or changed nothing. */
export function undoEntryFor(prev: State, next: State, action: Action, at: number, id: string): UndoEntry | undefined {
  if (prev === next) return undefined;
  switch (action.type) {
    case 'advanceItem':
    case 'setItemStatus':
    case 'updateItem':
    case 'deleteItem': {
      const index = prev.items.findIndex((i) => i.id === action.id);
      const before = prev.items[index];
      if (!before) return undefined;
      const after = next.items.find((i) => i.id === action.id) ?? null;
      if (after === before) return undefined;
      const text = describeItemChange(before, after);
      return text && { id, at, ...text, change: { kind: 'item', before, after, index } };
    }
    case 'setTaskStatus':
    case 'toggleStep': {
      const before = prev.tasks.find((t) => t.id === action.id);
      const after = next.tasks.find((t) => t.id === action.id);
      if (!before || !after || before === after) return undefined;
      const text = describeTaskChange(before, after);
      return text && { id, at, ...text, change: { kind: 'task', before, after } };
    }
    case 'addItem': {
      const known = new Set(prev.items.map((i) => i.id));
      const item = next.items.find((i) => !known.has(i.id));
      if (!item) return undefined;
      const where = item.room ? `Added to ${item.room}` : 'Added, no room';
      return { id, at, message: where, spoken: `${item.name} ${where.replace('Added', 'added')}`, change: { kind: 'added', item } };
    }
    default:
      return undefined;
  }
}

/**
 * Undo one entry against the current state. Returns the new state, the ops to queue and whether it
 * was fully undone, partly undone (some fields were changed since by someone else and stay), or not
 * at all. A field counts as "changed since" when its current value differs from the value this edit
 * set. The database ops carry the same condition, see the comment at the top.
 */
export function applyUndo(current: State, entry: UndoEntry, roomIds: ReadonlyMap<string, string>): { state: State; ops: Op[]; outcome: UndoOutcome } {
  const me = current.me;
  const out: Op[] = [];
  let reverted = 0;
  let skipped = 0;
  const change = entry.change;

  if (change.kind === 'added') {
    // Deleted on the other phone since: nothing left to take back.
    if (!current.items.some((i) => i.id === change.item.id)) return { state: current, ops: [], outcome: 'none' };
    return { state: { ...current, items: current.items.filter((i) => i.id !== change.item.id) }, ops: [ops.softDelete('items', change.item.id)], outcome: 'done' };
  }

  if (change.kind === 'item') {
    const { before, after, index } = change;
    const cur = current.items.find((i) => i.id === before.id);
    if (!after) {
      // Undo a delete: show it again where it was and clear deleted_at.
      if (cur) return { state: current, ops: [], outcome: 'done' };
      const items = [...current.items];
      items.splice(Math.min(index, items.length), 0, { ...before, updatedBy: me });
      return { state: { ...current, items }, ops: [ops.restore('items', before.id)], outcome: 'done' };
    }
    // Deleted on the other phone since: nothing to put back.
    if (!cur) return { state: current, ops: [], outcome: 'none' };
    const patch: Partial<Item> = {};
    if (before.status !== after.status) {
      if (cur.status === after.status) {
        Object.assign(patch, { status: before.status, deliveredAt: before.deliveredAt, installedAt: before.installedAt });
        out.push(ops.patchIf('items', { id: before.id, status: after.status }, { status: before.status, delivered_at: before.deliveredAt ?? null, installed_at: before.installedAt ?? null }));
        reverted++;
      } else skipped++;
    }
    const was = itemToRow(before, roomIds);
    const now = itemToRow(after, roomIds);
    for (const field of ITEM_FIELDS) {
      if (before[field] === after[field]) continue;
      if (cur[field] !== after[field]) {
        skipped++;
        continue;
      }
      Object.assign(patch, { [field]: before[field] });
      reverted++;
      // A room with no known id was never sent (see itemChangedColumns), so the server needs nothing.
      if (field === 'room' && [before.room, after.room].some((r) => r !== undefined && !roomIds.has(r))) continue;
      const col = COLUMN[field];
      out.push(ops.patchIf('items', { id: before.id, [col]: now[col] as string | number | boolean | null }, { [col]: was[col] }));
    }
    if (reverted === 0) return { state: current, ops: [], outcome: 'none' };
    const items = current.items.map((i) => (i === cur ? { ...cur, ...patch, updatedBy: me } : i));
    return { state: { ...current, items }, ops: out, outcome: skipped > 0 ? 'partial' : 'done' };
  }

  const { before, after } = change;
  const cur = current.tasks.find((t) => t.id === before.id);
  if (!cur) return { state: current, ops: [], outcome: 'none' };
  const assignments = cur.assignments.map((curA) => {
    const was = before.assignments.find((a) => a.person === curA.person);
    const set = after.assignments.find((a) => a.person === curA.person);
    if (!was || !set) return curA;
    let next = curA;
    if (was.status !== set.status) {
      if (curA.status === set.status) {
        next = { ...next, status: was.status };
        out.push(ops.patchIf('task_assignments', { task_id: before.id, person: curA.person, status: set.status }, { status: was.status }));
        reverted++;
      } else skipped++;
    }
    for (const step of set.steps) {
      const prevStep = was.steps.find((s) => s.id === step.id);
      if (!prevStep || prevStep.done === step.done) continue;
      const curStep = curA.steps.find((s) => s.id === step.id);
      if (curStep?.done !== step.done) {
        skipped++;
        continue;
      }
      next = { ...next, steps: next.steps.map((s) => (s.id === step.id ? { ...s, done: prevStep.done } : s)) };
      out.push(ops.patchIf('task_steps', { id: step.id, done: step.done }, { done: prevStep.done }));
      reverted++;
    }
    return next;
  });
  if (reverted === 0) return { state: current, ops: [], outcome: 'none' };
  const tasks = current.tasks.map((t) => (t === cur ? { ...cur, assignments, updatedBy: me } : t));
  return { state: { ...current, tasks }, ops: out, outcome: skipped > 0 ? 'partial' : 'done' };
}

/* ---------- The stack ---------- */

/** Newest last; the oldest falls off past UNDO_LIMIT. */
export function pushUndo(stack: readonly UndoEntry[], entry: UndoEntry): UndoEntry[] {
  return [...stack, entry].slice(-UNDO_LIMIT);
}

export function popUndo(stack: readonly UndoEntry[]): { entry?: UndoEntry; rest: UndoEntry[] } {
  return { entry: stack[stack.length - 1], rest: stack.slice(0, -1) };
}

/** The snackbar right after an edit. */
export function offerSnack(entry: UndoEntry): Snack {
  const changeItemId = entry.change.kind === 'added' ? entry.change.item.id : undefined;
  return { key: entry.id, message: entry.message, spoken: `${entry.spoken}. Undo available.`, canUndo: true, ...(changeItemId ? { changeItemId } : {}) };
}

/**
 * The snackbar after an Undo: says how it went and offers nothing more, so a double tap on Undo can
 * never undo a second edit. Undoing an earlier edit needs a fresh edit to offer it.
 */
export function afterUndoSnack(outcome: UndoOutcome, key: string): Snack {
  const message = outcome === 'done' ? 'Undone' : outcome === 'partial' ? 'Partly undone: some of it was changed since' : 'Not undone: it was changed since';
  return { key, message, spoken: `${message}.`, canUndo: false };
}
