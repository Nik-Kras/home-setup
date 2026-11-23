import { describe, expect, it } from 'vitest';
import { spendTrend, trendPath } from './spendTrend';

const paid = (actualPrice: number | undefined, deliveredAt?: string, extra: { installedAt?: string; addedAt?: string; pricePaidAt?: string } = {}) =>
  ({ actualPrice, deliveredAt, installedAt: extra.installedAt, addedAt: extra.addedAt ?? '2026-10-01T09:00:00', pricePaidAt: extra.pricePaidAt });

describe('spendTrend', () => {
  it('nothing paid: no line and nothing this week', () => {
    expect(spendTrend([paid(undefined, '2026-11-01T10:00:00')], '2026-11-22')).toEqual({ points: [], thisWeek: 0 });
  });

  it('adds up the paid prices day by day from the first spend to today', () => {
    const t = spendTrend([paid(25, '2026-11-18T10:00:00'), paid(90, '2026-11-20T10:00:00'), paid(10, '2026-11-20T18:00:00')], '2026-11-22');
    expect(t.start).toBe('2026-11-18');
    expect(t.points).toEqual([
      { day: '2026-11-18', total: 25 },
      { day: '2026-11-19', total: 25 },
      { day: '2026-11-20', total: 125 },
      { day: '2026-11-21', total: 125 },
      { day: '2026-11-22', total: 125 },
    ]);
  });

  it('ends at the same total as Spent so far: no delivery date falls back to installed, then added', () => {
    const t = spendTrend([paid(40, undefined, { installedAt: '2026-11-21T10:00:00' }), paid(60, undefined, { addedAt: '2026-11-19T10:00:00' })], '2026-11-22');
    expect(t.points.at(-1)!.total).toBe(100);
    expect(t.start).toBe('2026-11-19');
  });

  it('"this week" is the last 7 days including today', () => {
    const t = spendTrend([paid(100, '2026-11-15T10:00:00'), paid(20, '2026-11-16T10:00:00'), paid(5, '2026-11-22T08:00:00')], '2026-11-22');
    expect(t.thisWeek).toBe(25);
  });

  it('"this week" follows when the price was paid, not when the item arrived', () => {
    // Delivered a month ago, price entered today: this week. Delivered today, paid weeks ago: not.
    const t = spendTrend([
      paid(40, '2026-10-20T10:00:00', { pricePaidAt: '2026-11-22T08:00:00' }),
      paid(15, '2026-11-22T09:00:00', { pricePaidAt: '2026-10-30T09:00:00' }),
    ], '2026-11-22');
    expect(t.thisWeek).toBe(40);
    expect(t.start).toBe('2026-10-30');
    expect(t.points.at(-1)!.total).toBe(55);
  });

  it('a date after today counts today', () => {
    const t = spendTrend([paid(30, '2026-11-25T10:00:00')], '2026-11-22');
    expect(t.points).toEqual([{ day: '2026-11-22', total: 30 }]);
    expect(t.thisWeek).toBe(30);
  });
});

describe('trendPath', () => {
  it('starts from nothing and scales the totals into the box, highest point at the top', () => {
    const { line, area } = trendPath([{ total: 50 }, { total: 100 }], 320, 40);
    expect(line).toBe('M0 38 L160 20 L320 2');
    expect(area).toBe('M0 38 L160 20 L320 2 L320 40 L0 40Z');
  });

  it('one day of spending still rises; no points draw nothing', () => {
    expect(trendPath([{ total: 30 }], 100, 40).line).toBe('M0 38 L100 2');
    expect(trendPath([], 100, 40)).toEqual({ line: '', area: '' });
  });
});
