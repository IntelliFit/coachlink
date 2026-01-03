-- ============================================
-- 补丁迁移：创建 chat_rooms 和 chat_messages 表
-- 这些表在生产环境中已存在，但未纳入迁移文件
-- 用于 Supabase 分支数据库初始化
-- ============================================

-- chat_rooms（聊天室表）
CREATE TABLE IF NOT EXISTS chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES coach_subscriptions(id),
  last_message text,
  last_message_at timestamptz,
  is_archived boolean NOT NULL DEFAULT false,
  members uuid[],
  unread_members uuid[],
  type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS conversations_members_gin ON chat_rooms USING GIN (members);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON chat_rooms (updated_at DESC);

-- chat_messages（聊天消息表）
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id),
  message_type text NOT NULL,
  content text NOT NULL,
  media_url text,
  file_name text,
  file_size bigint,
  duration integer,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS chat_messages_room_id_idx ON chat_messages (room_id);
CREATE INDEX IF NOT EXISTS idx_coach_messages_sender ON chat_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_coach_messages_time ON chat_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_is_read_idx ON chat_messages (is_read);

-- 完成
SELECT 'chat_rooms and chat_messages tables created!' AS status;
