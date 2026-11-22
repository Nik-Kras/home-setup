# Home Setup

Shared app for two people (Android and iPhone) to track things to buy and install, move-in tasks, the home inventory and the budget, with home-screen widgets. Public repo: never commit secrets, addresses, legal names or contract details.

Read `docs/build-strategy.md` first. It defines the orchestrator workflow, who does what, the acceptance criteria and the milestones. Decisions are in `docs/product-decisions.md`, `docs/technical-decisions.md`, `docs/design-decisions.md`, and the open design items in `docs/design-review-2026-11-21.md`.

## Roles (summary)
- The main session is the **orchestrator**: plan, write briefs in `docs/tasks/`, delegate, run the emulator, merge, report.
- Heavy or native work: Codex (Sol 6.2) through the `/codex:rescue` skill.
- Standard implementation: Claude Code sub-agents with `model: opus` (Opus 5.5).
- Review of every finished task: sub-agents with `model: fable` (Fable 5.2), against the brief, the diff and the design screenshots.
- Parallel implementers use `isolation: "worktree"`. One user of the emulator at a time.

## Commands (run from `app/`)
```
npm test                     # domain, queue and diff tests (vitest)
npx tsc --noEmit             # typecheck
npx expo-doctor              # config check
npx -y tsx scripts/sync-check.mts   # live check against Supabase as the Claude account
```
Android: `JAVA_HOME=/opt/homebrew/opt/openjdk@17`, `ANDROID_HOME=/opt/homebrew/share/android-commandlinetools`, emulator AVD `MacroTrack_API_35` started with `-gpu host`. `npx expo run:android` builds a debug app; `npx expo start --port 8081` plus `adb reverse tcp:8081 tcp:8081` serves it. Release APK: `npx expo prebuild --platform android --clean && (cd android && ./gradlew assembleRelease)`; `app/plugins/with-release-signing.js` signs it with the key named in `~/.android-keys/home-setup-release.properties` (outside the repo, never committed) or the debug key if that file is missing; copy the APK to `app/build-output/home-setup.apk` (git-ignored). `e2e/run.sh` detects a release install and skips Metro. Expo docs for SDK 58 are at https://docs.expo.dev/llms.txt; check them before using Expo or React Native APIs.

## Rules
- Secrets live in `app/.env` (git-ignored). Never print or commit them. Live tests use the Claude account only.
- Follow `docs/design-decisions.md`, including colour meaning as built: coral only for urgent, mint for done and primary actions, Daryna lilac, amber only for in transit and to confirm.
- Keep changes small and tested. No features beyond the design. Run tests and typecheck before saying a task is done.
- Writes go through the offline queue (`app/src/data`). A person's edit sends only their own change (see `diff.ts`).

## Status
Updated 2026-11-22.
- Done: app shell, Buy list, Tasks (mine, other person, shared), Home, Budget, sign-in, Supabase sync with offline queue and realtime, schema migrations 0001 to 0004 applied, live sync check passing, 27 unit tests.
- Next: M1 (detail screens and add-task options), then M2 photos, M3 Android widgets, M4 hardening, M5 Android release, M6 iPhone, M7 acceptance.
- Waiting on the user: Apple Developer approval (for M6), sign-up must be switched off in Supabase Auth settings (unverified), change the Claude account password.
