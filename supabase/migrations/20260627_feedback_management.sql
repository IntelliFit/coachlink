create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  related_question text,
  status text default 'open',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.feedbacks
  add column if not exists category text not null default 'other',
  add column if not exists contact text not null default '',
  add column if not exists page_path text not null default '',
  add column if not exists app_version text not null default '',
  add column if not exists client_info jsonb not null default '{}'::jsonb,
  add column if not exists recent_requests jsonb not null default '[]'::jsonb,
  add column if not exists image_urls jsonb not null default '[]'::jsonb,
  add column if not exists submit_trace_id text not null default '',
  add column if not exists submit_request_id text not null default '',
  add column if not exists submit_host_name text not null default '',
  add column if not exists resolution_message text not null default '',
  add column if not exists reward_credits integer not null default 0,
  add column if not exists handled_by uuid references public.users(id) on delete set null,
  add column if not exists handled_at timestamptz;

alter table public.feedbacks
  drop constraint if exists feedbacks_category_check,
  drop constraint if exists feedbacks_status_check,
  drop constraint if exists feedbacks_reward_credits_check;

update public.feedbacks
set status = 'open'
where status is null or status = 'pending';

update public.feedbacks
set status = 'open'
where status not in ('open', 'pending', 'resolved', 'closed');

update public.feedbacks
set
  category = case
    when category in ('bug', 'suggestion', 'experience', 'other') then category
    else 'other'
  end,
  contact = coalesce(contact, ''),
  page_path = coalesce(page_path, ''),
  app_version = coalesce(app_version, ''),
  client_info = coalesce(client_info, '{}'::jsonb),
  recent_requests = coalesce(recent_requests, '[]'::jsonb),
  image_urls = coalesce(image_urls, '[]'::jsonb),
  submit_trace_id = coalesce(submit_trace_id, ''),
  submit_request_id = coalesce(submit_request_id, ''),
  submit_host_name = coalesce(submit_host_name, ''),
  resolution_message = coalesce(resolution_message, ''),
  reward_credits = greatest(coalesce(reward_credits, 0), 0);

alter table public.feedbacks
  alter column status set default 'open',
  alter column category set default 'other',
  alter column contact set default '',
  alter column page_path set default '',
  alter column app_version set default '',
  alter column client_info set default '{}'::jsonb,
  alter column recent_requests set default '[]'::jsonb,
  alter column image_urls set default '[]'::jsonb,
  alter column submit_trace_id set default '',
  alter column submit_request_id set default '',
  alter column submit_host_name set default '',
  alter column resolution_message set default '',
  alter column reward_credits set default 0;

alter table public.feedbacks
  add constraint feedbacks_category_check
    check (category in ('bug', 'suggestion', 'experience', 'other')),
  add constraint feedbacks_status_check
    check (status in ('open', 'pending', 'resolved', 'closed')),
  add constraint feedbacks_reward_credits_check
    check (reward_credits >= 0);

create index if not exists idx_feedbacks_created_at_desc
  on public.feedbacks (created_at desc);

create index if not exists idx_feedbacks_status_created_at
  on public.feedbacks (status, created_at desc);

create index if not exists idx_feedbacks_category_created_at
  on public.feedbacks (category, created_at desc);

create index if not exists idx_feedbacks_user_created_at
  on public.feedbacks (user_id, created_at desc);

create index if not exists idx_feedbacks_submit_trace_id
  on public.feedbacks (submit_trace_id);
