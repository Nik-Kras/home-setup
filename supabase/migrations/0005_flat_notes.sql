-- Flat notes: facts about the home and the tenancy (rules, who pays for what, things still to confirm),
-- shared by the household. Same access rules as items and tasks: every member can read, add and edit,
-- only the two people can hard-delete, Claude soft-deletes (sets deleted_at). Note content lives only in
-- the database, never in the repo.
--
-- Run once in the Supabase SQL editor. Safe to run again: the table, policies, triggers and the
-- realtime entry are each created only if missing.

create table if not exists public.flat_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  body text,
  reference text,
  kind text not null default 'info' check (kind in ('info', 'to_confirm', 'check')),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null default public.actor_key(),
  deleted_at timestamptz
);

alter table public.flat_notes enable row level security;

-- Default privileges from 0002 already cover new tables; stated again for safety.
grant select, insert, update, delete on public.flat_notes to authenticated;
revoke all on public.flat_notes from anon;

-- Row level security, as in 0001.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'flat_notes' and policyname = 'flat_notes_read') then
    create policy flat_notes_read on public.flat_notes for select using (public.is_member());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'flat_notes' and policyname = 'flat_notes_insert') then
    create policy flat_notes_insert on public.flat_notes for insert with check (public.is_member());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'flat_notes' and policyname = 'flat_notes_update') then
    create policy flat_notes_update on public.flat_notes for update using (public.is_member()) with check (public.is_member());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'flat_notes' and policyname = 'flat_notes_delete') then
    create policy flat_notes_delete on public.flat_notes for delete using (public.is_person());
  end if;
end $$;

-- Triggers, as for items: updated_at (0001), actor stamped by the database (0003), activity log (0001).
drop trigger if exists flat_notes_touch on public.flat_notes;
create trigger flat_notes_touch before update on public.flat_notes for each row execute function public.touch();

drop trigger if exists flat_notes_stamp on public.flat_notes;
create trigger flat_notes_stamp before insert or update on public.flat_notes for each row execute function public.stamp_actor();

drop trigger if exists flat_notes_log on public.flat_notes;
create trigger flat_notes_log after insert or update or delete on public.flat_notes for each row execute function public.log_activity();

-- Realtime, so a note added on one phone shows on the other.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'flat_notes') then
    alter publication supabase_realtime add table public.flat_notes;
  end if;
end $$;
