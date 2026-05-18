alter table public.coach_plan_instances
  add column if not exists archive_reason text,
  add column if not exists entitlement_consumption_policy text,
  add column if not exists entitlement_consumption_note text;

update public.coach_plan_instances
set entitlement_consumption_policy = 'count_service'
where entitlement_consumption_policy is null
   or entitlement_consumption_policy = '';

alter table public.coach_plan_instances
  alter column entitlement_consumption_policy set default 'count_service',
  alter column entitlement_consumption_policy set not null;

alter table public.coach_plan_instances
  drop constraint if exists coach_plan_instances_entitlement_consumption_policy_check;

alter table public.coach_plan_instances
  drop constraint if exists coach_plan_instances_entitlement_policy_check;

alter table public.coach_plan_instances
  add constraint coach_plan_instances_entitlement_policy_check
  check (
    entitlement_consumption_policy in (
      'count_service',
      'count_all_history',
      'no_charge'
    )
  );

alter table public.coach_plan_instances
  drop constraint if exists coach_plan_instances_archive_reason_check;

alter table public.coach_plan_instances
  add constraint coach_plan_instances_archive_reason_check
  check (
    archive_reason is null
    or archive_reason in (
      'served_phase',
      'replaced_counted',
      'replaced_no_charge',
      'discarded_no_charge',
      'legacy_import',
      'student_removed',
      'system_cleanup',
      'other'
    )
  );

comment on column public.coach_plan_instances.archive_reason is
  'Reason a plan instance was archived; documents replacement/import/service semantics.';

comment on column public.coach_plan_instances.entitlement_consumption_policy is
  'How this plan instance consumes coach subscription entitlement: count_service, count_all_history, or no_charge.';

comment on column public.coach_plan_instances.entitlement_consumption_note is
  'Optional human note explaining the entitlement consumption decision.';
