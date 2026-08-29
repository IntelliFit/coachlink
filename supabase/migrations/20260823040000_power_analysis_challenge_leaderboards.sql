-- Verified power-analysis challenge leaderboards. Each account keeps one
-- independently verified personal best for power and for velocity.

insert into public.leaderboard_templates (
  id,
  title,
  description,
  type,
  rank_by_field,
  sort_order,
  form_schema,
  rules,
  remarks,
  initiator,
  "needReview",
  created_at
)
values
  (
    'b7bc1548-08ed-4f52-90cc-f5b22a785103',
    '全国功率挑战 · 最大功率榜',
    '上传真实训练视频，由 CoachLink 自动分析并记录个人最高功率。',
    'power_analysis_power',
    '最高功率（W）',
    'desc',
    '[{"type":"number","name":"最高功率（W）","required":true},{"type":"number","name":"最快速度（m/s）","required":true},{"type":"text","name":"动作","required":true}]'::jsonb,
    '[{"detail":"只收录已完成自动分析的视频成绩","status":"success"},{"detail":"每位参赛者只保留个人最好成绩","status":"success"},{"detail":"支持引体、双力臂、臂屈伸、俯卧撑和深蹲","status":"warning"},{"detail":"绝对功率受体重、负重和动作类型影响，本榜属于大众挑战榜","status":"warning"}]'::jsonb,
    '全国榜指 CoachLink 全国参赛用户排名，不代表全国人口抽样或实验室测量。',
    'CoachLink',
    false,
    now()
  ),
  (
    'b7bc1548-08ed-4f52-90cc-f5b22a785104',
    '全国功率挑战 · 最快速度榜',
    '上传真实训练视频，由 CoachLink 自动分析并记录个人最快动作速度。',
    'power_analysis_speed',
    '最快速度（m/s）',
    'desc',
    '[{"type":"number","name":"最快速度（m/s）","required":true},{"type":"number","name":"最高功率（W）","required":true},{"type":"text","name":"动作","required":true}]'::jsonb,
    '[{"detail":"只收录已完成自动分析的视频成绩","status":"success"},{"detail":"每位参赛者只保留个人最好成绩","status":"success"},{"detail":"支持引体、双力臂、臂屈伸、俯卧撑和深蹲","status":"warning"},{"detail":"动作类型不同会影响速度，本榜属于大众挑战榜","status":"warning"}]'::jsonb,
    '全国榜指 CoachLink 全国参赛用户排名，不代表全国人口抽样或实验室测量。',
    'CoachLink',
    false,
    now()
  )
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  type = excluded.type,
  rank_by_field = excluded.rank_by_field,
  sort_order = excluded.sort_order,
  form_schema = excluded.form_schema,
  rules = excluded.rules,
  remarks = excluded.remarks,
  initiator = excluded.initiator,
  "needReview" = excluded."needReview";

create unique index if not exists idx_power_analysis_challenge_template_type
  on public.leaderboard_templates(type)
  where type in ('power_analysis_power', 'power_analysis_speed');

create table if not exists public.power_analysis_best_scores (
  user_id uuid primary key references public.users(id) on delete cascade,
  best_power_w numeric(12, 3) check (best_power_w is null or best_power_w > 0),
  best_power_mode text check (best_power_mode is null or best_power_mode in ('pullup', 'muscleup', 'dip', 'pushup', 'squat')),
  best_power_job_id uuid references public.tool_power_analysis_jobs(id) on delete set null,
  best_power_achieved_at timestamptz,
  best_velocity_mps numeric(12, 5) check (best_velocity_mps is null or best_velocity_mps > 0),
  best_velocity_mode text check (best_velocity_mode is null or best_velocity_mode in ('pullup', 'muscleup', 'dip', 'pushup', 'squat')),
  best_velocity_job_id uuid references public.tool_power_analysis_jobs(id) on delete set null,
  best_velocity_achieved_at timestamptz,
  updated_at timestamptz not null default now(),
  check (best_power_w is not null or best_velocity_mps is not null)
);

