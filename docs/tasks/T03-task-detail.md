# T03: Task detail and shared task screens

Implementer: Codex (Sol 6.2) via /codex:rescue, in its own git worktree. Reviewer: Fable 5.2. Depends on T01.

## Goal
Replace the placeholder `src/app/task/[id].tsx` with one screen that handles both a single-person task and a shared task, from `design-ref/screens/TaskDetail.png` (single person) and `design-ref/screens/TaskShared.png` (shared, two people). Private local files; sources in `design-ref/source/`.

## Do
- Single-person task: serif title (editable), chips for due date and reference and owner, status control (To do, In progress, Waiting, Done; 44dp segments; In progress is amber), a steps checklist with per-step check circles (add a step with a text input at the end; `toggleStep` exists in the store, add an `addStep` action if missing, going through the diff and queue), a note card for `notes`, and a footer line "Last change by <name>".
- Shared task: one card per person (You first) with avatar disc, status chip, progress bar and that person's own steps; the viewer can change only their own card (the other card is read only); a line "The task closes when both of you are done"; primary button "Mark mine done" (toggles to "Mark mine not done"); the task shows "<n> of <m> done".
- The title row has a due-date chip that opens a simple date choice (Today, Tomorrow, This week, Pick a date using a plain numeric text input is acceptable, No date) using `updateTask`.
- Do NOT build: "Nudge", "Ask Claude to draft", reminders, photos, comments. Leave no dead controls.
- Domain helpers (progress label, who is waiting) go in `src/domain/tasks.ts` with unit tests. Respect rule: a person's edit sends only their own assignment (`diff.ts`).

## Acceptance criteria
- Matches both design images in structure, spacing, type and colours; coral only for urgent.
- Accessibility: roles and labels, 44dp targets, 13px text minimum, no nested interactive elements, no clipping with long titles.
- Editing my part never changes the other person's part (covered by a test).
- `npm test`, `npx tsc --noEmit`, `npx expo export --platform android` pass.

## Report back (max 150 words)
Files changed, results, anything not done.
