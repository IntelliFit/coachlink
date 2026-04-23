-- Coach AI auto-reply settings.
-- Each coach owns one row keyed by coaches.user_id.

create table if not exists public.coach_ai_auto_reply_settings (
  coach_user_id uuid primary key references public.users(id) on delete cascade,
  enabled boolean not null default false,
  system_prompt text not null default '',
  knowledge_base text not null default '',
  model text not null default 'deepseek-chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_coach_ai_auto_reply_settings_enabled
  on public.coach_ai_auto_reply_settings (enabled)
  where enabled = true;

comment on table public.coach_ai_auto_reply_settings is 'Per-coach AI virtual assistant auto-reply settings.';
comment on column public.coach_ai_auto_reply_settings.system_prompt is 'Coach-authored base prompt for the AI virtual assistant.';
comment on column public.coach_ai_auto_reply_settings.knowledge_base is 'Coach-authored reference material used when replying to students.';

