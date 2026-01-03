-- =====================================================
-- 教练动作库表
-- coach_actions - 存储教练定义的训练动作
-- 这是核心表之一，在生产环境存在但缺失迁移文件
-- =====================================================

CREATE TABLE IF NOT EXISTS coach_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  detail text,
  positions text[],
  attrs text[],
  url text,
  "enableAutoWeightCompute" boolean DEFAULT false,
  "includesBodyWeight" boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_coach_actions_coach_id ON coach_actions(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_actions_name ON coach_actions(name);

-- 添加注释
COMMENT ON TABLE coach_actions IS '教练动作库：存储教练定义的可复用训练动作';
COMMENT ON COLUMN coach_actions.coach_id IS '所属教练的用户ID';
COMMENT ON COLUMN coach_actions.name IS '动作名称，如"深蹲"、"硬拉"';
COMMENT ON COLUMN coach_actions.positions IS '动作涉及的身体部位';
COMMENT ON COLUMN coach_actions.attrs IS '动作属性标签';
COMMENT ON COLUMN coach_actions."enableAutoWeightCompute" IS '是否启用自动重量计算';
COMMENT ON COLUMN coach_actions."includesBodyWeight" IS '动作是否包含自身体重（如引体向上）';

SELECT 'coach_actions table created!' AS status;
