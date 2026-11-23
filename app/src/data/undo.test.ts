import { describe, expect, it } from 'vitest';
import { budgetView } from '../domain/budgetView';
import type { Item, Task } from '../domain/types';
import { OpQueue, type KV, type Op } from './queue';
import { makeExecutor, ops } from './repo';
import { reducer, type Action, type State } from './reducer';
import { afterUndoSnack, applyUndo, claimNotice, offerSnack, popUndo, pushUndo, UNDO_LIMIT, undoEntryFor, type UndoEntry } from './undo';

const rooms = new Map([['Kitchen', 'room-k'], ['Hallway', 'room-h']]);
const kettle: Item = { id: 'i1', name: 'Kettle', status: 'needed', quantity: 1, urgent: false, needsInstall: false, room: 'Kitchen', addedAt: '2026-11-21T10:00:00Z', updatedBy: 'claude' };
const router: Item = { id: 'i2', name: 'Router', status: 'ordered', quantity: 1, urgent: true, needsInstall: true, addedAt: '2026-11-21T11:00:00Z', updatedBy: 'claude' };
const gp: Task = {
  id: 't1', title: 'Register with a GP', urgent: false, updatedBy: 'claude',
  assignments: [
    { person: 'nikita', status: 'todo', steps: [{ id: 's1', title: 'Pick a practice', done: false }] },
    { person: 'daryna', status: 'todo', steps: [{ id: 's2', title: 'Pick a practice', done: false }] },
  ],
};
const start: State = { me: 'nikita', items: [kettle, router], tasks: [gp], notes: [] };

/** Do an action the way the store does: new state plus its Undo entry. */
function edit(state: State, action: Action, at = 1_000): { next: State; entry: UndoEntry } {
  const next = reducer(state, action);
  const entry = undoEntryFor(state, next, action, at, `u${at}`);
  if (!entry) throw new Error(`no undo entry for ${action.type}`);
  return { next, entry };
}

const item = (s: State, id = 'i1') => s.items.find((i) => i.id === id)!;
/** The other phone's change arriving by realtime. */
const otherPhone = (s: State, id: string, patch: Partial<Item>): State => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...patch, updatedBy: 'daryna' } : i)) });

describe('stage stepping', () => {
  it('moves exactly one stage per tap, and installed only for things that need installing', () => {
    let s = start;
    const seen: string[] = [];
    for (let n = 0; n < 6; n++) {
      s = reducer(s, { type: 'advanceItem', id: 'i1' });
      seen.push(item(s).status);
    }
    expect(seen).toEqual(['looking', 'ordered', 'delivered', 'delivered', 'delivered', 'delivered']);
    expect(item(reducer(start, { type: 'advanceItem', id: 'i2' }), 'i2').status).toBe('delivered');
    const delivered = reducer(start, { type: 'advanceItem', id: 'i2' });
    expect(item(reducer(delivered, { type: 'advanceItem', id: 'i2' }), 'i2').status).toBe('installed');
  });

  it('a finished item does not move, so nothing is sent and no Undo is offered', () => {
    const done: State = { ...start, items: [{ ...kettle, status: 'delivered', deliveredAt: '2026-11-22T09:00:00Z' }] };
    expect(reducer(done, { type: 'advanceItem', id: 'i1' })).toBe(done);
  });

  it('the status sheet moves backwards too, clearing the dates of the stages left', () => {
    const got = reducer(start, { type: 'setItemStatus', id: 'i1', status: 'delivered' });
    const back = reducer(got, { type: 'setItemStatus', id: 'i1', status: 'ordered' });
    expect(item(back)).toMatchObject({ status: 'ordered', deliveredAt: undefined, updatedBy: 'nikita' });
  });
});

