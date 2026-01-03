-- ============================================
-- 清理脚本：删除所有 public schema 中的表
-- 用于 Supabase 分支数据库重置
-- ============================================

-- 先删除视图
DROP VIEW IF EXISTS user_video_timeline CASCADE;
DROP VIEW IF EXISTS coach_pending_reviews CASCADE;
DROP VIEW IF EXISTS training_statistics CASCADE;

-- 删除所有表（按依赖顺序，被引用的表放后面）
DROP TABLE IF EXISTS chat_room_unreads CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_rooms CASCADE;
DROP TABLE IF EXISTS execution_set_videos CASCADE;
DROP TABLE IF EXISTS plan_instance_executions CASCADE;
DROP TABLE IF EXISTS coach_plan_instances CASCADE;
DROP TABLE IF EXISTS coach_plan_templates CASCADE;
DROP TABLE IF EXISTS coach_plan_template_tags CASCADE;
DROP TABLE IF EXISTS personal_records_history CASCADE;
DROP TABLE IF EXISTS student_actions CASCADE;
DROP TABLE IF EXISTS student_plan_favorites CASCADE;
DROP TABLE IF EXISTS leaderboard_entries CASCADE;
DROP TABLE IF EXISTS leaderboard_templates CASCADE;
DROP TABLE IF EXISTS training_items CASCADE;
DROP TABLE IF EXISTS coach_reviews CASCADE;
DROP TABLE IF EXISTS student_comments CASCADE;
DROP TABLE IF EXISTS coach_applications CASCADE;
DROP TABLE IF EXISTS content_interactions CASCADE;
DROP TABLE IF EXISTS lifestyle_logs CASCADE;
DROP TABLE IF EXISTS onboarding_questionnaires CASCADE;
DROP TABLE IF EXISTS coach_questionnaires CASCADE;
DROP TABLE IF EXISTS coach_pricing CASCADE;
DROP TABLE IF EXISTS coach_subscriptions CASCADE;
DROP TABLE IF EXISTS coach_contents CASCADE;
DROP TABLE IF EXISTS coach_messages CASCADE;
DROP TABLE IF EXISTS coach_rulepacks CASCADE;
DROP TABLE IF EXISTS coaches CASCADE;
DROP TABLE IF EXISTS alipay_orders CASCADE;
DROP TABLE IF EXISTS shipping_info CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TABLE IF EXISTS pullup_leaderboard CASCADE;
DROP TABLE IF EXISTS rankingboard_pullup_2025_9_10 CASCADE;
DROP TABLE IF EXISTS specialties CASCADE;
DROP TABLE IF EXISTS training_videos CASCADE;
DROP TABLE IF EXISTS set_videos CASCADE;
DROP TABLE IF EXISTS training_records CASCADE;
DROP TABLE IF EXISTS training_sessions CASCADE;
DROP TABLE IF EXISTS training_reminders CASCADE;
DROP TABLE IF EXISTS training_progress CASCADE;
DROP TABLE IF EXISTS training_plan_details CASCADE;
DROP TABLE IF EXISTS training_plans CASCADE;
DROP TABLE IF EXISTS training_exercises CASCADE;
DROP TABLE IF EXISTS exercises CASCADE;
DROP TABLE IF EXISTS video_submissions CASCADE;
DROP TABLE IF EXISTS workout_logs CASCADE;
DROP TABLE IF EXISTS personal_records CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 删除序列（如果存在）
DROP SEQUENCE IF EXISTS alipay_orders_id_seq CASCADE;

-- 完成
SELECT 'All tables dropped successfully!' AS status;
