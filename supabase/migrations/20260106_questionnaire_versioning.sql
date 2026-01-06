-- =====================================================
-- Phase 5: 问卷版本化与回答记录
-- =====================================================

-- 1. 为 coach_questionnaires 增加版本控制字段
ALTER TABLE coach_questionnaires 
ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;

ALTER TABLE coach_questionnaires 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

COMMENT ON COLUMN coach_questionnaires.version IS '问卷版本号，每次教练修改问卷时递增';
COMMENT ON COLUMN coach_questionnaires.is_active IS '是否为当前活跃版本，修改问卷时旧版本设为 false';

-- 2. 更新现有数据（设置默认值）
UPDATE coach_questionnaires 
SET version = 1 
WHERE version IS NULL;

UPDATE coach_questionnaires 
SET is_active = true 
WHERE is_active IS NULL;

-- 3. 创建 questionnaire_responses 表
CREATE TABLE IF NOT EXISTS questionnaire_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES coaches(id) ON DELETE SET NULL,
  questionnaire_id uuid REFERENCES coach_questionnaires(id) ON DELETE SET NULL,
  questionnaire_version integer,
  answers jsonb NOT NULL DEFAULT '{}',
  context text CHECK (context IN ('initial', 'cycle_end', 'manual_update', 'coach_request')),
  plan_instance_id uuid REFERENCES coach_plan_instances(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- 4. 添加索引
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_student 
ON questionnaire_responses(student_id);

CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_coach 
ON questionnaire_responses(coach_id);

CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_created 
ON questionnaire_responses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_questionnaire 
ON questionnaire_responses(questionnaire_id);

-- 5. 添加注释
COMMENT ON TABLE questionnaire_responses IS '学员问卷回答记录表，保存所有历史回答快照';
COMMENT ON COLUMN questionnaire_responses.student_id IS '学员ID';
COMMENT ON COLUMN questionnaire_responses.coach_id IS '教练ID（可为空，系统问卷无教练）';
COMMENT ON COLUMN questionnaire_responses.questionnaire_id IS '问卷ID';
COMMENT ON COLUMN questionnaire_responses.questionnaire_version IS '填写时的问卷版本号';
COMMENT ON COLUMN questionnaire_responses.answers IS '学员的回答内容（JSON格式）';
COMMENT ON COLUMN questionnaire_responses.context IS '填写场景：initial(首次), cycle_end(周期结束), manual_update(手动更新), coach_request(教练要求)';
COMMENT ON COLUMN questionnaire_responses.plan_instance_id IS '关联的计划实例ID（可选）';

SELECT 'Phase 5 Migration: Questionnaire versioning completed successfully' AS result;
