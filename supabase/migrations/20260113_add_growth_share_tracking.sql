-- Growth share tracking for training share cards (QR-code acquisition)
-- Notes:
-- - RLS is OFF by default in this project; keep it that way for these tables.
-- - This migration is additive and safe to run multiple times.

create table if not exists public.growth_share_links (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references public.users(id) on delete cascade,
  execution_id uuid null references public.plan_instance_executions(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_growth_share_links_creator_created
  on public.growth_share_links (creator_user_id, created_at desc);

create table if not exists public.growth_share_events (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.growth_share_links(id) on delete cascade,
  event_type text not null,
  created_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_growth_share_events_share_created
  on public.growth_share_events (share_id, created_at desc);

