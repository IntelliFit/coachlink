-- 为 coach_plan_instances 添加 AI 生成日志字段
-- 用于存储 LLM 个性化生成计划时的决策过程和 reasoning
ALTER TABLE coach_plan_instances
ADD COLUMN IF NOT EXISTS ai_generation_log JSONB DEFAULT NULL;
