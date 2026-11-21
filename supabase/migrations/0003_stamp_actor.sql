-- The actor on a row is set by the database from the signed-in account, never by the client,
-- so nobody (including Claude) can write a change as someone else.

create function public.stamp_actor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_by := coalesce(public.actor_key(), 'system');
  return new;
end $$;

create function public.stamp_creator() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_by := coalesce(public.actor_key(), 'system');
  return new;
end $$;

create function public.stamp_author() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.author := coalesce(public.actor_key(), 'system');
  return new;
end $$;

create trigger items_stamp before insert or update on public.items for each row execute function public.stamp_actor();
create trigger tasks_stamp before insert or update on public.tasks for each row execute function public.stamp_actor();
create trigger assignments_stamp before insert or update on public.task_assignments for each row execute function public.stamp_actor();
create trigger photos_stamp before insert on public.item_photos for each row execute function public.stamp_creator();
create trigger comments_stamp before insert on public.comments for each row execute function public.stamp_author();
