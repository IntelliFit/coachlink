begin;

alter table public.tool_video_render_jobs
  alter column user_id drop not null;

alter table public.tool_video_render_jobs
  add column if not exists owner_token_hash text,
  add column if not exists client_key_hash text,
  add column if not exists export_quality text not null default 'standard',
  add column if not exists queue_tier text not null default 'standard',
  add column if not exists style_key text not null default 'aurora',
  add column if not exists bgm_key text not null default 'original',
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists payment_order_id uuid references public.alipay_orders(id),
  add column if not exists price_cents integer not null default 0,
  add column if not exists entitlement_source text;

alter table public.tool_video_render_jobs
  drop constraint if exists tool_video_render_jobs_status_check;

alter table public.tool_video_render_jobs
  add constraint tool_video_render_jobs_status_check
  check (
    status in (
      'awaiting_upload',
      'awaiting_payment',
      'queued',
      'processing',
      'done',
      'failed',
      'expired'
    )
  );

alter table public.tool_video_render_jobs
  drop constraint if exists tool_video_render_jobs_export_quality_check,
  add constraint tool_video_render_jobs_export_quality_check
    check (export_quality in ('standard', 'hd')),
  drop constraint if exists tool_video_render_jobs_queue_tier_check,
  add constraint tool_video_render_jobs_queue_tier_check
    check (queue_tier in ('standard', 'priority')),
  drop constraint if exists tool_video_render_jobs_payment_status_check,
  add constraint tool_video_render_jobs_payment_status_check
    check (payment_status in ('unpaid', 'pending', 'paid', 'free', 'refunded')),
  drop constraint if exists tool_video_render_jobs_entitlement_source_check,
  add constraint tool_video_render_jobs_entitlement_source_check
    check (
      entitlement_source is null
      or entitlement_source in ('signup_free', 'paid_export')
    );

create unique index if not exists idx_tool_video_render_jobs_payment_order
  on public.tool_video_render_jobs(payment_order_id)
  where payment_order_id is not null;

create index if not exists idx_tool_video_render_jobs_client_created
  on public.tool_video_render_jobs(client_key_hash, created_at desc)
  where client_key_hash is not null;

create index if not exists idx_tool_video_render_jobs_queue_tier_status_created
  on public.tool_video_render_jobs(queue_tier, status, created_at)
  where status in ('queued', 'processing');

create table if not exists public.tool_motion_effect_free_exports (
  user_id uuid primary key references public.users(id) on delete cascade,
  job_id uuid not null unique references public.tool_video_render_jobs(id) on delete cascade,
  status text not null default 'reserved'
    check (status in ('reserved', 'consumed')),
  reserved_at timestamptz not null default now(),
  consumed_at timestamptz
);

comment on table public.tool_motion_effect_free_exports is
  'One lifetime standard-quality motion-effect export granted after registration.';

alter table public.tool_motion_effect_free_exports enable row level security;

commit;
