-- 回填旧系统 1RM 到 student_actions.reference_1rm
-- 规则：
-- 1) 只回填 reference_1rm 为空的动作（不覆盖已有值）
-- 2) 仅回填 1RM 资格动作：STRENGTH + attrs 含「强度」+ enableAutoWeightCompute=true
-- 3) 数据来源优先级：PR历史(action_id匹配) > PR历史(动作名匹配) > 订阅问卷RM(action_id键匹配)

with eligible_actions as (
  select sa.id, sa.user_id, sa.name
  from public.student_actions sa
  where sa.reference_1rm is null
    and coalesce(sa.type, 'STRENGTH') = 'STRENGTH'
    and coalesce(sa."enableAutoWeightCompute", false) = true
    and sa.attrs is not null
    and '强度' = any(sa.attrs)
),
pr_by_action as (
  select pr.user_id, pr.action_id::text as action_id_text, max(pr.e1rm) as e1rm
  from public.personal_records_history pr
  where pr.e1rm is not null
    and pr.e1rm > 0
    and coalesce(pr.notes, '') <> 'AUTO_STATE'
    and pr.action_id is not null
  group by pr.user_id, pr.action_id
),
pr_by_name as (
  select pr.user_id, lower(trim(pr.exercise_name)) as action_name_norm, max(pr.e1rm) as e1rm
  from public.personal_records_history pr
  where pr.e1rm is not null
    and pr.e1rm > 0
    and coalesce(pr.notes, '') <> 'AUTO_STATE'
    and pr.exercise_name is not null
    and trim(pr.exercise_name) <> ''
  group by pr.user_id, lower(trim(pr.exercise_name))
),
questionnaire_rm as (
  select
    cs.student_id as user_id,
    kv.key as rm_key,
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
      pba.e1rm,
      pbn.e1rm,
      qrm.rm_value
    ) as fill_value
  from eligible_actions ea
  left join pr_by_action pba
    on pba.user_id = ea.user_id
   and pba.action_id_text = ea.id::text
  left join pr_by_name pbn
    on pbn.user_id = ea.user_id
   and pbn.action_name_norm = lower(trim(ea.name))
  left join questionnaire_rm qrm
    on qrm.user_id = ea.user_id
   and qrm.rm_key = ea.id::text
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


