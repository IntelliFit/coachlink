-- Adds the barbell lifts (back squat, bench press, deadlift) to the video analyzer.
-- Barbell results stay out of power_analysis_best_scores: the API skips ranking for these
-- modes, so that table's mode checks are intentionally left unchanged.

alter table public.tool_power_analysis_jobs
  drop constraint if exists tool_power_analysis_jobs_mode_check;

alter table public.tool_power_analysis_jobs
  add constraint tool_power_analysis_jobs_mode_check
  check (mode in ('pullup', 'muscleup', 'dip', 'pushup', 'squat', 'back_squat', 'bench_press', 'deadlift'));

comment on constraint tool_power_analysis_jobs_mode_check
  on public.tool_power_analysis_jobs is
  'Allowed Power Analysis movement presets supported by the video analysis worker.';
