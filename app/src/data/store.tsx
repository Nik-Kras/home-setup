import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { DisplayPhoto } from '../domain/photos';
import type { SyncStatus } from '../domain/sync';
import type { Item, ItemStatus, NoteKind, Person, TaskStatus } from '../domain/types';
import { diffToOps } from './diff';
import { reducer, type Action, type ItemPatch, type NotePatch, type State, type TaskPatch } from './reducer';
import { loadAll, subscribe } from './repo';
import { seedItems, seedNotes, seedRooms, seedTasks } from './seed';
import { claimDevice } from './accountScope';
import type { PhotoSource } from './photoFiles';
import { db, kv } from './supabase';
import { syncQueue } from './syncQueue';
import { useItemPhotos } from './useItemPhotos';
import { resetWidgets, useWidgetSync } from './widgetSync';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';
export type { SyncStatus };

export type Room = { id: string; name: string };

interface Store extends State {
  /** Rooms in their sort order: loaded from the database, or the demo rooms. */
  rooms: Room[];
  auth: AuthStatus;
  sync: SyncStatus;
  /** Unsent changes in the offline queue. */
  pending: number;
  /** This account's data has fully loaded once this session (always true for demo data). */
  loaded: boolean;
  /** Try to send and load again now, such as from a Retry button. */
  retry: () => void;
  photos: DisplayPhoto[];
  canDeletePhotos: boolean;
  addPhoto: (itemId: string, source: PhotoSource) => Promise<void>;
  deletePhoto: (photo: DisplayPhoto) => Promise<void>;
  retryPhoto: (photo: DisplayPhoto) => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  /**
   * Sends what it can, then signs this phone out. Without `force` it stops when changes are still
   * unsent and returns how many, so the screen can ask first. Returns 0 once signed out.
   */
  signOut: (opts?: { force?: boolean }) => Promise<number>;
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
/** Only for demo data, and until the signed-in account's member row is known (then `me` comes from it). */
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
  const [pending, setPending] = useState(0);
  const countPending = useCallback(async () => {
    const n = syncQueue ? await syncQueue.size() : 0;
    setPending(n);
    return n;
  }, []);
  const ref = useRef(state);
  const [rooms, setRooms] = useState<Room[]>(LIVE ? [] : seedRooms);
  const roomIds = useRef(new Map<string, string>());
  const [widgetReady, setWidgetReady] = useState(false);

  const set = useCallback((next: State) => {
    ref.current = next;
    setState(next);
  }, []);

  useWidgetSync(state, ref, set, auth, widgetReady);

  // `me` comes from the signed-in account's member row. A failed lookup is retried on the next refresh.
  const memberKnown = useRef<string | null>(null);
  const lookupMember = useCallback(async (account: string) => {
    if (!db) return;
    const { data, error } = await db.from('members').select('key,is_person').eq('user_id', account).maybeSingle();
    if (error || currentAccount.current !== account) return;
    // The database derives is_person from the two assignable member keys.
    const canDelete = data?.is_person === true;
    const me = canDelete ? data.key as Person : undefined;
    if (me) set({ ...ref.current, me });
    setMember({ account, canDelete });
    memberKnown.current = account;
    void kv.setItem(memberCacheKey(account), JSON.stringify({ me, canDelete })).catch(() => undefined);
  }, [set]);

