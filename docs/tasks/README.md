# Working conventions for task agents

Applies to every brief in this folder (T02 onwards). Read `CLAUDE.md` and `docs/build-strategy.md` first.

## Where you work
- You run in your own git worktree on your own branch, never in the main checkout `/Users/nikitakrasnytskyi/Repos/home-setup`. If your tool did not create a worktree for you, create one: `git -C /Users/nikitakrasnytskyi/Repos/home-setup worktree add ../home-setup-wt-<taskid> -b <taskid>`.
- A new worktree has no `node_modules`. Link the main one: `ln -s /Users/nikitakrasnytskyi/Repos/home-setup/app/node_modules app/node_modules`. Do not run `npm install` unless you add a dependency (then use `npx expo install <pkg>` and say so in your report; the orchestrator installs it in the main checkout on merge).
- The design images and HTML sources are private and git-ignored, so they are not in your worktree. Read them from the main checkout: `/Users/nikitakrasnytskyi/Repos/home-setup/design-ref/screens/<Name>.png` and `/Users/nikitakrasnytskyi/Repos/home-setup/design-ref/source/<Name>.dc.html`.
- `app/.env` does not exist in your worktree and you must never read or print the main one. Without it the app runs in demo mode, which is fine for your work.

## Rules
- Do not start the emulator, Metro or any dev server; the orchestrator verifies on the emulator after merging. You must run `npm test`, `npx tsc --noEmit` and `npx expo export --platform android --output-dir /tmp/<taskid>-export` from `app/` and leave them green.
- Expo and React Native APIs change between SDKs (this is SDK 58): fetch the matching page from https://docs.expo.dev/llms.txt (append `.md`) before using an API, never answer from memory.
- Keep changes small and in your lane. New components go in new files under `app/src/components`; avoid reformatting shared files. Shared files you may need to touch (`store.tsx`, `reducer.ts`, `diff.ts`, `ui.tsx`) get minimal edits, because other agents work in parallel and the orchestrator merges.
- Pure logic goes in `app/src/domain` (or a pure `data` helper) and is unit tested. Anything that is a person's edit must send only their own change (see `diff.ts`).
- Follow `docs/design-decisions.md`, including the colour meaning as built, and the accessibility rules in `docs/build-strategy.md`.
- No secrets, names, addresses or contract details in code, seeds, tests or commit messages. The repo is public.

## Finish
- Commit on your branch: `<TASKID>: <short summary>`, ending with `Co-Authored-By: <your model name> <noreply@anthropic.com>`. Do not push to `main` and do not merge.
- Report back in the length the brief asks: branch name, files changed, test and typecheck results, anything not done, and any dependency added.
