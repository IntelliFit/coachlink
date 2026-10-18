-- 2026-10-18: the anon key was inlined into public JavaScript by builds up to
-- 2026-10-14, and most public tables had no RLS, so anyone holding the key could
-- read (and likely write) users, profiles, subscriptions, plans, executions and chat.
--
-- Every legitimate access goes through Next.js server routes, which authenticate
-- the caller themselves and, from release 4cd3c227 on, use the service role for
-- every table. Client roles therefore get no direct table access at all.
--
-- APPLY ONLY AFTER the release containing 4cd3c227 is live on main and dev;
-- older pods still query with the anon key and would start failing.
--
-- Rollback: see the block at the end of this file.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Remember the previous RLS state for rollback.
create table if not exists public._client_role_lockdown_20261018 as
select c.relname, c.relkind::text as relkind, c.relrowsecurity as rls_was_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f');

do $$
declare r record;
begin
  for r in
    select c.relname, c.relkind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
  loop
    if r.relkind in ('r', 'p') then
      execute format('alter table public.%I enable row level security', r.relname);
    end if;
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', r.relname);
  end loop;
end $$;

revoke all privileges on all sequences in schema public from public, anon, authenticated;

-- The server keeps full access (service_role bypasses RLS).
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Tables created later must not silently reopen client access.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;

commit;

-- Verification (expect 0 rows):
-- select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relkind in ('r','p','v','m','f')
--   and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select'));

-- Rollback (restores the pre-2026-10-18 client access):
-- begin;
-- grant all privileges on all tables in schema public to anon, authenticated;
-- grant usage, select on all sequences in schema public to anon, authenticated;
-- do $$ declare r record; begin
--   for r in select relname from public._client_role_lockdown_20261018 where relkind in ('r','p') and not rls_was_enabled loop
--     execute format('alter table public.%I disable row level security', r.relname);
--   end loop; end $$;
-- alter default privileges in schema public grant all on tables to anon, authenticated;
-- alter default privileges in schema public grant all on sequences to anon, authenticated;
-- commit;
