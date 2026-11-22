import type { IconName } from '../domain/glyphs';
import { ITEM_STATUS_LABEL, nextActionLabel, nextStatus, stageStep } from '../domain/items';
import { fitRooms } from '../domain/widgetData';
import { ITEM_STATUSES, type Item, type ItemStatus, type Person } from '../domain/types';
import type { OpQueue } from './queue';
import { ops } from './repo';
import type { WidgetSnapshot } from './widgetSnapshot';

/**
 * The iPhone widget (expo-widgets). One widget kind, three sizes. Its props live in the App Group
 * (`group.app.homesetup.household`) as the widget timeline, which the app writes and the widget's
 * stage-tap App Intent edits:
 *
 *   { signedIn, leftCount, top: [row + icon], rooms: [{ room, items: [row] }], more, got: [{ id, from, to, at }] }
 *
 * A row is { id, name, status (label), urgent, from (the status the widget showed), install, to (the
 * one next stage, worked out here with domain nextStage since the widget runtime cannot import it),
 * toLabel, action ("Mark ordered") }. `rooms` holds what fits the large widget and `more` the left
 * items it does not show.
 * `got` holds the taps not yet applied (one stage each, from -> to): the app turns each into a
 * conditional patch in the offline queue at its next launch or foreground. No credentials, prices, notes or people go into the group.
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
  /** The stage a tap moves it to, its chip label and the tap's label. `to` equals `from` when there is none. */
  to: ItemStatus;
  toLabel: string;
  action: string;
}

export interface IosPendingGot {
  id: string;
  from: ItemStatus;
  /** Exactly one stage after `from`. */
  to: ItemStatus;
  at: string;
}

/** A row's next-stage fields, from the shared domain rule (one stage at a time). */
function nextFields(status: ItemStatus, install: boolean): Pick<IosWidgetRow, 'to' | 'toLabel' | 'action'> {
  const to = nextStatus({ status, needsInstall: install });
  return { to, toLabel: ITEM_STATUS_LABEL[to], action: nextActionLabel({ status, needsInstall: install }) ?? '' };
}

export interface IosWidgetProps {
  signedIn: boolean;
  leftCount: number;
  top: (IosWidgetRow & { icon: IconName })[];
  rooms: { room: string; items: IosWidgetRow[] }[];
  more: number;
  got: IosPendingGot[];
}

export const SIGNED_OUT_PROPS: IosWidgetProps = { signedIn: false, leftCount: 0, top: [], rooms: [], more: 0, got: [] };

/**
 * Room list budget of the large widget in points, as Android's fitRooms takes it: the large widget height on
 * the smaller current iPhones (344) less 24 padding and the 44 header, a room label (serif 17 plus 6 above),
 * a 44 row and the "+n more" line. iOS does not tell the widget its size, so this is fixed.
 */
export const IOS_LARGE_SPACE = 344 - 24 - 44;
export const IOS_LARGE_HEIGHTS = { room: 26, row: 44, more: 18 } as const;

export function toIosWidgetProps(snapshot: WidgetSnapshot | null): IosWidgetProps {
  if (!snapshot) return SIGNED_OUT_PROPS;
  const byId = new Map(snapshot.items.map((item) => [item.id, item]));
  const row = <T extends { id: string }>(shown: T) => {
    const item = byId.get(shown.id);
    const from = item?.status ?? 'needed';
    const install = item?.needsInstall ?? false;
    return { ...shown, from, install, ...nextFields(from, install) };
  };
  const { leftCount, top } = snapshot.data;
  const { rooms, more } = fitRooms(snapshot.data, IOS_LARGE_SPACE, IOS_LARGE_HEIGHTS);
  return {
    signedIn: true,
    leftCount,
    top: top.map(row),
    rooms: rooms.map(({ room, items }) => ({ room, items: items.map(row) })),
    more,
    got: [],
  };
}

/** Taken taps leave `got`, so their rows must show their new stage by themselves until the next snapshot. */
export function settleGot(props: IosWidgetProps, taken: readonly IosPendingGot[]): IosWidgetProps {
  const taps = new Map(taken.map((tap) => [tap.id, tap]));
  const ids = new Set(taps.keys());
  const settle = <T extends IosWidgetRow>(row: T): T => {
    const tap = taps.get(row.id);
    if (!tap) return row;
    return { ...row, status: ITEM_STATUS_LABEL[tap.to], from: tap.to, ...nextFields(tap.to, row.install ?? false) };
  };
  return {
    ...props,
    top: (props.top ?? []).map(settle),
    rooms: (props.rooms ?? []).map(({ room, items }) => ({ room, items: items.map(settle) })),
    got: (props.got ?? []).filter((tap) => !ids.has(tap.id)),
  };
}

