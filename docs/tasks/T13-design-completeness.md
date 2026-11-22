# T13: build everything the design shows that the app still lacks (user feedback: "make it look exactly like the design")

Implementer: Opus 5.5 in worktree `../home-setup-wt-t13` (branch `t13`, from main). You may use the Android emulator (emulator-5554, you are its only user). Reviewer: Fable 5.2.

## Source of truth
Design images /Users/nikitakrasnytskyi/Repos/home-setup/design-ref/screens/*.png and HTML sources design-ref/source/*.dc.html. The T12 agent reported these design features as missing in the app:
1. **Add-item suggestions**: the Add screen/sheet (Add.png) suggests common items as you type (and a few quick chips): a pure, tested suggestion function over a small built-in list of household items plus the user's existing item names; tapping a suggestion fills name, room and a sensible glyph.
2. **Budget trend line** (Budget.png): spend over time as drawn in the design (SVG, no new dependency unless react-native-svg is already installed; check package.json), computed by a pure tested function from delivered_at and actual_price.
3. **Item/Task switch in the add sheet**: one add sheet that switches between adding an item and a task, as in the design; keeps the existing add-task options.
4. **Comment bar** on Item and Task detail (Item.png, TaskDetail.png): a comment input and list; the `comments` table already exists (see supabase/migrations/0001_init.sql; check its RLS and columns) so wire it through the offline queue (ops in data/repo.ts, mapper, store, diff) with unit tests. Comments show author and relative time; the activity log is not required.
5. **Flat notes tab bar**: the Flat notes screen shows the tab bar as in FlatNotes.png.
6. Anything else you find that is visibly different in the design images and absent in the app after comparing every screen once more (Main, Add, AddTask, Budget, FlatNotes, Home, Item, TaskDetail, TaskGroup, TaskShared, Tasks, TasksDaryna). Do not undo T11 behaviour (one-stage status button, status sheet, undo bar, price prompt) or T12 visuals.

## Rules
Colour meaning and tokens per docs/design-decisions.md (coral only urgent, mint done/primary, Daryna lilac, amber in-transit). Bathroom tile colour stays sky blue unless told otherwise. Writes go through the offline queue; edits are field-level. No secrets, names or addresses in code. Data in the database is real household data: never create or delete it except soft-deleted `ZZ-` test rows; comments you create for testing must be soft-deleted or use a ZZ task.
Loop: build, run on emulator signed in as the Claude test account (see app/e2e/README.md), screenshot to /private/tmp/claude-501/-Users-nikitakrasnytskyi-Repos/79636bc3-97e1-4783-ae4c-c06353b1bb30/scratchpad/pass9/, compare to the design, fix, repeat (max 5 iterations).

## Acceptance
npm test (new tests for suggestions, trend data, comments ops/mapper), npx tsc --noEmit, android export green. If a migration is needed (e.g. a missing grant/column), write supabase/migrations/0007_*.sql and say so; do not apply it. Commit on t13 "T13: design completeness (suggestions, trend, add switch, comments, notes tab bar)", trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>". Do not push or merge. Report max 200 words.
