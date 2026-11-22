import { describe, expect, it, vi } from 'vitest';
import type { Item, Person } from '../domain/types';
import {
  applyGotLocally, createIosWidgetBridge, pendingGot, SIGNED_OUT_PROPS, toIosWidgetProps,
  type IosPendingGot, type IosWidgetProps,
} from './iosWidget';
import type { Op } from './queue';
import { makeWidgetSnapshot } from './widgetSnapshot';

const me = 'member' as Person;
const time = new Date('2026-11-22T09:00:00Z');
const tappedAt = '2026-11-22T09:15:00.000Z';
const base: Item = {
  id: 'item-1', name: 'Lamp', status: 'ordered', quantity: 1, room: 'Living room',
  urgent: true, needsInstall: false, addedAt: time.toISOString(), updatedBy: me,
};
const items: Item[] = [
  base,
  { ...base, id: 'item-2', name: 'Shelf', status: 'needed', urgent: false, needsInstall: true, room: 'Bedroom' },
  { ...base, id: 'item-3', name: 'Kettle', status: 'delivered', urgent: false, room: 'Kitchen' },
];
const tap: IosPendingGot = { id: 'item-1', from: 'ordered', at: tappedAt };

function fakeWidget(props: IosWidgetProps) {
  const timeline = [{ props: props as unknown }];
  return {
    timeline,
    getTimeline: vi.fn(async () => timeline.map((entry) => ({ ...entry }))),
    updateSnapshot: vi.fn((next: IosWidgetProps) => { timeline.splice(0, timeline.length, { props: next }); }),
  };
}

describe('iPhone widget props', () => {
  it('signed out shows the sign-in widget with no rows to tap', () => {
    expect(toIosWidgetProps(null)).toEqual(SIGNED_OUT_PROPS);
  });

  it('keeps the shared widget data and adds the status each row showed', () => {
    const props = toIosWidgetProps(makeWidgetSnapshot(items, time));
    expect(props.signedIn).toBe(true);
    expect(props.leftCount).toBe(2);
    expect(props.got).toEqual([]);
    expect(props.top.map((row) => [row.id, row.from, row.install, row.status])).toEqual([
      ['item-1', 'ordered', false, 'Ordered'], ['item-2', 'needed', true, 'Needed'],
    ]);
    expect(props.rooms.flatMap((r) => r.items.map((row) => row.id))).toEqual(['item-1', 'item-2']);
    expect(JSON.stringify(props)).not.toMatch(/addedAt|updatedBy|estPrice|notes/);
  });
});

describe('pending got taps', () => {
  it('reads well-formed taps once per item and skips anything that cannot be got', () => {
    expect(pendingGot([
      { props: { got: [tap, { ...tap, at: '2026-11-22T10:00:00Z' }] } },
      { props: { got: [{ id: 'item-2', from: 'delivered', at: tappedAt }, { id: 'item-4', from: 'needed', at: 'soon' }, null] } },
      { props: { got: [{ id: 'item-5', from: 'looking', at: tappedAt }] } },
      { props: null },
      {},
    ])).toEqual([tap, { id: 'item-5', from: 'looking', at: tappedAt }]);
  });

  it('shows a tap as got only where the item still has the status the widget showed', () => {
    const next = applyGotLocally(items, me, [tap, { id: 'item-2', from: 'looking', at: tappedAt }]);
    expect(next[0]).toMatchObject({ status: 'delivered', deliveredAt: tappedAt, updatedBy: me });
    expect(next[1]).toBe(items[1]);
    expect(applyGotLocally(items, me, [{ id: 'item-2', from: 'looking', at: tappedAt }])).toBe(items);
  });
});

describe('iPhone widget bridge', () => {
  it('queues a conditional patch per tap, applies it, then clears the taps', async () => {
    const props = { ...toIosWidgetProps(makeWidgetSnapshot(items, time)), leftCount: 1, got: [tap] };
    const widget = fakeWidget(props);
    const queued: Op[] = [];
    const queue = { enqueueAll: vi.fn(async (ops: Op[]) => { queued.push(...ops); }) };
    const applyGot = vi.fn();
    const bridge = createIosWidgetBridge(widget, queue);

    expect(await bridge.consume({ applyGot })).toBe(1);
    expect(queued).toMatchObject([{
      kind: 'patch', table: 'items', match: { id: 'item-1', status: 'ordered' },
      row: { status: 'delivered', delivered_at: tappedAt },
    }]);
    expect(applyGot).toHaveBeenCalledWith([tap]);
    expect(queue.enqueueAll.mock.invocationCallOrder[0]).toBeLessThan(widget.updateSnapshot.mock.invocationCallOrder[0]);
    expect(widget.timeline[0].props).toEqual({ ...props, got: [] }); // keeps the widget's optimistic count

    expect(await bridge.consume({ applyGot })).toBe(0);
    expect(queue.enqueueAll).toHaveBeenCalledTimes(1);
  });

  it('keeps the taps in the group when queueing fails', async () => {
    const widget = fakeWidget({ ...SIGNED_OUT_PROPS, signedIn: true, got: [tap] });
    const bridge = createIosWidgetBridge(widget, { enqueueAll: async () => { throw new Error('storage full'); } });
    await expect(bridge.consume({ applyGot: () => undefined })).rejects.toThrow('storage full');
    expect(widget.updateSnapshot).not.toHaveBeenCalled();
  });

  it('publishing takes waiting taps before it writes the new snapshot', async () => {
    const widget = fakeWidget({ ...SIGNED_OUT_PROPS, signedIn: true, got: [tap] });
    const queue = { enqueueAll: vi.fn(async () => undefined) };
    let live = items;
    const bridge = createIosWidgetBridge(widget, queue);

    const taken = await bridge.publish(
      { applyGot: (pending) => { live = applyGotLocally(live, me, pending); } },
      () => makeWidgetSnapshot(live, time),
    );
    expect(taken).toBe(1);
    expect(queue.enqueueAll).toHaveBeenCalledTimes(1);
    const written = widget.timeline[0].props as IosWidgetProps;
    expect(written.got).toEqual([]);
    expect(written.leftCount).toBe(1);
    expect(written.top.map((row) => row.id)).toEqual(['item-2']);
  });

  it('signed out drops waiting taps without queueing them', async () => {
    const widget = fakeWidget({ ...SIGNED_OUT_PROPS, signedIn: true, got: [tap] });
    const queue = { enqueueAll: vi.fn(async () => undefined) };
    await createIosWidgetBridge(widget, queue).publish(null, () => makeWidgetSnapshot(items, time));
    expect(queue.enqueueAll).not.toHaveBeenCalled();
    expect(widget.timeline[0].props).toEqual(SIGNED_OUT_PROPS);
  });

  it('runs consume and publish one after another', async () => {
    const widget = fakeWidget({ ...SIGNED_OUT_PROPS, signedIn: true, got: [tap] });
    const queue = { enqueueAll: vi.fn(async () => undefined) };
    const bridge = createIosWidgetBridge(widget, queue);
    const app = { applyGot: vi.fn() };
    await Promise.all([bridge.consume(app), bridge.publish(app, () => makeWidgetSnapshot(items, time))]);
    expect(queue.enqueueAll).toHaveBeenCalledTimes(1);
    expect(app.applyGot).toHaveBeenCalledTimes(1);
  });
});
