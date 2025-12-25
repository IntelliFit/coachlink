-- Migration: Add global_answers column to coach_plan_templates
-- Date: 2025-12-26
-- Purpose: Store global question answers for template matching

ALTER TABLE coach_plan_templates
ADD COLUMN IF NOT EXISTS global_answers JSONB DEFAULT '{}';

COMMENT ON COLUMN coach_plan_templates.global_answers IS '全局选项问题的答案，格式: {"问题名": 选项索引}，用于AI计划匹配';
