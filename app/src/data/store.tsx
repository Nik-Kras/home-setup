import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { DisplayPhoto } from '../domain/photos';
import type { Item, ItemStatus, NoteKind, Person, TaskStatus } from '../domain/types';
import { diffToOps } from './diff';
import { OpQueue } from './queue';
import { reducer, type Action, type ItemPatch, type NotePatch, type State, type TaskPatch } from './reducer';
import { loadAll, makeExecutor, subscribe } from './repo';
import { seedItems, seedNotes, seedRooms, seedTasks } from './seed';
import { db, kv } from './supabase';
import { useItemPhotos } from './useItemPhotos';
import type { PhotoSource } from './photoFiles';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';
export type SyncStatus = 'demo' | 'synced' | 'pending' | 'offline';

export type Room = { id: string; name: string };

interface Store extends State {
  /** Rooms in their sort order: loaded from the database, or the demo rooms. */
  rooms: Room[];
  auth: AuthStatus;
  sync: SyncStatus;
  photos: DisplayPhoto[];
  canDeletePhotos: boolean;
  addPhoto: (itemId: string, source: PhotoSource) => Promise<void>;
  deletePhoto: (photo: DisplayPhoto) => Promise<void>;
  retryPhoto: (photo: DisplayPhoto) => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  advanceItem: (id: string) => void;
  gotItem: (id: string) => void;
  addItem: (name: string, opts?: { room?: string; urgent?: boolean; assignedTo?: Person }) => void;
  updateItem: (id: string, patch: ItemPatch) => void;
  setItemStatus: (id: string, status: ItemStatus) => void;
  addTask: (title: string, assignees: Person[], opts?: { due?: string; urgent?: boolean; group?: string }) => void;
  updateTask: (id: string, patch: TaskPatch) => void;
  setTaskStatus: (id: string, person: Person, status: TaskStatus) => void;
  toggleStep: (id: string, person: Person, stepId: string) => void;
  addStep: (id: string, title: string) => void;
  addNote: (title: string, opts?: { body?: string; reference?: string; kind?: NoteKind }) => void;
  updateNote: (id: string, patch: NotePatch) => void;
}

const Ctx = createContext<Store | null>(null);
const LIVE = db !== null;
const DEFAULT_PERSON: Person = 'nikita';
const LAST_ACCOUNT = 'homesetup.photo-account.v1';
const itemCacheKey = (account: string) => `homesetup.photo-items.v1.${account}`;
const memberCacheKey = (account: string) => `homesetup.photo-member.v1.${account}`;

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await kv.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

