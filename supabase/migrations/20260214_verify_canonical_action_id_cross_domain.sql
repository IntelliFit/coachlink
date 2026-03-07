-- 跨域 canonical 回填核验（只读）

with unioned as (
  select 'coach_actions'::text as source_table, id, canonical_action_id from public.coach_actions
  union all
  select 'student_actions'::text as source_table, id, canonical_action_id from public.student_actions
  union all
  select 'community_actions'::text as source_table, id, canonical_action_id from public.community_actions
),
missing as (
  select source_table, count(*) as missing_count
  from unioned
  where canonical_action_id is null
  group by source_table
),
invalid_ref as (
  select
    u.source_table,
    count(*) as invalid_ref_count
  from unioned u
  left join public.canonical_actions ca on ca.id = u.canonical_action_id
  where u.canonical_action_id is not null
    and ca.id is null
  group by u.source_table
),
cross_domain_reuse as (
  select
    canonical_action_id,
    count(*) as total_refs,
    count(distinct source_table) as source_table_count
  from unioned
  where canonical_action_id is not null
  group by canonical_action_id
)
select
  'missing_by_table' as section,
  coalesce(jsonb_agg(missing order by missing.source_table), '[]'::jsonb) as result
from missing

union all

select
  'invalid_reference_by_table' as section,
  coalesce(jsonb_agg(invalid_ref order by invalid_ref.source_table), '[]'::jsonb) as result
from invalid_ref

union all

select
  'cross_domain_reused_canonical_top20' as section,
  coalesce(
    (
      select jsonb_agg(t order by t.source_table_count desc, t.total_refs desc)
      from (
        select canonical_action_id, total_refs, source_table_count
        from cross_domain_reuse
        where source_table_count > 1
        order by source_table_count desc, total_refs desc
        limit 20
      ) t
    ),
    '[]'::jsonb
  ) as result;

