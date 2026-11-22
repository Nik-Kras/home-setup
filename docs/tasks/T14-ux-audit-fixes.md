# T14: fix the UX audit findings (all severities)

Implementer: Opus 5.5 in worktree `../home-setup-wt-t14` (branch `t14`, from main). No emulator (T13 uses it): tests, tsc, export only. Reviewer: Fable 5.2, then I verify on the emulator. Add-flow items (who/urgent chips, 'Added to <room> - Undo - Change', one-tap claim, suggestions, comments, trend line, notes tab bar) belong to T13: do not build them.

Direct user feedback behind this: the app was "terrible": nothing could be reverted, price could not be entered, nothing checkable. A harsh UX audit (Fable) found the following; fix ALL of them (user: "proceed removing such issues of all levels").

## Critical
1. Items that need installing cannot reach Installed without a hidden toggle (data/reducer.ts:76 sets needsInstall false by default; domain/items.ts:137 shows four stages). Make Installed an always-available optional last stage in the sheet and the item stepper; after Delivered the primary button offers 'Mark installed' only when needs_install is set, else the sheet still allows Installed. 'Needs installing' toggle moves up on the item screen (not below Photos) and installed-flow copy stays honest.
## High
3. Price prompt only at Delivered and hides after 20 s (data/store.tsx:331-335, UndoBar.tsx:17). Also offer it when an item goes to Ordered (that is when people pay online), and give every got/ordered row without an actual price a small tappable 'Add price' chip that opens the price sheet.
4. A price entered on the item screen without 'Bought by' counts in Spent but in nobody's share (domain/items.ts:102; budgetView.ts:60). Default bought_by to me when a price is saved; Budget shows an explicit 'Unassigned £x' segment/line when some spend has no buyer.
6. Tasks cannot be deleted, reassigned, regrouped or made urgent after creation (app/task/[id].tsx:49,192: Edit changes the title only). Build a full edit sheet: title, group, due date, urgent, who (me/Daryna/both: adding or removing an assignment is a field-level op that never touches the other person's existing status or steps), notes/reference, and Delete (soft, with Undo, 10 s). Same for flat notes: delete (soft) with Undo.
7. Dead tick circles in Daryna's view (components/TaskRow.tsx:20,32; ui.tsx:97): where I have a part of a shared task the circle ticks MY part; where the task is only hers show her person disc instead of a dead circle (no fake affordance).
8. Flat notes entry and the group chips are buried in the Tasks list footer (tasks.tsx:143-148): move the group chip row and a 'Flat notes' entry under the segment switch.
## Medium
10. Next-up hero ignores the person filter and says 'Mark looking' for someone else's/unclaimed item (index.tsx:131,170): follow the filter (my items when Nikita disc is on, etc.). Add a clearly labelled 'Got it' shortcut (with Undo) for the shop case: from the card and the row, jumping straight to Delivered is fine ONLY via this explicit labelled action.
11. Sheet wording 'Looking · next', 'Delivered · got it' (components/StatusSheet.tsx:18): use a secondary line/subtitle, not dotted suffixes.
12. Quick-added tasks have no date and the sliders icon is unlabelled: label it ('Options'); in Add task the selected 'No date' chip is clipped to a tick (AddTask design): fix width.
13. Sync/offline visibility outside the Home account card (home.tsx:50): a small 'Offline · 3 unsent' / 'Sending 2' pill in the screen headers, hidden when synced.
14. Large widget circle advances a stage but looks like a done-tick (components/widgets/OurFlatWidget.tsx:70-83 and the iOS widget): draw a 'next stage' arrow-in-circle glyph, keep the accessibility label naming the stage.
15. Undo lasts 6 s: make it 10 s for deletes (keep 6 s for status).
## Low
- Rows are two-line and taller than the design (list shows 4 rows where Main.png shows 6): compact the rows to match the design's density (name + one meta line, status chip, no chevron clutter; keep the chip tappable).
- Flat notes subtitle 'From the tenancy contract' is wrong for a user's own note (app/notes.tsx:42): neutral wording.
- Tasks: add a 'Shared with Daryna' section in Mine; Done toggle uses a rotated back arrow (use a proper chevron).
- 'Test account, acting as Nikita' header is fine only for the test account; make sure a real person never sees it.
- Item screen header meta price (design Item.png), real activity history line ('Daryna marked it ordered, 2 h ago') from the existing `activity` table if readable, otherwise from updated_by/updated_at.

## Rules
Keep T11 behaviour (one-stage button, sheet, undo, price prompt) and T12 visuals; tokens and colour meaning per docs/design-decisions.md. Writes go through the offline queue with field-level ops; unit tests for every pure function and op. No secrets, names or addresses in code. If a migration is needed, write supabase/migrations/0007_*.sql (do not apply) and say so.

## Acceptance
npm test, npx tsc --noEmit, android + ios export green. Commit on t14 "T14: UX audit fixes", trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"; no push/merge. Report max 200 words.
