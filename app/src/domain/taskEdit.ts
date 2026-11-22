import { assigneesFor } from './taskOptions';
import { whoFor, type Who } from './tasks';
import type { Person, Task } from './types';

/** What the task edit sheet holds. Empty strings mean "none". */
export interface TaskDraft {
  title: string;
  group?: string;
  /** YYYY-MM-DD, or undefined for no date. */
  due?: string;
  urgent: boolean;
  who: Who;
  notes: string;
  reference: string;
}

/** The edit sheet's starting values for a task, seen by `me`. */
export function taskDraft(task: Task, me: Person): TaskDraft {
  return { title: task.title, group: task.group, due: task.due, urgent: task.urgent, who: whoFor(task, me), notes: task.notes ?? '', reference: task.reference ?? '' };
}

export interface TaskEdit {
  patch: Partial<Pick<Task, 'title' | 'group' | 'due' | 'urgent' | 'notes' | 'reference'>>;
  /** Set only when who the task is for changed. */
  assignees?: Person[];
}

const clean = (v: string | undefined) => (v?.trim() ? v.trim() : undefined);

/**
 * Only what the person changed, compared with the task as it was when the sheet opened, so a stale
 * sheet never undoes the other person's edit to another field made meanwhile. Assignees appear only
 * when Who changed, and then name exactly the people the task should be for.
 */
export function taskEditChanges(original: Task, draft: TaskDraft, me: Person): TaskEdit {
  const patch: TaskEdit['patch'] = {};
  const title = draft.title.trim();
  if (title && title !== original.title) patch.title = title;
  if (clean(draft.group) !== original.group) patch.group = clean(draft.group);
  if (draft.due !== original.due) patch.due = draft.due;
  if (draft.urgent !== original.urgent) patch.urgent = draft.urgent;
  if (clean(draft.notes) !== original.notes) patch.notes = clean(draft.notes);
  if (clean(draft.reference) !== original.reference) patch.reference = clean(draft.reference);
  const out: TaskEdit = { patch };
  if (draft.who !== whoFor(original, me)) out.assignees = assigneesFor(draft.who, me);
  return out;
}

/** Whether the draft can be saved: a title is required. */
export function canSaveTask(draft: TaskDraft): boolean {
  return draft.title.trim().length > 0;
}
