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
- Android: direct APK install, no store needed.
- iOS: TestFlight. Needs an Apple Developer account (about £79 per year). Without it, builds expire after 7 days.

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
