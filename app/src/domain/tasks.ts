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