describe('undo entries', () => {
  it('describes each kind of edit in plain words', () => {
    const msg = (action: Action, s: State = start) => edit(s, action).entry.message;
    expect(msg({ type: 'advanceItem', id: 'i1' })).toBe('Kettle → Looking');
    expect(edit(start, { type: 'advanceItem', id: 'i1' }).entry.spoken).toBe('Kettle moved to Looking');
    expect(msg({ type: 'setItemStatus', id: 'i2', status: 'needed' })).toBe('Router → Needed');
    // A price saved with no buyer counts as bought by me.
    expect(msg({ type: 'updateItem', id: 'i1', patch: { actualPrice: 24.5 } })).toBe('Kettle → paid £24.50 by Nikita');
    expect(msg({ type: 'updateItem', id: 'i1', patch: { actualPrice: 25, boughtBy: 'daryna' } })).toBe('Kettle → paid £25 by Daryna');
    expect(msg({ type: 'updateItem', id: 'i1', patch: { quantity: 2, urgent: true } })).toBe('Kettle → updated');
    expect(msg({ type: 'updateItem', id: 'i1', patch: { estPrice: 30 } })).toBe('Kettle → estimate £30');
    expect(msg({ type: 'updateItem', id: 'i1', patch: { quantity: 2 } })).toBe('Kettle → quantity 2');
    expect(msg({ type: 'updateItem', id: 'i1', patch: { assignedTo: 'daryna' } })).toBe('Kettle → assigned to Daryna');
    expect(msg({ type: 'updateItem', id: 'i1', patch: { boughtBy: 'nikita' } })).toBe('Kettle → bought by Nikita');
    expect(msg({ type: 'updateItem', id: 'i1', patch: { urgent: true } })).toBe('Kettle → urgent');
    expect(msg({ type: 'updateItem', id: 'i1', patch: { room: undefined } })).toBe('Kettle → no room');
    expect(msg({ type: 'updateItem', id: 'i1', patch: { name: 'Electric kettle' } })).toBe('Renamed to Electric kettle');
    expect(msg({ type: 'deleteItem', id: 'i1' })).toBe('Kettle deleted');
    expect(msg({ type: 'setTaskStatus', id: 't1', person: 'nikita', status: 'done' })).toBe('Marked done: Register with a GP');
    expect(msg({ type: 'setTaskStatus', id: 't1', person: 'nikita', status: 'in_progress' })).toBe('Register with a GP → In progress');
    expect(msg({ type: 'toggleStep', id: 't1', person: 'nikita', stepId: 's1' })).toBe('Step ticked: Pick a practice');
    const done = edit(start, { type: 'setTaskStatus', id: 't1', person: 'nikita', status: 'done' }).next;
    expect(msg({ type: 'setTaskStatus', id: 't1', person: 'nikita', status: 'todo' }, done)).toBe('Marked not done: Register with a GP');
  });

  it('adding a task and edits that change nothing are not undoable', () => {
    const add: Action = { type: 'addTask', title: 'Book a van', assignees: ['nikita'] };
    expect(undoEntryFor(start, reducer(start, add), add, 1, 'x')).toBeUndefined();
    const same: Action = { type: 'updateItem', id: 'i1', patch: { quantity: 1 } };
    expect(undoEntryFor(start, reducer(start, same), same, 1, 'x')).toBeUndefined();
  });
});

