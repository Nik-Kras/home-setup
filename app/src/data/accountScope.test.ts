import { describe, expect, it } from 'vitest';
import type { Item, Person } from '../domain/types';
import { claimDevice, QUEUE_OWNER_KEY } from './accountScope';
import { diffToOps } from './diff';
import { OpQueue, type KV, type Op } from './queue';
import { createWidgetStorage, makeWidgetSnapshot } from './widgetSnapshot';

// Integration of the widget handler, the app's edits and account changes over ONE shared queue
// (syncQueue), with an in-memory store standing in for AsyncStorage.
const me = 'member' as Person;
const time = new Date('2026-11-22T09:00:00Z');
const lamp: Item = {
  id: 'item-1', name: 'Lamp', status: 'ordered', quantity: 1, room: 'Living room',
  urgent: false, needsInstall: false, addedAt: time.toISOString(), updatedBy: me,
};
const kettle: Item = { ...lamp, id: 'item-2', name: 'Kettle', status: 'needed' };

function device() {
  const data = new Map<string, string>();
  const kv: KV = { getItem: async (k) => data.get(k) ?? null, setItem: async (k, v) => void data.set(k, v) };
  const sent: Op[] = [];
  let online = false;
  const queue = new OpQueue(kv, async (op) => {
    if (!online) return 'retry';
    sent.push(op);
    return 'ok';
  });
  const widget = createWidgetStorage(kv);
  return { kv, data, queue, widget, sent, goOnline: () => { online = true; } };
}

/** What the store's act() enqueues for one edit. */
const appEdit = (before: Item, after: Item) => diffToOps({ items: [before], tasks: [] }, { items: [after], tasks: [] }, new Map());

describe('widgets and app share one queue', () => {
  it('sends an app edit, a widget stage tap and a later app edit in the order they happened', async () => {
    const { queue, widget, sent, goOnline } = device();
    await widget.publish(() => makeWidgetSnapshot([lamp, kettle], time));

    await queue.enqueueAll(appEdit(kettle, { ...kettle, name: 'Electric kettle' }));
    const tapped = await widget.advance(lamp.id, new Date('2026-11-22T09:05:00Z'), queue);
    expect(tapped).not.toBeNull();
    await queue.enqueueAll(appEdit(kettle, { ...kettle, urgent: true }));
    await queue.flush(); // offline: everything stays queued
    expect(await queue.size()).toBe(3);

    goOnline();
    await queue.flush();
    expect(sent.map((op) => [op.kind, op.row])).toEqual([
      ['patch', { name: 'Electric kettle' }],
      ['patch', { status: 'delivered', delivered_at: '2026-11-22T09:05:00.000Z' }],
      ['patch', { urgent: true }],
    ]);
    expect(await queue.size()).toBe(0);
  });

  it('a widget tap on a needed item moves it to looking only, with no date', async () => {
    const { queue, widget, sent, goOnline } = device();
    await widget.publish(() => makeWidgetSnapshot([lamp, kettle], time));
    const data = await widget.advance(kettle.id, time, queue);
    expect(data?.rooms[0]?.items.find((row) => row.id === kettle.id)).toMatchObject({ status: 'Looking', action: 'Mark ordered' });
    goOnline();
    await queue.flush();
    expect(sent).toEqual([expect.objectContaining({ match: { id: kettle.id, status: 'needed' }, row: { status: 'looking' } })]);
  });

  it('loses nothing when a widget tap and an app edit append at the same moment as a flush', async () => {
    const { queue, widget, sent, goOnline } = device();
    await widget.publish(() => makeWidgetSnapshot([lamp, kettle], time));
    goOnline();
    await Promise.all([
      queue.enqueueAll(appEdit(kettle, { ...kettle, name: 'Electric kettle' })),
      queue.flush(),
      widget.advance(lamp.id, time, queue),
      queue.flush(),
    ]);
    await queue.flush();
    expect(sent.map((op) => Object.keys(op.row))).toEqual([['name'], ['status', 'delivered_at']]);
  });
});

describe('account change on one device', () => {
  it('drops the previous account\'s ops and widget snapshot, so nothing of theirs is sent or tapped', async () => {
    const { kv, queue, widget, sent, goOnline } = device();
    expect(await claimDevice(kv, queue, 'account-a')).toBe(false);
    await widget.publish(() => makeWidgetSnapshot([lamp, kettle], time));
    await queue.enqueueAll(appEdit(kettle, { ...kettle, name: 'Electric kettle' }));
    await widget.advance(lamp.id, time, queue);
    expect(await queue.size()).toBe(2);

    // Account A signs out offline, account B signs in: the store claims the device before flushing.
    expect(await claimDevice(kv, queue, 'account-b')).toBe(true);
    await widget.publish(() => null); // resetWidgets(): the signed-out widget
    expect(await queue.size()).toBe(0);
    expect(await widget.read()).toBeNull();
    expect(await widget.advance(kettle.id, time, queue)).toBeNull(); // a stale widget tap queues nothing

    goOnline();
    await queue.flush();
    expect(sent).toEqual([]);
  });

  it('keeps unsent ops when the same account signs in again', async () => {
    const { kv, data, queue } = device();
    await claimDevice(kv, queue, 'account-a');
    await queue.enqueueAll(appEdit(kettle, { ...kettle, name: 'Electric kettle' }));
    expect(await claimDevice(kv, queue, 'account-a')).toBe(false);
    expect(await queue.size()).toBe(1);
    expect(data.get(QUEUE_OWNER_KEY)).toBe('account-a');
  });

  it('adopts an existing queue on first run after the update without dropping it', async () => {
    const { kv, queue } = device();
    await queue.enqueueAll(appEdit(kettle, { ...kettle, name: 'Electric kettle' }));
    expect(await claimDevice(kv, queue, 'account-a')).toBe(false);
    expect(await queue.size()).toBe(1);
  });
});
