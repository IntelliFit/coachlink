-- One coach subscription may have exactly one current plan instance.
-- Application reconciliation is a compatibility layer; this trigger and
-- partial unique index are the final concurrency guarantee.

alter table public.coach_plan_instances
  add column if not exists archive_reason text,
  add column if not exists entitlement_consumption_policy text default 'count_service',
  add column if not exists entitlement_consumption_note text;

update public.coach_plan_instances
set entitlement_consumption_policy = 'count_service'
where entitlement_consumption_policy is null
   or entitlement_consumption_policy = '';

with ranked_current as (
  select
    id,
    row_number() over (
      partition by coach_subscription_id
      order by created_at desc nulls last, id desc
    ) as current_rank
  from public.coach_plan_instances
  where coach_subscription_id is not null
    and status in ('active', 'paused')
), duplicate_current as (
  select id
  from ranked_current
  where current_rank > 1
)
update public.coach_plan_instances as instance
set
  status = 'archived',
  archive_reason = case
    when exists (
      select 1
      from public.plan_instance_executions execution
      where execution.instance_id = instance.id
        and execution.status = 'completed'
    ) then 'replaced_counted'
    else 'discarded_no_charge'
  end,
  entitlement_consumption_policy = case
    when exists (
      select 1
      from public.plan_instance_executions execution
      where execution.instance_id = instance.id
        and execution.status = 'completed'
    ) then 'count_service'
    else 'no_charge'
  end,
  updated_at = now()
where instance.id in (select id from duplicate_current);

create unique index if not exists coach_plan_instances_one_current_per_subscription
  on public.coach_plan_instances (coach_subscription_id)
  where coach_subscription_id is not null
    and status in ('active', 'paused');

create or replace function public.enforce_single_current_coach_plan_instance()
returns trigger
language plpgsql
as $$
begin
  if new.coach_subscription_id is not null
     and new.status in ('active', 'paused') then
    update public.coach_plan_instances as existing
    set
      status = 'archived',
      archive_reason = case
        when exists (
          select 1
          from public.plan_instance_executions execution
          where execution.instance_id = existing.id
            and execution.status = 'completed'
        ) then 'replaced_counted'
        else 'discarded_no_charge'
      end,
      entitlement_consumption_policy = case
        when exists (
          select 1
          from public.plan_instance_executions execution
          where execution.instance_id = existing.id
            and execution.status = 'completed'
        ) then 'count_service'
        else 'no_charge'
      end,
      updated_at = now()
    where existing.coach_subscription_id = new.coach_subscription_id
      and existing.id is distinct from new.id
      and existing.status in ('active', 'paused');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_single_current_coach_plan_instance
  on public.coach_plan_instances;

create trigger trg_single_current_coach_plan_instance
before insert or update
on public.coach_plan_instances
for each row
execute function public.enforce_single_current_coach_plan_instance();

comment on index public.coach_plan_instances_one_current_per_subscription is
  'Guarantees one active/paused plan instance for each coach subscription.';
