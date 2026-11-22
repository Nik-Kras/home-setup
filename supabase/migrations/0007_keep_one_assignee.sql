-- A task always keeps at least one person. Two phones taking each other off the same task at the same
-- time would otherwise leave it with nobody. The app sends a removal as a conditional delete and shows
-- "Could not remove ..." when the server refuses it (this raises, so the op is dropped and reported).
-- Deleting the task itself (cascade) is not affected: the task row is already gone at that point.
-- Safe to run more than once.

create or replace function public.keep_one_assignee() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.tasks where id = old.task_id)
     and not exists (select 1 from public.task_assignments where task_id = old.task_id and person <> old.person) then
    raise exception 'a task keeps at least one person' using errcode = 'P0001';
  end if;
  return old;
end $$;

drop trigger if exists assignments_keep_one on public.task_assignments;
create trigger assignments_keep_one before delete on public.task_assignments
  for each row execute function public.keep_one_assignee();
