-- Photo paths. Safe to run more than once.
-- 1. Uploads to the photos bucket must go under items/ (the app writes items/<itemId>/<uuid>.jpg).
-- 2. The path of an existing item_photos row never changes, so a member cannot point a photo row
--    at another file.

drop policy if exists photos_write on storage.objects;
create policy photos_write on storage.objects for insert
  with check (bucket_id = 'photos' and starts_with(name, 'items/') and public.is_member());

create or replace function public.keep_photo_path() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.path is distinct from old.path then
    raise exception 'The path of a photo cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists photos_keep_path on public.item_photos;
create trigger photos_keep_path before update on public.item_photos
  for each row execute function public.keep_photo_path();
