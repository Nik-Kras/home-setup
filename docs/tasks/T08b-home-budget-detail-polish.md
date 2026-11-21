# T08b: Home, Budget, item, task detail and notes polish

Implementer: Opus 5.5 in its own worktree, branch `t08b`. Reviewer: Fable 5.2. You own ONLY: `app/src/app/(tabs)/home.tsx`, `(tabs)/budget.tsx`, `app/src/app/item/[id].tsx`, `ItemParts.tsx`, `app/src/app/task/[id].tsx`, `TaskDetailParts.tsx`, `app/src/app/notes.tsx`, `NoteCard.tsx`, `NoteSheet.tsx`, `Sheet.tsx`, and new files you create (for example a shared `ScreenHeader`). Do not touch Buy, Tasks, add-task or group files (another agent owns them).

Findings from a visual review of the real app against the design (`design-ref/screens/Home.png`, `Budget.png`, `Item.png`, `TaskDetail.png`, `TaskShared.png`, `FlatNotes.png`; paths in docs/tasks/README.md):
1. HOME shows a blank screen when nothing is in place: it reads as a failed load. Build the design: serif title and count, a Room/Owner switch (44dp, "By room" default, "By owner" groups by who bought it), room filter chips (All plus rooms that have items, horizontally scrollable with a fade), and the two-column photo/glyph grid. Add an empty state card (radius 24, surface) with "Nothing in place yet. Items show up here once they are delivered or installed." and a mint "Go to Buy list" button. Pure grouping/filter logic goes in `domain` with tests.
2. BUDGET at zero: the "Who paid" split bar shows a full half mint half lilac bar, implying a real split. When the total spent is 0 show only the neutral track and the text "No spending yet". The "By room" card shows a heading and no rows although items have estimates: show rows for rooms that have an estimate or spend ("£0 of £25"), and hide the card only when there is nothing at all. Tests for the pure budget view model.
3. ITEM detail: value hierarchy is flat (real values are muted like empty ones). Real values use `colors.text` weight 600, empty values "Nobody"/"Add" use secondary text, and the "Add" action is mint. Add the activity line style used on the task screens (dot plus bold name) for "Added ... by ..." and "Last change by ...".
4. SHARED back header: pushed screens put the back arrow at different heights. Create `components/ScreenHeader.tsx` (44dp back button at a fixed top offset below the safe area, optional right action) and use it on item, task and notes (the other agent will adopt it for group and add-task later).
5. TASK detail: in the single-person status control, equal-width segments leave "In progress" tight against the selected pill; size segments by content with padding 12. In the shared task "Add step" row, align its left edge with the card's other content.
6. NOTES empty state: align the empty text with the header's left edge, put it in a card with an "Add a note" button.
7. Stepper labels on the item screen must never shrink below 13px: let labels wrap to two lines instead.
8. Targets: controls under 44dp (the "Looking" status chip on rows is not yours; here: checkboxes, add-step plus, Edit) get `hitSlop` or a 44dp minimum.

## Acceptance criteria
- Matches the design where it differs today; colour meaning holds (coral only urgent, amber only in transit/to confirm, mint done/primary, Daryna lilac, neutral tiles); text 13px or more; no nested interactive elements; use minHeight not fixed heights.
- `npm test`, `npx tsc --noEmit`, `npx expo export --platform android` pass; new pure logic is tested.
- Commit on branch `t08b` ("T08b: home, budget and detail screen polish", co-author line as in the README). Report in max 120 words.
