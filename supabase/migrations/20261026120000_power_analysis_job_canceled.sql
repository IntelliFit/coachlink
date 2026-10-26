-- Lets a user cancel their own power-analysis job (waiting for upload, queued or being analyzed).
-- Only the job table's status check changes: 'canceled' is added. Canceled jobs do not count
-- toward the one-active-job limit or the daily analysis limit; their uploaded files are removed
-- when the job is canceled.

alter table public.tool_power_analysis_jobs
  drop constraint if exists tool_power_analysis_jobs_status_check;

alter table public.tool_power_analysis_jobs
  add constraint tool_power_analysis_jobs_status_check
  check (status in ('awaiting_upload', 'queued', 'processing', 'done', 'failed', 'expired', 'canceled'));

comment on constraint tool_power_analysis_jobs_status_check
  on public.tool_power_analysis_jobs is
  'Job lifecycle; canceled = stopped by the user before a result was produced.';
