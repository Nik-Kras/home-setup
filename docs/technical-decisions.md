# Technical decisions

Status: proposed on 2026-11-21, to be confirmed while building.

## Devices
- Android: Samsung S25.
- iOS: a recent iPhone (16 or 17 series).
- Both need real home-screen widgets with live data.

## Stack
- **App**: one cross-platform codebase, Expo (React Native) with TypeScript.
- **Widgets**: native modules, one per platform: Android Glance / App Widget, iOS WidgetKit. A web app (PWA) was rejected because it cannot provide home-screen widgets.
- **Backend**: Supabase (Postgres, Realtime, Storage, Row Level Security). Chosen for live sync, photo storage and a simple REST API for Claude.
- **Auth**: two member accounts only. Sign-up disabled. Claude uses its own scoped API key, recorded as the actor "Claude".

## Sync and offline
- Online-first with an offline write queue. Edits made offline are stored locally and replayed when the connection returns.
- Conflict rule: last write wins per field, with the actor and timestamp kept in an activity log.
- Realtime subscription keeps open apps current; widgets read from a shared local cache that the app and a background refresh keep fresh.

## Claude access
- Claude reads and writes through the Supabase REST API (or a thin CLI) with its own key.
- Every change is logged as actor "Claude".

## Distribution
- Android: direct APK install, no store needed. Store steps, if wanted later: `docs/store-publishing.md`.
- iOS: TestFlight. Needs an Apple Developer account (about £79 per year). Without it, builds expire after 7 days.

## Over-the-air updates (EAS Update), decided 2026-11-23
- `expo-updates` with Expo's update service, project `@nikitakras/home-setup`, channel `production`. JS and asset changes reach installed apps without a store release or a new APK.
- **Runtime version: `fingerprint` policy.** The runtime is a hash of everything that affects native code (dependencies with native code, config plugins, app.json, `plugins/`). An update is only offered to a binary with the same hash, so a JS update can never land on a binary whose native code differs. `appVersion` was rejected: it relies on remembering to bump `version` after every native change, and Android is built locally with gradle while iOS is built on EAS, so a forgotten bump would ship an update that crashes and gets rolled back. The cost of `fingerprint`: any native or app.json change needs a new build before updates reach it (a mismatch fails safe: the update is just not offered). The android/ and ios/ folders are git-ignored, so the fingerprint ignores them and the local gradle build, the EAS iOS build and `eas update` compute the same hash (checked 2026-11-23: same Android hash with and without a prebuilt android/ folder). `npx expo-updates runtimeversion:resolve --platform android` prints it.
- **Channel.** EAS builds get it from `eas.json` (`build.production.channel`). The locally built APK cannot, so `app.json` `updates.requestHeaders` carries `expo-channel-name: production`; prebuild writes it into AndroidManifest.xml (`UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY`) and Expo.plist. A future preview channel needs that header changed for its build.
- **Launch.** `checkAutomatically: ON_LOAD`, `fallbackToCacheTimeout: 0`: the app opens at once from what it has (never waits offline), and expo-updates checks and downloads in the background.
- **In the app** (`src/domain/appUpdate.ts`, `src/data/appUpdates.ts`): another check each time the app returns to the foreground, at most every 15 minutes. A downloaded update shows an "Update ready · Restart" snackbar once, not while typing or on an add form or next to an Undo, and the Home account card shows "Up to date / Update ready" with the running update id. The app restarts only on a tap; otherwise the update applies at the next cold start. Off in dev builds and when `Updates.isEnabled` is false.
- **Publish** (from `app/`): `npx eas-cli@latest update --channel production --environment production --message '<msg>' --non-interactive`. `--environment` is required since SDK 55 (it loads the EAS environment variables of that name, if any). The bundle is built on this Mac, so run it from the main checkout, where `app/.env` gives it the Supabase URL and key; from a worktree without `.env` the update would run in demo mode. It ships JS and assets only; a change to native code, dependencies with native code, config plugins or app.json needs a new APK and iOS build.
- The first binaries with `expo-updates` (the next APK and the next TestFlight build) must be installed once by hand; older installs never receive updates.

## Data model (sketch)
- `members` (id, name, kind: person or ai)
- `rooms` (id, name, sort)
- `items` (id, name, status, priority, quantity, room_id, est_price, actual_price, assigned_to, bought_by, link, notes, added_at, bought_at, delivered_at, installed_at, added_by, updated_by)
- `item_photos` (item_id, path)
- `comments` (item_id, author, body, at)
- `activity` (item_id, actor, change, at)

## Privacy
- The repository is public. It must hold no addresses, names, secrets or personal documents. Keys live in environment files that are git-ignored.

## Decisions confirmed 2026-11-21
- Backend: Supabase (Postgres, Realtime, Storage, RLS). Claude gets its own scoped key, actor "Claude", no hard delete.
- iPhone distribution: TestFlight with a paid Apple Developer account.
- v1 scope: everything designed (Buy list, Tasks with shared tasks, Home, Budget, flat notes, widgets).
- Design changes adopted from the review: live add input (type, press Enter, keyboard stays open) and cleaner colour meaning (coral only for urgent; owners as initial discs; neutral room tiles; amber only for in-transit and to-confirm). Not adopted: check circle on Buy rows, removing glows.
