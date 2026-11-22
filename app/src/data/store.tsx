import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { DisplayPhoto } from '../domain/photos';
import { identityFor, memberIdentity, type Identity, type SyncStatus } from '../domain/sync';
import type { Item, ItemStatus, NoteKind, Person, TaskStatus } from '../domain/types';
import { asksForPrice } from '../domain/items';
import { diffToOps } from './diff';
import { newId } from './mappers';
import type { Op } from './queue';
import { reducer, type Action, type ItemPatch, type NotePatch, type State, type TaskPatch } from './reducer';
import { loadAll, ops, subscribe } from './repo';
import { afterUndoSnack, applyUndo, offerSnack, popUndo, pushUndo, undoEntryFor, type Snack, type UndoEntry } from './undo';
import { seedItems, seedNotes, seedRooms, seedTasks } from './seed';
import { claimDevice } from './accountScope';
import type { PhotoSource } from './photoFiles';
import { db, kv } from './supabase';
import { missListeners, syncQueue } from './syncQueue';
import { useItemPhotos } from './useItemPhotos';
import { trySignOut } from './signOut';
import { resetIosWidget, useIosWidgetSync } from './iosWidgetSync';
import { resetWidgets, useWidgetSync } from './widgetSync';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';
export type { Identity, SyncStatus };

export type Room = { id: string; name: string };

interface Store extends State {
  /** Rooms in their sort order: loaded from the database, or the demo rooms. */
  rooms: Room[];
  auth: AuthStatus;
  sync: SyncStatus;
  /** Unsent changes in the offline queue. */
  pending: number;
  /** Whether `me` is known yet (see domain/sync.ts). Signed-in screens wait for it. */
  identity: Identity;
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
   * Sends what it can (edits and photos, up to 5 s), then signs this phone out. Without `force` it
   * stops when anything is still unsent and returns how many, so the screen can ask first. Returns 0
   * once signed out.
   */
  signOut: (opts?: { force?: boolean }) => Promise<number>;
  /** Moves an item exactly one stage on. */
  advanceItem: (id: string) => void;
  addItem: (name: string, opts?: { room?: string; urgent?: boolean; assignedTo?: Person }) => void;
  updateItem: (id: string, patch: ItemPatch) => void;
  setItemStatus: (id: string, status: ItemStatus) => void;
  /** Soft delete: hidden at once, deleted_at in the database, and Undo brings it back. */
  deleteItem: (id: string) => void;
  addTask: (title: string, assignees: Person[], opts?: { due?: string; urgent?: boolean; group?: string }) => void;
  /** Fields, and optionally who the task is for (people added or taken off; the others' parts stay). */
  updateTask: (id: string, patch: TaskPatch, assignees?: Person[]) => void;
  /** Soft delete with Undo. */
  deleteTask: (id: string) => void;
  setTaskStatus: (id: string, person: Person, status: TaskStatus) => void;
  toggleStep: (id: string, person: Person, stepId: string) => void;
  addStep: (id: string, title: string) => void;
  addNote: (title: string, opts?: { body?: string; reference?: string; kind?: NoteKind }) => void;
  updateNote: (id: string, patch: NotePatch) => void;
  /** Soft delete with Undo. */
  deleteNote: (id: string) => void;
  /** The snackbar after an edit ("Kettle → Ordered. Undo") or after an Undo; null when hidden. */
  snack: Snack | null;
  /** Undo the most recent edit still on the stack (see undo.ts). */
  undo: () => void;
  /** Hide the snackbar if it still shows `key` (its timer ran out). */
  dismissSnack: (key: string) => void;
  /** The item that has just arrived, for the optional "Paid?" prompt; null when none. */
  pricePrompt: string | null;
  closePricePrompt: () => void;
}

