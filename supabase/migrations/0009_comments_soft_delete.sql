-- Comments can be deleted by their author with Undo, as a soft delete (deleted_at), like items, tasks
-- and flat notes. Hard delete stays people-only (comments_delete policy from 0001).
-- Safe to run more than once.

alter table public.comments add column if not exists deleted_at timestamptz;

-- Same access as the other tables (0002 granted it to every table; repeated here for clarity).
grant select, insert, update, delete on public.comments to authenticated;

-- Only the author may change a comment (soft delete or undo of it); any member still reads them all.
drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments for update
  using (public.is_member() and author = public.actor_key())
  with check (public.is_member() and author = public.actor_key());

create index if not exists comments_target_idx on public.comments (target_type, target_id, created_at desc);