create index if not exists idx_power_analysis_best_power_ranking
  on public.power_analysis_best_scores(best_power_w desc, best_power_achieved_at asc, user_id asc)
  where best_power_w is not null;

create index if not exists idx_power_analysis_best_velocity_ranking
  on public.power_analysis_best_scores(best_velocity_mps desc, best_velocity_achieved_at asc, user_id asc)
  where best_velocity_mps is not null;

alter table public.power_analysis_best_scores enable row level security;
revoke all on table public.power_analysis_best_scores from anon, authenticated;
grant all on table public.power_analysis_best_scores to service_role;

create or replace function public.power_analysis_safe_numeric(p_value text)
returns numeric
language sql
immutable
strict
parallel safe
set search_path = public
as $$
  select case
    when btrim(p_value) ~ '^([0-9]+([.][0-9]+)?|[.][0-9]+)([eE][+-]?[0-9]+)?$'
      then btrim(p_value)::numeric
    else null
  end
$$;

revoke all on function public.power_analysis_safe_numeric(text) from public, anon, authenticated;
grant execute on function public.power_analysis_safe_numeric(text) to service_role;

create or replace function public.record_power_analysis_best(
  p_job_id uuid,
  p_user_id uuid
)
returns table (
  is_power_personal_best boolean,
  is_speed_personal_best boolean,
  power_rank bigint,
  speed_rank bigint,
  power_participant_total bigint,
  speed_participant_total bigint,
  power_percentile integer,
  speed_percentile integer,
  best_power_w numeric,
  best_velocity_mps numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.tool_power_analysis_jobs%rowtype;
  v_previous public.power_analysis_best_scores%rowtype;
  v_power numeric;
  v_velocity numeric;
  v_achieved_at timestamptz;
begin
  select * into v_job
  from public.tool_power_analysis_jobs
  where id = p_job_id and user_id = p_user_id and status = 'done';

  if not found then
    raise exception 'completed power analysis job not found';
  end if;

  v_power := coalesce(
    public.power_analysis_safe_numeric(v_job.metrics_json #>> '{summary,bestPowerW}'),
    public.power_analysis_safe_numeric(v_job.metrics_json #>> '{summary,best_power_w}')
  );
  v_velocity := coalesce(
    public.power_analysis_safe_numeric(v_job.metrics_json #>> '{summary,bestVelocityMps}'),
    public.power_analysis_safe_numeric(v_job.metrics_json #>> '{summary,best_velocity_mps}')
  );
  v_achieved_at := coalesce(v_job.completed_at, v_job.updated_at, v_job.created_at, now());

  if coalesce(v_power, 0) <= 0 then
    v_power := null;
  end if;
  if coalesce(v_velocity, 0) <= 0 then
    v_velocity := null;
  end if;
  if v_power is null and v_velocity is null then
    raise exception 'power analysis job has no rankable metrics';
  end if;

  select * into v_previous
  from public.power_analysis_best_scores
  where user_id = p_user_id
  for update;

  insert into public.power_analysis_best_scores as current (
    user_id,
    best_power_w,
    best_power_mode,
    best_power_job_id,
    best_power_achieved_at,
    best_velocity_mps,
    best_velocity_mode,
    best_velocity_job_id,
    best_velocity_achieved_at,
    updated_at
  ) values (
    p_user_id,
    v_power,
    case when v_power is not null then v_job.mode end,
    case when v_power is not null then p_job_id end,
    case when v_power is not null then v_achieved_at end,
    v_velocity,
    case when v_velocity is not null then v_job.mode end,
    case when v_velocity is not null then p_job_id end,
    case when v_velocity is not null then v_achieved_at end,
    now()
  )
  on conflict (user_id) do update set
    best_power_w = case
      when excluded.best_power_w is not null
        and (current.best_power_w is null or excluded.best_power_w > current.best_power_w)
      then excluded.best_power_w else current.best_power_w end,
    best_power_mode = case
      when excluded.best_power_w is not null
        and (current.best_power_w is null or excluded.best_power_w > current.best_power_w)
      then excluded.best_power_mode else current.best_power_mode end,
    best_power_job_id = case
      when excluded.best_power_w is not null
        and (current.best_power_w is null or excluded.best_power_w > current.best_power_w)
      then excluded.best_power_job_id else current.best_power_job_id end,
    best_power_achieved_at = case
      when excluded.best_power_w is not null
        and (current.best_power_w is null or excluded.best_power_w > current.best_power_w)
      then excluded.best_power_achieved_at else current.best_power_achieved_at end,
    best_velocity_mps = case
      when excluded.best_velocity_mps is not null
        and (current.best_velocity_mps is null or excluded.best_velocity_mps > current.best_velocity_mps)
      then excluded.best_velocity_mps else current.best_velocity_mps end,
    best_velocity_mode = case
      when excluded.best_velocity_mps is not null
        and (current.best_velocity_mps is null or excluded.best_velocity_mps > current.best_velocity_mps)
      then excluded.best_velocity_mode else current.best_velocity_mode end,
    best_velocity_job_id = case
      when excluded.best_velocity_mps is not null
        and (current.best_velocity_mps is null or excluded.best_velocity_mps > current.best_velocity_mps)
      then excluded.best_velocity_job_id else current.best_velocity_job_id end,
    best_velocity_achieved_at = case
      when excluded.best_velocity_mps is not null
        and (current.best_velocity_mps is null or excluded.best_velocity_mps > current.best_velocity_mps)
      then excluded.best_velocity_achieved_at else current.best_velocity_achieved_at end,
    updated_at = case
      when (
        excluded.best_power_w is not null
        and (current.best_power_w is null or excluded.best_power_w > current.best_power_w)
      ) or (
        excluded.best_velocity_mps is not null
        and (current.best_velocity_mps is null or excluded.best_velocity_mps > current.best_velocity_mps)
      ) then now() else current.updated_at end;

  return query
  with power_ranked as (
    select
      score.user_id,
      score.best_power_w,
      score.best_power_job_id,
      row_number() over (order by score.best_power_w desc, score.best_power_achieved_at asc, score.user_id asc) as ranking,
      count(*) over () as total_count
    from public.power_analysis_best_scores score
    where score.best_power_w is not null
  ),
  speed_ranked as (
    select
      score.user_id,
      score.best_velocity_mps,
      score.best_velocity_job_id,
      row_number() over (order by score.best_velocity_mps desc, score.best_velocity_achieved_at asc, score.user_id asc) as ranking,
      count(*) over () as total_count
    from public.power_analysis_best_scores score
    where score.best_velocity_mps is not null
  )
  select
    coalesce(power_ranked.best_power_job_id = p_job_id, false),
    coalesce(speed_ranked.best_velocity_job_id = p_job_id, false),
    coalesce(power_ranked.ranking, 0),
    coalesce(speed_ranked.ranking, 0),
    coalesce(power_ranked.total_count, 0),
    coalesce(speed_ranked.total_count, 0),
    case when coalesce(power_ranked.total_count, 0) > 0
      then floor(((power_ranked.total_count - power_ranked.ranking)::numeric * 100) / power_ranked.total_count)::integer
      else 0 end,
    case when coalesce(speed_ranked.total_count, 0) > 0
      then floor(((speed_ranked.total_count - speed_ranked.ranking)::numeric * 100) / speed_ranked.total_count)::integer
      else 0 end,
    power_ranked.best_power_w,
    speed_ranked.best_velocity_mps
  from power_ranked
  full join speed_ranked using (user_id)
  where coalesce(power_ranked.user_id, speed_ranked.user_id) = p_user_id;
end;
$$;

revoke all on function public.record_power_analysis_best(uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_power_analysis_best(uuid, uuid) to service_role;

-- Backfill completed analyses so the first release starts with real results.
with eligible as (
  select
    job.user_id,
    job.id as job_id,
    job.mode,
    coalesce(
      public.power_analysis_safe_numeric(job.metrics_json #>> '{summary,bestPowerW}'),
      public.power_analysis_safe_numeric(job.metrics_json #>> '{summary,best_power_w}')
    ) as best_power_w,
    coalesce(
      public.power_analysis_safe_numeric(job.metrics_json #>> '{summary,bestVelocityMps}'),
      public.power_analysis_safe_numeric(job.metrics_json #>> '{summary,best_velocity_mps}')
    ) as best_velocity_mps,
    coalesce(job.completed_at, job.updated_at, job.created_at) as achieved_at
  from public.tool_power_analysis_jobs job
  where job.status = 'done'
),
power_best as (
  select distinct on (user_id)
    user_id, job_id, mode, best_power_w, achieved_at
  from eligible
  where best_power_w > 0
  order by user_id, best_power_w desc, achieved_at asc, job_id asc
),
speed_best as (
  select distinct on (user_id)
    user_id, job_id, mode, best_velocity_mps, achieved_at
  from eligible
  where best_velocity_mps > 0
  order by user_id, best_velocity_mps desc, achieved_at asc, job_id asc
)
insert into public.power_analysis_best_scores as current (
  user_id,
  best_power_w,
  best_power_mode,
  best_power_job_id,
  best_power_achieved_at,
  best_velocity_mps,
  best_velocity_mode,
  best_velocity_job_id,
  best_velocity_achieved_at,
  updated_at
)
select
  coalesce(power_best.user_id, speed_best.user_id),
  power_best.best_power_w,
  power_best.mode,
  power_best.job_id,
  power_best.achieved_at,
  speed_best.best_velocity_mps,
  speed_best.mode,
  speed_best.job_id,
  speed_best.achieved_at,
  now()
from power_best
full join speed_best using (user_id)
on conflict (user_id) do update set
  best_power_w = case
    when excluded.best_power_w is not null
      and (current.best_power_w is null or excluded.best_power_w > current.best_power_w)
    then excluded.best_power_w else current.best_power_w end,
  best_power_mode = case
    when excluded.best_power_w is not null
      and (current.best_power_w is null or excluded.best_power_w > current.best_power_w)
    then excluded.best_power_mode else current.best_power_mode end,
  best_power_job_id = case
    when excluded.best_power_w is not null
      and (current.best_power_w is null or excluded.best_power_w > current.best_power_w)
    then excluded.best_power_job_id else current.best_power_job_id end,
  best_power_achieved_at = case
    when excluded.best_power_w is not null
      and (current.best_power_w is null or excluded.best_power_w > current.best_power_w)
    then excluded.best_power_achieved_at else current.best_power_achieved_at end,
  best_velocity_mps = case
    when excluded.best_velocity_mps is not null
      and (current.best_velocity_mps is null or excluded.best_velocity_mps > current.best_velocity_mps)
    then excluded.best_velocity_mps else current.best_velocity_mps end,
  best_velocity_mode = case
    when excluded.best_velocity_mps is not null
      and (current.best_velocity_mps is null or excluded.best_velocity_mps > current.best_velocity_mps)
    then excluded.best_velocity_mode else current.best_velocity_mode end,
  best_velocity_job_id = case
    when excluded.best_velocity_mps is not null
      and (current.best_velocity_mps is null or excluded.best_velocity_mps > current.best_velocity_mps)
    then excluded.best_velocity_job_id else current.best_velocity_job_id end,
  best_velocity_achieved_at = case
    when excluded.best_velocity_mps is not null
      and (current.best_velocity_mps is null or excluded.best_velocity_mps > current.best_velocity_mps)
    then excluded.best_velocity_achieved_at else current.best_velocity_achieved_at end,
  updated_at = now();
