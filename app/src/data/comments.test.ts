import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { commentActivity, commentsFor, mergeActivity, type Comment } from '../domain/comments';
import { diffToOps } from './diff';
import { commentFromRow, commentToRow, type CommentRow } from './mappers';
import { reducer, type State } from './reducer';
import { makeExecutor, ops } from './repo';

const start: State = { me: 'daryna', items: [], tasks: [], notes: [] };
const row: CommentRow = { id: 'c1', target_type: 'item', target_id: 'i1', author: 'daryna', body: 'the 800 W one is enough', created_at: '2026-11-21T18:00:00Z' };

describe('comment mapper', () => {
  it('reads a row, with an unknown author shown as Claude', () => {
    expect(commentFromRow(row)).toEqual({ id: 'c1', targetType: 'item', targetId: 'i1', author: 'daryna', body: 'the 800 W one is enough', createdAt: '2026-11-21T18:00:00Z' });
    expect(commentFromRow({ ...row, author: 'system' }).author).toBe('claude');
  });

  it('never sends the author: the database stamps it from the signed-in account', () => {
    const out = commentToRow(commentFromRow(row));
    expect(out).toEqual({ id: 'c1', target_type: 'item', target_id: 'i1', body: 'the 800 W one is enough', created_at: '2026-11-21T18:00:00Z' });
    expect(out).not.toHaveProperty('author');
  });
});

describe('addComment', () => {
  it('adds my trimmed comment, and ignores a blank one', () => {
    const next = reducer(start, { type: 'addComment', targetType: 'task', targetId: 't1', body: '  Booked for Tuesday ' });
    expect(next.comments).toEqual([{ id: expect.any(String), targetType: 'task', targetId: 't1', author: 'daryna', body: 'Booked for Tuesday', createdAt: expect.any(String) }]);
    expect(reducer(start, { type: 'addComment', targetType: 'task', targetId: 't1', body: '   ' })).toBe(start);
  });

  it('is sent as one insert-only upsert, so a retry never adds it twice', () => {
    const next = reducer(start, { type: 'addComment', targetType: 'item', targetId: 'i1', body: 'Hi' });
    const out = diffToOps(start, next, new Map());
    expect(out).toEqual([{ id: expect.any(String), kind: 'upsert', table: 'comments', ignoreDuplicates: true, row: { id: next.comments![0]!.id, target_type: 'item', target_id: 'i1', body: 'Hi', created_at: next.comments![0]!.createdAt } }]);
  });

  it('comments already there send nothing', () => {
    const withOne: State = { ...start, comments: [commentFromRow(row)] };
    expect(diffToOps(withOne, { ...withOne, comments: [...withOne.comments!] }, new Map())).toEqual([]);
  });

  it('the executor inserts it with ignoreDuplicates', async () => {
    const calls: { table: string; row: unknown; opts: unknown }[] = [];
    const db = { from: (table: string) => ({ upsert: async (r: unknown, opts: unknown) => (calls.push({ table, row: r, opts }), { error: null }) }) } as unknown as SupabaseClient;
    const op = ops.addComment(commentFromRow(row));
    expect(await makeExecutor(db)(op)).toBe('ok');
    expect(calls).toEqual([{ table: 'comments', row: commentToRow(commentFromRow(row)), opts: { ignoreDuplicates: true } }]);
  });
});

describe('commentsFor', () => {
  const c = (id: string, targetId: string, createdAt: string): Comment => ({ id, targetType: 'item', targetId, author: 'nikita', body: id, createdAt });
  it('keeps one target\'s comments, oldest first', () => {
    const list = [c('b', 'i1', '2026-11-21T12:00:00Z'), c('x', 'i2', '2026-11-21T11:00:00Z'), c('a', 'i1', '2026-11-21T10:00:00Z')];
    expect(commentsFor(list, 'item', 'i1').map((x) => x.id)).toEqual(['a', 'b']);
    expect(commentsFor(list, 'task', 'i1')).toEqual([]);
    expect(commentsFor(undefined, 'item', 'i1')).toEqual([]);
  });
});

describe('comment activity lines', () => {
  const now = Date.parse('2026-11-22T12:00:00Z');
  const c = (id: string, createdAt: string, author: Comment['author'] = 'daryna'): Comment => ({ id, targetType: 'item', targetId: 'i1', author, body: `note ${id}`, createdAt });
  it('reads like the item history, newest first', () => {
    const lines = commentActivity([c('a', '2026-11-22T09:00:00Z'), c('b', '2026-11-22T11:55:00Z', 'nikita')], 'item', 'i1', now);
    expect(lines).toEqual([
      { actor: 'nikita', text: 'commented: note b, 5 min ago', at: '2026-11-22T11:55:00Z' },
      { actor: 'daryna', text: 'commented: note a, 3 h ago', at: '2026-11-22T09:00:00Z' },
    ]);
  });

  it('sits among the changes by time; undated lines stay last', () => {
    const history = [{ actor: 'nikita' as const, text: 'marked it ordered', at: '2026-11-22T10:00:00Z' }, { actor: 'claude' as const, text: 'added it', at: '2026-11-21T10:00:00Z' }];
    const comments = commentActivity([c('a', '2026-11-22T09:00:00Z')], 'item', 'i1', now);
    expect(mergeActivity(history, comments).map((l) => l.text)).toEqual(['marked it ordered', 'commented: note a, 3 h ago', 'added it']);
    expect(mergeActivity([{ actor: 'claude', text: 'made the last change' }], comments).map((l) => l.text)).toEqual(['commented: note a, 3 h ago', 'made the last change']);
  });
});