describe('applyUndo: inverse patches', () => {
  it('a status change goes back with its dates, as a patch that applies only while the status is still the one set', () => {
    const { next, entry } = edit(start, { type: 'setItemStatus', id: 'i1', status: 'delivered' });
    expect(item(next).deliveredAt).toBeTruthy();
    const undone = applyUndo(next, entry, rooms);
    expect(undone.outcome).toBe('done');
    expect(item(undone.state)).toEqual({ ...kettle, updatedBy: 'nikita' });
    expect(undone.ops).toEqual([{ id: expect.any(String), kind: 'patch', table: 'items', match: { id: 'i1', status: 'delivered' }, row: { status: 'needed', delivered_at: null, installed_at: null }, reportMiss: true }]);
  });

  it('moving back from delivered and undoing restores the original delivered date', () => {
    const got: State = { ...start, items: [{ ...kettle, status: 'delivered', deliveredAt: '2026-11-20T09:00:00Z' }] };
    const { next, entry } = edit(got, { type: 'setItemStatus', id: 'i1', status: 'ordered' });
    const undone = applyUndo(next, entry, rooms);
    expect(item(undone.state)).toMatchObject({ status: 'delivered', deliveredAt: '2026-11-20T09:00:00Z' });
    expect(undone.ops[0]).toMatchObject({ match: { id: 'i1', status: 'ordered' }, row: { status: 'delivered', delivered_at: '2026-11-20T09:00:00Z' } });
  });

  it('a field edit goes back field by field, each conditional on the value this edit set', () => {
    const { next, entry } = edit(start, { type: 'updateItem', id: 'i1', patch: { actualPrice: 25, room: 'Hallway', assignedTo: 'daryna' } });
    const undone = applyUndo(next, entry, rooms);
    expect(item(undone.state)).toEqual({ ...kettle, updatedBy: 'nikita' });
    const paidAt = item(next).pricePaidAt!;
    expect(undone.ops.map((o) => [(o as Extract<Op, { kind: 'patch' }>).match, o.row])).toEqual([
      [{ id: 'i1', room_id: 'room-h' }, { room_id: 'room-k' }],
      [{ id: 'i1', actual_price: 25 }, { actual_price: null }],
      // The paid time goes back with the price, only while it is still the time this edit set.
      [{ id: 'i1', price_paid_at: paidAt }, { price_paid_at: null }],
      [{ id: 'i1', assigned_to: 'daryna' }, { assigned_to: null }],
      [{ id: 'i1', bought_by: 'nikita' }, { bought_by: null }],
    ]);
  });

  it('clearing a price and undoing matches the empty value as null', () => {
    const priced: State = { ...start, items: [{ ...kettle, estPrice: 30 }] };
    const { next, entry } = edit(priced, { type: 'updateItem', id: 'i1', patch: { estPrice: undefined } });
    expect(applyUndo(next, entry, rooms).ops[0]).toMatchObject({ match: { id: 'i1', est_price: null }, row: { est_price: 30 } });
  });

  it('when the other person changed the same field since, Undo leaves their value and says so', () => {
    const { next, entry } = edit(start, { type: 'setItemStatus', id: 'i1', status: 'ordered' });
    const theirs = otherPhone(next, 'i1', { status: 'delivered', deliveredAt: '2026-11-22T10:00:00Z' });
    const undone = applyUndo(theirs, entry, rooms);
    expect(undone.outcome).toBe('none');
    expect(undone.state).toBe(theirs);
    expect(undone.ops).toEqual([]);
  });

  it('when they changed a different field, Undo still reverts mine and keeps theirs', () => {
    const { next, entry } = edit(start, { type: 'updateItem', id: 'i1', patch: { actualPrice: 25 } });
    const theirs = otherPhone(next, 'i1', { notes: 'Matte black' });
    const undone = applyUndo(theirs, entry, rooms);
    expect(undone.outcome).toBe('done');
    expect(item(undone.state)).toMatchObject({ actualPrice: undefined, boughtBy: undefined, notes: 'Matte black' });
  });

  it('partly undone when only some of the fields were changed since', () => {
    const { next, entry } = edit(start, { type: 'updateItem', id: 'i1', patch: { actualPrice: 25, urgent: true } });
    const theirs = otherPhone(next, 'i1', { actualPrice: 27 });
    const undone = applyUndo(theirs, entry, rooms);
    expect(undone.outcome).toBe('partial');
    expect(item(undone.state)).toMatchObject({ actualPrice: 27, urgent: false, boughtBy: undefined });
    expect(undone.ops).toHaveLength(2); // urgent and the buyer that came with the price
  });

  it('an item deleted on the other phone since is not brought back by undoing a field edit', () => {
    const { next, entry } = edit(start, { type: 'updateItem', id: 'i1', patch: { quantity: 3 } });
    const gone: State = { ...next, items: next.items.filter((i) => i.id !== 'i1') };
    expect(applyUndo(gone, entry, rooms)).toEqual({ state: gone, ops: [], outcome: 'none' });
  });

  it('undoing a delete puts the item back in its place and clears deleted_at', () => {
    const { next, entry } = edit(start, { type: 'deleteItem', id: 'i1' });
    expect(next.items.map((i) => i.id)).toEqual(['i2']);
    const undone = applyUndo(next, entry, rooms);
    expect(undone.state.items.map((i) => i.id)).toEqual(['i1', 'i2']);
    expect(undone.ops).toEqual([{ id: expect.any(String), kind: 'patch', table: 'items', match: { id: 'i1' }, row: { deleted_at: null } }]);
  });

  it('a room with no known id is put back on screen but never sent as a cleared room', () => {
    const { next, entry } = edit(start, { type: 'updateItem', id: 'i1', patch: { room: 'Attic' } });
    const undone = applyUndo(next, entry, rooms);
    expect(item(undone.state).room).toBe('Kitchen');
    expect(undone.ops).toEqual([]);
  });

  it('my task part goes back only while it still has the status I set; the other part is never touched', () => {
    const { next, entry } = edit(start, { type: 'setTaskStatus', id: 't1', person: 'nikita', status: 'done' });
    const undone = applyUndo(next, entry, rooms);
    expect(undone.state.tasks[0]!.assignments.map((a) => a.status)).toEqual(['todo', 'todo']);
    expect(undone.ops).toEqual([{ id: expect.any(String), kind: 'patch', table: 'task_assignments', match: { task_id: 't1', person: 'nikita', status: 'done' }, row: { status: 'todo' }, reportMiss: true }]);
    expect(undone.state.tasks[0]!.assignments[1]).toBe(next.tasks[0]!.assignments[1]);
  });

  it('a step tick goes back conditionally, and not if it was changed since', () => {
    const { next, entry } = edit(start, { type: 'toggleStep', id: 't1', person: 'nikita', stepId: 's1' });
    const undone = applyUndo(next, entry, rooms);
    expect(undone.state.tasks[0]!.assignments[0]!.steps[0]!.done).toBe(false);
    expect(undone.ops).toEqual([{ id: expect.any(String), kind: 'patch', table: 'task_steps', match: { id: 's1', done: true }, row: { done: false }, reportMiss: true }]);
    // Unticked again by hand since: nothing left to undo.
    const again = reducer(next, { type: 'toggleStep', id: 't1', person: 'nikita', stepId: 's1' });
    expect(applyUndo(again, entry, rooms).outcome).toBe('none');
  });

  it('two quick taps are undone one at a time, back to where it started', () => {
    const a = edit(start, { type: 'advanceItem', id: 'i1' }, 1_000);
    const b = edit(a.next, { type: 'advanceItem', id: 'i1' }, 1_500);
    let stack = pushUndo(pushUndo([], a.entry), b.entry);
    let s = b.next;
    for (const expected of ['looking', 'needed']) {
      const { entry, rest } = popUndo(stack);
      s = applyUndo(s, entry!, rooms).state;
      stack = rest;
      expect(item(s).status).toBe(expected);
    }
    expect(stack).toEqual([]);
  });
});

