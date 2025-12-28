-- Migration: Add fields from training_videos to execution_set_videos
-- Date: 2025-12-28
-- Purpose: Migrate video review system from training_videos to execution_set_videos

-- Add missing columns to execution_set_videos table
ALTER TABLE execution_set_videos
ADD COLUMN IF NOT EXISTS user_notes TEXT,
ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'reviewed', 'not_required')),
ADD COLUMN IF NOT EXISTS requires_review BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS exercise_name TEXT;

-- Add comments for the new columns
COMMENT ON COLUMN execution_set_videos.user_notes IS '用户上传视频时的备注';
COMMENT ON COLUMN execution_set_videos.review_status IS '审阅状态：pending-待审阅, reviewed-已审阅, not_required-无需审阅';
COMMENT ON COLUMN execution_set_videos.requires_review IS '是否需要教练审阅';
COMMENT ON COLUMN execution_set_videos.exercise_name IS '动作名称（冗余字段，便于查询显示）';

-- Create index for review queries
CREATE INDEX IF NOT EXISTS idx_execution_set_videos_review_status 
ON execution_set_videos(review_status) 
WHERE requires_review = TRUE AND review_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_execution_set_videos_requires_review 
ON execution_set_videos(requires_review);

-- Add comment for the table
COMMENT ON TABLE execution_set_videos IS '训练执行组视频表（替代set_videos），关联plan_instance_executions，支持完整的审阅流程';

