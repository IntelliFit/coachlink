begin;

create table if not exists public.tool_video_render_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  effect_type text not null default 'finger_membrane'
    check (effect_type in ('finger_membrane')),
  effect_version text not null default 'v4',
  status text not null default 'awaiting_upload'
    check (status in ('awaiting_upload', 'queued', 'processing', 'done', 'failed', 'expired')),
  progress integer not null default 0 check (progress between 0 and 100),
  input_storage_bucket text not null default 'videos',
  input_storage_path text not null,
  output_storage_bucket text not null default 'videos',
  output_storage_path text,
  original_filename text,
  original_file_size_bytes bigint,
  metadata jsonb not null default '{}'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  error_message text,
  queue_driver text,
  queue_topic text,
  queue_consumer_group text,
  enqueued_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '1 day'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tool_video_render_jobs_user_created
  on public.tool_video_render_jobs(user_id, created_at desc);

create index if not exists idx_tool_video_render_jobs_status_created
  on public.tool_video_render_jobs(status, created_at)
  where status in ('awaiting_upload', 'queued', 'processing');

create index if not exists idx_tool_video_render_jobs_expires
  on public.tool_video_render_jobs(expires_at)
  where status <> 'expired';

create index if not exists idx_tool_video_render_jobs_queue_topic_status_created
  on public.tool_video_render_jobs(queue_topic, status, created_at)
  where status = 'queued';

comment on table public.tool_video_render_jobs is
  'Transient toolbox video-effect render jobs. Input and output media expire within 24 hours.';

alter table public.tool_video_render_jobs enable row level security;

create or replace function public.set_tool_video_render_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tool_video_render_jobs_updated_at
  on public.tool_video_render_jobs;
create trigger trg_tool_video_render_jobs_updated_at
before update on public.tool_video_render_jobs
for each row execute function public.set_tool_video_render_jobs_updated_at();

commit;
