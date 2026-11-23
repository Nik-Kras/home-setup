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
Android: `JAVA_HOME=/opt/homebrew/opt/openjdk@17`, `ANDROID_HOME=/opt/homebrew/share/android-commandlinetools`, emulator AVD `MacroTrack_API_35` started with `-gpu host`. `npx expo run:android` builds a debug app; `npx expo start --port 8081` plus `adb reverse tcp:8081 tcp:8081` serves it. Release APK: `npx expo prebuild --platform android --clean && (cd android && ./gradlew assembleRelease)`; `app/plugins/with-release-signing.js` signs it with the key named in `~/.android-keys/home-setup-release.properties` (outside the repo, never committed) or the debug key if that file is missing; copy the APK to `app/build-output/home-setup.apk` (git-ignored). `e2e/run.sh` detects a release install and skips Metro. Over-the-air update (JS and assets only, to installed release apps with the same native fingerprint; native or app.json changes need a new build): `npx eas-cli@latest update --channel production --environment production --message '<msg>' --non-interactive`. Run it in the main checkout: the bundle is built on this Mac and takes the Supabase settings from `app/.env` (a worktree has none and would ship demo mode); `--environment` is required since SDK 55. The first APK/TestFlight build with `expo-updates` must be installed once by hand. Details in `docs/technical-decisions.md`; store steps in `docs/store-publishing.md`. Expo docs for SDK 58 are at https://docs.expo.dev/llms.txt; check them before using Expo or React Native APIs.

## Rules
- Secrets live in `app/.env` (git-ignored). Never print or commit them. Live tests use the Claude account only.
- Follow `docs/design-decisions.md`, including colour meaning as built: coral only for urgent, mint for done and primary actions, Daryna lilac, amber only for in transit and to confirm.
- Keep changes small and tested. No features beyond the design. Run tests and typecheck before saying a task is done.
- Writes go through the offline queue (`app/src/data`). A person's edit sends only their own change (see `diff.ts`).

## Status
Updated 2026-11-23.
- App name: **Moved In** (bundle id `app.homesetup.household`, Expo slug `home-setup`, EAS project @nikitakras/home-setup). In-app title stays "Our flat".
- Built and merged: Buy list, Tasks (mine, other, shared, Done), Home, Budget (trend), item and task detail, notes, add screen with suggestions, comments, one-stage status + status sheet, undo bar, price + who paid, task edit, claim, sync pill, sign-out, Android widgets, iOS widgets (expo-widgets), photos, over-the-air updates (EAS Update, channel `production`, runtime `fingerprint`). Migrations 0001 to 0009 applied. 369 unit tests, Maestro e2e flows 01 to 13 (run `app/e2e/run.sh`), all green on the signed release APK.
- Data: the move-in checklist (40 tasks, 14 items) was loaded privately with `design-ref/seed-flat.mts` (git-ignored). Never commit it.
- Android: signed release APK (release key outside the repo), private release repo Nik-Kras/home-setup-releases. Needs a new APK only for native changes; JS changes ship with `eas update` (see docs/store-publishing.md).
- iPhone: EAS build 7 uploaded to App Store Connect (app record "Moved In"), App Group group.app.homesetup.household registered. Testers are added by the owner in TestFlight.
- Open: app icon is still the Expo placeholder (needs design + native rebuild); Play Store account and listing (owner, see docs/store-publishing.md); change the two weak account passwords; decide whether the in-app title should read "Moved In".
