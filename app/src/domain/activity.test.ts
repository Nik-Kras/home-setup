import { describe, expect, it } from 'vitest';
import { itemActivity, timeAgo, type ActivityRow } from './activity';

const now = Date.parse('2026-11-22T12:00:00Z');
const upd = (at: string, actor: string, old: Record<string, unknown>, next: Record<string, unknown>): ActivityRow => ({ actor, op: 'UPDATE', at, change: { old, new: next } });

describe('item activity', () => {
  it('says who did what and when, newest first, in plain words', () => {
    const rows: ActivityRow[] = [
      { actor: 'claude', op: 'INSERT', at: '2026-11-20T09:00:00Z', change: {} },
      upd('2026-11-22T10:00:00Z', 'daryna', { status: 'looking' }, { status: 'ordered' }),
      upd('2026-11-22T11:55:00Z', 'nikita', { actual_price: null }, { actual_price: 40 }),
    ];
    expect(itemActivity(rows, now)).toEqual([
      { actor: 'nikita', text: 'noted the price paid, 5 min ago', at: '2026-11-22T11:55:00Z' },
      { actor: 'daryna', text: 'marked it ordered, 2 h ago', at: '2026-11-22T10:00:00Z' },
      { actor: 'claude', text: expect.stringMatching(/^added it, /), at: '2026-11-20T09:00:00Z' },
    ]);
  });

  it('leaves out changes nobody would notice, and stops at the limit', () => {
    const rows = [
      upd('2026-11-22T11:00:00Z', 'nikita', { updated_at: 'a', name: 'Kettle' }, { updated_at: 'b', name: 'Kettle' }),
      upd('2026-11-22T10:00:00Z', 'nikita', { deleted_at: null }, { deleted_at: 'x' }),
      upd('2026-11-22T10:30:00Z', 'nikita', { deleted_at: 'x' }, { deleted_at: null }),
      upd('2026-11-22T09:00:00Z', 'daryna', { urgent: false }, { urgent: true }),
    ];
    expect(itemActivity(rows, now, 2).map((r) => r.text)).toEqual(['brought it back, 1 h ago', 'deleted it, 2 h ago']);
    expect(itemActivity(rows, now).at(-1)).toEqual({ actor: 'daryna', text: 'edited it, 3 h ago', at: '2026-11-22T09:00:00Z' });
  });

  it('formats time short', () => {
    expect(timeAgo('2026-11-22T11:59:40Z', now)).toBe('just now');
    expect(timeAgo('2026-11-21T10:00:00Z', now)).toBe('yesterday');
    expect(timeAgo('2026-11-19T10:00:00Z', now)).toBe('19 Nov');
  });
});
