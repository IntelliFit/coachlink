-- 回填旧系统 1RM 到 student_actions.reference_1rm（v2）
-- 修复点：
-- 1) 不再依赖 PR.action_id = student_actions.id（两者在教练计划链路常不相等）
-- 2) 优先回填真实PR；若只有 AUTO_STATE，也允许回填（否则会出现“有历史但不回填”）
-- 3) 问卷键支持 action_id / 动作名 双匹配
-- 4) 仅回填 reference_1rm 为空的资格动作，不覆盖已有值

with eligible_actions as (
  select
    sa.id,
    sa.user_id,
    sa.name,
    lower(trim(sa.name)) as norm_name,
    sa.canonical_action_id
  from public.student_actions sa
  where sa.reference_1rm is null
    and coalesce(sa.type, 'STRENGTH') = 'STRENGTH'
    and coalesce(sa."enableAutoWeightCompute", false) = true
    and sa.attrs is not null
    and '强度' = any(sa.attrs)
),
pr_enriched as (
  select
    pr.user_id,
    pr.e1rm,
    pr.date_achieved,
    pr.created_at,
    coalesce(pr.notes, '') as notes,
    lower(trim(coalesce(ca.name, pr.exercise_name, ''))) as norm_name,
    ca.canonical_action_id
  from public.personal_records_history pr
  left join public.coach_actions ca
    on ca.id = pr.action_id
  where pr.e1rm is not null
    and pr.e1rm > 0
),
pr_non_auto as (
  select
    user_id,
    norm_name,
    canonical_action_id,
    max(e1rm) as e1rm
  from pr_enriched
  where notes <> 'AUTO_STATE'
  group by user_id, norm_name, canonical_action_id
),
pr_auto_latest as (
  select distinct on (user_id, norm_name, canonical_action_id)
    user_id,
    norm_name,
    canonical_action_id,
    e1rm
  from pr_enriched
  where notes = 'AUTO_STATE'
  order by
    user_id,
    norm_name,
    canonical_action_id,
    date_achieved desc nulls last,
    created_at desc nulls last
),
questionnaire_rm as (
  select
    cs.student_id as user_id,
    kv.key as rm_key_raw,
    lower(trim(kv.key)) as rm_key_norm,
    nullif(kv.value, '')::numeric as rm_value
  from public.coach_subscriptions cs
  cross join lateral jsonb_array_elements(coalesce(cs.subscribe_data, '[]'::jsonb)) item
  cross join lateral jsonb_each_text(coalesce(item->'userInputs', '{}'::jsonb)) kv
  where item->>'type' = 'rm'
    and cs.status = 'active'
),
backfill_candidates as (
  select
    ea.id as action_id,
    coalesce(
      (
        select max(pna.e1rm)
        from pr_non_auto pna
        where pna.user_id = ea.user_id
          and (
            (ea.canonical_action_id is not null and pna.canonical_action_id = ea.canonical_action_id)
            or pna.norm_name = ea.norm_name
          )
      ),
      (
        select pa.e1rm
        from pr_auto_latest pa
        where pa.user_id = ea.user_id
          and (
            (ea.canonical_action_id is not null and pa.canonical_action_id = ea.canonical_action_id)
            or pa.norm_name = ea.norm_name
          )
        limit 1
      ),
      (
        select max(q.rm_value)
        from questionnaire_rm q
        where q.user_id = ea.user_id
          and (
            q.rm_key_raw = ea.id::text
            or q.rm_key_norm = ea.norm_name
          )
      )
    ) as fill_value
  from eligible_actions ea
),
updated as (
  update public.student_actions sa
  set reference_1rm = bc.fill_value,
      updated_at = now()
  from backfill_candidates bc
  where sa.id = bc.action_id
    and sa.reference_1rm is null
    and bc.fill_value is not null
    and bc.fill_value > 0
  returning sa.id
)
select count(*) as updated_count from updated;


