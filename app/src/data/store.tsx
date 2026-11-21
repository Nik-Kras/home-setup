import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { advance, markGot } from '../domain/items';
import { setAssignmentStatus, toggleStep } from '../domain/tasks';
import type { Actor, Item, Person, Task, TaskStatus } from '../domain/types';
import { seedItems, seedTasks } from './seed';

interface State {
  me: Person;
  items: Item[];
  tasks: Task[];
}

type Action =
  | { type: 'advanceItem'; id: string }
  | { type: 'gotItem'; id: string }
  | { type: 'addItem'; name: string; room?: string; urgent?: boolean; assignedTo?: Person }
  | { type: 'addTask'; title: string; assignees: Person[]; due?: string; urgent?: boolean }
  | { type: 'setTaskStatus'; id: string; person: Person; status: TaskStatus }
  | { type: 'toggleStep'; id: string; person: Person; stepId: string };

let counter = 100;
const newId = (p: string) => `${p}${++counter}`;

function reducer(state: State, action: Action): State {
  const actor: Actor = state.me;
  const now = new Date().toISOString();
  switch (action.type) {
    case 'advanceItem':
      return { ...state, items: state.items.map((i) => (i.id === action.id ? advance(i, now, actor) : i)) };
    case 'gotItem':
      return { ...state, items: state.items.map((i) => (i.id === action.id ? markGot(i, now, actor) : i)) };
    case 'addItem': {
      const name = action.name.trim();
      if (!name) return state;
      const item: Item = {
        id: newId('i'), name, status: 'needed', quantity: 1, urgent: action.urgent ?? false,
        needsInstall: false, room: action.room, assignedTo: action.assignedTo, addedAt: now, updatedBy: actor,
      };
      return { ...state, items: [item, ...state.items] };
    }
    case 'addTask': {
      const title = action.title.trim();
      if (!title || action.assignees.length === 0) return state;
      const task: Task = {
        id: newId('t'), title, due: action.due, urgent: action.urgent ?? false, updatedBy: actor,
        assignments: action.assignees.map((person) => ({ person, status: 'todo', steps: [] })),
      };
      return { ...state, tasks: [task, ...state.tasks] };
    }
    case 'setTaskStatus':
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.id ? setAssignmentStatus(t, action.person, action.status, actor) : t)) };
    case 'toggleStep':
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.id ? toggleStep(t, action.person, action.stepId, actor) : t)) };
  }
}

interface Store extends State {
  advanceItem: (id: string) => void;
  gotItem: (id: string) => void;
  addItem: (name: string, opts?: { room?: string; urgent?: boolean; assignedTo?: Person }) => void;
  addTask: (title: string, assignees: Person[], opts?: { due?: string; urgent?: boolean }) => void;
  setTaskStatus: (id: string, person: Person, status: TaskStatus) => void;
  toggleStep: (id: string, person: Person, stepId: string) => void;
}

const Ctx = createContext<Store | null>(null);

/** In-memory store seeded with demo data. Replaced by the Supabase-backed store in phase 2. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { me: 'nikita', items: seedItems, tasks: seedTasks });
  const advanceItem = useCallback((id: string) => dispatch({ type: 'advanceItem', id }), []);
  const gotItem = useCallback((id: string) => dispatch({ type: 'gotItem', id }), []);
  const addItem = useCallback((name: string, opts?: { room?: string; urgent?: boolean; assignedTo?: Person }) => dispatch({ type: 'addItem', name, ...opts }), []);
  const addTask = useCallback((title: string, assignees: Person[], opts?: { due?: string; urgent?: boolean }) => dispatch({ type: 'addTask', title, assignees, ...opts }), []);
  const setTaskStatus = useCallback((id: string, person: Person, status: TaskStatus) => dispatch({ type: 'setTaskStatus', id, person, status }), []);
  const toggleStepCb = useCallback((id: string, person: Person, stepId: string) => dispatch({ type: 'toggleStep', id, person, stepId }), []);
  const value = useMemo<Store>(
    () => ({ ...state, advanceItem, gotItem, addItem, addTask, setTaskStatus, toggleStep: toggleStepCb }),
    [state, advanceItem, gotItem, addItem, addTask, setTaskStatus, toggleStepCb],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
