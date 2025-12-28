-- 学员自建计划功能数据库迁移
-- 创建日期: 2025-12-29

-- 1. 创建 student_actions 表（学员动作库）
CREATE TABLE IF NOT EXISTS student_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    detail TEXT,
    positions TEXT[],
    attrs TEXT[] DEFAULT ARRAY['组数', '次数', '强度', '休息时间'],
    url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_student_actions_user_id ON student_actions(user_id);

-- 添加注释
COMMENT ON TABLE student_actions IS '学员个人动作库';
COMMENT ON COLUMN student_actions.user_id IS '所属用户ID';
COMMENT ON COLUMN student_actions.name IS '动作名称';
COMMENT ON COLUMN student_actions.detail IS '动作详情说明';
COMMENT ON COLUMN student_actions.positions IS '涉及部位';
COMMENT ON COLUMN student_actions.attrs IS '动作属性列表';
COMMENT ON COLUMN student_actions.url IS '参考视频链接';

-- 2. 创建 student_plan_favorites 表（学员常用计划/模板）
CREATE TABLE IF NOT EXISTS student_plan_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    training_days JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_student_plan_favorites_user_id ON student_plan_favorites(user_id);

-- 添加注释
COMMENT ON TABLE student_plan_favorites IS '学员常用计划（可复用模板）';
COMMENT ON COLUMN student_plan_favorites.user_id IS '所属用户ID';
COMMENT ON COLUMN student_plan_favorites.name IS '计划名称';
COMMENT ON COLUMN student_plan_favorites.description IS '计划描述';
COMMENT ON COLUMN student_plan_favorites.training_days IS '训练日数据（JSON格式）';

-- 3. 修改 coach_plan_instances 表，添加 source 字段
ALTER TABLE coach_plan_instances
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'coach';

COMMENT ON COLUMN coach_plan_instances.source IS '计划来源：coach=教练分配，self=学员自建';

-- 4. 启用 RLS
ALTER TABLE student_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_plan_favorites ENABLE ROW LEVEL SECURITY;

-- 5. 创建 RLS 策略 - student_actions
CREATE POLICY "Users can view own actions" ON student_actions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own actions" ON student_actions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own actions" ON student_actions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own actions" ON student_actions
    FOR DELETE USING (auth.uid() = user_id);

-- 6. 创建 RLS 策略 - student_plan_favorites
CREATE POLICY "Users can view own favorites" ON student_plan_favorites
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites" ON student_plan_favorites
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own favorites" ON student_plan_favorites
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites" ON student_plan_favorites
    FOR DELETE USING (auth.uid() = user_id);
