alter table public.coach_applications
  add column if not exists application_materials jsonb not null default '[]'::jsonb;

comment on column public.coach_applications.application_materials is
  'Structured coach application proof materials: achievements, cases, credentials, and media with public/private visibility.';
