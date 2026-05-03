-- =====================================================
-- Fix: coach_plan_instances 存在两个 status CHECK 约束
--
-- 根因：
--   20251201_coach_plan_tables.sql 创建表时的 inline CHECK 自动生成了
--   coach_plan_instances_status_check，允许值不含 'scheduled'。
--   20260106_plan_status_constraint.sql 添加了含 'scheduled' 的 check_plan_status，
--   但没有删除旧约束。
--
-- 后果：
--   插入 status='scheduled'（延迟激活）时旧约束报错，自动匹配计划失败。
-- =====================================================

-- 1. 删除旧的 auto-named 约束（如果存在）
ALTER TABLE coach_plan_instances
DROP CONSTRAINT IF EXISTS coach_plan_instances_status_check;

-- 2. 防御性：确保正确的约束存在
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

SELECT 'coach_plan_instances status constraints fixed' AS result;
