-- Nullable metadata preserves legacy coordinates and does not guess their source.
alter table public.streetlifting_locations
    add column if not exists country text,
    add column if not exists coordinate_system text;

alter table public.streetlifting_locations
    add constraint streetlifting_locations_coordinate_system_check
    check (coordinate_system is null or coordinate_system in ('wgs84', 'gcj02'));

create index if not exists idx_streetlifting_locations_country
    on public.streetlifting_locations(country);

comment on column public.streetlifting_locations.country is '国家/地区；历史未标记数据保持空值';
comment on column public.streetlifting_locations.coordinate_system is '明确记录的坐标来源：wgs84 / gcj02；历史数据不推断';

notify pgrst, 'reload schema';
