# T04: Add-task options and task group screens

Implementer: Opus 5.5 sub-agent in its own git worktree. Reviewer: Fable 5.2. Depends on T01.

## Goal
Build `src/app/add-task.tsx` (modal) and `src/app/group/[name].tsx` from `design-ref/screens/AddTask.png` and `design-ref/screens/TaskGroup.png` (private local images, sources in `design-ref/source/`).

## Do
- Add-task modal: title input (focused, Enter adds), When chips (Today, This week, Pick a date, No date), Group chips (Utilities, Address, Safety, Other), Who chips (Me, other person, Each of us), Urgent toggle. Opens from a small "More options" control next to the live add input on the Tasks screen, carrying over the text typed so far. Uses `addTask`; `addTask` must accept `group`, `due` and `urgent` (extend the store action and reducer, with tests).
- Group screen: title, progress bar and "x of y", a list of the viewer's tasks in that group with check circles (reuse the Tasks row), done tasks collapsed at the end. The Tasks screen shows group chips (name and open count) that open it; groups are the distinct `group` values of tasks.
- "Each of us" creates one task with two assignments. The offline queue and diff code already send it correctly.
- Do NOT build reminders or the tip banner text from the design (it holds private details); leave the banner out.

## Acceptance criteria
- Matches the two design images in structure, spacing, type and colours.
- Accessibility: roles, labels, 44dp targets, 13px text minimum, selected state announced (`accessibilityState.selected`) and not colour-only (check icon on selected chips).
- Adding with defaults (just a title) still takes one Enter press.
- `npm test`, `npx tsc --noEmit`, `npx expo export --platform android` pass; new logic is unit tested.

## Report back (max 150 words)
Files changed, results, anything not done.
