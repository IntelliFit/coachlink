-- =====================================================
-- 通用计划扩展 - 多态动作类型支持
-- 为 coach_actions 和 student_actions 添加 type, item_schema, suggested_time 字段
-- =====================================================

-- 1. coach_actions 表扩展
-- 添加 type 字段（默认STRENGTH，兼容现有数据）
ALTER TABLE coach_actions ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'STRENGTH';

-- 添加 item_schema 字段（存储类型特定的默认配置）
ALTER TABLE coach_actions ADD COLUMN IF NOT EXISTS item_schema JSONB;

-- 添加 suggested_time 字段（建议执行时间，如 '08:00'）
ALTER TABLE coach_actions ADD COLUMN IF NOT EXISTS suggested_time TEXT;

-- 添加类型约束
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'coach_actions_type_check'
    ) THEN
        ALTER TABLE coach_actions ADD CONSTRAINT coach_actions_type_check 
        CHECK (type IN ('STRENGTH', 'DIET', 'CARDIO', 'HABIT'));
    END IF;
END $$;

-- 添加注释
COMMENT ON COLUMN coach_actions.type IS '项目类型: STRENGTH(力量), DIET(饮食), CARDIO(有氧), HABIT(习惯)';
COMMENT ON COLUMN coach_actions.item_schema IS '类型特定的默认配置 JSON';
COMMENT ON COLUMN coach_actions.suggested_time IS '建议执行时间，如 08:00';

-- 2. student_actions 表扩展
ALTER TABLE student_actions ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'STRENGTH';
ALTER TABLE student_actions ADD COLUMN IF NOT EXISTS item_schema JSONB;
ALTER TABLE student_actions ADD COLUMN IF NOT EXISTS suggested_time TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'student_actions_type_check'
    ) THEN
        ALTER TABLE student_actions ADD CONSTRAINT student_actions_type_check 
        CHECK (type IN ('STRENGTH', 'DIET', 'CARDIO', 'HABIT'));
    END IF;
END $$;

COMMENT ON COLUMN student_actions.type IS '项目类型: STRENGTH(力量), DIET(饮食), CARDIO(有氧), HABIT(习惯)';
COMMENT ON COLUMN student_actions.item_schema IS '类型特定的默认配置 JSON';
COMMENT ON COLUMN student_actions.suggested_time IS '建议执行时间，如 08:00';

-- 3. 创建索引以支持按类型查询
CREATE INDEX IF NOT EXISTS idx_coach_actions_type ON coach_actions(type);
CREATE INDEX IF NOT EXISTS idx_student_actions_type ON student_actions(type);

SELECT 'Polymorphic action types migration completed!' AS status;
