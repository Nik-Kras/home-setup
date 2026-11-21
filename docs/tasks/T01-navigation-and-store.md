# T01: Navigation structure and store actions

Implementer: Opus 5.5 sub-agent. Reviewer: Fable 5.2. Works directly on `main` (nothing else runs in parallel).

## Goal
Make room for detail screens. Today the four tabs are the only routes. Add a stack above the tabs so item, task, group and notes screens can open on top, and give the store the update actions those screens need. Add placeholder screens only; later tasks fill them in.

## Do
1. Routing (Expo Router, SDK 58; read https://docs.expo.dev/router/advanced/stack.md and nested navigators before coding):
   - Move the tab screens into a `(tabs)` group: `src/app/(tabs)/_layout.tsx` (the existing Tabs, Gate and custom `TabBar` logic), `index.tsx`, `tasks.tsx`, `home.tsx`, `budget.tsx`.
   - Root `src/app/_layout.tsx`: fonts, splash, `StoreProvider`, sign-in gate, and a `Stack` with `headerShown: false` and the same dark background, containing `(tabs)` and the screens below.
   - New routes, each a placeholder that shows the serif title, a back button (44dp target, `accessibilityLabel="Back"`) and the id or name it received: `src/app/item/[id].tsx`, `src/app/task/[id].tsx`, `src/app/group/[name].tsx`, `src/app/notes.tsx`, `src/app/add-task.tsx` (presented as a modal).
   - Rows navigate: a Buy row (pressing the text area, not the icon tile) pushes `/item/<id>`; a Tasks row (the text area, not the check circle) pushes `/task/<id>`. The tile and the check circle keep their current tap actions.
   - Tasks screen group chips are not built yet; skip them.
2. Store actions in `src/data/store.tsx` plus reducer cases, all going through the existing diff and queue path:
   - `updateItem(id, patch)` where patch is a partial of `Item` without `id`, and it stamps `updatedBy`.
   - `updateTask(id, patch)` for `title`, `due`, `urgent`, `notes`, `reference`, `group` only.
   - `setItemStatus(id, status)` that sets the status directly and the matching `deliveredAt` or `installedAt` timestamps.
   Extend `src/data/diff.ts` if a changed task field must be sent (task field changes send one `patch` op on `tasks` with only the changed columns, never the assignments).
3. Tests (vitest): reducer cases for the three actions, and `diffToOps` for a task field change and an item status change. Keep the existing tests green.

## Acceptance criteria
- `npm test` and `npx tsc --noEmit` pass; `npx expo-doctor` shows no new issue; `npx expo export --platform android` succeeds.
- The four tabs look and behave exactly as before (same files moved, no visual change).
- Each placeholder route opens from the right place and the back button returns to the tab.
- No button nested inside a pressable that has its own action; tile and check circle still work.
- No new dependencies unless required; if one is added, say why.

## References
- Existing code: `app/src/app`, `app/src/components`, `app/src/data`, `app/src/domain`.
- Rules: `CLAUDE.md`, `docs/build-strategy.md`.

## Report back (max 150 words)
Files changed, test and typecheck results, anything you could not do.
