import { formatMoney, ITEM_STATUS_LABEL } from '../domain/items';
import { dayMonth } from '../domain/taskOptions';
import type { FlatNote, Item, Person, Task, TaskStatus } from '../domain/types';
import { itemToRow, taskToRow } from './mappers';
import type { Op } from './queue';
import { ITEM_FIELDS, TASK_FIELDS, type Action, type State } from './reducer';
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
/** after null: the task was deleted. index: where it was, to put it back there. */
type TaskChange = { kind: 'task'; before: Task; after: Task | null; index: number };
/** Notes offer Undo for a delete only. */
type NoteChange = { kind: 'note'; before: FlatNote; after: null; index: number };
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
  change: ItemChange | TaskChange | NoteChange | AddedChange;
  /** The queue Ops the edit sent. If none has gone out yet (offline), Undo takes them back instead. */
  opIds?: readonly string[];
}

/** What the snackbar shows. `canUndo` is false for a plain notice such as "Undone". */
export interface Snack {
  key: string;
  message: string;
  spoken: string;
  canUndo: boolean;
  /** How long it stays, in ms (a screen reader gets longer, see UndoBar). */
  ms: number;
  /** An item the snackbar's "Change" button opens (after adding one). */
  changeItemId?: string;
}

/** A status or field change: 6 s. A delete: 10 s, as losing a thing by mistake costs more. */
export const SNACK_MS = 6_000;
export const DELETE_SNACK_MS = 10_000;

const isDelete = (entry: UndoEntry) => entry.change.kind !== 'added' && entry.change.after === null;

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

const TASK_FIELD_TEXT: Record<(typeof TASK_FIELDS)[number], (t: Task) => string> = {
  title: (t) => `renamed to ${t.title}`,
  due: (t) => (t.due ? `due ${dayMonth(t.due)}` : 'no date'),
  urgent: (t) => (t.urgent ? 'urgent' : 'not urgent'),
  notes: (t) => (t.notes ? 'notes saved' : 'notes cleared'),
  reference: (t) => (t.reference ? 'reference saved' : 'reference cleared'),
  group: (t) => (t.group ? `moved to ${t.group}` : 'no group'),
};

/** "for you", "for Daryna", "for both of you", from the viewer `me`. */
function forWhom(task: Task, me: Person): string {
  if (task.assignments.length > 1) return 'for both of you';
  const p = task.assignments[0]?.person;
  return p === me ? 'for you' : p ? `for ${PERSON[p]}` : 'for nobody';
}

