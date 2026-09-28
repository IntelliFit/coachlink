begin;

alter table public.plan_instance_executions
  add column if not exists performed_on date,
  add column if not exists completion_recorded_at timestamptz;

-- Do not fabricate dates or submission times for legacy rows.
create table public.plan_execution_date_confirmations (
  request_id uuid primary key,
  execution_id uuid not null references public.plan_instance_executions(id) on delete cascade,
  student_id uuid not null,
  previous_completed_at timestamptz,
  previous_performed_on date,
  performed_on date not null,
  recorded_at timestamptz not null default clock_timestamp()
);
alter table public.plan_execution_date_confirmations enable row level security;
revoke all on public.plan_execution_date_confirmations from public, anon, authenticated;
grant select, insert on public.plan_execution_date_confirmations to service_role;

create or replace function public.capture_execution_completion_recorded_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'completed' then new.completion_recorded_at := clock_timestamp(); end if;
  elsif old.status <> 'completed' and new.status = 'completed' then
    new.completion_recorded_at := coalesce(old.completion_recorded_at, clock_timestamp());
  else
    new.completion_recorded_at := old.completion_recorded_at;
  end if;
  return new;
end;
$$;
create trigger capture_execution_completion_recorded_at
before insert or update on public.plan_instance_executions
for each row execute function public.capture_execution_completion_recorded_at();

-- Explicit student confirmation. Normal saves must not call this command.
-- The plan lock also serializes against create_plan_execution_atomic.
create or replace function public.record_plan_completion_date(
  p_instance_id uuid, p_student_id uuid, p_day_index integer,
  p_performed_on date, p_execution_id uuid, p_expected_updated_at timestamptz,
  p_request_id uuid, p_start_execution_day integer
)
returns setof public.plan_instance_executions
language plpgsql security invoker set search_path = '' as $$
declare
  plan_row public.coach_plan_instances%rowtype;
  target_row public.plan_instance_executions%rowtype;
  prior_request public.plan_execution_date_confirmations%rowtype;
  prior_completed_at timestamptz;
  prior_performed_on date;
  confirmed_at timestamptz;
