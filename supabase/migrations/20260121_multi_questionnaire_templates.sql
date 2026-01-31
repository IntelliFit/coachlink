-- Multi questionnaire templates (draft/active/default)
-- NOTE: This migration is committed for later execution.
-- In some environments, cloud DB may be read-only from tooling; apply via Supabase CLI/Dashboard.
--
-- Strategy:
-- - allow multiple rows per coach (already supported)
-- - add optional metadata columns (name/status/is_default) for fast listing/default selection
-- - keep legacy is_active for "published" questionnaires

alter table public.coach_questionnaires
  add column if not exists name text not null default '默认问卷',
  add column if not exists status text not null default 'active',
  add column if not exists is_default boolean not null default false;

update public.coach_questionnaires
set status = case when coalesce(is_active, true) = true then 'active' else 'archived' end
where status is null or status = '';

with ranked as (
  select
    id,
    coach_id,
    row_number() over (
      partition by coach_id
      order by (case when status = 'active' then 1 else 0 end) desc,
               updated_at desc nulls last,
               created_at desc nulls last
    ) as rn
  from public.coach_questionnaires
)
update public.coach_questionnaires cq
set is_default = (ranked.rn = 1)
from ranked
where cq.id = ranked.id;

update public.coach_questionnaires
set is_active = (status = 'active')
where is_active is distinct from (status = 'active');

create unique index if not exists coach_questionnaires_unique_default_per_coach
  on public.coach_questionnaires (coach_id)
  where is_default;

create index if not exists idx_coach_questionnaires_coach_status
  on public.coach_questionnaires (coach_id, status);