describe('conditional undo against the server', () => {
  /** A fake items table behind the real executor, applying patches only where every match column holds. */
  function fakeServer(rows: Record<string, Record<string, unknown>>) {
    const db = {
      from: () => ({
        update: (row: Record<string, unknown>) => {
          const conds: [string, unknown][] = [];
          const q = {
            eq: (k: string, v: unknown) => (conds.push([k, v]), q),
            is: (k: string, v: null) => (conds.push([k, v]), q),
            then: (ok: (r: { error: null; count: number }) => void) => {
              let count = 0;
              for (const r of Object.values(rows)) if (conds.every(([k, v]) => (r[k] ?? null) === v)) (Object.assign(r, row), count++);
              ok({ error: null, count });
            },
          };
          return q;
        },
      }),
    };
    return makeExecutor(db as never);
  }
  const memory = (): KV => {
    const m = new Map<string, string>();
    return { getItem: async (k) => m.get(k) ?? null, setItem: async (k, v) => void m.set(k, v) };
  };

  it('offline: Undo takes the unsent edit back from the queue, so the other person\'s change stays', async () => {
    const server = { i1: { id: 'i1', status: 'needed', delivered_at: null as string | null } };
    const queue = new OpQueue(memory(), fakeServer(server));
    const forward: Op = { id: 'f1', kind: 'patch', table: 'items', match: { id: 'i1' }, row: { status: 'ordered' } };
    await queue.enqueue(forward); // offline: not sent
    server.i1.status = 'delivered'; // the other phone, online
    expect(await queue.cancel(['f1'])).toBe(true);
    await queue.flush();
    expect(server.i1.status).toBe('delivered');
    expect(await queue.size()).toBe(0);
  });

  it('an edit already sent cannot be taken back; the conditional inverse is sent instead', async () => {
    const server = { i1: { id: 'i1', status: 'needed', delivered_at: null as string | null } };
    const queue = new OpQueue(memory(), fakeServer(server));
    const { next, entry } = edit(start, { type: 'setItemStatus', id: 'i1', status: 'ordered' });
    await queue.enqueue({ id: 'f1', kind: 'patch', table: 'items', match: { id: 'i1' }, row: { status: 'ordered' } });
    await queue.flush();
    expect(await queue.cancel(['f1'])).toBe(false);
    await queue.enqueueAll(applyUndo(next, entry, rooms).ops);
    await queue.flush();
    expect(server.i1.status).toBe('needed');
  });

  it('an op that was tried without a clear answer, or is being sent, is never cancelled', async () => {
    let calls = 0;
    let release: (o: 'ok') => void = () => undefined;
    const exec = (): Promise<'ok' | 'retry'> => (++calls === 1 ? Promise.resolve('retry') : new Promise((r) => { release = r; }));
    const queue = new OpQueue(memory(), exec);
    await queue.enqueueAll([
      { id: 'a', kind: 'patch', table: 'items', match: { id: 'i1' }, row: { quantity: 2 } },
      { id: 'b', kind: 'patch', table: 'items', match: { id: 'i2' }, row: { quantity: 2 } },
    ]);
    await queue.flush(); // 'a' failed with no clear answer: it may have reached the server
    expect(await queue.cancel(['a'])).toBe(false);
    const sending = queue.flush(); // 'a' again, now in flight
    await new Promise((r) => setTimeout(r, 0));
    expect(await queue.cancel(['a'])).toBe(false);
    expect(await queue.cancel(['a', 'b'])).toBe(false); // all or nothing
    expect(await queue.size()).toBe(2);
    release('ok');
    await new Promise((r) => setTimeout(r, 0));
    // 'b' is now in flight too; once done, nothing is left.
    release('ok');
    await sending;
    expect(await queue.size()).toBe(0);
    expect(await queue.cancel([])).toBe(false);
  });

  it('online: the other person moves it on after my edit landed; my late Undo changes nothing', async () => {
    const server = { i1: { id: 'i1', status: 'ordered', delivered_at: null as string | null } };
    const missed: Op[] = [];
    const queue = new OpQueue(memory(), fakeServer(server), undefined, (op) => missed.push(op));
    const { next, entry } = edit(start, { type: 'setItemStatus', id: 'i1', status: 'ordered' });
    server.i1.status = 'delivered'; // theirs, after mine
    const inverse = applyUndo(next, entry, rooms).ops;
    await queue.enqueueAll(inverse);
    await queue.flush();
    expect(server.i1.status).toBe('delivered');
    // The phone is told, so the snackbar can say "Not undone" instead of "Undone".
    expect(missed.map((o) => o.id)).toEqual(inverse.map((o) => o.id));
    expect(await queue.size()).toBe(0); // no match is not an error: the op is done, not retried
  });

  it('a cleared price is matched with IS NULL', async () => {
    const server = { i1: { id: 'i1', est_price: null as number | null } };
    const queue = new OpQueue(memory(), fakeServer(server));
    const priced: State = { ...start, items: [{ ...kettle, estPrice: 30 }] };
    const { next, entry } = edit(priced, { type: 'updateItem', id: 'i1', patch: { estPrice: undefined } });
    await queue.enqueueAll(applyUndo(next, entry, rooms).ops);
    await queue.flush();
    expect(server.i1.est_price).toBe(30);
  });
});

