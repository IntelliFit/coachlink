-- Motion game leaderboards use server-issued sessions and only expose each
-- player's verified personal best through the existing leaderboard UI.

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
    'b7bc1548-08ed-4f52-90cc-f5b22a785101',
    '引体冲刺无限榜',
    '移动头部带小鸟穿越上下管道，个人最佳成绩自动同步。',
    'motion_game_pullup',
    '穿越通道',
    'desc',
    '[{"type":"number","name":"穿越通道","required":true},{"type":"number","name":"坚持秒数","required":true},{"type":"number","name":"引体次数","required":true}]'::jsonb,
    '[{"detail":"只记录服务器会话内完成的成绩","status":"success"},{"detail":"每位玩家只保留个人最佳成绩","status":"success"},{"detail":"同分时依次比较坚持时间和引体次数","status":"warning"}]'::jsonb,
    '游戏进行时保持屏幕常亮；生命耗尽后自动结算并同步。',
    'CoachLink',
    false,
    now()
  ),
  (
    'b7bc1548-08ed-4f52-90cc-f5b22a785102',
    '俯卧撑突围无限榜',
    '移动头部带小鸟穿越上下管道，个人最佳成绩自动同步。',
    'motion_game_pushup',
    '穿越通道',
    'desc',
    '[{"type":"number","name":"穿越通道","required":true},{"type":"number","name":"坚持秒数","required":true},{"type":"number","name":"俯卧撑次数","required":true}]'::jsonb,
    '[{"detail":"只记录服务器会话内完成的成绩","status":"success"},{"detail":"每位玩家只保留个人最佳成绩","status":"success"},{"detail":"同分时依次比较坚持时间和俯卧撑次数","status":"warning"}]'::jsonb,
    '游戏进行时保持屏幕常亮；生命耗尽后自动结算并同步。',
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

create unique index if not exists idx_motion_game_leaderboard_template_type
  on public.leaderboard_templates(type)
  where type in ('motion_game_pullup', 'motion_game_pushup');

create table if not exists public.motion_game_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  game_key text not null check (game_key in ('pullup-rush', 'pushup-dash')),
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  score integer check (score >= 0),
  elapsed_ms integer check (elapsed_ms >= 0),
  action_count integer check (action_count >= 0),
  lock_ratio numeric(5, 4) check (lock_ratio >= 0 and lock_ratio <= 1),
  client_version text,
  created_at timestamptz not null default now()
);

create index if not exists idx_motion_game_runs_user_game_created
  on public.motion_game_runs(user_id, game_key, created_at desc);

create unique index if not exists idx_motion_game_runs_one_active
  on public.motion_game_runs(user_id, game_key)
  where status = 'active';

create table if not exists public.motion_game_best_scores (
  user_id uuid not null references public.users(id) on delete cascade,
  game_key text not null check (game_key in ('pullup-rush', 'pushup-dash')),
  score integer not null check (score >= 0),
  elapsed_ms integer not null check (elapsed_ms >= 0),
  action_count integer not null check (action_count >= 0),
  lock_ratio numeric(5, 4) not null check (lock_ratio >= 0 and lock_ratio <= 1),
  run_id uuid not null references public.motion_game_runs(id) on delete restrict,
  achieved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_key)
);

create index if not exists idx_motion_game_best_scores_ranking
  on public.motion_game_best_scores(game_key, score desc, elapsed_ms desc, action_count desc, achieved_at asc, user_id asc);

alter table public.motion_game_runs enable row level security;
alter table public.motion_game_best_scores enable row level security;

revoke all on table public.motion_game_runs from anon, authenticated;
revoke all on table public.motion_game_best_scores from anon, authenticated;
grant all on table public.motion_game_runs to service_role;
grant all on table public.motion_game_best_scores to service_role;

