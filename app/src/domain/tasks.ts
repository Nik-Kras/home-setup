import type { Actor, Assignment, Person, Task, TaskStatus, TaskStep } from './types';

/** A task is finished only when every assignee has finished their part. */
export function isTaskDone(task: Task): boolean {
  return task.assignments.length > 0 && task.assignments.every((a) => a.status === 'done');
}

export function isShared(task: Task): boolean {
  return task.assignments.length > 1;
}

export function taskProgress(task: Task): { done: number; total: number } {
  return {
    done: task.assignments.filter((a) => a.status === 'done').length,
    total: task.assignments.length,
  };
}

export function taskProgressLabel(task: Task): string {
  const { done, total } = taskProgress(task);
  return `${done} of ${total} done`;
}

export function assignmentFor(task: Task, person: Person): Assignment | undefined {
  return task.assignments.find((a) => a.person === person);
}

/** Tasks on one person's own list: theirs alone, plus shared ones. */
export function tasksFor(tasks: readonly Task[], person: Person): Task[] {
  return tasks.filter((t) => assignmentFor(t, person) !== undefined);
}

/** The "Both" view: only tasks that need both people. */
export function sharedTasks(tasks: readonly Task[]): Task[] {
  return tasks.filter(isShared);
}

/** Set one person's status. Other assignees are untouched. Returns a new task. */
export function setAssignmentStatus(
  task: Task,
  person: Person,
  status: TaskStatus,
  actor: Actor,
): Task {
  const assignment = assignmentFor(task, person);
  if (!assignment || assignment.status === status) return task;
  return {
    ...task,
    updatedBy: actor,
    assignments: task.assignments.map((a) => (a.person === person ? { ...a, status } : a)),
  };
}

export function toggleStep(
  task: Task,
  person: Person,
  stepId: string,
  actor: Actor,
): Task {
  if (!assignmentFor(task, person)?.steps.some((s) => s.id === stepId)) return task;
  return {
    ...task,
    updatedBy: actor,
    assignments: task.assignments.map((a) =>
      a.person !== person
        ? a
        : { ...a, steps: a.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s)) },
    ),
  };
}

/** Append one step without changing any existing step or the other assignment. */
export function addStep(task: Task, person: Person, step: Pick<TaskStep, 'id' | 'title'>, actor: Actor): Task {
  const assignment = assignmentFor(task, person);
  const title = step.title.trim();
  if (!assignment || !title) return task;
  const lastSort = assignment.steps.reduce((max, s, i) => Math.max(max, s.sort ?? i), -1);
  const steps = [...assignment.steps, { id: step.id, title, done: false, sort: lastSort + 1 }];
  return {
    ...task,
    updatedBy: actor,
    assignments: task.assignments.map((a) => (a === assignment ? { ...a, steps } : a)),
  };
}

/** The person who still has to act on a shared task after someone finished. */
export function waitingOn(task: Task): Person[] {
  if (!isShared(task)) return [];
  const anyDone = task.assignments.some((a) => a.status === 'done');
  if (!anyDone) return [];
  return task.assignments.filter((a) => a.status !== 'done').map((a) => a.person);
}

/** Accept a compact numeric date or an ISO date pasted into the due date field. */
export function parseTaskDate(value: string): string | undefined {
  const date = value.trim().replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(date)) return undefined;
  const ms = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === date ? date : undefined;
}

/** Whole days from `today` to `due` (both YYYY-MM-DD). Negative when overdue. */
export function daysLeft(due: string, today: string): number {
  const ms = Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Open tasks for a person: urgent first, then by due date, then undated. */
export function openTasksSorted(tasks: readonly Task[], person: Person): Task[] {
  return tasksFor(tasks, person)
    .filter((t) => assignmentFor(t, person)?.status !== 'done')
    .sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      if (a.due && b.due) return a.due.localeCompare(b.due);
      if (a.due) return -1;
      if (b.due) return 1;
      return a.title.localeCompare(b.title);
    });
}

/**
 * Tasks where this person's part is done, by title: the collapsed "Done" list on the Tasks tab, so a
 * part ticked by mistake can always be found and unticked (an ungrouped task is on no other screen).
 */
export function doneTasksFor(tasks: readonly Task[], person: Person): Task[] {
  return tasksFor(tasks, person)
    .filter((t) => assignmentFor(t, person)?.status === 'done')
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Who a task is for, as a set of people. A person added gets a fresh part (to do, no steps); a person
 * taken off loses only their own part. The part of anyone who stays is never touched, so their status
 * and steps survive. At least one person stays: an empty list changes nothing.
 */
export function setAssignees(task: Task, people: readonly Person[], actor: Actor): Task {
  const want = [...new Set(people)];
  if (want.length === 0) return task;
  const kept = task.assignments.filter((a) => want.includes(a.person));
  const added = want.filter((p) => !kept.some((a) => a.person === p)).map((person): Assignment => ({ person, status: 'todo', steps: [] }));
  if (added.length === 0 && kept.length === task.assignments.length) return task;
  return { ...task, updatedBy: actor, assignments: [...kept, ...added] };
}

export type Who = 'me' | 'other' | 'both';

/** The Who choice a task stands for, seen by `me`. */
export function whoFor(task: Task, me: Person): Who {
  const mine = assignmentFor(task, me) !== undefined;
  const theirs = task.assignments.some((a) => a.person !== me);
  return mine && theirs ? 'both' : mine ? 'me' : 'other';
}

/**
 * What a task row's left control is, for `me` looking at `viewer`'s list (null: the Both view).
 * - tick: a circle that ticks MY part (also on the other person's list, when I share the task).
 * - disc: the task is only the other person's, so their initial disc shows their state; nothing to tap.
 */
export type RowControl = { kind: 'tick'; person: Person; done: boolean } | { kind: 'disc'; person: Person; done: boolean };

export function rowControl(task: Task, viewer: Person | null, me: Person): RowControl {
  const mine = assignmentFor(task, me);
  if (mine) return { kind: 'tick', person: me, done: mine.status === 'done' };
  const theirs = (viewer && assignmentFor(task, viewer)) ?? task.assignments[0];
  return { kind: 'disc', person: theirs?.person ?? viewer ?? me, done: theirs?.status === 'done' };
}
