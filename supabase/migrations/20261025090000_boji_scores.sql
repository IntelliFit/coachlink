-- 薄肌检测器：记录每次检测的分数，用于「超越 X% 的人」和好友 PK。
-- 只存分数和几项原始比例，不存照片或任何图像数据。
-- 只新建一张表和一个只读函数，不改动现有表。
--
-- Rollback:
--   drop function if exists public.boji_total_score_rank(numeric, uuid);
--   drop table if exists public.tool_boji_scores;

create table if not exists public.tool_boji_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  total_score numeric(5, 2) check (total_score is null or (total_score >= 0 and total_score <= 100)),
  abs_score numeric(5, 2) check (abs_score is null or (abs_score >= 0 and abs_score <= 100)),
  v_taper_score numeric(5, 2) check (v_taper_score is null or (v_taper_score >= 0 and v_taper_score <= 100)),
  arms_score numeric(5, 2) check (arms_score is null or (arms_score >= 0 and arms_score <= 100)),
  symmetry_score numeric(5, 2) check (symmetry_score is null or (symmetry_score >= 0 and symmetry_score <= 100)),
  shoulder_waist_ratio numeric(6, 3),
  upper_arm_ratio numeric(6, 3),
  abs_pack_count smallint,
  abs_definition numeric(6, 3),
  silhouette_iou numeric(5, 3),
  lookalike_key text,
  -- 应战时指向发起人的那条成绩
  challenge_score_id uuid references public.tool_boji_scores(id) on delete set null,
  engine_version text,
  created_at timestamptz not null default now()
);

create index if not exists idx_tool_boji_scores_user_created
  on public.tool_boji_scores(user_id, created_at desc);

create index if not exists idx_tool_boji_scores_user_total
  on public.tool_boji_scores(user_id, total_score)
  where total_score is not null;

create index if not exists idx_tool_boji_scores_challenge
  on public.tool_boji_scores(challenge_score_id, created_at desc)
  where challenge_score_id is not null;

comment on table public.tool_boji_scores is
  'Boji detector results (scores only, never photos). Used for the percentile ranking and friend PK.';
comment on column public.tool_boji_scores.challenge_score_id is
  'When this result answered a PK invitation: the inviter''s score row.';

alter table public.tool_boji_scores enable row level security;
revoke all on table public.tool_boji_scores from public, anon, authenticated;
grant select, insert, update, delete on table public.tool_boji_scores to service_role;

-- 排名：每人只算最好的一次综合分，排除本人。
create or replace function public.boji_total_score_rank(p_score numeric, p_exclude_user uuid)
returns table (sample_users bigint, below_users bigint)
language sql
stable
security definer
set search_path = public
as $$
  with best as (
    select user_id, max(total_score) as best_total
    from public.tool_boji_scores
    where total_score is not null
      and (p_exclude_user is null or user_id <> p_exclude_user)
    group by user_id
  )
  select count(*)::bigint, count(*) filter (where best_total < p_score)::bigint
  from best
$$;

revoke all on function public.boji_total_score_rank(numeric, uuid) from public, anon, authenticated;
grant execute on function public.boji_total_score_rank(numeric, uuid) to service_role;
