-- 放宽约束以支持自建计划
ALTER TABLE coach_plan_instances ALTER COLUMN coach_subscription_id DROP NOT NULL;
ALTER TABLE coach_plan_instances ALTER COLUMN coach_id DROP NOT NULL;

-- 确保 source 字段存在
ALTER TABLE coach_plan_instances ADD COLUMN IF NOT EXISTS source text DEFAULT 'coach';

-- 检查并更新动作表（如果需要）
-- 注意：get-instance API 需要更新以支持从 student_actions 读取数据
