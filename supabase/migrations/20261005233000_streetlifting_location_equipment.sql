-- User-confirmed selections only. NULL leaves legacy text eligible for read-time
-- suggestions; an explicit empty array suppresses those suggestions.
-- Do not bulk rewrite historical descriptions, coordinates or inferred tags.
alter table public.streetlifting_locations
  add column if not exists equipment_types text[];

comment on column public.streetlifting_locations.equipment_types is
  '用户确认的器材 code 列表；NULL=未确认，空数组=用户已清空；历史描述建议不落库';

create index if not exists idx_streetlifting_locations_equipment_types
  on public.streetlifting_locations using gin(equipment_types);

notify pgrst, 'reload schema';
