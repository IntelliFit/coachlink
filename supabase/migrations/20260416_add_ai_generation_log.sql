-- Store LLM personalization reasoning for coach-created plan instances.
ALTER TABLE coach_plan_instances
ADD COLUMN IF NOT EXISTS ai_generation_log JSONB DEFAULT NULL;
