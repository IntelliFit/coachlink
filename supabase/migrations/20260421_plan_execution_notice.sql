alter table if exists public.coach_plan_templates
  add column if not exists execution_notice text;

alter table if exists public.coach_plan_instances
  add column if not exists execution_notice text;

comment on column public.coach_plan_templates.execution_notice is
  'Coach-authored instructions students must read before executing plans made from this template.';

comment on column public.coach_plan_instances.execution_notice is
  'Coach-authored instructions students must read before executing this plan instance.';
