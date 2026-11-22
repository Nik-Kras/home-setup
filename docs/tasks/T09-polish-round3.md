# T09: Polish round 3

Implementer: Opus 5.5 in its own worktree, branch `t09`. Reviewer: Fable 5.2. Conventions: docs/tasks/README.md. DO NOT touch `app/src/app/item/[id].tsx`, `ItemParts.tsx`, `app/src/app/(tabs)/home.tsx` (the photo task owns them) or anything about the store's widget sync or `app/index.ts`/`app.json` (the widget task owns them). You may add new files.

Design images (read from the main checkout, see README): Main, Tasks, TaskDetail, TaskShared, AddTask, TaskGroup, FlatNotes. Remaining findings from an independent visual review of the real app (Fable 5.2):
1. ADD TASK modal: the When/Group/Who chips wrap and the keyboard hides the Who row and helper text. Make each group a single-row horizontal scroller as in the design (with a right edge fade), chips 44dp high (currently about 50), so all three rows and the helper text fit above the keyboard.
2. ADD TASK header sits about 14dp lower than on the detail screens. Use `ScreenHeader` (components/ScreenHeader.tsx) so the top inset matches.
3. GROUP and NOTES headers differ (the plus is 9dp further right on Notes, back arrow 11dp higher). Use `ScreenHeader` on both, with the same trailing action slot.
4. BUY: the person filter is missing. The design and docs/design-decisions.md put two 44dp discs at the top right: mint "N", lilac "D"; tapping one filters the list to items assigned to that person (outline when off, filled tint when on; both off means everyone). Pure filter helper in `domain` with tests.
5. TASKS: "More options" floats alone with about 70dp gap before "Most urgent". Put it in the add bar as a 44dp trailing icon button ("sliders" icon, label "More options") and tighten the gap to 16dp.
6. TASKS: a bare "1" next to "Most urgent". Show "1 task" or hide the count when it is 1.
7. TASK detail and SHARED: chips ("Add due date", "Urgent", due chip, owner chip) are about 32dp high. Where they are tappable give them a 44dp minimum hit area (`hitSlop` or minHeight) without changing the look.
8. EMPTY STATES: create one `components/EmptyState.tsx` (icon tile, title, one line, optional primary action) and use it on the Notes screen and the group screen. Drop the "0 to confirm" count on Notes at zero and keep exactly one add control there.
9. SHARED task "Add step" row in the You card: right-align the plus to the card padding (16dp), use the muted text token for the placeholder (not dimmer), and align "No steps yet" in the other card to the same baseline.
10. GLOW: apply one consistent soft mint glow style (a shared style in `theme/tokens.ts`, e.g. `glow`) to the Tasks deadline card, the Buy "Next up" card and the Budget "Spent so far" card, one per screen. Budget's file is `(tabs)/budget.tsx`, which you may edit for this only.
11. BUY urgent row: the "!" badge exists but the coral word "Urgent" described in the colour section is missing; add the word in coral to the meta line only if it fits on one line, else keep the badge (its accessibility label already says Urgent).

## Acceptance criteria
- Everything above done or explained; no regressions; text 13px minimum; 44dp targets; no nested interactive elements; use minHeight not fixed heights; colour meaning rules hold.
- `npm test`, `npx tsc --noEmit`, `npx expo export --platform android` pass; new pure logic tested.
- Commit on branch `t09` ("T09: polish round 3", co-author line as in the README). Report in max 120 words.
