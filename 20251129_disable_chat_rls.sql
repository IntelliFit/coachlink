-- =====================================================
-- 禁用聊天表的 RLS，与项目其他表保持一致
-- 权限检查在 API 层面进行
-- =====================================================

-- 1. 删除所有 RLS 策略
DROP POLICY IF EXISTS "Students can view own conversations" ON "public"."conversations";
DROP POLICY IF EXISTS "Coaches can view own conversations" ON "public"."conversations";
DROP POLICY IF EXISTS "Students can create conversations with subscribed coaches" ON "public"."conversations";
DROP POLICY IF EXISTS "conversations_insert_any_student" ON "public"."conversations";
DROP POLICY IF EXISTS "Participants can update conversations" ON "public"."conversations";
DROP POLICY IF EXISTS "conversations_select_student" ON "public"."conversations";
DROP POLICY IF EXISTS "conversations_select_coach" ON "public"."conversations";
DROP POLICY IF EXISTS "conversations_insert_student" ON "public"."conversations";
DROP POLICY IF EXISTS "conversations_update_student" ON "public"."conversations";
DROP POLICY IF EXISTS "conversations_update_coach" ON "public"."conversations";

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON "public"."coach_messages";
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON "public"."coach_messages";
DROP POLICY IF EXISTS "Users can update received messages to mark as read" ON "public"."coach_messages";
DROP POLICY IF EXISTS "coach_messages_select" ON "public"."coach_messages";
DROP POLICY IF EXISTS "coach_messages_insert" ON "public"."coach_messages";
DROP POLICY IF EXISTS "coach_messages_update" ON "public"."coach_messages";

-- 2. 禁用 RLS
ALTER TABLE "public"."conversations" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."coach_messages" DISABLE ROW LEVEL SECURITY;

-- 注释：权限检查现在在 API 路由中进行，与项目中其他表（如 training_records, pullup_leaderboard）保持一致

