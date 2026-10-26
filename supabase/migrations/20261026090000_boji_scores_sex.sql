-- 薄肌检测器女性版：成绩表加性别和女性档的分数，排名按性别分开。
-- 只给 tool_boji_scores 加列（已有的行都是男性，默认值 'male'），不删不改现有数据。
--
-- 排名函数：
--   boji_total_score_rank(p_score, p_exclude_user)            保留原签名，改为只统计男性（线上旧版本代码继续可用）
--   boji_total_score_rank_by_sex(p_score, p_exclude_user, p_sex) 新增，女性排名用
-- 新函数单独命名，避免和旧函数重载后 PostgREST 无法选择。
--
-- Rollback:
--   drop function if exists public.boji_total_score_rank_by_sex(numeric, uuid, text);
--   (重新执行 20261025090000_boji_scores.sql 里的 boji_total_score_rank 定义)
--   alter table public.tool_boji_scores
--     drop column if exists abs_line_index, drop column if exists waist_hip_ratio,
--     drop column if exists waist_hip_score, drop column if exists sex;

alter table public.tool_boji_scores
  add column if not exists sex text not null default 'male' check (sex in ('male', 'female')),
  add column if not exists waist_hip_score numeric(5, 2)
    check (waist_hip_score is null or (waist_hip_score >= 0 and waist_hip_score <= 100)),
  add column if not exists waist_hip_ratio numeric(6, 3),
  add column if not exists abs_line_index numeric(7, 4);

comment on column public.tool_boji_scores.sex is
  'Scoring profile the engine used: male (packs, arms) or female (vest line, waist/hip ratio).';

create index if not exists idx_tool_boji_scores_sex_user_total
  on public.tool_boji_scores(sex, user_id, total_score)
  where total_score is not null;

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
      and sex = 'male'
      and (p_exclude_user is null or user_id <> p_exclude_user)
    group by user_id
  )
  select count(*)::bigint, count(*) filter (where best_total < p_score)::bigint
  from best
$$;

create or replace function public.boji_total_score_rank_by_sex(p_score numeric, p_exclude_user uuid, p_sex text)
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
      and sex = p_sex
      and (p_exclude_user is null or user_id <> p_exclude_user)
    group by user_id
  )
  select count(*)::bigint, count(*) filter (where best_total < p_score)::bigint
  from best
$$;

revoke all on function public.boji_total_score_rank(numeric, uuid) from public, anon, authenticated;
grant execute on function public.boji_total_score_rank(numeric, uuid) to service_role;
revoke all on function public.boji_total_score_rank_by_sex(numeric, uuid, text) from public, anon, authenticated;
grant execute on function public.boji_total_score_rank_by_sex(numeric, uuid, text) to service_role;
