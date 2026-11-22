import type { Comment } from '../domain/comments';
import { advance, setStatus } from '../domain/items';
import { addStep, setAssignmentStatus, toggleStep } from '../domain/tasks';
import type { Actor, FlatNote, Item, ItemStatus, NoteKind, Person, Task, TaskStatus } from '../domain/types';
import { newId } from './mappers';

export interface State {
  me: Person;
  items: Item[];
  tasks: Task[];
  notes: FlatNote[];
  /** Comments on items and tasks. Optional so older callers and tests need not list them. */
  comments?: Comment[];
}

/**
 * Item fields a person can edit. id and addedAt are fixed, updatedBy is stamped by the reducer, and
 * status with its timestamps changes only through setItemStatus.
 */
export const ITEM_FIELDS = ['name', 'quantity', 'urgent', 'needsInstall', 'room', 'estPrice', 'actualPrice', 'assignedTo', 'boughtBy', 'link', 'notes'] as const;
export type ItemPatch = Partial<Pick<Item, (typeof ITEM_FIELDS)[number]>>;

/** Task fields a person can edit. Assignments change only through their own actions. */
export const TASK_FIELDS = ['title', 'due', 'urgent', 'notes', 'reference', 'group'] as const;
export type TaskPatch = Partial<Pick<Task, (typeof TASK_FIELDS)[number]>>;

/** Note fields a person can edit. */
export const NOTE_FIELDS = ['title', 'body', 'reference', 'kind', 'sort'] as const;
export type NotePatch = Partial<Pick<FlatNote, (typeof NOTE_FIELDS)[number]>>;

/** Trim optional text; blank becomes undefined so it is stored as null. */
const clean = (v: string | undefined) => (v?.trim() ? v.trim() : undefined);

export type Action =
  | { type: 'replace'; items: Item[]; tasks: Task[]; notes?: FlatNote[]; comments?: Comment[] }
  /** Exactly one stage on (see nextStatus). Nothing ever jumps to the end. */
  | { type: 'advanceItem'; id: string }
  | { type: 'addItem'; name: string; room?: string; urgent?: boolean; assignedTo?: Person }
  | { type: 'updateItem'; id: string; patch: ItemPatch }
  | { type: 'setItemStatus'; id: string; status: ItemStatus }
  /** Hides the item here; the database row is soft-deleted (deleted_at), so Undo can bring it back. */
  | { type: 'deleteItem'; id: string }
  | { type: 'addTask'; title: string; assignees: Person[]; due?: string; urgent?: boolean; group?: string }
  | { type: 'updateTask'; id: string; patch: TaskPatch }
  | { type: 'setTaskStatus'; id: string; person: Person; status: TaskStatus }
  | { type: 'toggleStep'; id: string; person: Person; stepId: string }
  | { type: 'addStep'; id: string; title: string }
  | { type: 'addNote'; title: string; body?: string; reference?: string; kind?: NoteKind }
  | { type: 'updateNote'; id: string; patch: NotePatch }
  /** A comment by me on an item or task. Comments are never edited. */
  | { type: 'addComment'; targetType: Comment['targetType']; targetId: string; body: string };

/** Apply a patch, or return the same object when nothing would change, so no op is sent. */
function patched<T extends object>(obj: T, patch: NoInfer<Partial<T>>, actor: Actor): T {
  const changed = (Object.keys(patch) as (keyof T)[]).some((k) => obj[k] !== patch[k]);
  return changed ? { ...obj, ...patch, updatedBy: actor } : obj;
}

function editTask(state: State, id: string, edit: (task: Task) => Task): State {
  const tasks = state.tasks.map((t) => (t.id === id ? edit(t) : t));
  return tasks.some((t, n) => t !== state.tasks[n]) ? { ...state, tasks } : state;
}

