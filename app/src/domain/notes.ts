import { isTaskDone } from './tasks';
import type { FlatNote, NoteKind, Task } from './types';

/** Open questions first, then things to check, then plain facts; the stored order within each. */
const KIND_ORDER: Record<NoteKind, number> = { to_confirm: 0, check: 1, info: 2 };

export function notesSorted(notes: readonly FlatNote[]): FlatNote[] {
  return [...notes].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.sort - b.sort);
}

export function toConfirmCount(notes: readonly FlatNote[]): number {
  return notes.filter((n) => n.kind === 'to_confirm').length;
}

/** What the note form holds. An empty string means no body or no reference. */
export interface NoteDraft {
  title: string;
  body: string;
  reference: string;
  kind: NoteKind;
}

/**
 * Only the fields the person changed, compared with the note as it was when the form opened.
 * Unchanged fields are left out, so a stale form cannot undo another person's edit made meanwhile.
 */
export function noteDraftChanges(original: FlatNote, draft: NoteDraft): Partial<NoteDraft> {
  const out: Partial<NoteDraft> = {};
  if (draft.title.trim() !== original.title) out.title = draft.title;
  if (draft.body.trim() !== (original.body ?? '')) out.body = draft.body;
  if (draft.reference.trim() !== (original.reference ?? '')) out.reference = draft.reference;
  if (draft.kind !== original.kind) out.kind = draft.kind;
  return out;
}

/** True when a task with this title is still open, so "Make it a task" would only add a duplicate. */
export function hasOpenTask(tasks: readonly Task[], title: string): boolean {
  const want = title.trim().toLowerCase();
  return tasks.some((t) => !isTaskDone(t) && t.title.trim().toLowerCase() === want);
}