  const refresh = useMemo(() => {
    let running: Promise<void> | undefined;
    const run = async () => {
      if (!db || !syncQueue || !account) return;
      try {
        // One shared queue: app edits and widget taps (headless MARK_GOT) are sent in order.
        await syncQueue.flush();
        if (currentAccount.current !== account) return;
        // The flush stopped on a failed send: never overwrite unsent local edits, and say so.
        if ((await countPending()) > 0) return setSync('offline');
        await flushPhotos();
        if (currentAccount.current !== account) return;
        const before = ref.current;
        const snap = await loadAll(db);
        if (currentAccount.current !== account) return;
        // An edit or widget tap landed during the load: keep it and try again on the next refresh.
        // Compare the data only, so the member lookup setting `me` does not void the first load.
        const now = ref.current;
        const edited = now.items !== before.items || now.tasks !== before.tasks || now.notes !== before.notes;
        if (edited || (await syncQueue.size()) > 0) return;
        roomIds.current = new Map(snap.rooms.map((r) => [r.name, r.id]));
        setRooms(snap.rooms);
        set({ ...ref.current, items: snap.items, tasks: snap.tasks, notes: snap.notes });
        setWidgetReady(true);
        setSync('synced');
        void kv.setItem(itemCacheKey(account), JSON.stringify({ items: snap.items, rooms: snap.rooms })).catch(() => undefined);
        if (memberKnown.current !== account) void lookupMember(account).catch(() => undefined);
        await loadPhotos(snap.photos);
      } catch {
        if (currentAccount.current === account) setSync('offline');
      }
    };
    return () => running ??= run().finally(() => { running = undefined; });
  }, [account, countPending, flushPhotos, loadPhotos, lookupMember, set]);

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
        // Per-account caches go with the account. The widget snapshot is not touched here: the
        // signed-out state publishes an empty snapshot, so a widget tap cannot queue anything.
        const previous = currentAccount.current;
        setAccount(null);
        void kv.removeItem(LAST_ACCOUNT).catch(() => undefined);
        if (previous) void kv.multiRemove([itemCacheKey(previous), memberCacheKey(previous)]).catch(() => undefined);
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
    setWidgetReady(false); // widgets publish again only after this account's first full load
    if (!account) {
      setAuth('signedOut');
      return;
    }
    let active = true;
    setAuth('loading');
    setSync('pending');
    void (async () => {
      // Before the first flush: drop another account's unsent Ops and its widget snapshot.
      if (await claimDevice(kv, syncQueue, account).catch(() => false)) await resetWidgets().catch(() => undefined);
      if (!active) return;
      await countPending().catch(() => 0);
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

      if (active) await lookupMember(account);
    })().catch(() => undefined);
    return () => { active = false; };
  }, [account, countPending, lookupMember, set]);

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
      const q = syncQueue;
      if (!q) return;
      void (async () => {
        await q.enqueueAll(diffToOps(prev, next, roomIds.current));
        setSync('pending');
        await countPending();
        await q.flush();
        setSync((await countPending()) === 0 ? 'synced' : 'offline');
      })();
    },
    [set, countPending],
  );

  // Stable across renders, so memoised list rows are not redrawn on every store change.
  const actions = useMemo(
    () => ({
      advanceItem: (id: string) => act({ type: 'advanceItem', id }),
      gotItem: (id: string) => act({ type: 'gotItem', id }),
      addItem: (name: string, opts?: { room?: string; urgent?: boolean; assignedTo?: Person }) => act({ type: 'addItem', name, ...opts }),
      updateItem: (id: string, patch: ItemPatch) => act({ type: 'updateItem', id, patch }),
      setItemStatus: (id: string, status: ItemStatus) => act({ type: 'setItemStatus', id, status }),
      addTask: (title: string, assignees: Person[], opts?: { due?: string; urgent?: boolean; group?: string }) => act({ type: 'addTask', title, assignees, ...opts }),
      updateTask: (id: string, patch: TaskPatch) => act({ type: 'updateTask', id, patch }),
      setTaskStatus: (id: string, person: Person, status: TaskStatus) => act({ type: 'setTaskStatus', id, person, status }),
      toggleStep: (id: string, person: Person, stepId: string) => act({ type: 'toggleStep', id, person, stepId }),
      addStep: (id: string, title: string) => act({ type: 'addStep', id, title }),
      addNote: (title: string, opts?: { body?: string; reference?: string; kind?: NoteKind }) => act({ type: 'addNote', title, ...opts }),
      updateNote: (id: string, patch: NotePatch) => act({ type: 'updateNote', id, patch }),
    }),
    [act],
  );

  const value = useMemo<Store>(
    () => ({
      ...state,
      rooms,
      auth,
      sync,
      pending,
      loaded: !LIVE || widgetReady,
      retry: () => void refresh(),
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
      signOut: async (opts) => {
        if (!db) return 0;
        // Best effort: send this account's edits while its session is still valid.
        await syncQueue?.flush().catch(() => undefined);
        const left = await countPending().catch(() => 0);
        if (left > 0 && !opts?.force) return left;
        // Local scope: signs out this phone only, and works offline. Unsent Ops stay with this
        // account and are sent if it signs in again (accountScope.ts drops them for another account).
        await db.auth.signOut({ scope: 'local' });
        return 0;
      },
      ...actions,
    }),
    [state, rooms, auth, sync, pending, widgetReady, actions, account, photos, canDeletePhotos, addPhoto, deletePhoto, retryPhoto, refresh, countPending],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
