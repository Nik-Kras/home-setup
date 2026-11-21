import { describe, expect, it } from 'vitest';
import { notesSorted, toConfirmCount } from '../domain/notes';
import type { FlatNote } from '../domain/types';
import { diffToOps } from './diff';
import { noteFromRow, noteToRow } from './mappers';
import { reducer, type State } from './reducer';

const note: FlatNote = { id: 'n1', title: 'Demo: gas supply', body: 'Check the meter.', kind: 'to_confirm', sort: 1, updatedBy: 'claude' };
const state: State = { me: 'nikita', items: [], tasks: [], notes: [note] };
const rooms = new Map<string, string>();

describe('notes domain', () => {
  it('puts to-confirm notes first, then checks, then facts, keeping the stored order', () => {
    const a: FlatNote = { ...note, id: 'a', kind: 'info', sort: 1 };
    const b: FlatNote = { ...note, id: 'b', kind: 'check', sort: 5 };
    const c: FlatNote = { ...note, id: 'c', kind: 'to_confirm', sort: 3 };
    const d: FlatNote = { ...note, id: 'd', kind: 'to_confirm', sort: 2 };
    expect(notesSorted([a, b, c, d]).map((n) => n.id)).toEqual(['d', 'c', 'b', 'a']);
    expect(toConfirmCount([a, b, c, d])).toBe(2);
  });
});

describe('note mappers', () => {
  it('round-trips a note and never sends updated_by', () => {
    expect(noteToRow(note)).toEqual({ id: 'n1', title: 'Demo: gas supply', body: 'Check the meter.', reference: null, kind: 'to_confirm', sort: 1 });
    expect(noteFromRow({ id: 'n1', title: 'Demo: gas supply', body: 'Check the meter.', reference: null, kind: 'to_confirm', sort: 1, updated_by: 'claude' })).toEqual(note);
  });

  it('a null sort reads as 0 and an unknown actor as claude', () => {
    expect(noteFromRow({ id: 'x', title: 'T', body: null, reference: null, kind: 'info', sort: null, updated_by: 'system' })).toMatchObject({ sort: 0, updatedBy: 'claude', body: undefined });
  });
});

describe('addNote', () => {
  it('adds a trimmed note at the end with the next sort and stamps the actor', () => {
    const next = reducer(state, { type: 'addNote', title: '  Demo: bins day ', body: ' ', reference: ' Clause 2 ' });
    expect(next.notes).toHaveLength(2);
    expect(next.notes[1]).toMatchObject({ title: 'Demo: bins day', body: undefined, reference: 'Clause 2', kind: 'info', sort: 2, updatedBy: 'nikita' });
  });

  it('an empty title is refused', () => {
    expect(reducer(state, { type: 'addNote', title: '   ' })).toBe(state);
  });

  it('is one idempotent upsert by id', () => {
    const next = reducer(state, { type: 'addNote', title: 'Demo: bins day', kind: 'check' });
    const added = next.notes[1]!;
    expect(diffToOps(state, next, rooms)).toEqual([
      { id: expect.any(String), kind: 'upsert', table: 'flat_notes', row: { id: added.id, title: 'Demo: bins day', body: null, reference: null, kind: 'check', sort: 2 } },
    ]);
  });
});

describe('updateNote', () => {
  it('patches only the changed columns', () => {
    const next = reducer(state, { type: 'updateNote', id: 'n1', patch: { kind: 'info', body: 'Checked: yes.' } });
    expect(next.notes[0]).toMatchObject({ kind: 'info', body: 'Checked: yes.', title: 'Demo: gas supply', updatedBy: 'nikita' });
    expect(diffToOps(state, next, rooms)).toEqual([{ id: expect.any(String), kind: 'patch', table: 'flat_notes', match: { id: 'n1' }, row: { kind: 'info', body: 'Checked: yes.' } }]);
  });

  it('clearing the body sends null', () => {
    const next = reducer(state, { type: 'updateNote', id: 'n1', patch: { body: '  ' } });
    expect(next.notes[0]!.body).toBeUndefined();
    expect(diffToOps(state, next, rooms)[0]).toMatchObject({ kind: 'patch', row: { body: null } });
  });

  it('ignores fields outside the allowed set, refuses an empty title, and an unchanged patch is a no-op', () => {
    const sneaky = { id: 'other', updatedBy: 'daryna' } as unknown as { title: string };
    expect(reducer(state, { type: 'updateNote', id: 'n1', patch: sneaky })).toBe(state);
    expect(reducer(state, { type: 'updateNote', id: 'n1', patch: { title: ' ' } })).toBe(state);
    expect(reducer(state, { type: 'updateNote', id: 'n1', patch: { title: ' Demo: gas supply ', kind: 'to_confirm' } })).toBe(state);
    expect(reducer(state, { type: 'updateNote', id: 'nope', patch: { title: 'X' } })).toBe(state);
  });

  it('a diff without notes on either side sends nothing for notes', () => {
    expect(diffToOps({ items: [], tasks: [] }, { items: [], tasks: [] }, rooms)).toEqual([]);
  });
});
