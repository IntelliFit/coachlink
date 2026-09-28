-- Let a student explicitly confirm a timed-out workout as completed without
-- reviving the session. Any untouched replacement attempt for the same plan
-- day is closed in the same transaction so it cannot hide the real workout.

begin;

create or replace function public.complete_plan_execution_atomic(
  p_execution_id uuid,
  p_student_id uuid,
  p_completed_at timestamptz,
  p_session_notes text,
  p_action_executions jsonb,
  p_completed_sets integer,
  p_total_sets integer,
  p_last_saved_at timestamptz
)
returns setof public.plan_instance_executions
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_row public.plan_instance_executions%rowtype;
begin
  select *
  into target_row
  from public.plan_instance_executions
  where id = p_execution_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'EXECUTION_NOT_FOUND';
  end if;

  if target_row.student_id <> p_student_id then
    raise exception using errcode = '42501', message = 'EXECUTION_FORBIDDEN';
  end if;

  -- Duplicate finish requests are idempotent and must not rewrite timestamps.
  if target_row.status = 'completed' then
    return next target_row;
    return;
  end if;

  if target_row.status not in ('in_progress', 'timed_out') then
    raise exception using errcode = 'P0001', message = 'EXECUTION_NOT_FINISHABLE';
  end if;

  if target_row.status = 'timed_out' then
    -- Lock all active replacements before deciding whether they are safe to
    -- close. A replacement with recorded work belongs to a different attempt
    -- and must never be discarded implicitly.
    perform 1
    from public.plan_instance_executions
    where instance_id = target_row.instance_id
      and student_id = target_row.student_id
      and day_index = target_row.day_index
      and id <> target_row.id
      and status = 'in_progress'
    for update;

    if exists (
      select 1
      from public.plan_instance_executions as sibling
      where sibling.instance_id = target_row.instance_id
        and sibling.student_id = target_row.student_id
        and sibling.day_index = target_row.day_index
        and sibling.id <> target_row.id
        and sibling.status = 'in_progress'
        and (
          coalesce(sibling.completed_sets, 0) > 0
          or nullif(btrim(coalesce(sibling.session_notes, '')), '') is not null
          or exists (
            select 1
            from public.execution_set_videos as video
            where video.execution_id = sibling.id
          )
          or exists (
            select 1
            from public.execution_feedbacks as feedback
            where feedback.execution_id = sibling.id
          )
          or exists (
            select 1
            from public.personal_records_history as record
            where record.execution_id = sibling.id
          )
          or exists (
            select 1
            from public.growth_share_links as share_link
            where share_link.execution_id = sibling.id
          )
        )
    ) then
      raise exception using errcode = 'P0001', message = 'ACTIVE_ATTEMPT_HAS_PROGRESS';
    end if;

    update public.plan_instance_executions
    set
      status = 'abandoned',
      ended_at = coalesce(ended_at, now()),
      close_reason = 'superseded_by_late_completion',
      updated_at = now()
    where instance_id = target_row.instance_id
      and student_id = target_row.student_id
      and day_index = target_row.day_index
      and id <> target_row.id
      and status = 'in_progress';
  end if;

  return query
  update public.plan_instance_executions as execution
  set
    status = 'completed',
    completed_at = p_completed_at,
    ended_at = null,
    close_reason = case
      when target_row.status = 'timed_out' then 'late_completion_confirmed_after_timeout'
      else execution.close_reason
    end,
    session_notes = coalesce(p_session_notes, execution.session_notes),
    action_executions = coalesce(p_action_executions, execution.action_executions),
    completed_sets = greatest(coalesce(p_completed_sets, execution.completed_sets, 0), 0),
    total_sets = greatest(coalesce(p_total_sets, execution.total_sets, 0), 0),
    last_saved_at = coalesce(p_last_saved_at, execution.last_saved_at),
    updated_at = now()
  where execution.id = target_row.id
  returning execution.*;
end;
$$;

revoke all on function public.complete_plan_execution_atomic(
  uuid, uuid, timestamptz, text, jsonb, integer, integer, timestamptz
) from public, anon, authenticated;
grant execute on function public.complete_plan_execution_atomic(
  uuid, uuid, timestamptz, text, jsonb, integer, integer, timestamptz
) to service_role;

commit;
