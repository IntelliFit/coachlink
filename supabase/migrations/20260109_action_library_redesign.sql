-- =====================================================
-- 动作库重构迁移脚本
-- 创建日期: 2026-01-09
-- 功能: 
--   1. 创建公共动作库表 canonical_actions
--   2. 给 coach_actions 加 canonical_action_id
--   3. 给 student_actions 加缺失字段
--   4. 给 personal_records_history 加来源字段
-- =====================================================

-- 1. 创建公共动作库表
CREATE TABLE IF NOT EXISTS canonical_actions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    aliases TEXT[] DEFAULT '{}',
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_canonical_actions_name 
    ON canonical_actions USING GIN (to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_canonical_actions_aliases 
    ON canonical_actions USING GIN (aliases);

COMMENT ON TABLE canonical_actions IS '公共动作库：平台维护的标准动作字典';
COMMENT ON COLUMN canonical_actions.id IS '动作ID，如 squat_low_bar';
COMMENT ON COLUMN canonical_actions.name IS '标准名称，如 低杠深蹲';
COMMENT ON COLUMN canonical_actions.aliases IS '别名数组，如 ["竞技深蹲", "Low Bar Squat"]';
COMMENT ON COLUMN canonical_actions.category IS '分类：下肢、推、拉、核心等';

-- 2. 给 coach_actions 加公共动作关联字段
ALTER TABLE coach_actions 
ADD COLUMN IF NOT EXISTS canonical_action_id TEXT REFERENCES canonical_actions(id);

CREATE INDEX IF NOT EXISTS idx_coach_actions_canonical 
    ON coach_actions(canonical_action_id);

COMMENT ON COLUMN coach_actions.canonical_action_id IS '关联的公共动作ID（可选）';

-- 3. 给 student_actions 加缺失字段
ALTER TABLE student_actions 
ADD COLUMN IF NOT EXISTS canonical_action_id TEXT REFERENCES canonical_actions(id);

ALTER TABLE student_actions 
ADD COLUMN IF NOT EXISTS "enableAutoWeightCompute" BOOLEAN DEFAULT false;

ALTER TABLE student_actions 
ADD COLUMN IF NOT EXISTS "includesBodyWeight" BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_student_actions_canonical 
    ON student_actions(canonical_action_id);

COMMENT ON COLUMN student_actions.canonical_action_id IS '关联的公共动作ID（可选）';
COMMENT ON COLUMN student_actions."enableAutoWeightCompute" IS '是否启用自动重量计算';
COMMENT ON COLUMN student_actions."includesBodyWeight" IS '动作是否包含自身体重';

-- 4. 给 personal_records_history 加来源字段（如果表存在）
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'personal_records_history') THEN
        ALTER TABLE personal_records_history 
        ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'coach';
        
        ALTER TABLE personal_records_history 
        ADD COLUMN IF NOT EXISTS source_coach_id UUID;
        
        CREATE INDEX IF NOT EXISTS idx_prh_source 
            ON personal_records_history(source_type, source_coach_id);
            
        COMMENT ON COLUMN personal_records_history.source_type IS '来源类型：coach=教练计划, self=自主训练';
        COMMENT ON COLUMN personal_records_history.source_coach_id IS '归属教练ID（自主训练为NULL）';
    END IF;
END $$;

-- 5. 导入种子数据
INSERT INTO canonical_actions (id, name, aliases, category) VALUES
    ('squat_low_bar', '低杠深蹲', ARRAY['竞技深蹲', 'Low Bar Squat', '力量举深蹲'], '下肢'),
    ('squat_high_bar', '高杠深蹲', ARRAY['健美深蹲', 'High Bar Squat', '奥林匹克深蹲'], '下肢'),
    ('squat_front', '前蹲', ARRAY['Front Squat', '颈前深蹲'], '下肢'),
    ('bench_press', '卧推', ARRAY['平板卧推', 'Bench Press', 'Flat Bench'], '推'),
    ('bench_press_incline', '上斜卧推', ARRAY['Incline Bench Press', '斜板卧推'], '推'),
    ('bench_press_decline', '下斜卧推', ARRAY['Decline Bench Press'], '推'),
    ('deadlift_conventional', '传统硬拉', ARRAY['硬拉', 'Conventional Deadlift', 'Deadlift'], '拉'),
    ('deadlift_sumo', '相扑硬拉', ARRAY['Sumo Deadlift', '宽站硬拉'], '拉'),
    ('deadlift_romanian', '罗马尼亚硬拉', ARRAY['RDL', 'Romanian Deadlift', '直腿硬拉'], '拉'),
    ('pullup_weighted', '负重引体向上', ARRAY['负重引体', 'Weighted Pull-up', '加重引体'], '拉'),
    ('pullup_bodyweight', '引体向上', ARRAY['Pull-up', '正手引体'], '拉'),
    ('chinup', '反手引体', ARRAY['Chin-up', '反握引体'], '拉'),
    ('row_barbell', '杠铃划船', ARRAY['Barbell Row', '俯身划船'], '拉'),
    ('ohp', '站姿推举', ARRAY['肩推', 'Overhead Press', 'OHP', 'Military Press'], '推'),
    ('dip_weighted', '负重双杠臂屈伸', ARRAY['Weighted Dips', '负重臂屈伸'], '推'),
    ('hip_thrust', '臀推', ARRAY['Hip Thrust', '臀桥'], '下肢'),
    ('leg_press', '腿举', ARRAY['Leg Press', '倒蹬'], '下肢'),
    ('lunge', '弓步蹲', ARRAY['Lunge', '箭步蹲'], '下肢'),
    ('leg_curl', '腿弯举', ARRAY['Leg Curl', '俯卧腿弯举'], '下肢'),
    ('leg_extension', '腿屈伸', ARRAY['Leg Extension', '坐姿腿屈伸'], '下肢')
ON CONFLICT (id) DO NOTHING;

SELECT 'Action library migration completed!' AS status;
