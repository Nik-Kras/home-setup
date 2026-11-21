import { describe, expect, it } from 'vitest';
import { hasOpenTask, noteDraftChanges, notesSorted, toConfirmCount, type NoteDraft } from '../domain/notes';
import type { FlatNote, Task } from '../domain/types';
import { diffToOps } from './diff';
import { noteFromRow, noteToRow } from './mappers';
import { reducer, type State } from './reducer';

const note: FlatNote = { id: 'n1', title: 'Demo: spare key holder', body: 'Ask the neighbour.', kind: 'to_confirm', sort: 1, updatedBy: 'claude' };
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

describe('noteDraftChanges', () => {
  const draftOf = (n: FlatNote): NoteDraft => ({ title: n.title, body: n.body ?? '', reference: n.reference ?? '', kind: n.kind });

  it('an untouched form changes nothing, even with surrounding spaces', () => {
    expect(noteDraftChanges(note, draftOf(note))).toEqual({});
    expect(noteDraftChanges(note, { ...draftOf(note), title: ` ${note.title} `, reference: '  ' })).toEqual({});
  });

  it('sends only the fields the person changed', () => {
    expect(noteDraftChanges(note, { ...draftOf(note), kind: 'info' })).toEqual({ kind: 'info' });
    expect(noteDraftChanges(note, { ...draftOf(note), body: '', reference: 'Hall cupboard' })).toEqual({ body: '', reference: 'Hall cupboard' });
  });

  it('a stale form does not revert another person\'s edit made meanwhile', () => {
    const opened = note;
    const draft = { ...draftOf(opened), kind: 'info' as const };
    // Meanwhile the other person changed the body. Only kind goes out, so their body stays.
    const changes = noteDraftChanges(opened, draft);
    const theirs: State = { ...state, notes: [{ ...note, body: 'Their new body.' }] };
    const next = reducer(theirs, { type: 'updateNote', id: 'n1', patch: changes });
    expect(next.notes[0]).toMatchObject({ kind: 'info', body: 'Their new body.' });
  });
});

describe('hasOpenTask', () => {
  const task = (title: string, status: 'todo' | 'done'): Task => ({ id: title, title, urgent: false, updatedBy: 'nikita', assignments: [{ person: 'nikita', status, steps: [] }] });

  it('finds an open task with the same title, ignoring case and spaces', () => {
    expect(hasOpenTask([task(' demo: spare key holder ', 'todo')], note.title)).toBe(true);
  });

  it('a finished task or a different title does not count', () => {
    expect(hasOpenTask([task(note.title, 'done'), task('Something else', 'todo')], note.title)).toBe(false);
  });
});

describe('note mappers', () => {
  it('round-trips a note and never sends updated_by', () => {
    expect(noteToRow(note)).toEqual({ id: 'n1', title: 'Demo: spare key holder', body: 'Ask the neighbour.', reference: null, kind: 'to_confirm', sort: 1 });
    expect(noteFromRow({ id: 'n1', title: 'Demo: spare key holder', body: 'Ask the neighbour.', reference: null, kind: 'to_confirm', sort: 1, updated_by: 'claude' })).toEqual(note);
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
    expect(next.notes[0]).toMatchObject({ kind: 'info', body: 'Checked: yes.', title: 'Demo: spare key holder', updatedBy: 'nikita' });
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
    expect(reducer(state, { type: 'updateNote', id: 'n1', patch: { title: ' Demo: spare key holder ', kind: 'to_confirm' } })).toBe(state);
    expect(reducer(state, { type: 'updateNote', id: 'nope', patch: { title: 'X' } })).toBe(state);
  });

  it('a diff without notes on either side sends nothing for notes', () => {
    expect(diffToOps({ items: [], tasks: [] }, { items: [], tasks: [] }, rooms)).toEqual([]);
  });
});
