-- =====================================================
-- 教练计划系统核心表
-- 包含: coach_plan_templates, coach_plan_template_tags, coach_plan_instances
-- 这些表在生产环境存在但缺失迁移文件
-- =====================================================

-- 1. coach_plan_templates（核心模板库表）
CREATE TABLE IF NOT EXISTS coach_plan_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  type text NOT NULL,
  rest_days_count smallint,
  tags text[],
  suitable_for text,
  training_days jsonb[],
  training_days_count smallint,
  week_days int2[],
  contained_options text[],
  global_answers jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_coach_plan_templates_coach_id ON coach_plan_templates(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_plan_templates_type ON coach_plan_templates(type);

-- 2. coach_plan_template_tags（模板标签表）
CREATE TABLE IF NOT EXISTS coach_plan_template_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES coach_plan_templates(id) ON DELETE CASCADE,
  tag_name text NOT NULL,
  tag_value text,
  created_at timestamptz DEFAULT now()
);

-- 3. coach_plan_instances（计划实例表）
CREATE TABLE IF NOT EXISTS coach_plan_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_plan_template_id uuid REFERENCES coach_plan_templates(id) ON DELETE SET NULL,
  student_id uuid REFERENCES users(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES coaches(id) ON DELETE SET NULL,
  coach_subscription_id uuid REFERENCES coach_subscriptions(id) ON DELETE SET NULL,
  name varchar NOT NULL,
  description text,
  training_days jsonb NOT NULL,
  status varchar DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  start_date date,
  end_date date,
  start_execution_day integer DEFAULT 1,
  source text DEFAULT 'coach' CHECK (source IN ('coach', 'self')),
  type text,
  tags text[],
  suitable_for text,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_plan_instances_template ON coach_plan_instances(coach_plan_template_id);
CREATE INDEX IF NOT EXISTS idx_plan_instances_student ON coach_plan_instances(student_id);
CREATE INDEX IF NOT EXISTS idx_plan_instances_coach ON coach_plan_instances(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_plan_instances_start_execution_day ON coach_plan_instances(start_execution_day);

SELECT 'coach_plan_templates and coach_plan_instances tables created!' AS status;
