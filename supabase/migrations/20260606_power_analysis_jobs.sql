create table if not exists public.tool_power_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  mode text not null check (mode in ('pullup', 'muscleup')),
  height_cm numeric(6, 2) not null check (height_cm >= 100 and height_cm <= 250),
  weight_kg numeric(6, 2) not null check (weight_kg >= 30 and weight_kg <= 250),
  status text not null default 'awaiting_upload' check (
    status in ('awaiting_upload', 'queued', 'processing', 'done', 'failed', 'expired')
  ),
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  input_storage_bucket text not null default 'videos',
  input_storage_path text not null,
  output_storage_bucket text not null default 'videos',
  output_storage_path text,
  metrics_json jsonb not null default '{}'::jsonb,
  llm_summary text,
  error_message text,
  original_filename text,
  original_file_size_bytes bigint,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '1 day'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tool_power_analysis_jobs_user_created
  on public.tool_power_analysis_jobs(user_id, created_at desc);

create index if not exists idx_tool_power_analysis_jobs_status_created
  on public.tool_power_analysis_jobs(status, created_at)
  where status in ('awaiting_upload', 'queued', 'processing');

create index if not exists idx_tool_power_analysis_jobs_expires
  on public.tool_power_analysis_jobs(expires_at)
  where status <> 'expired';

comment on table public.tool_power_analysis_jobs is
  'Transient toolbox power-analysis jobs. Uploaded and processed videos are staging artifacts only and should be cleaned within 1 day.';

comment on column public.tool_power_analysis_jobs.metrics_json is
  'Structured deterministic metrics from the pose-analysis worker, such as rep-level displacement, ascent time, power, horsepower, and max velocity.';

comment on column public.tool_power_analysis_jobs.expires_at is
  'Server-side artifact expiry. Input/output videos should not be retained beyond this timestamp.';

create or replace function public.set_tool_power_analysis_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tool_power_analysis_jobs_updated_at on public.tool_power_analysis_jobs;
create trigger trg_tool_power_analysis_jobs_updated_at
before update on public.tool_power_analysis_jobs
for each row
execute function public.set_tool_power_analysis_jobs_updated_at();