/**
 * Local-first store. Every edit updates the screen at once, then goes through the offline queue to
 * Supabase. Without Supabase keys it runs on demo data. Other devices' changes arrive by realtime.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ me: DEFAULT_PERSON, items: LIVE ? [] : seedItems, tasks: LIVE ? [] : seedTasks, notes: LIVE ? [] : seedNotes });
  const [auth, setAuth] = useState<AuthStatus>(LIVE ? 'loading' : 'signedIn');
  const [account, setAccount] = useState<string | null | undefined>(undefined);
  const [member, setMember] = useState<{ account: string; canDelete: boolean }>();
  const canDeletePhotos = !LIVE || (member?.account === account && member?.canDelete === true);
  const { photos, addPhoto, deletePhoto, retryPhoto, flushPhotos, loadPhotos } =
    useItemPhotos(LIVE ? account ?? null : 'demo', canDeletePhotos);
  const currentAccount = useRef(account);
  currentAccount.current = account;
  const [sync, setSync] = useState<SyncStatus>(LIVE ? 'pending' : 'demo');
  const ref = useRef(state);
  const [rooms, setRooms] = useState<Room[]>(LIVE ? [] : seedRooms);
  const roomIds = useRef(new Map<string, string>());
  const queue = useRef<OpQueue | null>(null);

  const set = useCallback((next: State) => {
    ref.current = next;
    setState(next);
  }, []);

  if (db && !queue.current) {
    queue.current = new OpQueue(kv, makeExecutor(db), (op) => console.warn('server refused a change, dropped:', op.table));
  }

  const refresh = useMemo(() => {
    let running: Promise<void> | undefined;
    const run = async () => {
      if (!db || !queue.current || !account) return;
      try {
        await queue.current.flush();
        if (currentAccount.current !== account) return;
        if ((await queue.current.size()) > 0) return setSync('pending'); // never overwrite unsent local edits
        await flushPhotos();
        if (currentAccount.current !== account) return;
        const snap = await loadAll(db);
        if (currentAccount.current !== account) return;
        roomIds.current = new Map(snap.rooms.map((r) => [r.name, r.id]));
        setRooms(snap.rooms);
        set({ ...ref.current, items: snap.items, tasks: snap.tasks, notes: snap.notes });
        setSync('synced');
        void kv.setItem(itemCacheKey(account), JSON.stringify({ items: snap.items, rooms: snap.rooms })).catch(() => undefined);
        await loadPhotos(snap.photos);
      } catch {
        if (currentAccount.current === account) setSync('offline');
      }
    };
    return () => running ??= run().finally(() => { running = undefined; });
  }, [account, flushPhotos, loadPhotos, set]);

  useEffect(() => {
    const client = db;
    if (!client) return;
    let generation = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data } = client.auth.onAuthStateChange((event, session) => {
      const revision = ++generation;
      clearTimeout(timer);
      if (session) {
        setAccount(session.user.id);
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          void kv.setItem(LAST_ACCOUNT, session.user.id).catch(() => undefined);
        }
      } else if (event === 'SIGNED_OUT') {
        setAccount(null);
        void kv.removeItem(LAST_ACCOUNT).catch(() => undefined);
      } else if (event === 'INITIAL_SESSION') {
        // An expired token can produce an empty initial session when the device is offline.
        // Only restore the local account when auth confirms a retryable network error.
        timer = setTimeout(() => {
          void (async () => {
            const cached = await kv.getItem(LAST_ACCOUNT).catch(() => null);
            const result = cached && await client.auth.getSession();
            if (generation !== revision) return;
            if (!result) setAccount(null);
            else setAccount(result.data.session?.user.id ?? (isAuthRetryableFetchError(result.error) ? cached : null));
          })().catch(() => { if (generation === revision) setAccount(null); });
        }, 0);
      }
    });
    return () => {
      generation++;
      clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, []);

  // Restore the item list and last confirmed deletion permission before trying the network.
  useEffect(() => {
    const client = db;
    if (!client || account === undefined) return;
    if (!account) {
      setAuth('signedOut');
      return;
    }
    let active = true;
    setAuth('loading');
    setSync('pending');
    void (async () => {
      const [cached, cachedMember] = await Promise.all([
        readCache<{ items: Item[]; rooms: Room[] }>(itemCacheKey(account)),
        readCache<{ me?: Person; canDelete: boolean }>(memberCacheKey(account)),
      ]);
      if (!active) return;
      const cachedRooms = cached?.rooms ?? [];
      roomIds.current = new Map(cachedRooms.map((r) => [r.name, r.id]));
      setRooms(cachedRooms);
      set({ ...ref.current, me: cachedMember?.me ?? DEFAULT_PERSON, items: cached?.items ?? [], tasks: [], notes: [] });
      setMember({ account, canDelete: cachedMember?.canDelete === true });
      setAuth('signedIn');

      const { data, error } = await client.from('members').select('key,is_person').eq('user_id', account).maybeSingle();
      if (!active || error) return;
      // The database derives is_person from the two assignable member keys.
      const canDelete = data?.is_person === true;
      const me = canDelete ? data.key as Person : undefined;
      if (me) set({ ...ref.current, me });
      setMember({ account, canDelete });
      void kv.setItem(memberCacheKey(account), JSON.stringify({ me, canDelete })).catch(() => undefined);
    })().catch(() => undefined);
    return () => { active = false; };
  }, [account, set]);

  // realtime changes from the other phone, and catch-up when the app returns to the front
  useEffect(() => {
    const client = db;
    if (!client || auth !== 'signedIn' || !account) return;
    void refresh();
    const off = subscribe(client, () => void refresh());
    const app = AppState.addEventListener('change', (s) => s === 'active' && void refresh());
    const timer = setInterval(() => void refresh(), 20_000); // retries a stuck queue
    return () => {
      off();
      app.remove();
      clearInterval(timer);
    };
  }, [account, auth, refresh]);

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
      rooms,
      auth,
      sync,
      photos,
      canDeletePhotos,
      addPhoto: async (itemId, source) => {
        if (account) await kv.setItem(itemCacheKey(account), JSON.stringify({ items: ref.current.items, rooms }));
        await addPhoto(itemId, source);
        void refresh();
      },
      deletePhoto: async (photo) => {
        await deletePhoto(photo);
        void refresh();
      },
      retryPhoto: async (photo) => {
        await retryPhoto(photo);
        void refresh();
      },
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
      updateItem: (id, patch) => act({ type: 'updateItem', id, patch }),
      setItemStatus: (id, status) => act({ type: 'setItemStatus', id, status }),
      addTask: (title, assignees, opts) => act({ type: 'addTask', title, assignees, ...opts }),
      updateTask: (id, patch) => act({ type: 'updateTask', id, patch }),
      setTaskStatus: (id, person, status) => act({ type: 'setTaskStatus', id, person, status }),
      toggleStep: (id, person, stepId) => act({ type: 'toggleStep', id, person, stepId }),
      addStep: (id, title) => act({ type: 'addStep', id, title }),
      addNote: (title, opts) => act({ type: 'addNote', title, ...opts }),
      updateNote: (id, patch) => act({ type: 'updateNote', id, patch }),
    }),
    [state, rooms, auth, sync, act, account, photos, canDeletePhotos, addPhoto, deletePhoto, retryPhoto, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
