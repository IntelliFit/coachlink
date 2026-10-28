-- 即兴训练支持学员自定义名称（为空时客户端显示“即兴锻炼”）
-- 创建日期: 2026-10-27
-- 应用层限制 20 字（packages/core/src/impromptuTitle.ts），数据库留 40 字余量。

ALTER TABLE impromptu_executions
    ADD COLUMN IF NOT EXISTS title TEXT;

ALTER TABLE impromptu_executions
    DROP CONSTRAINT IF EXISTS impromptu_executions_title_length;

ALTER TABLE impromptu_executions
    ADD CONSTRAINT impromptu_executions_title_length
    CHECK (title IS NULL OR char_length(title) <= 40);

COMMENT ON COLUMN impromptu_executions.title IS '学员自定义训练名称，NULL 表示使用默认名称';
