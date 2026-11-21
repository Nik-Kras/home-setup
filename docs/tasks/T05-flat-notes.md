# T05: Flat notes (needs a database table)

Implementer: Opus 5.5 sub-agent in its own git worktree. Reviewer: Fable 5.2. Depends on T01.

## Goal
A "Flat notes" screen of facts about the home and tenancy (rules, who pays for what, things still to confirm), stored in Supabase so it stays private and is shared between the two people. Design: `design-ref/screens/FlatNotes.png` (private local image; source in `design-ref/source/`). The repo is public: ship NO real note content in code, seeds or tests, only generic examples marked as demo.

## Do
1. Migration `supabase/migrations/0005_flat_notes.sql`: table `public.flat_notes` (id uuid pk default gen_random_uuid(), title text not null, body text, reference text, kind text not null default 'info' check in ('info','to_confirm','check'), sort int default 0, created_at, updated_at, updated_by text default public.actor_key(), deleted_at), RLS enabled with the same four policies as other tables (members read/insert/update, only people delete), triggers `touch` and `stamp_actor` and `log_activity` like `items`, added to the realtime publication. Grants are covered by earlier default privileges, but add explicit `grant select, insert, update, delete on public.flat_notes to authenticated;` for safety. Do not run it; the user runs it in the Supabase SQL editor.
2. Domain type `FlatNote`, mappers, `loadAll` extended, store actions `addNote`, `updateNote`, with diff and queue ops (idempotent upserts), tests.
3. Screen `src/app/notes.tsx`: serif title, count of "to confirm" notes, cards with icon tile (neutral), title, body, reference line (13px), a kind pill (To confirm amber, Check coral only if urgent meaning, otherwise neutral), "Make it a task" button on `to_confirm` notes that opens the add-task modal prefilled (if T04's route is not merged yet, call `addTask` directly with the note title), add and edit via a sheet (`Modal`). Reachable from a chip on the Tasks screen.
4. Demo mode (no Supabase) shows two generic demo notes.

## Acceptance criteria
- Matches the design image's structure and look.
- Accessibility rules from `docs/build-strategy.md`.
- `npm test`, `npx tsc --noEmit`, `npx expo export --platform android` pass.
- The migration is idempotent in spirit (create table if not exists; policies created once) and is documented at its top.

## Report back (max 150 words)
Files changed, results, and the exact SQL file for the user to run.
