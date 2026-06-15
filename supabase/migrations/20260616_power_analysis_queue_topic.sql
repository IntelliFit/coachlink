alter table public.tool_power_analysis_jobs
  add column if not exists queue_driver text,
  add column if not exists queue_topic text,
  add column if not exists queue_consumer_group text,
  add column if not exists enqueued_at timestamptz;

create index if not exists idx_tool_power_analysis_jobs_queue_topic_status_created
  on public.tool_power_analysis_jobs(queue_topic, status, created_at)
  where status = 'queued';

comment on column public.tool_power_analysis_jobs.queue_driver is
  'Task queue driver used when the job was enqueued, for example memory or kafka.';

comment on column public.tool_power_analysis_jobs.queue_topic is
  'Task queue topic that owns this job. Queue workers may only recover or claim jobs matching their configured topic.';

comment on column public.tool_power_analysis_jobs.queue_consumer_group is
  'Consumer group expected to process this job when a durable queue is used.';

comment on column public.tool_power_analysis_jobs.enqueued_at is
  'Timestamp when the job was moved to queued state and published to the configured queue.';
