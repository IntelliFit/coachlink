-- Close stale training sessions without pretending they were completed, and
-- let coaches save a plan revision while a student is still training.

begin;

alter table public.plan_instance_executions
  drop constraint if exists plan_instance_executions_status_check;

alter table public.plan_instance_executions
  add constraint plan_instance_executions_status_check
  check (status in ('in_progress', 'completed', 'abandoned', 'paused', 'timed_out'));

alter table public.plan_instance_executions
  add column if not exists ended_at timestamptz,
  add column if not exists close_reason text;

comment on column public.plan_instance_executions.ended_at is
  'Terminal timestamp for abandoned/timed-out executions; completed_at remains completion-only.';
comment on column public.plan_instance_executions.close_reason is
  'Why a non-completed execution closed, for example hard_timeout_5h or user_skip.';

alter table public.coach_plan_instances
  add column if not exists revision_of_instance_id uuid
    references public.coach_plan_instances(id) on delete set null,
  add column if not exists activation_after_execution_id uuid
    references public.plan_instance_executions(id) on delete set null,
  add column if not exists activation_reason text,
  add column if not exists activated_at timestamptz;

create unique index if not exists coach_plan_instances_one_pending_revision
  on public.coach_plan_instances (revision_of_instance_id)
  where status = 'scheduled' and revision_of_instance_id is not null;

comment on column public.coach_plan_instances.revision_of_instance_id is
  'Current plan whose immutable content is being revised.';
comment on column public.coach_plan_instances.activation_after_execution_id is
  'Execution that must close before this scheduled revision becomes active.';
comment on column public.coach_plan_instances.activation_reason is
  'Why activation is deferred, for example execution_in_progress.';

-- Existing sessions older than the hard limit are retained for audit but no
-- longer block coach plan updates or masquerade as active training.
update public.plan_instance_executions
set
  status = 'timed_out',
  ended_at = coalesce(ended_at, now()),
  close_reason = coalesce(close_reason, 'hard_timeout_5h'),
  updated_at = now()
where status = 'in_progress'
  and started_at <= now() - interval '5 hours';

-- The old check-then-insert start flow can leave two still-active attempts for
-- the same day. Keep the most recently touched attempt active and retain the
-- others as timed-out audit records before enforcing uniqueness.
with ranked_active_attempts as (
  select
    id,
    row_number() over (
      partition by instance_id, student_id, day_index
      order by updated_at desc nulls last, started_at desc nulls last, created_at desc, id desc
    ) as attempt_rank
  from public.plan_instance_executions
  where status = 'in_progress'
)
update public.plan_instance_executions as execution
set
  status = 'timed_out',
  ended_at = coalesce(execution.ended_at, now()),
  close_reason = coalesce(execution.close_reason, 'duplicate_concurrent_attempt'),
  updated_at = now()
from ranked_active_attempts
where execution.id = ranked_active_attempts.id
  and ranked_active_attempts.attempt_rank > 1;

-- Add the concurrency guard after closing stale rows, so old ghost sessions
-- cannot prevent the migration itself from completing.
create unique index if not exists plan_instance_executions_one_active_attempt
  on public.plan_instance_executions (instance_id, student_id, day_index)
  where status = 'in_progress';

-- Starting an execution and activating a replacement revision both lock the
-- source instance row. This closes the race where a request that loaded the
-- old plan just before activation could insert a new active execution after
-- the replacement had already gone live.
create or replace function public.create_plan_execution_atomic(
  p_instance_id uuid,
  p_student_id uuid,
  p_day_index integer,
  p_action_executions jsonb,
  p_total_sets integer
)
returns setof public.plan_instance_executions
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_status text;
begin
  select status
  into source_status
  from public.coach_plan_instances
  where id = p_instance_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PLAN_INSTANCE_NOT_FOUND';
  end if;

  if source_status not in ('active', 'paused') then
    raise exception using errcode = 'P0001', message = 'PLAN_INSTANCE_NOT_CURRENT';
  end if;

  return query
  insert into public.plan_instance_executions (
    instance_id,
    student_id,
    day_index,
    action_executions,
    total_sets,
    completed_sets,
    status
  ) values (
    p_instance_id,
    p_student_id,
    p_day_index,
    coalesce(p_action_executions, '[]'::jsonb),
    greatest(coalesce(p_total_sets, 0), 0),
    0,
    'in_progress'
  )
  on conflict (instance_id, student_id, day_index)
    where status = 'in_progress'
  do update set instance_id = excluded.instance_id
  returning public.plan_instance_executions.*;
end;
$$;

create or replace function public.activate_pending_plan_revision_atomic(
  p_source_instance_id uuid,
  p_start_execution_day integer
)
returns setof public.coach_plan_instances
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_row public.coach_plan_instances%rowtype;
  pending_row public.coach_plan_instances%rowtype;
  now_value timestamptz := now();
begin
  select *
  into source_row
  from public.coach_plan_instances
  where id = p_source_instance_id
  for update;

  if not found then
    return;
  end if;

  if exists (
    select 1
    from public.plan_instance_executions
    where instance_id = p_source_instance_id
      and status = 'in_progress'
  ) then
    return;
  end if;

  select *
  into pending_row
  from public.coach_plan_instances
  where revision_of_instance_id = p_source_instance_id
    and status = 'scheduled'
  order by updated_at desc nulls last, created_at desc nulls last, id desc
  limit 1
  for update;

  if pending_row.id is null then
    return;
  end if;

  -- A coach-facing "update" keeps the logical/current instance and all of its
  -- execution relationships. The scheduled row is only temporary content
  -- storage while an immutable execution snapshot is running.
  return query
  update public.coach_plan_instances as source
  set
    name = pending_row.name,
    description = pending_row.description,
    execution_notice = pending_row.execution_notice,
    coach_plan_template_id = pending_row.coach_plan_template_id,
    end_date = pending_row.end_date,
    tags = pending_row.tags,
    type = pending_row.type,
    suitable_for = pending_row.suitable_for,
    training_days = pending_row.training_days,
    training_days_count = pending_row.training_days_count,
    rest_days_count = pending_row.rest_days_count,
    start_date = coalesce(source_row.start_date, pending_row.start_date),
    start_execution_day = greatest(coalesce(p_start_execution_day, 1), 1),
    activation_after_execution_id = null,
    activation_reason = null,
    entitlement_consumption_policy = 'count_service',
    updated_at = now_value
  where source.id = p_source_instance_id
    and source.status in ('active', 'paused')
  returning source.*;

  update public.coach_plan_instances
  set
    status = 'archived',
    archive_reason = 'pending_update_applied',
    entitlement_consumption_policy = 'no_charge',
    entitlement_consumption_note = 'Temporary update payload applied back to the original plan instance',
    activation_after_execution_id = null,
    activation_reason = null,
    updated_at = now_value
  where id = pending_row.id;
end;
$$;

revoke all on function public.create_plan_execution_atomic(uuid, uuid, integer, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.create_plan_execution_atomic(uuid, uuid, integer, jsonb, integer)
  to service_role;

revoke all on function public.activate_pending_plan_revision_atomic(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.activate_pending_plan_revision_atomic(uuid, integer)
  to service_role;

commit;
