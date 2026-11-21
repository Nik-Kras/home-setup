import type { FlatNote, NoteKind } from './types';

/** Open questions first, then things to check, then plain facts; the stored order within each. */
const KIND_ORDER: Record<NoteKind, number> = { to_confirm: 0, check: 1, info: 2 };

export function notesSorted(notes: readonly FlatNote[]): FlatNote[] {
  return [...notes].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.sort - b.sort);
}

export function toConfirmCount(notes: readonly FlatNote[]): number {
  return notes.filter((n) => n.kind === 'to_confirm').length;
}
