-- Coach service automation v1.
-- Scope: coach-level defaults + per-subscription overrides, no package-level policy.

create table if not exists public.coach_automation_policies (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  initial_plan_mode text not null default 'auto_publish',
  feedback_adjustment_mode text not null default 'draft_notify',
  next_phase_mode text not null default 'draft_notify',
  risk_guard_mode text not null default 'strict',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_automation_policies_coach_unique unique (coach_id),
  constraint coach_automation_policies_initial_plan_mode_check
    check (initial_plan_mode in ('off', 'draft', 'auto_publish')),
  constraint coach_automation_policies_feedback_mode_check
    check (feedback_adjustment_mode in ('off', 'draft_notify', 'auto_apply_low_risk', 'auto_apply_safe')),
  constraint coach_automation_policies_next_phase_mode_check
    check (next_phase_mode in ('off', 'draft_notify', 'auto_publish_if_credits')),
  constraint coach_automation_policies_risk_guard_mode_check
    check (risk_guard_mode in ('strict', 'normal'))
);

create table if not exists public.subscription_automation_overrides (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.coach_subscriptions(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  initial_plan_mode text null,
  feedback_adjustment_mode text null,
  next_phase_mode text null,
  risk_guard_mode text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_automation_overrides_subscription_unique unique (subscription_id),
  constraint subscription_automation_overrides_initial_plan_mode_check
    check (initial_plan_mode is null or initial_plan_mode in ('off', 'draft', 'auto_publish')),
  constraint subscription_automation_overrides_feedback_mode_check
    check (feedback_adjustment_mode is null or feedback_adjustment_mode in ('off', 'draft_notify', 'auto_apply_low_risk', 'auto_apply_safe')),
  constraint subscription_automation_overrides_next_phase_mode_check
    check (next_phase_mode is null or next_phase_mode in ('off', 'draft_notify', 'auto_publish_if_credits')),
  constraint subscription_automation_overrides_risk_guard_mode_check
    check (risk_guard_mode is null or risk_guard_mode in ('strict', 'normal'))
);

create table if not exists public.coach_automation_jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  status text not null default 'pending',
  trigger_source text not null,
  idempotency_key text not null,
  subscription_id uuid null references public.coach_subscriptions(id) on delete set null,
  coach_id uuid null references public.coaches(id) on delete set null,
  student_id uuid null references public.users(id) on delete set null,
  plan_instance_id uuid null references public.coach_plan_instances(id) on delete set null,
  feedback_id uuid null references public.execution_feedbacks(id) on delete set null,
  input_snapshot jsonb null,
  output_snapshot jsonb null,
  error_message text null,
  needs_coach_confirmation boolean not null default false,
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  finished_at timestamptz null,
  updated_at timestamptz not null default now(),
  constraint coach_automation_jobs_idempotency_key_unique unique (idempotency_key),
  constraint coach_automation_jobs_type_check
    check (type in ('initial_plan', 'feedback_adjustment', 'next_phase', 'renewal_check', 'subscription_end')),
  constraint coach_automation_jobs_status_check
    check (status in ('pending', 'running', 'succeeded', 'failed', 'needs_coach_review', 'skipped'))
);

create table if not exists public.coach_plan_adjustment_drafts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid null references public.coach_automation_jobs(id) on delete set null,
  feedback_id uuid null references public.execution_feedbacks(id) on delete set null,
  plan_instance_id uuid not null references public.coach_plan_instances(id) on delete cascade,
  subscription_id uuid null references public.coach_subscriptions(id) on delete set null,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  risk_level text not null default 'low',
  summary text not null default '',
  proposed_patch jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  requires_coach_review boolean not null default true,
  applied_at timestamptz null,
  rejected_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_plan_adjustment_drafts_risk_level_check
    check (risk_level in ('low', 'medium', 'high')),
  constraint coach_plan_adjustment_drafts_status_check
    check (status in ('draft', 'applied', 'rejected', 'expired'))
);

create index if not exists idx_coach_automation_jobs_coach_created
  on public.coach_automation_jobs(coach_id, created_at desc);
create index if not exists idx_coach_automation_jobs_subscription
  on public.coach_automation_jobs(subscription_id, created_at desc);
create index if not exists idx_coach_automation_jobs_status
  on public.coach_automation_jobs(status, created_at desc);
create index if not exists idx_subscription_automation_overrides_coach
  on public.subscription_automation_overrides(coach_id, updated_at desc);
create index if not exists idx_plan_adjustment_drafts_coach_status
  on public.coach_plan_adjustment_drafts(coach_id, status, created_at desc);
create index if not exists idx_plan_adjustment_drafts_instance
  on public.coach_plan_adjustment_drafts(plan_instance_id, created_at desc);
create unique index if not exists idx_plan_adjustment_drafts_feedback_unique
  on public.coach_plan_adjustment_drafts(feedback_id)
  where feedback_id is not null;

alter table public.coach_automation_policies enable row level security;
alter table public.subscription_automation_overrides enable row level security;
alter table public.coach_automation_jobs enable row level security;
alter table public.coach_plan_adjustment_drafts enable row level security;

create policy "Coaches can read own automation policy"
  on public.coach_automation_policies for select to authenticated
  using (exists (
    select 1 from public.coaches c
    where c.id = coach_automation_policies.coach_id
      and c.user_id::text = auth.uid()::text
  ));

create policy "Coaches can manage own automation policy"
  on public.coach_automation_policies for all to authenticated
  using (exists (
    select 1 from public.coaches c
    where c.id = coach_automation_policies.coach_id
      and c.user_id::text = auth.uid()::text
  ))
  with check (exists (
    select 1 from public.coaches c
    where c.id = coach_automation_policies.coach_id
      and c.user_id::text = auth.uid()::text
  ));

create policy "Coaches can read own automation overrides"
  on public.subscription_automation_overrides for select to authenticated
  using (exists (
    select 1 from public.coaches c
    where c.id = subscription_automation_overrides.coach_id
      and c.user_id::text = auth.uid()::text
  ));

create policy "Coaches can manage own automation overrides"
  on public.subscription_automation_overrides for all to authenticated
  using (exists (
    select 1 from public.coaches c
    where c.id = subscription_automation_overrides.coach_id
      and c.user_id::text = auth.uid()::text
  ))
  with check (exists (
    select 1 from public.coaches c
    where c.id = subscription_automation_overrides.coach_id
      and c.user_id::text = auth.uid()::text
  ));

create policy "Coaches can read own automation jobs"
  on public.coach_automation_jobs for select to authenticated
  using (exists (
    select 1 from public.coaches c
    where c.id = coach_automation_jobs.coach_id
      and c.user_id::text = auth.uid()::text
  ));

create policy "Coaches can read own adjustment drafts"
  on public.coach_plan_adjustment_drafts for select to authenticated
  using (exists (
    select 1 from public.coaches c
    where c.id = coach_plan_adjustment_drafts.coach_id
      and c.user_id::text = auth.uid()::text
  ));

grant all on table public.coach_automation_policies to authenticated, service_role;
grant all on table public.subscription_automation_overrides to authenticated, service_role;
grant all on table public.coach_automation_jobs to service_role;
grant select on table public.coach_automation_jobs to authenticated;
grant all on table public.coach_plan_adjustment_drafts to service_role;
grant select on table public.coach_plan_adjustment_drafts to authenticated;
