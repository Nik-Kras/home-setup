import { assignmentFor, daysLeft, openTasksSorted, tasksFor, type Who } from './tasks';
import type { Person, Task } from './types';

/** The groups offered when adding a task. Tasks may also carry other group names (from Claude or older data). */
export const TASK_GROUPS = ['Utilities', 'Address', 'Safety', 'Other'] as const;

export type When = 'today' | 'week' | 'date' | 'none';
export type { Who };

/** Local calendar date as YYYY-MM-DD. */
export function localDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "26 Nov" for a YYYY-MM-DD day. */
export function dayMonth(day: string): string {
  return `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;
}

export type DueTone = 'coral' | 'amber' | 'neutral';

/** The due chip for a task due on `due`, seen on `today` (both local YYYY-MM-DD, see `localDate`). */
export function dueLabel(due: string, today: string): { text: string; tone: DueTone } {
  const d = daysLeft(due, today);
  if (d < 0) return { text: 'Overdue', tone: 'coral' };
  if (d === 0) return { text: 'Today', tone: 'coral' };
  if (d === 1) return { text: 'Tomorrow', tone: 'amber' };
  if (d <= 7) return { text: `${d} days`, tone: 'amber' };
  return { text: dayMonth(due), tone: 'neutral' };
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Sunday of the week that holds `today` (weeks start on Monday). A Sunday is its own end of week. */
export function endOfWeek(today: string): string {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(today, dow === 0 ? 0 : 7 - dow);
}

/** The due date a When choice stands for. "Pick a date" uses the picked day, if any. */
export function dueFor(when: When, today: string, picked?: string): string | undefined {
  if (when === 'today') return today;
  if (when === 'week') return endOfWeek(today);
  if (when === 'date') return picked;
  return undefined;
}

export function assigneesFor(who: Who, me: Person): Person[] {
  const other: Person = me === 'nikita' ? 'daryna' : 'nikita';
  if (who === 'both') return [me, other];
  return [who === 'me' ? me : other];
}

/**
 * Whether `person` added a task (or, from the same add screen, an item) whose id is not in `before`.
 * Used to clear the add bar only once something is really added.
 */
export function addedSince(before: ReadonlySet<string>, things: readonly Pick<Task, 'id' | 'updatedBy'>[], person: Person): boolean {
  return things.some((t) => !before.has(t.id) && t.updatedBy === person);
}

/** A group name as a route segment. Encoded here so '/', '%', '?' and '#' survive the route. */
export function groupToParam(name: string): string {
  return encodeURIComponent(name);
}

/** The group name back from its route segment. A segment that is not valid encoding is taken as it is. */
export function groupFromParam(raw: string | undefined): string {
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export interface GroupSummary {
  name: string;
  open: number;
  done: number;
  total: number;
}

/**
 * Groups on one person's list: the distinct `group` values of their tasks, with how many are still open
 * for them. The add-task groups come first in their usual order, then any others by name.
 */
export function groupsFor(tasks: readonly Task[], person: Person): GroupSummary[] {
  const by = new Map<string, GroupSummary>();
  for (const t of tasksFor(tasks, person)) {
    if (!t.group) continue;
    const g = by.get(t.group) ?? { name: t.group, open: 0, done: 0, total: 0 };
    g.total += 1;
    if (assignmentFor(t, person)?.status === 'done') g.done += 1;
    else g.open += 1;
    by.set(t.group, g);
  }
  const rank = (name: string) => {
    const i = (TASK_GROUPS as readonly string[]).indexOf(name);
    return i === -1 ? TASK_GROUPS.length : i;
  };
  return [...by.values()].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
}

/** One person's tasks in a group: open ones in the usual order, then the ones they have done. */
export function groupTasks(tasks: readonly Task[], group: string, person: Person): { open: Task[]; done: Task[] } {
  const mine = tasksFor(tasks, person).filter((t) => t.group === group);
  return {
    open: openTasksSorted(mine, person),
    done: mine.filter((t) => assignmentFor(t, person)?.status === 'done').sort((a, b) => a.title.localeCompare(b.title)),
  };
}

/** Weeks of a month for a calendar, Monday first. Days outside the month are null. `month` is 1-12. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