export function reducer(state: State, action: Action): State {
  const actor: Actor = state.me;
  const now = new Date().toISOString();
  switch (action.type) {
    case 'replace':
      return { ...state, items: action.items, tasks: action.tasks, notes: action.notes ?? state.notes, comments: action.comments ?? state.comments };
    case 'advanceItem': {
      const items = state.items.map((i) => (i.id === action.id ? advance(i, now, actor) : i));
      return items.some((i, n) => i !== state.items[n]) ? { ...state, items } : state;
    }
    case 'deleteItem': {
      const items = state.items.filter((i) => i.id !== action.id);
      return items.length === state.items.length ? state : { ...state, items };
    }
    case 'addItem': {
      const name = action.name.trim();
      if (!name) return state;
      const item: Item = { id: newId(), name, status: 'needed', quantity: 1, urgent: action.urgent ?? false, needsInstall: false, room: action.room, assignedTo: action.assignedTo, addedAt: now, updatedBy: actor };
      return { ...state, items: [item, ...state.items] };
    }
    case 'updateItem': {
      const patch: ItemPatch = {};
      for (const k of ITEM_FIELDS) if (k in action.patch) Object.assign(patch, { [k]: action.patch[k] });
      if (patch.name !== undefined) {
        patch.name = patch.name.trim();
        if (!patch.name) return state;
      }
      const items = state.items.map((i) => (i.id === action.id ? patched(i, patch, actor) : i));
      return items.some((i, n) => i !== state.items[n]) ? { ...state, items } : state;
    }
    case 'setItemStatus': {
      const items = state.items.map((i) => (i.id === action.id ? setStatus(i, action.status, now, actor) : i));
      return items.some((i, n) => i !== state.items[n]) ? { ...state, items } : state;
    }
    case 'addTask': {
      const title = action.title.trim();
      if (!title || action.assignees.length === 0) return state;
      const group = action.group?.trim() || undefined;
      const people = [...new Set(action.assignees)];
      const task: Task = { id: newId(), title, group, due: action.due, urgent: action.urgent ?? false, updatedBy: actor, assignments: people.map((person) => ({ person, status: 'todo', steps: [] })) };
      return { ...state, tasks: [task, ...state.tasks] };
    }
    case 'updateTask': {
      const patch: TaskPatch = {};
      for (const k of TASK_FIELDS) if (k in action.patch) Object.assign(patch, { [k]: action.patch[k] });
      if (patch.title !== undefined) {
        patch.title = patch.title.trim();
        if (!patch.title) return state;
      }
      return editTask(state, action.id, (task) => patched(task, patch, actor));
    }
    case 'setTaskStatus':
      if (action.person !== state.me) return state;
      return editTask(state, action.id, (task) => setAssignmentStatus(task, state.me, action.status, actor));
    case 'toggleStep':
      if (action.person !== state.me) return state;
      return editTask(state, action.id, (task) => toggleStep(task, state.me, action.stepId, actor));
    case 'addStep':
      return editTask(state, action.id, (task) => addStep(task, state.me, { id: newId(), title: action.title }, actor));
    case 'addNote': {
      const title = action.title.trim();
      if (!title) return state;
      const sort = state.notes.reduce((m, n) => Math.max(m, n.sort), 0) + 1;
      const note: FlatNote = { id: newId(), title, body: clean(action.body), reference: clean(action.reference), kind: action.kind ?? 'info', sort, updatedBy: actor };
      return { ...state, notes: [...state.notes, note] };
    }
    case 'updateNote': {
      const patch: NotePatch = {};
      for (const k of NOTE_FIELDS) if (k in action.patch) Object.assign(patch, { [k]: action.patch[k] });
      if (patch.title !== undefined) {
        patch.title = patch.title.trim();
        if (!patch.title) return state;
      }
      if ('body' in patch) patch.body = clean(patch.body);
      if ('reference' in patch) patch.reference = clean(patch.reference);
      const notes = state.notes.map((n) => (n.id === action.id ? patched(n, patch, actor) : n));
      return notes.some((n, i) => n !== state.notes[i]) ? { ...state, notes } : state;
    }
    case 'addComment': {
      const body = action.body.trim();
      if (!body) return state;
      const comment: Comment = { id: newId(), targetType: action.targetType, targetId: action.targetId, author: actor, body, createdAt: now };
      return { ...state, comments: [...(state.comments ?? []), comment] };
    }
  }
}
