alter table public.tool_power_analysis_jobs
  drop constraint if exists tool_power_analysis_jobs_mode_check;

alter table public.tool_power_analysis_jobs
  add constraint tool_power_analysis_jobs_mode_check
  check (mode in ('pullup', 'muscleup', 'dip', 'pushup', 'squat'));

comment on constraint tool_power_analysis_jobs_mode_check
  on public.tool_power_analysis_jobs is
  'Allowed Power Analysis movement presets supported by the video analysis worker.';
