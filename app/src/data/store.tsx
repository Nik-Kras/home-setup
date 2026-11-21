import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { advance, markGot } from '../domain/items';
import { setAssignmentStatus, toggleStep } from '../domain/tasks';
import type { Actor, Item, Person, Task, TaskStatus } from '../domain/types';
import { diffToOps } from './diff';
import { newId } from './mappers';
import { OpQueue } from './queue';
import { loadAll, makeExecutor, subscribe } from './repo';
import { seedItems, seedTasks } from './seed';
import { db, kv } from './supabase';

interface State {
  me: Person;
  items: Item[];
  tasks: Task[];
}

type Action =
  | { type: 'replace'; items: Item[]; tasks: Task[] }
  | { type: 'advanceItem'; id: string }
  | { type: 'gotItem'; id: string }
  | { type: 'addItem'; name: string; room?: string; urgent?: boolean; assignedTo?: Person }
  | { type: 'addTask'; title: string; assignees: Person[]; due?: string; urgent?: boolean }
  | { type: 'setTaskStatus'; id: string; person: Person; status: TaskStatus }
  | { type: 'toggleStep'; id: string; person: Person; stepId: string };

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
    case 'addTask': {
      const title = action.title.trim();
      if (!title || action.assignees.length === 0) return state;
      const task: Task = { id: newId(), title, due: action.due, urgent: action.urgent ?? false, updatedBy: actor, assignments: action.assignees.map((person) => ({ person, status: 'todo', steps: [] })) };
      return { ...state, tasks: [task, ...state.tasks] };
    }
    case 'setTaskStatus':
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.id ? setAssignmentStatus(t, action.person, action.status, actor) : t)) };
    case 'toggleStep':
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.id ? toggleStep(t, action.person, action.stepId, actor) : t)) };
  }
}

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';
export type SyncStatus = 'demo' | 'synced' | 'pending' | 'offline';

interface Store extends State {
  auth: AuthStatus;
  sync: SyncStatus;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  advanceItem: (id: string) => void;
  gotItem: (id: string) => void;
  addItem: (name: string, opts?: { room?: string; urgent?: boolean; assignedTo?: Person }) => void;
  addTask: (title: string, assignees: Person[], opts?: { due?: string; urgent?: boolean }) => void;
  setTaskStatus: (id: string, person: Person, status: TaskStatus) => void;
  toggleStep: (id: string, person: Person, stepId: string) => void;
}

const Ctx = createContext<Store | null>(null);
const LIVE = db !== null;

/**
 * Local-first store. Every edit updates the screen at once, then goes through the offline queue to
 * Supabase. Without Supabase keys it runs on demo data. Other devices' changes arrive by realtime.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ me: 'nikita', items: LIVE ? [] : seedItems, tasks: LIVE ? [] : seedTasks });
  const [auth, setAuth] = useState<AuthStatus>(LIVE ? 'loading' : 'signedIn');
  const [sync, setSync] = useState<SyncStatus>(LIVE ? 'pending' : 'demo');
  const ref = useRef(state);
  const roomIds = useRef(new Map<string, string>());
  const queue = useRef<OpQueue | null>(null);

  const set = useCallback((next: State) => {
    ref.current = next;
    setState(next);
  }, []);

  if (db && !queue.current) {
    queue.current = new OpQueue(kv, makeExecutor(db), (op) => console.warn('server refused a change, dropped:', op.table));
  }

  const refresh = useCallback(async () => {
    if (!db || !queue.current) return;
    try {
      await queue.current.flush();
      if ((await queue.current.size()) > 0) return setSync('pending'); // never overwrite unsent local edits
      const snap = await loadAll(db);
      roomIds.current = new Map(snap.rooms.map((r) => [r.name, r.id]));
      set({ ...ref.current, items: snap.items, tasks: snap.tasks });
      setSync('synced');
    } catch {
      setSync('offline');
    }
  }, [set]);

  // sign-in state and who "me" is
  useEffect(() => {
    const client = db;
    if (!client) return;
    const resolve = async (userId: string | null) => {
      if (!userId) return setAuth('signedOut');
      const { data } = await client.from('members').select('key').eq('user_id', userId).maybeSingle();
      const key = data?.key;
      if (key === 'nikita' || key === 'daryna') set({ ...ref.current, me: key });
      setAuth('signedIn');
      void refresh();
    };
    void client.auth.getSession().then(({ data }) => resolve(data.session?.user.id ?? null));
    const { data: sub } = client.auth.onAuthStateChange((_e, session) => void resolve(session?.user.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, [refresh, set]);

  // realtime changes from the other phone, and catch-up when the app returns to the front
  useEffect(() => {
    const client = db;
    if (!client || auth !== 'signedIn') return;
    const off = subscribe(client, () => void refresh());
    const app = AppState.addEventListener('change', (s) => s === 'active' && void refresh());
    const timer = setInterval(() => void refresh(), 20_000); // retries a stuck queue
    return () => {
      off();
      app.remove();
      clearInterval(timer);
    };
  }, [auth, refresh]);

  const act = useCallback(
    (action: Action) => {
      const prev = ref.current;
      const next = reducer(prev, action);
      if (next === prev) return;
      set(next);
      if (!queue.current) return;
      const q = queue.current;
      void (async () => {
        for (const op of diffToOps(prev, next, roomIds.current)) await q.enqueue(op);
        setSync('pending');
        await q.flush();
        setSync((await q.size()) === 0 ? 'synced' : 'offline');
      })();
    },
    [set],
  );

  const value = useMemo<Store>(
    () => ({
      ...state,
      auth,
      sync,
      signIn: async (email, password) => {
        if (!db) return 'Not connected';
        const { error } = await db.auth.signInWithPassword({ email: email.trim(), password });
        return error ? error.message : null;
      },
      signOut: async () => {
        await db?.auth.signOut();
      },
      advanceItem: (id) => act({ type: 'advanceItem', id }),
      gotItem: (id) => act({ type: 'gotItem', id }),
      addItem: (name, opts) => act({ type: 'addItem', name, ...opts }),
      addTask: (title, assignees, opts) => act({ type: 'addTask', title, assignees, ...opts }),
      setTaskStatus: (id, person, status) => act({ type: 'setTaskStatus', id, person, status }),
      toggleStep: (id, person, stepId) => act({ type: 'toggleStep', id, person, stepId }),
    }),
    [state, auth, sync, act],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
