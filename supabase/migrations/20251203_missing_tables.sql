-- =====================================================
-- 缺失表格完整迁移
-- 基于 database.types.ts 中的类型定义创建
-- 包含：coach_applications, coach_pricing, coach_questionnaires,
--       training_items, leaderboard_templates, leaderboard_entries
-- =====================================================

-- 1. coach_applications（教练申请表）
CREATE TABLE IF NOT EXISTS coach_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  title text,
  bio text,
  avatar_url text,
  contact_email text,
  contact_phone text,
  years_experience integer,
  specialties text[],
  achievements text[],
  credentials jsonb[],
  case_studies text[],
  teaching_philosophy text,
  portfolio_url text,
  resume_url text,
  social_links jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id),
  applied_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_applications_user ON coach_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_applications_status ON coach_applications(status);

-- 2. coach_pricing（教练收费套餐表）
CREATE TABLE IF NOT EXISTS coach_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  pricings jsonb NOT NULL DEFAULT '{}',
  products jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_pricing_coach ON coach_pricing(coach_id);

-- 3. coach_questionnaires（教练专属问卷表）
CREATE TABLE IF NOT EXISTS coach_questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  questions jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_questionnaires_coach ON coach_questionnaires(coach_id);

-- 4. training_items（训练项目表）
CREATE TABLE IF NOT EXISTS training_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text
);

CREATE INDEX IF NOT EXISTS idx_training_items_name ON training_items(name);

-- 5. leaderboard_templates（排行榜模板表）
CREATE TABLE IF NOT EXISTS leaderboard_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type text,
  rank_by_field text NOT NULL,
  sort_order text DEFAULT 'desc',
  form_schema jsonb,
  rules jsonb,
  remarks text,
  initiator text,
  creator_id uuid REFERENCES users(id),
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_templates_type ON leaderboard_templates(type);

-- 6. leaderboard_entries（排行榜条目表）
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES leaderboard_templates(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  form_data jsonb NOT NULL DEFAULT '{}',
  score numeric,
  evidence_url text,
  extra_data jsonb,
  note text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_template ON leaderboard_entries(template_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_user ON leaderboard_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_score ON leaderboard_entries(score DESC);

SELECT '6个缺失表已创建！' AS status;
