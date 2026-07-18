-- Durable AI plan editing sessions.
-- Stores conversation + baseline + draft so users can inspect or continue prior edits.

create table if not exists public.plan_ai_edit_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  scope_key text not null,
  target_action_type text not null default 'coach',
  title text not null default 'AI 计划修改',
  status text not null default 'draft',
  messages jsonb not null default '[]'::jsonb,
  baseline_training_days jsonb not null default '[]'::jsonb,
  draft_training_days jsonb not null default '[]'::jsonb,
  modifications jsonb not null default '[]'::jsonb,
  pending_actions jsonb not null default '[]'::jsonb,
  one_rm_adjustments jsonb not null default '[]'::jsonb,
  context_options jsonb not null default '{}'::jsonb,
  applied_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_ai_edit_sessions_target_type_check
    check (target_action_type in ('coach', 'student')),
  constraint plan_ai_edit_sessions_status_check
    check (status in ('draft', 'applied', 'archived')),
  constraint plan_ai_edit_sessions_scope_key_length_check
    check (char_length(scope_key) between 1 and 240),
  constraint plan_ai_edit_sessions_title_length_check
    check (char_length(title) between 1 and 160),
  constraint plan_ai_edit_sessions_messages_array_check
    check (jsonb_typeof(messages) = 'array'),
  constraint plan_ai_edit_sessions_baseline_array_check
    check (jsonb_typeof(baseline_training_days) = 'array'),
  constraint plan_ai_edit_sessions_draft_array_check
    check (jsonb_typeof(draft_training_days) = 'array'),
  constraint plan_ai_edit_sessions_modifications_array_check
    check (jsonb_typeof(modifications) = 'array')
);

create index if not exists idx_plan_ai_edit_sessions_user_scope_updated
  on public.plan_ai_edit_sessions(user_id, scope_key, updated_at desc);

create index if not exists idx_plan_ai_edit_sessions_user_status_updated
  on public.plan_ai_edit_sessions(user_id, status, updated_at desc);

alter table public.plan_ai_edit_sessions enable row level security;

drop policy if exists "Users can manage own AI plan edit sessions"
  on public.plan_ai_edit_sessions;
create policy "Users can manage own AI plan edit sessions"
  on public.plan_ai_edit_sessions for all to authenticated
  using (user_id::text = auth.uid()::text)
  with check (user_id::text = auth.uid()::text);

grant all on table public.plan_ai_edit_sessions to authenticated, service_role;

comment on table public.plan_ai_edit_sessions is
  'Durable conversation and draft snapshots for the Web AI plan modifier.';
comment on column public.plan_ai_edit_sessions.scope_key is
  'Stable UI resource scope, for example coach-template:<id> or coach-student-plan:<id>.';
