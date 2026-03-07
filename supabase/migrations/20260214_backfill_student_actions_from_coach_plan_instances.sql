-- 一次性回填：将历史教练计划中涉及的动作补入学员动作库（仅补缺失，不覆盖）
-- 目标：
-- 1) 历史计划里出现过的 coach_actions，自动补到对应 student_actions
-- 2) 避免重复：优先按 canonical_action_id 匹配，名称兜底匹配

with plan_action_refs as (
  select distinct
    coalesce(cpi.student_id, cs.student_id) as student_id,
    coalesce(
      aset ->> 'action_id',
      aset ->> 'actionId'
    ) as coach_action_id_text
  from public.coach_plan_instances cpi
  left join public.coach_subscriptions cs
    on cs.id = cpi.coach_subscription_id
  cross join lateral jsonb_array_elements(coalesce(cpi.training_days, '[]'::jsonb)) day_obj
  cross join lateral jsonb_array_elements(coalesce(day_obj -> 'actionSets', '[]'::jsonb)) aset
  where coalesce(cpi.student_id, cs.student_id) is not null
),
valid_plan_actions as (
  select
    par.student_id,
    (par.coach_action_id_text)::uuid as coach_action_id
  from plan_action_refs par
  where par.coach_action_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
),
source_rows as (
  select distinct
    vpa.student_id as user_id,
    ca.name,
    ca.detail,
    ca.positions,
    ca.attrs,
    ca.url,
    coalesce(ca.type, 'STRENGTH') as type,
    ca.item_schema,
    ca.suggested_time,
    coalesce(ca."enableAutoWeightCompute", false) as "enableAutoWeightCompute",
    (coalesce(ca."includesBodyWeight", false) and coalesce(ca."enableAutoWeightCompute", false)) as "includesBodyWeight",
    ca.canonical_action_id
  from valid_plan_actions vpa
  join public.coach_actions ca
    on ca.id = vpa.coach_action_id
),
to_insert as (
  select s.*
  from source_rows s
  where not exists (
    select 1
    from public.student_actions sa
    where sa.user_id = s.user_id
      and (
        (s.canonical_action_id is not null and sa.canonical_action_id = s.canonical_action_id)
        or lower(trim(sa.name)) = lower(trim(s.name))
      )
  )
)
insert into public.student_actions (
  user_id,
  name,
  detail,
  positions,
  attrs,
  url,
  type,
  item_schema,
  suggested_time,
  "enableAutoWeightCompute",
  "includesBodyWeight",
  canonical_action_id,
  reference_1rm,
  created_at,
  updated_at
)
select
  ti.user_id,
  ti.name,
  ti.detail,
  ti.positions,
  ti.attrs,
  ti.url,
  ti.type,
  ti.item_schema,
  ti.suggested_time,
  ti."enableAutoWeightCompute",
  ti."includesBodyWeight",
  ti.canonical_action_id,
  null::numeric as reference_1rm,
  now(),
  now()
from to_insert ti;


