-- Home Setup: initial schema.
-- Three accounts exist: two people and Claude (an automation account). Sign-up is disabled in the
-- Supabase dashboard; accounts are created by hand. Everything is shared by the household.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Members: maps an auth user to a role in the household.
-- ---------------------------------------------------------------------------
create table public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  key text not null unique check (key in ('nikita', 'daryna', 'claude')),
  display_name text not null,
  is_person boolean generated always as (key in ('nikita', 'daryna')) stored
);

create function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid());
$$;

create function public.is_person() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and is_person);
$$;

create function public.actor_key() returns text
language sql stable security definer set search_path = public as $$
  select key from public.members where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Items (things to buy or install)
-- ---------------------------------------------------------------------------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort int not null default 0
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  status text not null default 'needed'
    check (status in ('needed', 'looking', 'ordered', 'delivered', 'installed')),
  quantity int not null default 1 check (quantity > 0),
  urgent boolean not null default false,
  needs_install boolean not null default false,
  room_id uuid references public.rooms (id) on delete set null,
  est_price numeric(10, 2) check (est_price >= 0),
  actual_price numeric(10, 2) check (actual_price >= 0),
  assigned_to text check (assigned_to in ('nikita', 'daryna')),
  bought_by text check (bought_by in ('nikita', 'daryna')),
  link text,
  notes text,
  added_at timestamptz not null default now(),
  delivered_at timestamptz,
  installed_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by text not null default public.actor_key(),
  deleted_at timestamptz
);

create table public.item_photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now(),
  created_by text not null default public.actor_key()
);

-- ---------------------------------------------------------------------------
-- Tasks. One task, one assignment row per person. A task is finished only when every
-- assignment is done (computed in the app; see domain/tasks.ts).
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  grp text,
  due date,
  urgent boolean not null default false,
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null default public.actor_key(),
  deleted_at timestamptz
);

create table public.task_assignments (
  task_id uuid not null references public.tasks (id) on delete cascade,
  person text not null check (person in ('nikita', 'daryna')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'waiting', 'done')),
  updated_at timestamptz not null default now(),
  updated_by text not null default public.actor_key(),
  primary key (task_id, person)
);

create table public.task_steps (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  person text not null,
  title text not null,
  done boolean not null default false,
  sort int not null default 0,
  foreign key (task_id, person) references public.task_assignments (task_id, person) on delete cascade
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('item', 'task')),
  target_id uuid not null,
  author text not null default public.actor_key(),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

-- Who changed what. Written by trigger so no client can skip it.
create table public.activity (
  id bigint generated always as identity primary key,
  actor text not null,
  target_table text not null,
  target_id text not null,
  op text not null,
  change jsonb,
  at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Triggers: updated_at and activity log
-- ---------------------------------------------------------------------------
create function public.touch() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger items_touch before update on public.items for each row execute function public.touch();
create trigger tasks_touch before update on public.tasks for each row execute function public.touch();
create trigger assignments_touch before update on public.task_assignments for each row execute function public.touch();

create function public.log_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  target text;
begin
  target := coalesce(rec ->> 'id', (rec ->> 'task_id') || ':' || (rec ->> 'person'));
  insert into public.activity (actor, target_table, target_id, op, change)
  values (
    coalesce(public.actor_key(), 'system'),
    tg_table_name,
    target,
    tg_op,
    case when tg_op = 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
         else rec end
  );
  return coalesce(new, old);
end $$;

create trigger items_log after insert or update or delete on public.items for each row execute function public.log_activity();
create trigger tasks_log after insert or update or delete on public.tasks for each row execute function public.log_activity();
create trigger assignments_log after insert or update or delete on public.task_assignments for each row execute function public.log_activity();

-- ---------------------------------------------------------------------------
-- Row level security. Household of three accounts: members can read and write everything,
-- but only the two people can hard-delete. Claude can soft-delete (set deleted_at) only.
-- ---------------------------------------------------------------------------
alter table public.members enable row level security;
alter table public.rooms enable row level security;
alter table public.items enable row level security;
alter table public.item_photos enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignments enable row level security;
alter table public.task_steps enable row level security;
alter table public.comments enable row level security;
alter table public.activity enable row level security;

create policy members_read on public.members for select using (public.is_member());

do $$
declare t text;
begin
  foreach t in array array['rooms', 'items', 'item_photos', 'tasks', 'task_assignments', 'task_steps', 'comments']
  loop
    execute format('create policy %I_read on public.%I for select using (public.is_member())', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (public.is_member())', t, t);
    execute format('create policy %I_update on public.%I for update using (public.is_member()) with check (public.is_member())', t, t);
    execute format('create policy %I_delete on public.%I for delete using (public.is_person())', t, t);
  end loop;
end $$;

create policy activity_read on public.activity for select using (public.is_member());
-- activity has no insert/update/delete policy: only the trigger (security definer) writes it.

-- ---------------------------------------------------------------------------
-- Realtime and storage
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.items, public.tasks, public.task_assignments, public.task_steps, public.comments;

insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict do nothing;
create policy photos_read on storage.objects for select using (bucket_id = 'photos' and public.is_member());
create policy photos_write on storage.objects for insert with check (bucket_id = 'photos' and public.is_member());

-- Starter rooms
insert into public.rooms (name, sort) values
  ('Kitchen', 1), ('Living room', 2), ('Bedroom', 3), ('Bathroom', 4), ('Hallway', 5)
on conflict do nothing;
