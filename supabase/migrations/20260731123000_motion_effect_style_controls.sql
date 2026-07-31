begin;

alter table public.tool_video_render_jobs
  add column if not exists style_key text not null default 'aurora';

comment on column public.tool_video_render_jobs.style_key is
  'Visual preset key for the finger-membrane renderer. Fine controls stay in metadata.';

commit;