/** "Marked done: Register with a GP", "Step ticked: Pick a practice", "Register with a GP → due 26 Nov". */
export function describeTaskChange(before: Task, after: Task | null, me: Person = 'nikita'): { message: string; spoken: string } | undefined {
  if (!after) return { message: `${before.title} deleted`, spoken: `${before.title} deleted` };
  const fields = TASK_FIELDS.filter((f) => before[f] !== after[f]);
  const people = (t: Task) => t.assignments.map((a) => a.person).sort().join(',');
  const whoChanged = people(before) !== people(after);
  if (fields.length > 0 || whoChanged) {
    const message = fields.length === 1 && fields[0] === 'title' && !whoChanged ? `Renamed to ${after.title}`
      : `${before.title} → ${fields.length + (whoChanged ? 1 : 0) > 1 ? 'updated' : whoChanged ? forWhom(after, me) : TASK_FIELD_TEXT[fields[0]!](after)}`;
    return { message, spoken: message.replace(' → ', ', ') };
  }
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
    case 'toggleStep':
    case 'updateTask':
    case 'deleteTask': {
      const index = prev.tasks.findIndex((t) => t.id === action.id);
      const before = prev.tasks[index];
      if (!before) return undefined;
      const after = next.tasks.find((t) => t.id === action.id) ?? null;
      if (after === before) return undefined;
      const text = describeTaskChange(before, after, prev.me);
      return text && { id, at, ...text, change: { kind: 'task', before, after, index } };
    }
    case 'deleteNote': {
      const index = prev.notes.findIndex((n) => n.id === action.id);
      const before = prev.notes[index];
      if (!before || next.notes.some((n) => n.id === action.id)) return undefined;
      return { id, at, message: `${before.title} deleted`, spoken: `Note ${before.title} deleted`, change: { kind: 'note', before, after: null, index } };
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

  if (change.kind === 'note') {
    // Undo a note delete: show it again where it was and clear deleted_at.
    const { before, index } = change;
    if (current.notes.some((n) => n.id === before.id)) return { state: current, ops: [], outcome: 'done' };
    const notes = [...current.notes];
    notes.splice(Math.min(index, notes.length), 0, { ...before, updatedBy: me });
    return { state: { ...current, notes }, ops: [ops.restore('flat_notes', before.id)], outcome: 'done' };
  }

  const { before, after, index } = change;
  const cur = current.tasks.find((t) => t.id === before.id);
  if (!after) {
    // Undo a task delete: show it again where it was and clear deleted_at.
    if (cur) return { state: current, ops: [], outcome: 'done' };
    const tasks = [...current.tasks];
    tasks.splice(Math.min(index, tasks.length), 0, { ...before, updatedBy: me });
    return { state: { ...current, tasks }, ops: [ops.restore('tasks', before.id)], outcome: 'done' };
  }
  if (!cur) return { state: current, ops: [], outcome: 'none' };

  // Task fields: each goes back only while it still holds the value this edit set.
  const fieldPatch: Partial<Task> = {};
  const wasRow = taskToRow(before);
  const nowRow = taskToRow(after);
  for (const field of TASK_FIELDS) {
    if (before[field] === after[field]) continue;
    if (cur[field] !== after[field]) {
      skipped++;
      continue;
    }
    Object.assign(fieldPatch, { [field]: before[field] });
    reverted++;
    const col = field === 'group' ? 'grp' : field;
    out.push(ops.patchIf('tasks', { id: before.id, [col]: nowRow[col] as string | boolean | null }, { [col]: wasRow[col] }));
  }

  // Who it is for goes back to exactly the people it had, but only while it is still for exactly the
  // people this edit left (otherwise someone changed it since, and theirs stays). People taken off come
  // back with their part as it was (insert-only, so a part that exists is never overwritten); people
  // added go again unless they have started their part since (the delete is conditional on that too).
  const people = (list: readonly { person: Person }[]) => list.map((a) => a.person).sort().join(',');
  const back: typeof cur.assignments = [];
  const drop = new Set<Person>();
  if (people(before.assignments) !== people(after.assignments)) {
    if (people(cur.assignments) !== people(after.assignments)) skipped++;
    else {
      for (const was of before.assignments) {
        if (after.assignments.some((a) => a.person === was.person)) continue;
        back.push(was);
        out.push(ops.addAssignment(before.id, was.person, was.status));
        was.steps.forEach((step, i) => out.push(ops.saveStep(before.id, was.person, step, i, true)));
        reverted++;
      }
      for (const a of after.assignments) {
        if (before.assignments.some((was) => was.person === a.person)) continue;
        const now = cur.assignments.find((x) => x.person === a.person)!;
        if (now.status !== 'todo' || now.steps.length > 0) {
          skipped++;
          continue;
        }
        drop.add(a.person);
        out.push(ops.removeAssignment(before.id, a.person, { status: 'todo' }));
        reverted++;
      }
    }
  }

  const assignments = cur.assignments.filter((a) => !drop.has(a.person)).map((curA) => {
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
  // Put returning people back in the order the task had them before.
  const order = before.assignments.map((a) => a.person);
  const merged = [...assignments, ...back].sort((x, y) => {
    const ix = order.indexOf(x.person);
    const iy = order.indexOf(y.person);
    return (ix === -1 ? order.length : ix) - (iy === -1 ? order.length : iy);
  });
  const tasks = current.tasks.map((t) => (t === cur ? { ...cur, ...fieldPatch, assignments: merged, updatedBy: me } : t));
  return { state: { ...current, tasks }, ops: out, outcome: skipped > 0 ? 'partial' : 'done' };
}

/**
 * The notice when taking a person off a task did not happen on the server: their part changed since,
 * it was the last person on the task, or this account may not remove people. Undefined for any other op.
 */
export function removalNotice(op: Op, tasks: readonly Task[]): string | undefined {
  if (op.kind !== 'delete' || op.table !== 'task_assignments') return undefined;
  const person = op.match.person;
  const name = person === 'nikita' || person === 'daryna' ? PERSON[person] : 'That person';
  const title = tasks.find((t) => t.id === op.match.task_id)?.title;
  return `Could not remove ${name}${title ? ` from ${title}` : ''}`;
}

/** A plain notice on the snackbar (no Undo), such as a removal that did not happen. */
export function noticeSnack(message: string, key: string): Snack {
  return { key, message, spoken: `${message}.`, canUndo: false, ms: DELETE_SNACK_MS };
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
  return { key: entry.id, message: entry.message, spoken: `${entry.spoken}. Undo available.`, canUndo: true, ms: isDelete(entry) || changeItemId ? DELETE_SNACK_MS : SNACK_MS, ...(changeItemId ? { changeItemId } : {}) };
}

/**
 * The snackbar after an Undo: says how it went and offers nothing more, so a double tap on Undo can
 * never undo a second edit. Undoing an earlier edit needs a fresh edit to offer it.
 */
export function afterUndoSnack(outcome: UndoOutcome, key: string): Snack {
  const message = outcome === 'done' ? 'Undone' : outcome === 'partial' ? 'Partly undone: some of it was changed since' : 'Not undone: it was changed since';
  return { key, message, spoken: `${message}.`, canUndo: false, ms: SNACK_MS };
}
