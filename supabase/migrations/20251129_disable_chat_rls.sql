-- =====================================================
-- 禁用聊天表的 RLS，与项目其他表保持一致
-- 权限检查在 API 层面进行
-- 更新: 2025-12-30 - 适配新版表名 (chat_rooms, chat_messages)
-- =====================================================

-- 1. 删除 chat_rooms 表的 RLS 策略（如果存在）
DROP POLICY IF EXISTS "chat_rooms_select" ON "public"."chat_rooms";
DROP POLICY IF EXISTS "chat_rooms_insert" ON "public"."chat_rooms";
DROP POLICY IF EXISTS "chat_rooms_update" ON "public"."chat_rooms";

-- 2. 删除 chat_messages 表的 RLS 策略（如果存在）
DROP POLICY IF EXISTS "chat_messages_select" ON "public"."chat_messages";
DROP POLICY IF EXISTS "chat_messages_insert" ON "public"."chat_messages";
DROP POLICY IF EXISTS "chat_messages_update" ON "public"."chat_messages";

-- 3. 禁用 RLS
ALTER TABLE "public"."chat_rooms" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."chat_messages" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."chat_room_unreads" DISABLE ROW LEVEL SECURITY;

-- 注释：权限检查现在在 API 路由中进行，与项目中其他表保持一致

SELECT 'Chat RLS disabled successfully!' AS status;
