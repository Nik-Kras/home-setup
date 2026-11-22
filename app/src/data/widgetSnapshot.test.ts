import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Item, Person } from '../domain/types';
import { makeExecutor, ops } from './repo';
import { createWidgetStorage, makeWidgetSnapshot, WIDGET_SNAPSHOT_KEY, type WidgetSource } from './widgetSnapshot';

const me = 'member' as Person;
const time = new Date('2026-11-22T09:00:00Z');
const tappedAt = new Date('2026-11-22T09:15:00Z');
const later = new Date('2026-11-22T09:45:00Z');
const item: Item = {
  id: 'item-1', name: 'Lamp', status: 'ordered', quantity: 1, room: 'Living room',
  urgent: true, needsInstall: false, addedAt: time.toISOString(), updatedBy: me,
};

function fixture() {
  const values = new Map<string, string>();
  const storage = createWidgetStorage({
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
  });
  return { values, storage, queue: { enqueueAll: vi.fn(async () => undefined) } };
}

describe('widget snapshot shape', () => {
  it('stores only what the widgets draw and what the tap needs', async () => {
    const { storage, values } = fixture();
    await storage.publish(() => makeWidgetSnapshot([{
      ...item, estPrice: 10, notes: 'Sample note', link: 'https://example.com', deliveredAt: time.toISOString(), assignedTo: me,
    }], time));
    const stored = JSON.parse(values.get(WIDGET_SNAPSHOT_KEY)!);
    expect(Object.keys(stored).sort()).toEqual(['data', 'items']);
    expect(Object.keys(stored.data).sort()).toEqual(['leftCount', 'rooms', 'top', 'updatedAt', 'v']);
    expect(Object.keys(stored.items[0]).sort()).toEqual(['addedAt', 'id', 'name', 'needsInstall', 'room', 'status', 'urgent']);
  });
});

describe('widget storage and offline taps', () => {
  it('queues a one-stage patch conditional on the status shown, saves data and ignores repeated taps', async () => {
    const { storage, queue } = fixture();
    const onChange = vi.fn();
    await storage.publish(() => makeWidgetSnapshot([item], time));

    const [data, duplicate] = await Promise.all([
      storage.advance(item.id, tappedAt, queue, undefined, onChange),
      storage.advance(item.id, tappedAt, queue, undefined, onChange),
    ]);
    expect(data).toMatchObject({ updatedAt: tappedAt.toISOString(), leftCount: 0, rooms: [] });
    // The second tap saw the stored snapshot already delivered (done): nothing more to do.
    expect(duplicate).toBeNull();
    expect(queue.enqueueAll).toHaveBeenCalledExactlyOnceWith([{
      id: expect.any(String), kind: 'patch', table: 'items', match: { id: item.id, status: 'ordered' },
      row: { status: 'delivered', delivered_at: tappedAt.toISOString() },
    }]);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ status: 'ordered' }), { status: 'delivered', deliveredAt: tappedAt.toISOString() });
    expect((await storage.read())?.data).toEqual(data);
  });

  it('retains a delivered item that still needs installation; the next tap installs it, keeping the delivered date', async () => {
    const { storage, queue } = fixture();
    await storage.publish(() => makeWidgetSnapshot([{ ...item, needsInstall: true }], time));
    const data = await storage.advance(item.id, tappedAt, queue);
    expect(data?.leftCount).toBe(1);
    expect(data?.rooms[0]?.items[0]).toMatchObject({ status: 'Delivered', action: 'Mark installed' });
    const installed = await storage.advance(item.id, later, queue);
    expect(installed).toMatchObject({ leftCount: 0, rooms: [] });
    expect(queue.enqueueAll).toHaveBeenLastCalledWith([expect.objectContaining({
      match: { id: item.id, status: 'delivered' }, row: { status: 'installed', installed_at: later.toISOString() },
    })]);
  });

  it('a needed item moves one stage per tap and stays on the widget with its new chip until it is got', async () => {
    const { storage, queue } = fixture();
    await storage.publish(() => makeWidgetSnapshot([{ ...item, status: 'needed' }], time));
    const seen: [string | undefined, string | undefined][] = [];
    for (const at of [tappedAt, later, new Date('2026-11-22T10:00:00Z')]) {
      const data = await storage.advance(item.id, at, queue);
      seen.push([data?.rooms[0]?.items[0]?.status, data?.rooms[0]?.items[0]?.action]);
    }
    expect(seen).toEqual([['Looking', 'Mark ordered'], ['Ordered', 'Got it'], [undefined, undefined]]);
    expect((queue.enqueueAll.mock.calls as unknown as [{ match: unknown; row: unknown }[]][]).map(([[op]]) => [op!.match, op!.row])).toEqual([
      [{ id: item.id, status: 'needed' }, { status: 'looking' }],
      [{ id: item.id, status: 'looking' }, { status: 'ordered' }],
      [{ id: item.id, status: 'ordered' }, { status: 'delivered', delivered_at: '2026-11-22T10:00:00.000Z' }],
    ]);
  });

  it('ignores stale taps after sign-out or when the live item has already changed', async () => {
    const { storage, queue } = fixture();
    await storage.publish(() => makeWidgetSnapshot([item], time));
    const current = () => makeWidgetSnapshot([{ ...item, status: 'installed' }], time);
    expect(await storage.advance(item.id, tappedAt, queue, current)).toBeNull();
    await storage.publish(() => null);
    expect(await storage.read()).toBeNull();
    expect(await storage.advance(item.id, tappedAt, queue)).toBeNull();
    expect(queue.enqueueAll).not.toHaveBeenCalled();
  });

  it('leaves the snapshot untouched if the queue write fails', async () => {
    const { storage, queue } = fixture();
    await storage.publish(() => makeWidgetSnapshot([item], time));
    queue.enqueueAll.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(storage.advance(item.id, tappedAt, queue)).rejects.toThrow('storage unavailable');
    expect((await storage.read())?.data.leftCount).toBe(1);
  });
});

