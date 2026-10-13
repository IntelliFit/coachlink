begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

-- All legitimate payment access goes through authenticated/verified server
-- routes. Custom app JWTs are not Supabase Auth JWTs, so public client roles
-- must not write financial status or create/delete payment rows directly.
alter table public.alipay_orders enable row level security;
alter table public.student_membership_orders enable row level security;
revoke all privileges on table public.alipay_orders,public.student_membership_orders
  from public,anon,authenticated;
grant select,insert,update,delete on table public.alipay_orders,public.student_membership_orders
  to service_role;

-- Legacy policies must not become a future client-side write path if a grant
-- is accidentally restored. This applies only to the two payment tables.
do $$
declare p record;
begin
  for p in select tablename,policyname from pg_policies
    where schemaname='public' and tablename in ('alipay_orders','student_membership_orders')
  loop execute format('drop policy %I on public.%I',p.policyname,p.tablename); end loop;
end $$;
commit;