begin
  select * into plan_row from public.coach_plan_instances
    where id = p_instance_id and student_id = p_student_id for update;
  if not found then raise exception 'PLAN_FORBIDDEN' using errcode = '42501'; end if;
  if p_request_id is null or p_performed_on is null or p_day_index < 1 then
    raise exception 'INVALID_COMPLETION_INPUT';
  end if;
  if p_performed_on > (now() at time zone 'Asia/Shanghai')::date
    or p_performed_on < coalesce(plan_row.start_date::date, (plan_row.created_at at time zone 'Asia/Shanghai')::date) then
    raise exception 'INVALID_TRAINING_DATE';
  end if;
  if not exists (select 1 from jsonb_array_elements(plan_row.training_days::jsonb) d
    where coalesce(d->>'dayIndex', d->>'day_index')::int = p_day_index
      and coalesce(d->>'type', 'training') = 'training') then
    raise exception 'TRAINING_DAY_NOT_FOUND';
  end if;
  select * into prior_request from public.plan_execution_date_confirmations where request_id = p_request_id;
  if found then
    if prior_request.student_id <> p_student_id or prior_request.performed_on <> p_performed_on
      or not exists (select 1 from public.plan_instance_executions e where e.id = prior_request.execution_id
        and e.instance_id = p_instance_id and e.day_index = p_day_index) then
      raise exception 'REQUEST_ID_CONFLICT';
    end if;
    return query select * from public.plan_instance_executions where id = prior_request.execution_id;
    return;
  end if;
  perform 1 from public.plan_instance_executions
    where instance_id = p_instance_id and student_id = p_student_id and day_index = p_day_index
    order by id for update;
  if p_execution_id is not null then
    select * into target_row from public.plan_instance_executions
      where id = p_execution_id and instance_id = p_instance_id
        and student_id = p_student_id and day_index = p_day_index;
    if not found then raise exception 'EXECUTION_NOT_FOUND'; end if;
    if p_expected_updated_at is null or target_row.updated_at <> p_expected_updated_at then
      raise exception 'EXECUTION_WRITE_CONFLICT';
    end if;
    if target_row.status not in ('in_progress', 'timed_out', 'completed') then
      raise exception 'EXECUTION_NOT_FINISHABLE';
    end if;
  elsif exists (select 1 from public.plan_instance_executions
    where instance_id = p_instance_id and student_id = p_student_id and day_index = p_day_index) then
    raise exception 'EXECUTION_WRITE_CONFLICT';
  end if;
  if exists (select 1 from public.plan_instance_executions
    where instance_id = p_instance_id and student_id = p_student_id and day_index = p_day_index
      and id is distinct from target_row.id and status in ('in_progress', 'completed')) then
    raise exception 'OTHER_ATTEMPT_EXISTS';
  end if;
  if target_row.status is distinct from 'completed' then
    if plan_row.status not in ('active', 'paused') then raise exception 'PLAN_NOT_CURRENT'; end if;
    if exists (select 1 from jsonb_array_elements(plan_row.training_days::jsonb) d
      where coalesce(d->>'dayIndex',d->>'day_index')::int >= greatest(1,p_start_execution_day)
        and coalesce(d->>'dayIndex',d->>'day_index')::int < p_day_index
        and (coalesce(d->>'type','training') = 'training'
          or jsonb_array_length(coalesce(d->'actionSets','[]'::jsonb)) > 0)
        and not exists (select 1 from public.plan_instance_executions e
          where e.instance_id = p_instance_id and e.student_id = p_student_id
            and e.day_index = coalesce(d->>'dayIndex',d->>'day_index')::int
            and e.status in ('completed','abandoned')
            and coalesce(e.close_reason,'') <> 'superseded_by_late_completion')) then
      raise exception 'PREVIOUS_TRAINING_UNRESOLVED';
    end if;
  end if;
  prior_completed_at := target_row.completed_at;
  prior_performed_on := target_row.performed_on;
  -- Existing readers continue to use completed_at. Keep its known time if the
  -- date agrees; otherwise use day precision, explicitly recorded in performed_on.
  confirmed_at := case when (target_row.completed_at at time zone 'Asia/Shanghai')::date = p_performed_on
    then target_row.completed_at else p_performed_on::timestamp at time zone 'Asia/Shanghai' end;
  if target_row.id is null then
    insert into public.plan_instance_executions(instance_id,student_id,day_index,status,
      started_at,completed_at,performed_on,action_executions,total_sets,completed_sets,close_reason)
    values (p_instance_id,p_student_id,p_day_index,'completed',clock_timestamp(),confirmed_at,
      p_performed_on,'[]'::jsonb,0,0,'student_confirmed_backfill') returning * into target_row;
  else
    update public.plan_instance_executions set status = 'completed', completed_at = confirmed_at,
      performed_on = p_performed_on, ended_at = null,
      close_reason = case when target_row.status <> 'completed' then 'student_confirmed_backfill' else close_reason end
      where id = target_row.id returning * into target_row;
  end if;
  insert into public.plan_execution_date_confirmations(request_id,execution_id,student_id,
    previous_completed_at,previous_performed_on,performed_on)
  values(p_request_id,target_row.id,p_student_id,prior_completed_at,prior_performed_on,p_performed_on);
  if prior_completed_at is null then
    update public.coach_plan_instances
      set start_date = coalesce(start_date, p_performed_on - (p_day_index - 1))
      where id = p_instance_id;
    if plan_row.coach_subscription_id is not null then
      update public.coach_subscriptions
        set start_date = coalesce(start_date, p_performed_on::timestamp at time zone 'Asia/Shanghai')
        where id = plan_row.coach_subscription_id and student_id = p_student_id;
    end if;
  end if;
  return next target_row;
end;
$$;
revoke all on function public.record_plan_completion_date(uuid,uuid,integer,date,uuid,timestamptz,uuid,integer)
  from public, anon, authenticated;
grant execute on function public.record_plan_completion_date(uuid,uuid,integer,date,uuid,timestamptz,uuid,integer)
  to service_role;
commit;
