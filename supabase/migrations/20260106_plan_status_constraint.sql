-- =====================================================
-- Phase 1: 计划状态规范化
-- 添加 status 字段约束，确保状态值有效
-- =====================================================

-- 1. 首先查看现有数据中的 status 分布
-- SELECT status, COUNT(*) FROM coach_plan_instances GROUP BY status;

-- 2. 修正任何无效的 status 值
UPDATE coach_plan_instances 
SET status = 'active' 
WHERE status IS NULL;

-- 3. 将不在允许列表中的状态改为 archived
UPDATE coach_plan_instances 
SET status = 'archived' 
WHERE status NOT IN ('active', 'completed', 'archived', 'scheduled', 'draft', 'paused');

-- 4. 添加约束（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_plan_status'
  ) THEN
    ALTER TABLE coach_plan_instances 
    ADD CONSTRAINT check_plan_status 
    CHECK (status IN ('active', 'completed', 'archived', 'scheduled', 'draft', 'paused'));
  END IF;
END $$;

-- 5. 添加注释说明
COMMENT ON COLUMN coach_plan_instances.status IS 
'计划状态: active(执行中,同一学员唯一), completed(已完成), archived(已归档), scheduled(待执行), draft(草稿), paused(暂停)';

-- 6. 为 student_id + status 创建索引，加速查询当前计划
CREATE INDEX IF NOT EXISTS idx_plan_instances_student_status 
ON coach_plan_instances(student_id, status);

SELECT 'Phase 1 Migration: Status constraint added successfully' AS result;
