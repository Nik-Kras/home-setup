import type { FlatNote, Item, Task } from '../domain/types';
import { itemChangedColumns, noteChangedColumns } from './mappers';
import type { Op } from './queue';
import { ops } from './repo';

/** Editable task fields and their database columns. Assignments are diffed separately. */
const TASK_COLUMNS = [['title', 'title'], ['due', 'due'], ['urgent', 'urgent'], ['notes', 'notes'], ['reference', 'reference'], ['group', 'grp']] as const satisfies readonly (readonly [keyof Task, string])[];

/**
 * Turn "state before, state after" into the minimal ops to send.
 * A person's edit sends only the thing that person changed: a new item is one upsert, an edited item
 * is one patch of the changed columns. Changing my part of a
 * shared task never sends the other person's part, so a stale screen cannot undo their work.
 */
export function diffToOps(
  prev: { items: readonly Item[]; tasks: readonly Task[]; notes?: readonly FlatNote[] },
  next: { items: readonly Item[]; tasks: readonly Task[]; notes?: readonly FlatNote[] },
  roomIds: ReadonlyMap<string, string>,
): Op[] {
  const out: Op[] = [];

  const prevItems = new Map(prev.items.map((i) => [i.id, i]));
  for (const item of next.items) {
    const before = prevItems.get(item.id);
    if (before === item) continue;
    if (!before) {
      out.push(ops.saveItem(item, roomIds));
      continue;
    }
    const fields = itemChangedColumns(before, item, roomIds);
    if (Object.keys(fields).length > 0) out.push(ops.patchItem(item.id, fields));
  }

  const prevTasks = new Map(prev.tasks.map((t) => [t.id, t]));
  for (const task of next.tasks) {
    const before = prevTasks.get(task.id);
    if (before === task) continue;
    if (!before) {
      out.push(...ops.saveTask(task));
      continue;
    }
    const fields: Record<string, unknown> = {};
    for (const [key, col] of TASK_COLUMNS) {
      if (before[key] !== task[key]) fields[col] = task[key] ?? null;
    }
    if (Object.keys(fields).length > 0) out.push(ops.patchTask(task.id, fields));
    // Who it is for: each person added or taken off is one op on their own part only.
    for (const was of before.assignments) {
      if (!task.assignments.some((a) => a.person === was.person)) out.push(ops.removeAssignment(task.id, was.person));
    }
    for (const a of task.assignments) {
      const was = before.assignments.find((x) => x.person === a.person);
      if (!was) {
        out.push(ops.addAssignment(task.id, a.person, a.status));
        a.steps.forEach((step, index) => out.push(ops.saveStep(task.id, a.person, step, index, true)));
        continue;
      }
      if (was.status !== a.status) out.push(ops.setAssignment(task.id, a.person, a.status));
      for (const [index, step] of a.steps.entries()) {
        const prevStep = was.steps.find((s) => s.id === step.id);
        if (!prevStep) out.push(ops.saveStep(task.id, a.person, step, index));
        else if (prevStep.done !== step.done) out.push(ops.toggleStep(step.id, step.done));
      }
    }
  }

  // A new note is one upsert; an edited note is one patch of the changed columns.
  const prevNotes = new Map((prev.notes ?? []).map((n) => [n.id, n]));
  for (const note of next.notes ?? []) {
    const before = prevNotes.get(note.id);
    if (before === note) continue;
    if (!before) {
      out.push(ops.saveNote(note));
      continue;
    }
    const fields = noteChangedColumns(before, note);
    if (Object.keys(fields).length > 0) out.push(ops.patchNote(note.id, fields));
  }
  return out;
}
