-- Newer Supabase projects do not grant table access to API roles automatically.
-- Row level security (0001) still decides which rows each account can see or change.

grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- members is managed from the dashboard only; the activity log is written by trigger only.
revoke insert, update, delete on public.members from authenticated;
revoke insert, update, delete on public.activity from authenticated;

grant execute on function public.is_member(), public.is_person(), public.actor_key() to authenticated;

-- Anonymous (signed-out) callers get nothing.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Tables added later get the same access.
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
