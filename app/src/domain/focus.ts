import { dayMonth } from './taskOptions';
import { assignmentFor, daysLeft, isTaskDone } from './tasks';
import type { Person, Task } from './types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Open for one person means their part is not done; with no person (the shared view) the whole task is not done. */
function isOpenFor(task: Task, person: Person | null): boolean {
  if (!person) return !isTaskDone(task);
  const mine = assignmentFor(task, person);
  return mine !== undefined && mine.status !== 'done';
}

/**
 * The task for the deadline card on the Tasks screen: the open task with the nearest due date (overdue
 * counts as nearest), or when nothing open has a date, the first urgent one. None when neither exists.
 */
export function focusTask(list: readonly Task[], person: Person | null): Task | undefined {
  const open = list.filter((t) => isOpenFor(t, person));
  const byTitle = (a: Task, b: Task) => a.title.localeCompare(b.title);
  const dated = open
    .filter((t) => t.due)
    .sort((a, b) => a.due!.localeCompare(b.due!) || Number(b.urgent) - Number(a.urgent) || byTitle(a, b));
  if (dated.length > 0) return dated[0];
  return open.filter((t) => t.urgent).sort(byTitle)[0];
}

/**
 * The card's eyebrow, such as "Due Fri 27 Nov · 5 days left". `alert` (coral) is for overdue, due today,
 * or an urgent task with no date, whose eyebrow says "Urgent".
 */
export function focusEyebrow(task: Task, today: string): { text: string; alert: boolean } {
  if (!task.due) return { text: 'Urgent · no due date', alert: true };
  const d = daysLeft(task.due, today);
  const day = `${WEEKDAYS[new Date(`${task.due}T00:00:00Z`).getUTCDay()]} ${dayMonth(task.due)}`;
  const plural = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
  const rest = d < 0 ? `${plural(-d)} overdue` : d === 0 ? 'today' : `${plural(d)} left`;
  return { text: `Due ${day} · ${rest}`, alert: d <= 0 };
}

/** One person's checklist progress on a task. Zero total when they have no steps. */
export function stepProgress(task: Task, person: Person): { done: number; total: number } {
  const steps = assignmentFor(task, person)?.steps ?? [];
  return { done: steps.filter((s) => s.done).length, total: steps.length };
}