describe('the undo stack and snackbar', () => {
  const entry = (n: number, at = n * 1_000): UndoEntry => ({ ...edit(start, { type: 'updateItem', id: 'i1', patch: { quantity: n + 1 } }, at).entry, id: `e${n}` });

  it('keeps the newest ten', () => {
    let stack: UndoEntry[] = [];
    for (let n = 1; n <= UNDO_LIMIT + 3; n++) stack = pushUndo(stack, entry(n));
    expect(stack).toHaveLength(UNDO_LIMIT);
    expect(stack[0]!.id).toBe('e4');
    expect(popUndo(stack).entry!.id).toBe(`e${UNDO_LIMIT + 3}`);
    expect(popUndo([])).toEqual({ entry: undefined, rest: [] });
  });

  it('offers Undo after an edit and announces it', () => {
    expect(offerSnack(entry(1))).toEqual({ key: 'e1', message: 'Kettle → quantity 2', spoken: 'Kettle, quantity 2. Undo available.', canUndo: true, ms: 6_000 });
  });

  it('after an Undo it only says how it went: no second Undo in the same spot, so a double tap undoes one edit', () => {
    expect(afterUndoSnack('done', 'k')).toEqual({ key: 'k', message: 'Undone', spoken: 'Undone.', canUndo: false, ms: 6_000 });
    expect(afterUndoSnack('none', 'k')).toMatchObject({ message: 'Not undone: it was changed since', canUndo: false });
    expect(afterUndoSnack('partial', 'k')).toMatchObject({ message: 'Partly undone: some of it was changed since', canUndo: false });
  });
});

