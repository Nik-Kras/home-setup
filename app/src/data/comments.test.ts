import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { commentActivity, commentsFor, COMMENTS_SHOWN, mergeActivity, type Comment } from '../domain/comments';
import { diffToOps } from './diff';
import { commentFromRow, commentToRow, type CommentRow } from './mappers';
import { reducer, type State } from './reducer';
import { isMissingColumn, makeExecutor, ops } from './repo';
import { applyUndo, offerSnack, undoEntryFor } from './undo';

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
      { actor: 'nikita', text: 'commented: note b, 5 min ago', at: '2026-11-22T11:55:00Z', commentId: 'b' },
      { actor: 'daryna', text: 'commented: note a, 3 h ago', at: '2026-11-22T09:00:00Z', commentId: 'a' },
    ]);
  });

  it('sits among the changes by time; undated lines stay last', () => {
    const history = [{ actor: 'nikita' as const, text: 'marked it ordered', at: '2026-11-22T10:00:00Z' }, { actor: 'claude' as const, text: 'added it', at: '2026-11-21T10:00:00Z' }];
    const comments = commentActivity([c('a', '2026-11-22T09:00:00Z')], 'item', 'i1', now);
    expect(mergeActivity(history, comments).map((l) => l.text)).toEqual(['marked it ordered', 'commented: note a, 3 h ago', 'added it']);
    expect(mergeActivity([{ actor: 'claude', text: 'made the last change' }], comments).map((l) => l.text)).toEqual(['commented: note a, 3 h ago', 'made the last change']);
  });
});

describe('comment author and delete', () => {
  it('my new comment carries the account the database will stamp (Claude for the test account)', () => {
    const asClaude: State = { ...start, me: 'nikita', actor: 'claude' };
    expect(reducer(asClaude, { type: 'addComment', targetType: 'item', targetId: 'i1', body: 'Hi' }).comments![0]!.author).toBe('claude');
    expect(reducer({ ...start, me: 'nikita' }, { type: 'addComment', targetType: 'item', targetId: 'i1', body: 'Hi' }).comments![0]!.author).toBe('nikita');
  });

  it('only my own comment can be deleted; it is a soft delete with Undo that puts it back', () => {
    const mine = commentFromRow({ ...row, id: 'm', author: 'daryna' });
    const theirs = commentFromRow({ ...row, id: 't', author: 'nikita' });
    const withTwo: State = { ...start, comments: [theirs, mine] };
    expect(reducer(withTwo, { type: 'deleteComment', id: 't' })).toBe(withTwo);
    const action = { type: 'deleteComment' as const, id: 'm' };
    const next = reducer(withTwo, action);
    expect(next.comments).toEqual([theirs]);
    const entry = undoEntryFor(withTwo, next, action, 1, 'u')!;
    expect(entry.message).toBe('Comment deleted');
    expect(offerSnack(entry)).toMatchObject({ canUndo: true, ms: 10_000 });
    const undone = applyUndo(next, entry, new Map());
    expect(undone.state.comments).toEqual([theirs, mine]);
    expect(undone.ops).toEqual([{ id: expect.any(String), kind: 'patch', table: 'comments', match: { id: 'm' }, row: { deleted_at: null } }]);
    expect(ops.softDelete('comments', 'm')).toMatchObject({ table: 'comments', match: { id: 'm' }, row: { deleted_at: expect.any(String) } });
  });

  it('shows at most the newest COMMENTS_SHOWN per item', () => {
    const many: Comment[] = Array.from({ length: COMMENTS_SHOWN + 5 }, (_, n) => ({ id: `c${n}`, targetType: 'item', targetId: 'i1', author: 'nikita', body: 'x', createdAt: new Date(Date.UTC(2026, 10, 1, 0, n)).toISOString() }));
    const shown = commentsFor(many, 'item', 'i1');
    expect(shown).toHaveLength(COMMENTS_SHOWN);
    expect(shown.at(-1)!.id).toBe(`c${COMMENTS_SHOWN + 4}`);
    expect(shown[0]!.id).toBe('c5');
  });

  it('a missing column (migration pending) is recognised', () => {
    expect(isMissingColumn({ code: '42703' })).toBe(true);
    expect(isMissingColumn({ code: 'PGRST204' })).toBe(true);
    expect(isMissingColumn({ code: '23505' })).toBe(false);
  });
});
