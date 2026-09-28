-- Only for the disposable PostgreSQL database created by the companion runner.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
create table public.coach_subscriptions(id uuid primary key, student_id uuid, start_date timestamptz);
create table public.coach_plan_instances(id uuid primary key, student_id uuid, status text,
  start_date date, created_at timestamptz default now(), training_days jsonb, coach_subscription_id uuid);
create table public.plan_instance_executions(id uuid primary key default gen_random_uuid(), instance_id uuid,
  student_id uuid, day_index integer, status text, started_at timestamptz default now(), completed_at timestamptz,
  ended_at timestamptz, updated_at timestamptz default clock_timestamp(), close_reason text,
  action_executions jsonb default '[]', total_sets integer default 0, completed_sets integer default 0);
create function public.touch_execution() returns trigger language plpgsql as $$ begin new.updated_at=clock_timestamp(); return new; end $$;
create trigger touch_execution before update on public.plan_instance_executions for each row execute function public.touch_execution();
grant usage on schema public to service_role;
grant all on public.coach_subscriptions, public.coach_plan_instances, public.plan_instance_executions to service_role;
insert into public.coach_plan_instances(id,student_id,status,start_date,training_days) values
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','active','2026-09-01',
 '[{"dayIndex":1,"type":"training"},{"dayIndex":2,"type":"rest"},{"dayIndex":3,"type":"training"},{"dayIndex":4,"type":"rest"},{"dayIndex":5,"type":"training"}]'),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','active','2026-09-01','[{"dayIndex":1,"type":"training"}]');