const stageIndex = (status: unknown) => (typeof status === 'string' ? ITEM_STATUSES.indexOf(status as ItemStatus) : -1);

/** A tap's target: exactly one stage after `from`. A tap without `to` (an older widget build) means the next one. */
function tapTarget(from: unknown, to: unknown): ItemStatus | undefined {
  const at = stageIndex(from);
  if (at < 0 || at >= ITEM_STATUSES.length - 1) return undefined;
  const target = to === undefined ? ITEM_STATUSES[at + 1] : to;
  return stageIndex(target) === at + 1 ? target as ItemStatus : undefined;
}

/** The well-formed taps across the timeline entries, first tap per item. */
export function pendingGot(entries: readonly { props?: unknown }[]): IosPendingGot[] {
  const seen = new Set<string>();
  const out: IosPendingGot[] = [];
  for (const { props } of entries) {
    const got = (props as Partial<IosWidgetProps> | null | undefined)?.got;
    if (!Array.isArray(got)) continue;
    for (const tap of got as unknown[]) {
      const { id, from, to, at } = (tap ?? {}) as Partial<IosPendingGot>;
      const target = tapTarget(from, to);
      if (typeof id !== 'string' || !id || seen.has(id) || !target || typeof at !== 'string' || Number.isNaN(Date.parse(at))) continue;
      seen.add(id);
      out.push({ id, from: from as ItemStatus, to: target, at });
    }
  }
  return out;
}

/** Show the taps' new stages now, like the Android widget does; only where the item still has the status the widget showed. Dates as the app stamps them (stageStep). */
export function applyGotLocally(items: Item[], me: Person, pending: readonly IosPendingGot[]): Item[] {
  if (pending.length === 0) return items;
  const taps = new Map(pending.map((tap) => [tap.id, tap]));
  let changed = false;
  const next = items.map((item) => {
    const tap = taps.get(item.id);
    if (!tap || item.status !== tap.from) return item;
    changed = true;
    return { ...item, ...stageStep(tap.to, tap.at), updatedBy: me };
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
      await queue.enqueueAll(pending.map(({ id, from, to, at }) => ops.advanceIf(id, from, stageStep(to, at))));
      app.applyGot(pending);
    }
    const last = entries[entries.length - 1]?.props as IosWidgetProps | undefined;
    write(settleGot({ ...SIGNED_OUT_PROPS, ...last }, pending));
    return pending.length;
  }

  /** The props last written by this bridge. The store refreshes every 20 s; unchanged props are not rewritten. */
  let written: string | undefined;
  function write(props: IosWidgetProps) {
    const json = JSON.stringify(props);
    if (json === written) return;
    widget.updateSnapshot(props);
    written = json;
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
      write(toIosWidgetProps(app ? getSnapshot() : null));
      return taken;
    }),
  };
}

export type IosPublishMode = 'signedOut' | 'live' | 'keep';

/**
 * Same rules as the Android widgets: signed out (or demo, with no queue) shows the sign-in widget; signed
 * in, the snapshot is written after the account's first full load; while signing in or loading offline
 * the previous snapshot stays. Taps are still taken while it stays (see the consume effect).
 */
export function iosPublishMode(auth: 'loading' | 'signedOut' | 'signedIn', hasQueue: boolean, ready: boolean): IosPublishMode {
  if (auth === 'signedOut' || !hasQueue) return 'signedOut';
  return auth === 'signedIn' && ready ? 'live' : 'keep';
}

/** Signed out publishes at once; live publishes 500 ms after the last store change. Returns the cleanup. */
export function schedulePublish(mode: IosPublishMode, publish: () => void, delay = 500): (() => void) | undefined {
  if (mode === 'keep') return undefined;
  if (mode === 'signedOut') {
    publish();
    return undefined;
  }
  const timer = setTimeout(publish, delay);
  return () => clearTimeout(timer);
}
