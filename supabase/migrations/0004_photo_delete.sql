-- Lets the two people (not Claude) remove or replace photos. Photos can already be added by any member.
create policy photos_delete on storage.objects for delete using (bucket_id = 'photos' and public.is_person());
