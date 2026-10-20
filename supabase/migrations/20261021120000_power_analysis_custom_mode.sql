-- Adds the custom ("其他动作", any user-named movement) mode to the video analyzer.
-- Only the job table's mode check changes. Custom results stay out of power_analysis_best_scores:
-- the API skips ranking for this mode, so that table's mode checks are intentionally left unchanged.
-- The movement name lives in tool_power_analysis_jobs.metadata.custom_action_name (no new column).

alter table public.tool_power_analysis_jobs
  drop constraint if exists tool_power_analysis_jobs_mode_check;

alter table public.tool_power_analysis_jobs
  add constraint tool_power_analysis_jobs_mode_check
  check (mode in ('pullup', 'muscleup', 'dip', 'pushup', 'squat', 'back_squat', 'bench_press', 'deadlift', 'custom'));

comment on constraint tool_power_analysis_jobs_mode_check
  on public.tool_power_analysis_jobs is
  'Allowed Power Analysis movement presets supported by the video analysis worker; custom = any user-named movement (trial).';
