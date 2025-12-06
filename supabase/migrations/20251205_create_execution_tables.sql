-- Migration: Create training execution tables
-- Created: 2025-12-05

-- 1. Plan Instance Executions (主训练执行表)
CREATE TABLE IF NOT EXISTS plan_instance_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relations
    instance_id UUID NOT NULL REFERENCES coach_plan_instances(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Training Day Identification
    day_index INT NOT NULL CHECK (day_index >= 1),
    
    -- Execution Timing
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'completed', 'abandoned', 'paused')),
    
    -- Execution Data (JSONB)
    -- Structure: [{action_id, action_name, sets: [{set_number, status, actual_weight, actual_reps, ...}]}]
    action_executions JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Summary Statistics (denormalized for performance)
    total_sets INT NOT NULL DEFAULT 0,
    completed_sets INT NOT NULL DEFAULT 0,
    progress_percent DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN total_sets > 0 
        THEN (completed_sets::decimal / total_sets * 100) 
        ELSE 0 END
    ) STORED,
    
    -- Session Notes (整体训练备注)
    session_notes TEXT,
    
    -- Auto-save Tracking
    last_saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for plan_instance_executions
CREATE INDEX idx_exec_instance_day ON plan_instance_executions(instance_id, day_index);
CREATE INDEX idx_exec_student ON plan_instance_executions(student_id);
CREATE INDEX idx_exec_date ON plan_instance_executions(started_at DESC);
CREATE INDEX idx_exec_status ON plan_instance_executions(status) WHERE status != 'completed';
CREATE INDEX idx_exec_lookup ON plan_instance_executions(student_id, instance_id, day_index, started_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_plan_instance_executions_updated_at
    BEFORE UPDATE ON plan_instance_executions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 2. Execution Set Videos (组视频表)
CREATE TABLE IF NOT EXISTS execution_set_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relations
    execution_id UUID NOT NULL REFERENCES plan_instance_executions(id) ON DELETE CASCADE,
    
    -- Set Identification
    action_id UUID NOT NULL,
    set_number INT NOT NULL CHECK (set_number >= 1),
    
    -- Video Data
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration_seconds INT,
    file_size_bytes BIGINT,
    
    -- Supabase Storage Info
    storage_path TEXT NOT NULL,
    storage_bucket TEXT DEFAULT 'videos',
    
    -- Upload Status
    upload_status TEXT DEFAULT 'uploaded'
        CHECK (upload_status IN ('uploading', 'uploaded', 'failed')),
    
    -- Coach Feedback (future feature)
    coach_feedback TEXT,
    coach_rating INT CHECK (coach_rating >= 1 AND coach_rating <= 5),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(id),
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Unique constraint: one video per set
    UNIQUE(execution_id, action_id, set_number)
);

-- Indexes for execution_set_videos
CREATE INDEX idx_set_videos_execution ON execution_set_videos(execution_id);
CREATE INDEX idx_set_videos_action ON execution_set_videos(action_id);
CREATE INDEX idx_set_videos_created ON execution_set_videos(created_at DESC);

-- 3. Personal Records History (PR历史表 - 替代旧 personal_records)
CREATE TABLE IF NOT EXISTS personal_records_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Exercise Info
    action_id UUID, -- 可关联 coach_actions
    exercise_name VARCHAR(200) NOT NULL,
    
    -- PR Data
    max_weight NUMERIC(6,2), -- kg
    max_reps INT,
    load_formula VARCHAR(50), -- e.g., "60kg × 10次 @ RPE 8"
    
    -- Context
    execution_id UUID REFERENCES plan_instance_executions(id) ON DELETE SET NULL,
    execution_set_number INT,
    date_achieved DATE NOT NULL,
    notes TEXT,
    
    -- Verification (future feature)
    video_url TEXT,
    is_verified BOOLEAN DEFAULT false,
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for personal_records_history
CREATE INDEX idx_pr_user_exercise ON personal_records_history(user_id, exercise_name);
CREATE INDEX idx_pr_user_date ON personal_records_history(user_id, date_achieved DESC);
CREATE INDEX idx_pr_exercise ON personal_records_history(exercise_name);
CREATE INDEX idx_pr_execution ON personal_records_history(execution_id) WHERE execution_id IS NOT NULL;

-- Comments
COMMENT ON TABLE plan_instance_executions IS '训练计划实例执行记录 - 每次训练一条记录';
COMMENT ON TABLE execution_set_videos IS '训练组视频 - 每组一个视频';
COMMENT ON TABLE personal_records_history IS 'PR历史记录 - 替代旧的 personal_records 表';

COMMENT ON COLUMN plan_instance_executions.action_executions IS 'JSONB结构存储所有动作和组的执行数据';
COMMENT ON COLUMN plan_instance_executions.session_notes IS '整体训练备注';
COMMENT ON COLUMN execution_set_videos.storage_path IS 'Supabase Storage 中的文件路径';
COMMENT ON COLUMN personal_records_history.load_formula IS '计算公式，如 "60kg × 10次 @ RPE 8"';
