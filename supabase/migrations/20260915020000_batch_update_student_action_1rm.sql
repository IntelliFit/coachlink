begin;

-- Apply all validated 1RM edits for one student in one database statement.
-- The API remains responsible for coach authorization and action eligibility;
-- this service-role-only function guarantees an atomic write and avoids one
-- HTTPS PATCH round trip per action.
create or replace function public.batch_update_student_action_reference_1rm(
  p_student_id uuid,
  p_updates jsonb
)
returns table (
  id uuid,
  reference_1rm numeric
)
language sql
security definer
set search_path = ''
as $$
  with parsed_updates as (
    select
      (item.value ->> 'id')::uuid as action_id,
      case
        when not (item.value ? 'reference_1rm')
          or jsonb_typeof(item.value -> 'reference_1rm') = 'null'
        then null::numeric
        else (item.value ->> 'reference_1rm')::numeric
      end as next_reference_1rm,
      item.ordinality
    from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb))
      with ordinality as item(value, ordinality)
  ),
  deduplicated_updates as (
    select distinct on (action_id)
      action_id,
      next_reference_1rm
    from parsed_updates
    order by action_id, ordinality desc
  )
  update public.student_actions as action
  set
    reference_1rm = updates.next_reference_1rm,
    updated_at = now()
  from deduplicated_updates as updates
  where action.id = updates.action_id
    and action.user_id = p_student_id
  returning action.id, action.reference_1rm;
$$;

revoke all on function public.batch_update_student_action_reference_1rm(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.batch_update_student_action_reference_1rm(uuid, jsonb)
  to service_role;

commit;
