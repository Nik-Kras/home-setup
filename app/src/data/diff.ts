import type { Item, Task } from '../domain/types';
import type { Op } from './queue';
import { ops } from './repo';

/**
 * Turn "state before, state after" into the minimal ops to send.
 * A person's edit sends only the thing that person changed. In particular, changing my part of a
 * shared task never sends the other person's part, so a stale screen cannot undo their work.
 */
export function diffToOps(
  prev: { items: readonly Item[]; tasks: readonly Task[] },
  next: { items: readonly Item[]; tasks: readonly Task[] },
  roomIds: ReadonlyMap<string, string>,
): Op[] {
  const out: Op[] = [];

  const prevItems = new Map(prev.items.map((i) => [i.id, i]));
  for (const item of next.items) {
    if (prevItems.get(item.id) !== item) out.push(ops.saveItem(item, roomIds));
  }

  const prevTasks = new Map(prev.tasks.map((t) => [t.id, t]));
  for (const task of next.tasks) {
    const before = prevTasks.get(task.id);
    if (before === task) continue;
    if (!before) {
      out.push(...ops.saveTask(task));
      continue;
    }
    for (const a of task.assignments) {
      const was = before.assignments.find((x) => x.person === a.person);
      if (!was) continue;
      if (was.status !== a.status) out.push(ops.setAssignment(task.id, a.person, a.status));
      for (const step of a.steps) {
        const prevStep = was.steps.find((s) => s.id === step.id);
        if (prevStep && prevStep.done !== step.done) out.push(ops.toggleStep(step.id, step.done));
      }
    }
  }
  return out;
}