const Ctx = createContext<Store | null>(null);
const LIVE = db !== null;
/**
 * Demo data acts as this person, and so does a non-person account (identity `standIn`, shown on
 * screen). For a person `me` comes from their member row; screens wait for it (identity `loading`).
 */
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
  const { photos, addPhoto, deletePhoto, retryPhoto, flushPhotos, loadPhotos, unsentPhotos } =
    useItemPhotos(LIVE ? account ?? null : 'demo', canDeletePhotos);
  const currentAccount = useRef(account);
  currentAccount.current = account;
  const [sync, setSync] = useState<SyncStatus>(LIVE ? 'pending' : 'demo');
  const [pending, setPending] = useState(0);
  const [identity, setIdentity] = useState<Identity>(LIVE ? 'loading' : 'known');
  const countPending = useCallback(async () => {
    const n = syncQueue ? await syncQueue.size() : 0;
    setPending(n);
    return n;
  }, []);
  const ref = useRef(state);
  const [rooms, setRooms] = useState<Room[]>(LIVE ? [] : seedRooms);
  const roomIds = useRef(new Map<string, string>());
  const [widgetReady, setWidgetReady] = useState(false);

  const undoStack = useRef<UndoEntry[]>([]);
  /** The last Undo's sent patches, to correct its snackbar if the server kept the other person's value. */
  const lastUndo = useRef<{ key: string; ids: Set<string>; missed: number } | null>(null);
  const [snack, setSnack] = useState<Snack | null>(null);
  const [pricePrompt, setPricePrompt] = useState<string | null>(null);

  const set = useCallback((next: State) => {
    ref.current = next;
    setState(next);
  }, []);

  useWidgetSync(state, ref, set, auth, widgetReady);
  useIosWidgetSync(state, ref, set, auth, widgetReady);

  // `me` comes from the signed-in account's member row. A failed lookup is retried on the next refresh.
  const memberKnown = useRef<string | null>(null);
  const lookupMember = useCallback(async (account: string) => {
    if (!db) return;
    setIdentity((i) => (i === 'failed' ? 'loading' : i));
    const { data, error } = await db.from('members').select('key,is_person').eq('user_id', account).maybeSingle()
      .then((r) => r, (thrown: unknown) => ({ data: null, error: thrown }));
    if (currentAccount.current !== account) return;
    // A cached identity stays; without one the screens show a retry rather than guessing a person.
    if (error) return setIdentity((i) => (i === 'loading' ? 'failed' : i));
    // No member row: not one of the household, so never shown as the test account (see memberIdentity).
    const found = memberIdentity(data as { key: string; is_person: boolean } | null);
    if (found.identity === 'failed') return setIdentity('failed');
    const { me, canDelete } = found;
    set({ ...ref.current, me: me ?? DEFAULT_PERSON });
    setIdentity(found.identity);
    setMember({ account, canDelete });
    memberKnown.current = account;
    void kv.setItem(memberCacheKey(account), JSON.stringify({ me, canDelete })).catch(() => undefined);
  }, [set]);

  const refresh = useMemo(() => {
    let running: Promise<void> | undefined;
    const trigger = (): Promise<void> => running ??= run().finally(() => { running = undefined; });
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
        // Try again shortly, so `loaded` does not wait for the 20 s timer.
        if (edited || (await syncQueue.size()) > 0) return void setTimeout(() => void trigger(), 1_000);
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
    return trigger;
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
    // Undo belongs to the account that made the edit.
    undoStack.current = [];
    setSnack(null);
    setPricePrompt(null);
    setIdentity('loading');
    if (!account) {
      setAuth('signedOut');
      return;
    }
    let active = true;
    setAuth('loading');
    setSync('pending');
    void (async () => {
      // Before the first flush: drop another account's unsent Ops and its widget snapshot.
      if (await claimDevice(kv, syncQueue, account).catch(() => false)) {
        await Promise.all([resetWidgets().catch(() => undefined), resetIosWidget()]);
      }
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
      setIdentity(identityFor(cachedMember));
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

  /**
   * Show the new state at once, then queue its ops and send them. `out` may be worked out after the
   * screen has changed (Undo first tries to take unsent ops back from the queue).
   */
  const commit = useCallback(
    (next: State, out: Op[] | ((q: NonNullable<typeof syncQueue>) => Promise<Op[]>)) => {
      set(next);
      const q = syncQueue;
      if (!q) return;
      void (async () => {
        const list = typeof out === 'function' ? await out(q) : out;
        if (list.length > 0) {
          await q.enqueueAll(list);
          setSync('pending');
          await countPending();
          await q.flush();
        }
        setSync((await countPending()) === 0 ? 'synced' : 'offline');
      })();
    },
    [set, countPending],
  );

  const act = useCallback(
    (action: Action) => {
      const prev = ref.current;
      const next = reducer(prev, action);
      if (next === prev) return;
      // A delete is explicit: diffToOps never turns a missing row into a delete.
      const out = action.type === 'deleteItem' ? [ops.softDelete('items', action.id)]
        : action.type === 'deleteTask' ? [ops.softDelete('tasks', action.id)]
          : action.type === 'deleteNote' ? [ops.softDelete('flat_notes', action.id)]
            : diffToOps(prev, next, roomIds.current);
      commit(next, out);
      const entry = undoEntryFor(prev, next, action, Date.now(), newId());
      if (entry) {
        undoStack.current = pushUndo(undoStack.current, { ...entry, opIds: out.map((o) => o.id) });
        setSnack(offerSnack(entry));
      }
      if (action.type === 'advanceItem' || action.type === 'setItemStatus') {
        const before = prev.items.find((i) => i.id === action.id);
        const after = next.items.find((i) => i.id === action.id);
        if (before && after && asksForPrice(before, after)) setPricePrompt(after.id);
      }
    },
    [commit],
  );

  // An Undo patch matched no row: the other person changed that field first, and theirs stayed.
  // Say so on the snackbar if it is still up, and load again so the screen shows their value.
  useEffect(() => {
    const listener = (op: Op) => {
      const last = lastUndo.current;
      if (!last?.ids.has(op.id)) return;
      last.missed++;
      setSnack((cur) => (cur?.key === last.key ? afterUndoSnack(last.missed >= last.ids.size ? 'none' : 'partial', last.key) : cur));
      void refresh();
    };
    missListeners.add(listener);
    return () => { missListeners.delete(listener); };
  }, [refresh]);

  const undo = useCallback(() => {
    const { entry, rest } = popUndo(undoStack.current);
    if (!entry) return;
    undoStack.current = rest;
    const prev = ref.current;
    const result = applyUndo(prev, entry, roomIds.current);
    const key = newId();
    const sent = { key, ids: new Set<string>(), missed: 0 };
    lastUndo.current = sent;
    setSnack(afterUndoSnack(result.outcome, key));
    // The "Paid?" prompt belongs to that arrival: once undone it is gone for good, even if the other
    // phone marks the item delivered later.
    if (entry.change.kind === 'item') {
      const id = entry.change.before.id;
      setPricePrompt((cur) => (cur === id ? null : cur));
    }
    if (result.state === prev) return;
    commit(result.state, async (q) => {
      // Still unsent (offline, or not flushed yet): take the edit back, so the server never sees it.
      // Otherwise send the conditional inverse patches (see undo.ts).
      const unsent = result.outcome === 'done' && entry.opIds !== undefined && await q.cancel(entry.opIds);
      const out = unsent ? [] : result.ops;
      out.forEach((op) => sent.ids.add(op.id));
      return out;
    });
  }, [commit]);

  // Stable across renders, so memoised list rows are not redrawn on every store change.
  const actions = useMemo(
    () => ({
      advanceItem: (id: string) => act({ type: 'advanceItem', id }),
      addItem: (name: string, opts?: { room?: string; urgent?: boolean; assignedTo?: Person }) => act({ type: 'addItem', name, ...opts }),
      updateItem: (id: string, patch: ItemPatch) => act({ type: 'updateItem', id, patch }),
      setItemStatus: (id: string, status: ItemStatus) => act({ type: 'setItemStatus', id, status }),
      deleteItem: (id: string) => act({ type: 'deleteItem', id }),
      addTask: (title: string, assignees: Person[], opts?: { due?: string; urgent?: boolean; group?: string }) => act({ type: 'addTask', title, assignees, ...opts }),
      updateTask: (id: string, patch: TaskPatch, assignees?: Person[]) => act({ type: 'updateTask', id, patch, ...(assignees ? { assignees } : {}) }),
      deleteTask: (id: string) => act({ type: 'deleteTask', id }),
      setTaskStatus: (id: string, person: Person, status: TaskStatus) => act({ type: 'setTaskStatus', id, person, status }),
      toggleStep: (id: string, person: Person, stepId: string) => act({ type: 'toggleStep', id, person, stepId }),
      addStep: (id: string, title: string) => act({ type: 'addStep', id, title }),
      addNote: (title: string, opts?: { body?: string; reference?: string; kind?: NoteKind }) => act({ type: 'addNote', title, ...opts }),
      updateNote: (id: string, patch: NotePatch) => act({ type: 'updateNote', id, patch }),
      deleteNote: (id: string) => act({ type: 'deleteNote', id }),
      undo,
      dismissSnack: (key: string) => setSnack((cur) => (cur?.key === key ? null : cur)),
      closePricePrompt: () => setPricePrompt(null),
    }),
    [act, undo],
  );

  const value = useMemo<Store>(
    () => ({
      ...state,
      snack,
      pricePrompt,
      rooms,
      auth,
      sync,
      pending,
      loaded: !LIVE || widgetReady,
      identity,
      retry: () => {
        void refresh();
        if (account && memberKnown.current !== account) void lookupMember(account);
      },
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
        const client = db;
        if (!client) return 0;
        return trySignOut({
          // Best effort: send this account's edits and photos while its session is still valid.
          flush: async () => {
            await syncQueue?.flush();
            await flushPhotos();
          },
          unsent: async () => (await countPending()) + (await unsentPhotos()),
          // Local scope: signs out this phone only, and works offline. Unsent edits and photos stay
          // with this account and are sent if it signs in again; another account's sign-in drops them.
          signOut: async () => { await client.auth.signOut({ scope: 'local' }); },
        }, opts);
      },
      ...actions,
    }),
    [state, snack, pricePrompt, rooms, auth, sync, pending, identity, widgetReady, actions, account, photos, canDeletePhotos, addPhoto, deletePhoto, retryPhoto, refresh, countPending, lookupMember, flushPhotos, unsentPhotos],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
