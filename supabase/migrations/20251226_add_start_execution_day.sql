-- 为 coach_plan_instances 表添加起始执行位置字段
-- 用于记录学员从第几天开始执行计划（前面的天数视为"已完成"）

ALTER TABLE coach_plan_instances
ADD COLUMN IF NOT EXISTS start_execution_day integer DEFAULT 1;

COMMENT ON COLUMN coach_plan_instances.start_execution_day IS '起始执行天数索引（1-based），前面的天数视为已完成';

-- 添加索引以便后续查询
CREATE INDEX IF NOT EXISTS idx_coach_plan_instances_start_execution_day
ON coach_plan_instances(start_execution_day);
