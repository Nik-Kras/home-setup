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
}

/** One person's share of a task. A shared task has one assignment per person. */
export interface Assignment {
  person: Person;
  status: TaskStatus;
  steps: TaskStep[];
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