describe('conditional stage patch', () => {
  it('matches the row by id and the status the widget showed, and sends only that stage\'s date', async () => {
    expect(ops.advanceIf('item-1', 'ordered', { status: 'delivered', deliveredAt: tappedAt.toISOString() })).toEqual({
      id: expect.any(String), kind: 'patch', table: 'items',
      match: { id: 'item-1', status: 'ordered' },
      row: { status: 'delivered', delivered_at: tappedAt.toISOString() },
    });
    expect(ops.advanceIf('item-1', 'needed', { status: 'looking' }).row).toEqual({ status: 'looking' });
    const filters: [string, unknown][] = [];
    const query = { eq: (key: string, value: unknown) => (filters.push([key, value]), query), then: (ok: (r: { error: null }) => void) => ok({ error: null }) };
    const db = { from: () => ({ update: () => query }) } as unknown as SupabaseClient;
    expect(await makeExecutor(db)(ops.advanceIf('item-1', 'looking', { status: 'ordered' }))).toBe('ok');
    expect(filters).toEqual([['id', 'item-1'], ['status', 'looking']]);
  });
});

describe('periodic refresh', () => {
  const source = (patch: Partial<WidgetSource> = {}): WidgetSource => ({
    hasSession: vi.fn(async () => true),
    pending: vi.fn(async () => 0),
    loadItems: vi.fn(async () => [{ ...item, id: 'item-2', name: 'Kettle', urgent: false }]),
    ...patch,
  });

  it('stores and returns fresh data when signed in', async () => {
    const { storage } = fixture();
    await storage.publish(() => makeWidgetSnapshot([item], time));
    const data = await storage.refresh(source(), () => later);
    expect(data).toMatchObject({ updatedAt: later.toISOString(), leftCount: 1, top: [{ id: 'item-2' }] });
    expect((await storage.read())?.data).toEqual(data);
  });

  it('keeps the stored snapshot with no session', async () => {
    const { storage } = fixture();
    await storage.publish(() => makeWidgetSnapshot([item], time));
    const src = source({ hasSession: vi.fn(async () => false) });
    expect(await storage.refresh(src, () => later)).toMatchObject({ updatedAt: time.toISOString(), top: [{ id: 'item-1' }] });
    expect(src.loadItems).not.toHaveBeenCalled();
  });

  it('keeps the stored snapshot, with its old age, on a network failure', async () => {
    const { storage } = fixture();
    await storage.publish(() => makeWidgetSnapshot([item], time));
    const data = await storage.refresh(source({ loadItems: vi.fn(async () => { throw new Error('offline'); }) }), () => later);
    expect(data).toMatchObject({ updatedAt: time.toISOString(), top: [{ id: 'item-1' }] });
    expect((await storage.read())?.data.updatedAt).toBe(time.toISOString());
  });

  it('does not fetch while local edits are unsent or the snapshot is fresh', async () => {
    const { storage } = fixture();
    await storage.publish(() => makeWidgetSnapshot([item], time));
    const unsent = source({ pending: vi.fn(async () => 1) });
    expect(await storage.refresh(unsent, () => later)).toMatchObject({ updatedAt: time.toISOString() });
    expect(unsent.loadItems).not.toHaveBeenCalled();
    const fresh = source();
    expect(await storage.refresh(fresh, () => new Date('2026-11-22T09:02:00Z'))).toMatchObject({ updatedAt: time.toISOString() });
    expect(fresh.hasSession).not.toHaveBeenCalled();
  });

  it('does not overwrite a tap made while the fetch was in flight', async () => {
    const { storage, queue } = fixture();
    await storage.publish(() => makeWidgetSnapshot([item], time));
    let release: (items: Item[]) => void = () => undefined;
    const src = source({ loadItems: vi.fn(() => new Promise<Item[]>((resolve) => { release = resolve; })) });
    const refreshing = storage.refresh(src, () => later);
    await vi.waitFor(() => expect(src.loadItems).toHaveBeenCalled());
    const tapped = await storage.advance(item.id, tappedAt, queue);
    release([item]);
    expect(await refreshing).toEqual(tapped);
    expect((await storage.read())?.data.updatedAt).toBe(tappedAt.toISOString());
  });
});
