-- =====================================================
-- 教练评价表和学员评论表
-- 用于学员对教练的评价反馈
-- =====================================================

-- coach_reviews（教练评价表）
CREATE TABLE IF NOT EXISTS coach_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_subscription_id uuid NOT NULL REFERENCES coach_subscriptions(id) ON DELETE CASCADE,
  student_id uuid REFERENCES users(id) ON DELETE SET NULL,
  coach_id uuid REFERENCES coaches(id) ON DELETE SET NULL,
  review_text text,
  media_urls text[],
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_coach_reviews_subscription ON coach_reviews(coach_subscription_id);
CREATE INDEX IF NOT EXISTS idx_coach_reviews_student ON coach_reviews(student_id);
CREATE INDEX IF NOT EXISTS idx_coach_reviews_coach ON coach_reviews(coach_id);

-- student_comments（学员评论表）
CREATE TABLE IF NOT EXISTS student_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid REFERENCES coach_contents(id) ON DELETE CASCADE,
  student_id uuid REFERENCES users(id) ON DELETE SET NULL,
  comment_text text,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_student_comments_content ON student_comments(content_id);
CREATE INDEX IF NOT EXISTS idx_student_comments_student ON student_comments(student_id);

SELECT 'coach_reviews and student_comments tables created!' AS status;
