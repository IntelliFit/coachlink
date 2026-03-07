-- 学员训练反馈表：每次训练完成后学员可以写一条反馈给教练
CREATE TABLE execution_feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES plan_instance_executions(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES coach_plan_instances(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES users(id),
  day_index integer NOT NULL CHECK (day_index >= 1),
  content text NOT NULL CHECK (char_length(content) <= 500),
  difficulty_rating smallint CHECK (difficulty_rating >= 1 AND difficulty_rating <= 5),
  coach_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 索引：按实例查反馈（教练视角）
CREATE INDEX idx_execution_feedbacks_instance ON execution_feedbacks(instance_id, created_at DESC);
-- 索引：按执行查反馈（去重判断）
CREATE INDEX idx_execution_feedbacks_execution ON execution_feedbacks(execution_id);
-- 索引：按学员查
CREATE INDEX idx_execution_feedbacks_student ON execution_feedbacks(student_id);

COMMENT ON TABLE execution_feedbacks IS '学员训练执行反馈，训练完成后写给教练的简短反馈';
COMMENT ON COLUMN execution_feedbacks.content IS '反馈内容，最长500字';
COMMENT ON COLUMN execution_feedbacks.difficulty_rating IS '难度评分1-5（1=太简单 5=太难）';
COMMENT ON COLUMN execution_feedbacks.coach_read_at IS '教练阅读时间，NULL=未读';

