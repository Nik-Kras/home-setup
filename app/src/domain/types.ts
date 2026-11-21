/** People who can act in the app. Claude is an actor, never an assignee. */
export type Person = 'nikita' | 'daryna';
export type Actor = Person | 'claude';

export type ItemStatus = 'needed' | 'looking' | 'ordered' | 'delivered' | 'installed';
export const ITEM_STATUSES: readonly ItemStatus[] = [
  'needed',
  'looking',
  'ordered',
  'delivered',
  'installed',
];

export type TaskStatus = 'todo' | 'in_progress' | 'waiting' | 'done';

export interface Item {
  id: string;
  name: string;
  status: ItemStatus;
  quantity: number;
  urgent: boolean;
  /** True for things that must be fitted or set up (router, shelves). Others are done once delivered. */
  needsInstall: boolean;
  room?: string;
  estPrice?: number;
  actualPrice?: number;
  assignedTo?: Person;
  boughtBy?: Person;
  link?: string;
  notes?: string;
  addedAt: string;
  deliveredAt?: string;
  installedAt?: string;
  updatedBy: Actor;
}

export interface TaskStep {
  id: string;
  title: string;
  done: boolean;
  /** Stored order. Older in-memory steps use their position in the checklist. */
  sort?: number;
}

/** One person's share of a task. A shared task has one assignment per person. */
export interface Assignment {
  person: Person;
  status: TaskStatus;
  steps: TaskStep[];
}

/** info: a plain fact. to_confirm: not known yet, can become a task. check: something to verify. */
export type NoteKind = 'info' | 'to_confirm' | 'check';
export const NOTE_KINDS: readonly NoteKind[] = ['info', 'to_confirm', 'check'];

/** A fact about the home or the tenancy, shared by both people. */
export interface FlatNote {
  id: string;
  title: string;
  body?: string;
  /** Where it comes from, such as a contract clause. */
  reference?: string;
  kind: NoteKind;
  sort: number;
  updatedBy: Actor;
}

export interface Task {
  id: string;
  title: string;
  group?: string;
  /** Calendar date, YYYY-MM-DD, no time. */
  due?: string;
  urgent: boolean;
  /** Free text such as a contract clause. */
  reference?: string;
  notes?: string;
  assignments: Assignment[];
  updatedBy: Actor;
}