describe('prices and the budget', () => {
  it('a price entered after delivery counts as spent; its Undo takes it out again', () => {
    const got = reducer(start, { type: 'setItemStatus', id: 'i1', status: 'delivered' });
    const priced = edit(got, { type: 'updateItem', id: 'i1', patch: { actualPrice: 24.99, boughtBy: 'nikita' } });
    const withRouter = reducer(priced.next, { type: 'updateItem', id: 'i2', patch: { estPrice: 60 } });
    const view = budgetView(withRouter.items);
    expect(view).toMatchObject({ spent: 24.99, toBuy: 60, estimatedTotal: 84.99, byPerson: { nikita: 24.99, daryna: 0 } });
    expect(view.rooms.reduce((sum, r) => sum + r.total, 0)).toBeCloseTo(84.99);
    const undone = applyUndo(withRouter, priced.entry, rooms).state;
    expect(budgetView(undone.items)).toMatchObject({ spent: 0, toBuy: 60 });
  });

  it('an estimate stops counting as "to buy" once the item is got, and a deleted item counts for nothing', () => {
    const est = reducer(start, { type: 'updateItem', id: 'i1', patch: { estPrice: 25 } });
    expect(budgetView(est.items).toBuy).toBe(25);
    expect(budgetView(reducer(est, { type: 'setItemStatus', id: 'i1', status: 'delivered' }).items).toBuy).toBe(0);
    expect(budgetView(reducer(est, { type: 'deleteItem', id: 'i1' }).items).toBuy).toBe(0);
  });
});

