# T11: item and task status model, undo, price, editing (user feedback, high priority)

Implementer: Opus 5.5 in worktree `../home-setup-wt-t11` (branch `t11`). No emulator for you (another agent uses it); tests, tsc, export only. Reviewer: Fable 5.2 afterwards.

## What the user said (verbatim intent)
"I clicked 'Got it' on the kettle, meaning I proceeded to the NEXT stage, like ordered. Now it is 'done in my home' and I cannot revert it. I cannot check anything. I cannot put the price. When you press it, it should just update the status. There is no way to revert a change. It's horrible. Be thoughtful about features like that and ensure a nice user experience."

## Model to build
Item stages: needed -> looking -> ordered -> delivered -> installed (installed only for items that need installing; otherwise delivered is the end).
1. **One stage at a time.** The primary action on a row/card advances exactly ONE stage and its label names the target stage in plain words: "Mark looking", "Mark ordered", "Got it" (only when the next stage is delivered), "Mark installed". The Buy-tab "Next up" card button follows the same rule (not always "Got it"). Never jump to the end.
2. **Status chip is a control.** Tapping a row's status chip opens a bottom sheet listing all stages with the current one marked; the user can pick ANY stage, forwards or backwards. Also reachable on the item detail screen.
3. **Undo everywhere.** After any status change, check/uncheck, assignment change, delete (soft), quantity/price edit: a snackbar "<Item> -> Ordered. Undo" for 6 s above the tab bar, accessible (announced), and the undo sends the inverse field-level patch through the offline queue (see app/src/data/diff.ts and repo.ts). Task checkboxes and step ticks must be toggleable both ways (tap again to uncheck) and also offer Undo. Build it as ONE reusable undo mechanism in the store (a small undo stack of inverse actions), not per-screen hacks, with unit tests.
4. **Price.** Item detail has editable estimated price and actual price (numeric, pounds, validation, clear button). When an item moves to delivered, show a quick optional inline prompt "Paid? £___  [Save] [Skip]" (skippable, never blocking, remembers nothing). Budget screen reads these (check domain/budgetView.ts still sums correctly).
5. **Everything editable** on the item detail: name, quantity, room, owner (assigned_to), who bought it, urgent, needs install, link, notes, status. Every field saves immediately with the field-level patch (a person's edit sends only their own changed field).
6. **Tasks:** same principles. The task row check toggles my part done/undone; the task detail shows my status with all four states selectable (todo, in progress, waiting, done); undo available; shared tasks still need both to finish.
7. **Widgets:** the large widget's check circle keeps meaning "got it" (delivered) but it must be a conditional patch from the status the widget showed (already so). Add no widget UI changes; mention in your report how a user reverts a mistaken widget tap (the status sheet in the app).
8. Copy: every control says what it will do. No ambiguous "Done".

## Files you may touch
domain/*, data/* (reducer, store, diff, repo), the item row and Next-up card components, item/[id].tsx, task/[id].tsx, tasks list rows, new components for the status sheet, undo snackbar and price prompt. Do NOT restyle: another agent (T12) is changing tile colours, icons and visual styling in ui.tsx/glyphs.ts/theme. Keep your edits to styling minimal and use existing tokens; put new UI in new files where you can, to ease the merge.

## Acceptance
npm test (add many tests: stage stepping, backward moves, undo inverse patches, price validation, budget sums), npx tsc --noEmit, `npx expo export --platform android --output-dir /tmp/t11-export` green. No secrets, names or addresses in code. Commit on t11 "T11: stage stepping, status sheet, undo, price and editing", trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>". Do not push or merge. Report max 200 words: what changed, tests, anything unverified on screen.
