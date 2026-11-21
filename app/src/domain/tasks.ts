import type { Actor, Assignment, Person, Task, TaskStatus } from './types';

/** A task is finished only when every assignee has finished their part. */
export function isTaskDone(task: Task): boolean {
  return task.assignments.length > 0 && task.assignments.every((a) => a.status === 'done');
}

export function isShared(task: Task): boolean {
  return task.assignments.length > 1;
}

/** "1 of 2 done" for shared tasks; "0 of 1" for a single-person task. */
export function taskProgress(task: Task): { done: number; total: number } {
  return {
    done: task.assignments.filter((a) => a.status === 'done').length,
    total: task.assignments.length,
  };
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
  if (!assignmentFor(task, person)) return task;
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

/** The person who still has to act on a shared task after someone finished. */
export function waitingOn(task: Task): Person[] {
  if (!isShared(task)) return [];
  const anyDone = task.assignments.some((a) => a.status === 'done');
  if (!anyDone) return [];
  return task.assignments.filter((a) => a.status !== 'done').map((a) => a.person);
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
