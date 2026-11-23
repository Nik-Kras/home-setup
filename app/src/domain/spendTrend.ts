import type { Item } from './types';

export interface SpendTrend {
  /** Cumulative spend at the end of each day, from the first day with a spend to today (both included). */
  points: { day: string; total: number }[];
  /** First day with a spend, YYYY-MM-DD, for the "1 Oct" label; undefined when nothing is paid yet. */
  start?: string;
  /** Spend in the 7 days up to and including today, for "+£120 this week". */
  thisWeek: number;
}

const DAY = 86_400_000;
/** Local calendar day of an ISO time, YYYY-MM-DD. */
export function localDay(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const dayMs = (day: string) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Spending over time for the Budget trend line and "+£X this week". A paid price counts on the day it
 * was saved (price_paid_at); prices saved before that was recorded fall back to the day the item
 * arrived (delivered, else installed), else when it was added, so the line ends at the same "Spent so
 * far" total. Days after today are clamped to today.
 */
export function spendTrend(items: readonly Pick<Item, 'actualPrice' | 'pricePaidAt' | 'deliveredAt' | 'installedAt' | 'addedAt'>[], today: string): SpendTrend {
  const byDay = new Map<string, number>();
  for (const i of items) {
    if (!i.actualPrice) continue;
    const when = i.pricePaidAt ?? i.deliveredAt ?? i.installedAt ?? i.addedAt;
    let day = localDay(when);
    if (day > today) day = today;
    byDay.set(day, (byDay.get(day) ?? 0) + i.actualPrice);
  }
  if (byDay.size === 0) return { points: [], thisWeek: 0 };
  const start = [...byDay.keys()].sort()[0]!;
  const points: SpendTrend['points'] = [];
  let total = 0;
  for (let ms = dayMs(start); ms <= dayMs(today); ms += DAY) {
    const day = dayOf(ms);
    total += byDay.get(day) ?? 0;
    points.push({ day, total });
  }
  const weekStart = dayOf(dayMs(today) - 6 * DAY);
  let thisWeek = 0;
  for (const [day, amount] of byDay) if (day >= weekStart) thisWeek += amount;
  return { points, start, thisWeek };
}

/**
 * SVG path for the trend inside a width x height box (y grows down), with a 2px inset at the top and
 * bottom so the stroke is not clipped. The line starts from nothing at the left edge, so even one day
 * of spending rises. Empty for no points.
 */
export function trendPath(points: readonly { total: number }[], width: number, height: number): { line: string; area: string } {
  if (points.length === 0) return { line: '', area: '' };
  const values = [0, ...points.map((p) => p.total)];
  const max = Math.max(...values, 1);
  const top = 2;
  const usable = height - 4;
  const r = (n: number) => Math.round(n * 10) / 10;
  const line = values.map((v, n) => `${n === 0 ? 'M' : 'L'}${r((n / (values.length - 1)) * width)} ${r(top + usable - (v / max) * usable)}`).join(' ');
  return { line, area: `${line} L${r(width)} ${height} L0 ${height}Z` };
}