describe('executor: conditional patches report a miss', () => {
  const db = (count: number, seen: unknown[]) => ({
    from: () => ({
      update: (_row: unknown, opts?: unknown) => {
        seen.push(opts);
        const q = { eq: () => q, is: () => q, then: (ok: (r: { error: null; count: number | null }) => void) => ok({ error: null, count: opts ? count : null }) };
        return q;
      },
    }),
  }) as never;

  it('an Undo patch that matched no row is "missed"; one that matched is ok', async () => {
    const op = applyUndo(...(() => { const { next, entry } = edit(start, { type: 'updateItem', id: 'i1', patch: { quantity: 2 } }); return [next, entry, rooms] as const; })()).ops[0]!;
    const seen: unknown[] = [];
    expect(await makeExecutor(db(0, seen))(op)).toBe('missed');
    expect(await makeExecutor(db(1, seen))(op)).toBe('ok');
    expect(seen).toEqual([{ count: 'exact' }, { count: 'exact' }]);
  });

  it('a plain patch does not ask for a count and is never "missed"', async () => {
    const seen: unknown[] = [];
    expect(await makeExecutor(db(0, seen))({ id: 'p', kind: 'patch', table: 'items', match: { id: 'i1' }, row: { quantity: 2 } })).toBe('ok');
    expect(seen).toEqual([undefined]);
  });
});

describe('adding an item: "Added to <room>", Undo, Change', () => {
  it('offers Undo and Change, naming the room it went in', () => {
    const { next, entry } = edit(start, { type: 'addItem', name: 'Toaster', room: 'Kitchen', assignedTo: 'nikita' });
    const added = next.items[0]!;
    expect(entry.message).toBe('Added to Kitchen');
    expect(entry.spoken).toBe('Toaster added to Kitchen');
    expect(offerSnack(entry)).toMatchObject({ canUndo: true, changeItemId: added.id });
    expect(edit(start, { type: 'addItem', name: 'Thing' }).entry.message).toBe('Added, no room');
  });

  it('Undo takes the new item off the list and soft-deletes it', () => {
    const { next, entry } = edit(start, { type: 'addItem', name: 'Toaster', room: 'Kitchen' });
    const added = next.items[0]!;
    const undone = applyUndo(next, entry, rooms);
    expect(undone.outcome).toBe('done');
    expect(undone.state.items.map((i) => i.id)).toEqual(['i1', 'i2']);
    expect(undone.ops).toEqual([{ id: expect.any(String), kind: 'patch', table: 'items', match: { id: added.id }, row: { deleted_at: expect.any(String) } }]);
  });

  it('nothing to undo if the other phone deleted it since', () => {
    const { entry } = edit(start, { type: 'addItem', name: 'Toaster' });
    expect(applyUndo(start, entry, rooms)).toMatchObject({ outcome: 'none', ops: [] });
  });

  it('a claim ("I\'ll buy it") assigns an unclaimed item to me and is undoable', () => {
    const { next, entry } = edit(start, { type: 'claimItem', id: 'i1' });
    expect(item(next).assignedTo).toBe('nikita');
    expect(entry.message).toBe('Kettle → assigned to Nikita');
    const undone = applyUndo(next, entry, rooms);
    expect(item(undone.state).assignedTo).toBeUndefined();
    expect(undone.ops[0]).toMatchObject({ table: 'items', match: { id: 'i1', assigned_to: 'nikita' }, row: { assigned_to: null } });
  });

  it('a claim never takes an item someone already has', () => {
    const taken: State = { ...start, items: [{ ...kettle, assignedTo: 'daryna' }, router] };
    expect(reducer(taken, { type: 'claimItem', id: 'i1' })).toBe(taken);
  });

  it('is sent only while the item is still unclaimed; a miss says the other person took it', () => {
    const op = ops.claimIf('i1', 'nikita');
    expect(op).toMatchObject({ kind: 'patch', table: 'items', match: { id: 'i1', assigned_to: null }, row: { assigned_to: 'nikita' }, reportMiss: true });
    expect(claimNotice(op, 'nikita')).toBe('Daryna already took it');
    expect(claimNotice(ops.claimIf('i1', 'daryna'), 'daryna')).toBe('Nikita already took it');
    // Other conditional patches (an Undo of a claim) are not claims.
    expect(claimNotice(ops.patchIf('items', { id: 'i1', assigned_to: 'nikita' }, { assigned_to: null }), 'nikita')).toBeUndefined();
  });
});
