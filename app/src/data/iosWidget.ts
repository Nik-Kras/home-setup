import type { IconName } from '../domain/glyphs';
import { ITEM_STATUSES, type Item, type ItemStatus, type Person } from '../domain/types';
import type { OpQueue } from './queue';
import { ops } from './repo';
import type { WidgetSnapshot } from './widgetSnapshot';

/**
 * The iPhone widget (expo-widgets). One widget kind, three sizes. Its props live in the App Group
 * (`group.app.homesetup.household`) as the widget timeline, which the app writes and the widget's
 * "got it" App Intent edits:
 *
 *   { signedIn, leftCount, top: [row + icon], rooms: [{ room, items: [row] }], got: [{ id, from, at }] }
 *
 * A row is { id, name, status (label), urgent, from (the status the widget showed), install }.
 * `got` holds the taps not yet applied: the app turns each into a conditional patch in the offline
 * queue at its next launch or foreground. No credentials, prices, notes or people go into the group.
 */
export const IOS_WIDGET_NAME = 'OurFlat';

export interface IosWidgetRow {
  id: string;
  name: string;
  status: string;
  urgent: boolean;
  from: ItemStatus;
  /** Needs installing, so it stays on the list after it is got. */
  install: boolean;
}

export interface IosPendingGot {
  id: string;
  from: ItemStatus;
  at: string;
}

export interface IosWidgetProps {
  signedIn: boolean;
  leftCount: number;
  top: (IosWidgetRow & { icon: IconName })[];
  rooms: { room: string; items: IosWidgetRow[] }[];
  got: IosPendingGot[];
}

export const SIGNED_OUT_PROPS: IosWidgetProps = { signedIn: false, leftCount: 0, top: [], rooms: [], got: [] };

export function toIosWidgetProps(snapshot: WidgetSnapshot | null): IosWidgetProps {
  if (!snapshot) return SIGNED_OUT_PROPS;
  const byId = new Map(snapshot.items.map((item) => [item.id, item]));
  const row = <T extends { id: string }>(shown: T) => {
    const item = byId.get(shown.id);
    return { ...shown, from: item?.status ?? 'needed', install: item?.needsInstall ?? false };
  };
  const { leftCount, top, rooms } = snapshot.data;
  return {
    signedIn: true,
    leftCount,
    top: top.map(row),
    rooms: rooms.map(({ room, items }) => ({ room, items: items.map(row) })),
    got: [],
  };
}

const canGet = (status: unknown): status is ItemStatus =>
  typeof status === 'string' && ITEM_STATUSES.indexOf(status as ItemStatus) >= 0
  && ITEM_STATUSES.indexOf(status as ItemStatus) < ITEM_STATUSES.indexOf('delivered');

/** The well-formed taps across the timeline entries, first tap per item. */
export function pendingGot(entries: readonly { props?: unknown }[]): IosPendingGot[] {
  const seen = new Set<string>();
  const out: IosPendingGot[] = [];
  for (const { props } of entries) {
    const got = (props as Partial<IosWidgetProps> | null | undefined)?.got;
    if (!Array.isArray(got)) continue;
    for (const tap of got as unknown[]) {
      const { id, from, at } = (tap ?? {}) as Partial<IosPendingGot>;
      if (typeof id !== 'string' || !id || seen.has(id) || !canGet(from) || typeof at !== 'string' || Number.isNaN(Date.parse(at))) continue;
      seen.add(id);
      out.push({ id, from, at });
    }
  }
  return out;
}

/** Show the taps as got now, like the Android widget does; only where the item still has the status the widget showed. */
export function applyGotLocally(items: Item[], me: Person, pending: readonly IosPendingGot[]): Item[] {
  if (pending.length === 0) return items;
  const taps = new Map(pending.map((tap) => [tap.id, tap]));
  let changed = false;
  const next = items.map((item) => {
    const tap = taps.get(item.id);
    if (!tap || item.status !== tap.from) return item;
    changed = true;
    return { ...item, status: 'delivered' as const, deliveredAt: tap.at, updatedBy: me };
  });
  return changed ? next : items;
}

/** What the bridge needs from an expo-widgets Widget. */
export interface IosWidgetHandle {
  getTimeline(): Promise<{ props: unknown }[]>;
  updateSnapshot(props: IosWidgetProps): void;
}

/** What the bridge needs from the app store. */
export interface IosWidgetApp {
  /** Apply the taps to the live state (see applyGotLocally). */
  applyGot(pending: readonly IosPendingGot[]): void;
}

/**
 * The app side of the iPhone widget. Every write goes through one chain so a publish never runs in the
 * middle of a consume. Taps are queued before they are cleared from the group: if the app dies in
 * between, the tap is queued twice, and the second conditional patch matches no row.
 */
export function createIosWidgetBridge(widget: IosWidgetHandle, queue: Pick<OpQueue, 'enqueueAll'> | null) {
  let tail: Promise<unknown> = Promise.resolve();
  const serialize = <T>(work: () => Promise<T>): Promise<T> => {
    const next = tail.then(work);
    tail = next.catch(() => undefined);
    return next;
  };

  /** Queue the widget's taps and apply them to the app. Returns the number of taps taken. */
  async function drain(app: IosWidgetApp | null): Promise<number> {
    const entries = await widget.getTimeline();
    const pending = pendingGot(entries);
    if (pending.length === 0) return 0;
    if (app && queue) {
      await queue.enqueueAll(pending.map(({ id, from, at }) => ops.markGotIf(id, from, at)));
      app.applyGot(pending);
    }
    const last = entries[entries.length - 1]?.props as IosWidgetProps | undefined;
    widget.updateSnapshot({ ...(last ?? SIGNED_OUT_PROPS), got: [] });
    return pending.length;
  }

  return {
    /** Signed in: take the taps written while the app was closed or in the background. */
    consume: (app: IosWidgetApp) => serialize(() => drain(app)),
    /**
     * Write fresh props (`app` null means signed out). Returns the number of taps taken. Signed in, taps not
     * consumed yet are taken first so the new snapshot does not erase them; signed out, they are dropped,
     * since there is no account to send them for.
     */
    publish: (app: IosWidgetApp | null, getSnapshot: () => WidgetSnapshot | null) => serialize(async () => {
      const taken = await drain(app);
      widget.updateSnapshot(toIosWidgetProps(app ? getSnapshot() : null));
      return taken;
    }),
  };
}
