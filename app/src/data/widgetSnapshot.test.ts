import { describe, expect, it, vi } from 'vitest';
import type { Item, Person } from '../domain/types';
import { createWidgetStorage, makeWidgetSnapshot, WIDGET_SNAPSHOT_KEY } from './widgetSnapshot';

const me = 'member' as Person;
const time = new Date('2026-11-22T09:00:00Z');
const tappedAt = new Date('2026-11-22T09:15:00Z');
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

describe('widget storage and offline taps', () => {
  it('queues only status and delivered_at, saves data and ignores repeated taps', async () => {
    const { storage, values, queue } = fixture();
    const onChange = vi.fn();
    await storage.publish(() => makeWidgetSnapshot([{ ...item, estPrice: 10, notes: 'Sample note' }], [], me, time));
    expect(values.get(WIDGET_SNAPSHOT_KEY)).not.toContain('estPrice');
    expect(values.get(WIDGET_SNAPSHOT_KEY)).not.toContain('Sample note');

    const [data, duplicate] = await Promise.all([
      storage.markGot(item.id, tappedAt, queue, undefined, onChange),
      storage.markGot(item.id, tappedAt, queue, undefined, onChange),
    ]);
    expect(data).toMatchObject({ updatedAt: tappedAt.toISOString(), leftCount: 0, urgentCount: 0, nextUp: null });
    expect(duplicate).toBeNull();
    expect(queue.enqueueAll).toHaveBeenCalledExactlyOnceWith([{
      id: expect.any(String), kind: 'patch', table: 'items', match: { id: item.id },
      row: { status: 'delivered', delivered_at: tappedAt.toISOString() },
    }]);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ status: 'ordered' }), expect.objectContaining({ status: 'delivered' }));
    expect((await storage.read())?.data).toEqual(data);
  });

  it('retains a delivered item that still needs installation', async () => {
    const { storage, queue } = fixture();
    await storage.publish(() => makeWidgetSnapshot([{ ...item, needsInstall: true }], [], me, time));
    const data = await storage.markGot(item.id, tappedAt, queue);
    expect(data?.leftCount).toBe(1);
    expect(data?.rooms[0]?.items[0]?.status).toBe('Delivered');
  });

  it('ignores stale taps after sign-out or when the live item has already changed', async () => {
    const { storage, queue } = fixture();
    await storage.publish(() => makeWidgetSnapshot([item], [], me, time));
    const current = () => makeWidgetSnapshot([{ ...item, status: 'installed' }], [], me, time);
    expect(await storage.markGot(item.id, tappedAt, queue, current)).toBeNull();
    await storage.publish(() => null);
    expect(await storage.read()).toBeNull();
    expect(await storage.markGot(item.id, tappedAt, queue)).toBeNull();
    expect(queue.enqueueAll).not.toHaveBeenCalled();
  });

  it('leaves the snapshot untouched if the queue write fails', async () => {
    const { storage, queue } = fixture();
    await storage.publish(() => makeWidgetSnapshot([item], [], me, time));
    queue.enqueueAll.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(storage.markGot(item.id, tappedAt, queue)).rejects.toThrow('storage unavailable');
    expect((await storage.read())?.data.leftCount).toBe(1);
  });
});
