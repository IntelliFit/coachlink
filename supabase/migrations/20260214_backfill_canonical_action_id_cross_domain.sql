-- 跨域回填 canonical_action_id（coach/student/community）
-- 规则：
-- 1) 仅处理 canonical_action_id 为空的数据；
-- 2) 按“归一化名称 + 全属性签名”跨域归并；
-- 3) 全属性一致 => 同一个 canonical；
-- 4) 不覆盖已有 canonical_action_id。

with unified_missing as (
  select
    'coach_actions'::text as source_table,
    ca.id as row_id,
    ca.name,
    coalesce(ca.type, 'STRENGTH') as type,
    ca.positions,
    ca.attrs,
    ca.item_schema,
    ca.suggested_time,
    coalesce(ca."enableAutoWeightCompute", false) as enable_auto_weight_compute,
    coalesce(ca."includesBodyWeight", false) as includes_body_weight
  from public.coach_actions ca
  where ca.canonical_action_id is null

  union all

  select
    'student_actions'::text as source_table,
    sa.id as row_id,
    sa.name,
    coalesce(sa.type, 'STRENGTH') as type,
    sa.positions,
    sa.attrs,
    sa.item_schema,
    sa.suggested_time,
    coalesce(sa."enableAutoWeightCompute", false) as enable_auto_weight_compute,
    coalesce(sa."includesBodyWeight", false) as includes_body_weight
  from public.student_actions sa
  where sa.canonical_action_id is null

  union all

  select
    'community_actions'::text as source_table,
    pa.id as row_id,
    pa.name,
    coalesce(pa.type, 'STRENGTH') as type,
    pa.positions,
    pa.attrs,
    pa.item_schema,
    pa.suggested_time,
    coalesce(pa."enableAutoWeightCompute", false) as enable_auto_weight_compute,
    coalesce(pa."includesBodyWeight", false) as includes_body_weight
  from public.community_actions pa
  where pa.canonical_action_id is null
),
normalized as (
  select
    u.*,
    lower(regexp_replace(trim(coalesce(u.name, '')), '\s+', '', 'g')) as norm_name,
    lower(trim(coalesce(u.type, 'STRENGTH'))) as norm_type,
    coalesce((
      select string_agg(lower(trim(x)), '|' order by lower(trim(x)))
      from unnest(coalesce(u.positions, array[]::text[])) as x
    ), '') as norm_positions,
    coalesce((
      select string_agg(lower(trim(x)), '|' order by lower(trim(x)))
      from unnest(coalesce(u.attrs, array[]::text[])) as x
    ), '') as norm_attrs,
    coalesce((u.item_schema::jsonb)::text, '') as norm_item_schema,
    lower(trim(coalesce(u.suggested_time, ''))) as norm_suggested_time,
    case when u.enable_auto_weight_compute then '1' else '0' end as norm_auto_flag,
    case when u.includes_body_weight then '1' else '0' end as norm_body_flag
  from unified_missing u
),
fingerprinted as (
  select
    n.*,
    concat_ws(
      '||',
      n.norm_name,
      n.norm_type,
      n.norm_positions,
      n.norm_attrs,
      n.norm_item_schema,
      n.norm_suggested_time,
      n.norm_auto_flag,
      n.norm_body_flag
    ) as attr_signature
  from normalized n
),
canonical_candidates as (
  select
    'auto_' || substr(md5(attr_signature), 1, 24) as canonical_id,
    attr_signature,
    norm_name
  from fingerprinted
  group by attr_signature, norm_name
),
canonical_name_pick as (
  select
    cc.canonical_id,
    cc.attr_signature,
    x.name as canonical_name
  from canonical_candidates cc
  join lateral (
    select f.name
    from fingerprinted f
    where f.attr_signature = cc.attr_signature
      and coalesce(trim(f.name), '') <> ''
    group by f.name
    order by count(*) desc, length(f.name) asc, f.name asc
    limit 1
  ) x on true
),
canonical_aliases as (
  select
    cnp.canonical_id,
    cnp.canonical_name,
    array_remove(array_agg(distinct nullif(trim(f.name), '')), cnp.canonical_name) as aliases
  from canonical_name_pick cnp
  join fingerprinted f on f.attr_signature = cnp.attr_signature
  group by cnp.canonical_id, cnp.canonical_name
),
inserted_canonical as (
  insert into public.canonical_actions (id, name, aliases, category, created_at)
  select
    ca.canonical_id,
    ca.canonical_name,
    coalesce(ca.aliases, array[]::text[]),
    null::text as category,
    now()
  from canonical_aliases ca
  on conflict (id) do nothing
  returning id
),
mapping as (
  select
    f.source_table,
    f.row_id,
    ('auto_' || substr(md5(f.attr_signature), 1, 24)) as canonical_id
  from fingerprinted f
),
updated_coach as (
  update public.coach_actions ca
  set
    canonical_action_id = m.canonical_id,
    updated_at = now()
  from mapping m
  where m.source_table = 'coach_actions'
    and ca.id = m.row_id
    and ca.canonical_action_id is null
  returning ca.id
),
updated_student as (
  update public.student_actions sa
  set
    canonical_action_id = m.canonical_id,
    updated_at = now()
  from mapping m
  where m.source_table = 'student_actions'
    and sa.id = m.row_id
    and sa.canonical_action_id is null
  returning sa.id
),
updated_public as (
  update public.community_actions pa
  set
    canonical_action_id = m.canonical_id,
    updated_at = now()
  from mapping m
  where m.source_table = 'community_actions'
    and pa.id = m.row_id
    and pa.canonical_action_id is null
  returning pa.id
)
select
  (select count(*) from canonical_candidates) as canonical_candidates_count,
  (select count(*) from inserted_canonical) as canonical_inserted_count,
  (select count(*) from updated_coach) as coach_actions_updated,
  (select count(*) from updated_student) as student_actions_updated,
  (select count(*) from updated_public) as community_actions_updated;

