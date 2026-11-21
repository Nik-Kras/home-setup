# Build strategy

The goal: an app the two of us can install and use, on a Samsung phone (Android) and an iPhone, with the shared list, tasks, inventory, budget and home-screen widgets, kept in sync through Supabase.

## Roles
Claude (the main session) is the **orchestrator**. It plans, writes the task briefs, delegates, runs the shared emulator, merges, and decides. It does not do large implementation work itself, so its context stays small.

| Role | Who | Used for |
|---|---|---|
| Orchestrator | Claude Code main session | Plan, briefs, delegation, merging, emulator runs, decisions, reports to the user |
| Implementer (heavy) | Codex, "Sol 6.2", via the `/codex:rescue` skill | Larger or native tasks: widgets, photos, config plugins, hard debugging, build problems |
| Implementer (standard) | Claude Code sub-agents on **Opus 5.5** (`model: opus`) | Screens, components, tests, refactors, docs |
| Reviewer | Claude Code sub-agents on **Fable 5.2** (`model: fable`) | Independent review of every finished task against its acceptance criteria and the design |

Rules for the roles:
- The reviewer is never the same model run that implemented the task, and gets the brief, the diff and the screenshots, not the implementer's opinion of its own work.
- Parallel implementers work in separate git worktrees (`isolation: "worktree"`) and touch different files. Only one thing uses the Android emulator at a time.
- Implementers get a brief file (`docs/tasks/Tnn-*.md`), not a long prompt. The brief holds the goal, the files to touch, the design references and the acceptance criteria.
- Reports back are short: what changed, how it was verified, what is left.

## The loop for every task
1. **Brief.** Orchestrator writes `docs/tasks/Tnn-name.md` with acceptance criteria.
2. **Implement.** One implementer (Codex or an Opus agent) builds it on a branch or worktree. It must run `npm test` and `npx tsc --noEmit` and leave both green.
3. **Verify.** The orchestrator merges and runs the app on the Android emulator, driving it with `adb` and taking screenshots (`scripts` and the private `design-ref/` folder hold the references). Layout is also checked with the overflow/overlap script.
4. **Review.** A Fable 5.2 reviewer compares the screenshots with `design-ref/screens/`, checks the acceptance criteria and the code, and lists defects ranked by severity. It reads the skill files it is told to use (impeccable for visual review) and says which it opened.
5. **Fix.** Defects go back to an implementer. Repeat steps 3 to 5 until the reviewer reports no high or medium defects.
6. **Ship the slice.** Commit with a clear message, push, update the status section in `CLAUDE.md`.

## Acceptance criteria that apply to every task
- Tests pass (`npm test`), typecheck passes (`npx tsc --noEmit`), `npx expo-doctor` has no new failures.
- Matches the design image for that screen: structure, spacing, type, colours (see `docs/design-decisions.md`, including the "colour meaning as built" section). No clipped text, no overlap, nothing under the tab bar.
- Touch targets 44dp or more, text 13px or more (monogram letters excepted), contrast at least 4.5:1 for text, accessibility labels and roles on controls, no button nested inside a link.
- Adding an item or task and changing a status stay within 5 seconds and one or two taps.
- Offline: every edit works without network and syncs later through the queue; a person's edit never overwrites the other person's part of a shared task.
- No secrets, personal addresses, legal names or contract details in the repo. The repo is public.
- Claude's own changes are attributed to Claude by the database; Claude never hard-deletes.

## Milestones
| # | Milestone | Done when |
|---|---|---|
| M1 | Navigation and detail screens: item, task, shared task, flat notes, add-task options | Screens match design on the emulator; reviewer clean |
| M2 | Photos: capture or pick, upload to the `photos` bucket, shown on Home and in details | A photo taken in the app appears on the other device after sync; reviewer clean |
| M3 | Android widgets: small, medium, large; tap to mark got, tap to add; refresh on change | Widgets added on the emulator home screen show live data and respond to taps |
| M4 | Hardening: empty and error states, sync status indicator, sign-out, `me` from the account, performance | Reviewer clean; no crash in a 15-minute scripted session |
| M5 | Android release: signed APK, QR install | APK installs on a device and signs in |
| M6 | iPhone: EAS build, TestFlight, iOS widgets | Build succeeds; needs the user's Apple login once |
| M7 | Final acceptance | All checklists above pass; user installs on both phones |

## Limits (be honest in reports)
- iOS layout and widgets cannot be seen on this Mac (no Xcode). For iOS the orchestrator can confirm the cloud build and tests only; the user or Daryna confirms the look.
- Real person accounts are not available to Claude; live tests use the Claude account and demo data.
- Things that need the user: Apple ID login and 2FA, TestFlight tester invites, installing on phones, anything paid, changes to Supabase dashboard settings.

## Where things live
- Product, technical, design decisions and the design review: `docs/`.
- Task briefs: `docs/tasks/`.
- App code: `app/`; domain rules and tests in `app/src/domain`; data layer in `app/src/data`.
- Database: `supabase/migrations/`.
- Private design references (git-ignored): `design-ref/screens` (images), `design-ref/source` (HTML), `design-ref/shoot.sh`, `design-ref/check.py`.
- Secrets: `app/.env` (git-ignored).
