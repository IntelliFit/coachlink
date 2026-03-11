-- 即兴训练执行表（独立于计划执行链路）
-- 创建日期: 2026-02-15

CREATE TABLE IF NOT EXISTS impromptu_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    action_executions JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_sets INT NOT NULL DEFAULT 0,
    completed_sets INT NOT NULL DEFAULT 0,
    session_notes TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    last_saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_impromptu_executions_student
    ON impromptu_executions(student_id);
CREATE INDEX IF NOT EXISTS idx_impromptu_executions_started_at
    ON impromptu_executions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_impromptu_executions_status
    ON impromptu_executions(status);

CREATE TRIGGER update_impromptu_executions_updated_at
    BEFORE UPDATE ON impromptu_executions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE impromptu_executions IS '即兴训练执行记录（无需计划可直接开始）';
COMMENT ON COLUMN impromptu_executions.action_executions IS '动作与组执行数据（与 plan_instance_executions 结构保持近似）';

