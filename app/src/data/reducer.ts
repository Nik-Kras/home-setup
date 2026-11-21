import { advance, markGot, setStatus } from '../domain/items';
import { setAssignmentStatus, toggleStep } from '../domain/tasks';
import type { Actor, Item, ItemStatus, Person, Task, TaskStatus } from '../domain/types';
import { newId } from './mappers';

export interface State {
  me: Person;
  items: Item[];
  tasks: Task[];
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

export type Action =
  | { type: 'replace'; items: Item[]; tasks: Task[] }
  | { type: 'advanceItem'; id: string }
  | { type: 'gotItem'; id: string }
  | { type: 'addItem'; name: string; room?: string; urgent?: boolean; assignedTo?: Person }
  | { type: 'updateItem'; id: string; patch: ItemPatch }
  | { type: 'setItemStatus'; id: string; status: ItemStatus }
  | { type: 'addTask'; title: string; assignees: Person[]; due?: string; urgent?: boolean; group?: string }
  | { type: 'updateTask'; id: string; patch: TaskPatch }
  | { type: 'setTaskStatus'; id: string; person: Person; status: TaskStatus }
  | { type: 'toggleStep'; id: string; person: Person; stepId: string };

/** Apply a patch, or return the same object when nothing would change, so no op is sent. */
function patched<T extends object>(obj: T, patch: NoInfer<Partial<T>>, actor: Actor): T {
  const changed = (Object.keys(patch) as (keyof T)[]).some((k) => obj[k] !== patch[k]);
  return changed ? { ...obj, ...patch, updatedBy: actor } : obj;
}

export function reducer(state: State, action: Action): State {
  const actor: Actor = state.me;
  const now = new Date().toISOString();
  switch (action.type) {
    case 'replace':
      return { ...state, items: action.items, tasks: action.tasks };
    case 'advanceItem':
      return { ...state, items: state.items.map((i) => (i.id === action.id ? advance(i, now, actor) : i)) };
    case 'gotItem':
      return { ...state, items: state.items.map((i) => (i.id === action.id ? markGot(i, now, actor) : i)) };
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
      const tasks = state.tasks.map((t) => (t.id === action.id ? patched(t, patch, actor) : t));
      return tasks.some((t, n) => t !== state.tasks[n]) ? { ...state, tasks } : state;
    }
    case 'setTaskStatus':
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.id ? setAssignmentStatus(t, action.person, action.status, actor) : t)) };
    case 'toggleStep':
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.id ? toggleStep(t, action.person, action.stepId, actor) : t)) };
  }
}
