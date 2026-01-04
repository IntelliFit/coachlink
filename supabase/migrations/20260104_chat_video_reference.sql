-- 聊天视频引用功能：添加 content_metadata 字段
-- 用于存储视频引用等结构化消息元数据

ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS content_metadata JSONB;

COMMENT ON COLUMN chat_messages.content_metadata IS '消息元数据，用于存储视频引用等结构化信息';

-- 添加索引以便高效查询
CREATE INDEX IF NOT EXISTS idx_chat_messages_content_metadata 
ON chat_messages USING gin(content_metadata) 
WHERE content_metadata IS NOT NULL;