create or replace function public.finish_motion_game_run(
  p_run_id uuid,
  p_user_id uuid,
  p_score integer,
  p_elapsed_ms integer,
  p_action_count integer,
  p_lock_ratio numeric
)
returns table (
  is_personal_best boolean,
  player_rank bigint,
  player_total bigint,
  percentile integer,
  best_score integer,
  best_elapsed_ms integer,
  best_action_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.motion_game_runs%rowtype;
  v_previous public.motion_game_best_scores%rowtype;
  v_template_id uuid;
  v_action_label text;
  v_rows integer;
  v_is_personal_best boolean := false;
begin
  select * into v_run
  from public.motion_game_runs
  where id = p_run_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'motion game session not found';
  end if;

  if v_run.status = 'abandoned' then
    raise exception 'motion game session has expired';
  end if;

  if v_run.status = 'active' then
    update public.motion_game_runs
    set status = 'completed',
        completed_at = now(),
        score = p_score,
        elapsed_ms = p_elapsed_ms,
        action_count = p_action_count,
        lock_ratio = p_lock_ratio
    where id = p_run_id;

    select * into v_previous
    from public.motion_game_best_scores
    where user_id = p_user_id and game_key = v_run.game_key
    for update;

    v_is_personal_best := v_previous.user_id is null
      or p_score > v_previous.score
      or (p_score = v_previous.score and p_elapsed_ms > v_previous.elapsed_ms)
      or (
        p_score = v_previous.score
        and p_elapsed_ms = v_previous.elapsed_ms
        and p_action_count > v_previous.action_count
      );

    if v_is_personal_best then
      insert into public.motion_game_best_scores (
        user_id, game_key, score, elapsed_ms, action_count, lock_ratio, run_id, achieved_at, updated_at
      ) values (
        p_user_id, v_run.game_key, p_score, p_elapsed_ms, p_action_count, p_lock_ratio, p_run_id, now(), now()
      )
      on conflict (user_id, game_key) do update set
        score = excluded.score,
        elapsed_ms = excluded.elapsed_ms,
        action_count = excluded.action_count,
        lock_ratio = excluded.lock_ratio,
        run_id = excluded.run_id,
        achieved_at = excluded.achieved_at,
        updated_at = excluded.updated_at;

      if v_run.game_key = 'pullup-rush' then
        v_template_id := 'b7bc1548-08ed-4f52-90cc-f5b22a785101';
        v_action_label := '引体次数';
      else
        v_template_id := 'b7bc1548-08ed-4f52-90cc-f5b22a785102';
        v_action_label := '俯卧撑次数';
      end if;

      update public.leaderboard_entries
      set score = p_score,
          form_data = jsonb_build_array(
            jsonb_build_object('type', 'number', 'name', '穿越通道', 'required', true, 'userInput', p_score),
            jsonb_build_object('type', 'number', 'name', '坚持秒数', 'required', true, 'userInput', floor(p_elapsed_ms / 1000.0)),
            jsonb_build_object('type', 'number', 'name', v_action_label, 'required', true, 'userInput', p_action_count)
          ),
          extra_data = jsonb_build_object(
            'game_key', v_run.game_key,
            'run_id', p_run_id,
            'elapsed_ms', p_elapsed_ms,
            'action_count', p_action_count,
            'lock_ratio', p_lock_ratio,
            'verified', true
          ),
          status = 'approved',
          created_at = now()
      where template_id = v_template_id and user_id = p_user_id;

      get diagnostics v_rows = row_count;
      if v_rows = 0 then
        insert into public.leaderboard_entries (
          template_id, user_id, form_data, score, extra_data, status, created_at
        ) values (
          v_template_id,
          p_user_id,
          jsonb_build_array(
            jsonb_build_object('type', 'number', 'name', '穿越通道', 'required', true, 'userInput', p_score),
            jsonb_build_object('type', 'number', 'name', '坚持秒数', 'required', true, 'userInput', floor(p_elapsed_ms / 1000.0)),
            jsonb_build_object('type', 'number', 'name', v_action_label, 'required', true, 'userInput', p_action_count)
          ),
          p_score,
          jsonb_build_object(
            'game_key', v_run.game_key,
            'run_id', p_run_id,
            'elapsed_ms', p_elapsed_ms,
            'action_count', p_action_count,
            'lock_ratio', p_lock_ratio,
            'verified', true
          ),
          'approved',
          now()
        );
      end if;
    end if;
  else
    select * into v_previous
    from public.motion_game_best_scores
    where user_id = p_user_id and game_key = v_run.game_key;
    v_is_personal_best := v_previous.run_id = p_run_id;
  end if;

  return query
  with ranked as (
    select
      best.user_id,
      best.score,
      best.elapsed_ms,
      best.action_count,
      row_number() over (
        order by best.score desc, best.elapsed_ms desc, best.action_count desc, best.achieved_at asc, best.user_id asc
      ) as ranking,
      count(*) over () as total_count
    from public.motion_game_best_scores best
    where best.game_key = v_run.game_key
  )
  select
    v_is_personal_best,
    ranked.ranking,
    ranked.total_count,
    floor(((ranked.total_count - ranked.ranking)::numeric * 100) / greatest(ranked.total_count, 1))::integer,
    ranked.score,
    ranked.elapsed_ms,
    ranked.action_count
  from ranked
  where ranked.user_id = p_user_id;
end;
$$;

revoke all on function public.finish_motion_game_run(uuid, uuid, integer, integer, integer, numeric) from public, anon, authenticated;
grant execute on function public.finish_motion_game_run(uuid, uuid, integer, integer, integer, numeric) to service_role;
