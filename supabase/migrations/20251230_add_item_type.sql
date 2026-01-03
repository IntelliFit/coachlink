-- =====================================================
-- 添加 item 类型支持到 coach_actions 和 student_actions
-- 用于支持饮食、习惯等非力量训练项目
-- =====================================================

-- 1. 为 coach_actions 添加 type 字段
ALTER TABLE coach_actions 
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'STRENGTH';

-- 2. 为 student_actions 添加 type 字段
ALTER TABLE student_actions 
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'STRENGTH';

-- 3. 添加索引以支持按类型筛选
CREATE INDEX IF NOT EXISTS idx_coach_actions_type ON coach_actions(type);
CREATE INDEX IF NOT EXISTS idx_student_actions_type ON student_actions(type);

-- 4. 添加注释
COMMENT ON COLUMN coach_actions.type IS '项目类型: STRENGTH(力量), DIET(饮食), CARDIO(有氧), HABIT(习惯)';
COMMENT ON COLUMN student_actions.type IS '项目类型: STRENGTH(力量), DIET(饮食), CARDIO(有氧), HABIT(习惯)';

SELECT 'Item type columns added to coach_actions and student_actions!' AS status;
