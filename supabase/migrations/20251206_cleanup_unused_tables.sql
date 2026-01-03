-- =====================================================
-- 清理不再使用的旧表
-- 这些表在当前代码库中没有引用，或者已被新架构取代
-- =====================================================

-- 1. coach_plan_template_tags (标签已整合进 coach_plan_templates.tags 数组字段)
DROP TABLE IF EXISTS coach_plan_template_tags CASCADE;

-- 2. video_submissions (视频提交，先删除依赖 exercises 的表或使用 CASCADE)
DROP TABLE IF EXISTS video_submissions CASCADE;

-- 3. exercises (旧版动作表，已由 coach_actions / training_items 取代)
DROP TABLE IF EXISTS exercises CASCADE;

-- 4. workout_logs (训练日志，已由 training_records / plan_instance_executions 取代)
DROP TABLE IF EXISTS workout_logs CASCADE;

-- 5. training_reminders (训练提醒，当前未在代码中启用)
DROP TABLE IF EXISTS training_reminders CASCADE;

-- 6. training_progress (清理额外的旧表)
DROP TABLE IF EXISTS training_progress CASCADE;

SELECT '已删除 6 个冗余表（含依赖项）' AS status;
