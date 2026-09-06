-- Add per-set video attachments for impromptu training executions.
-- Kept separate from execution_set_videos so the existing plan execution
-- foreign key and unique constraint remain unchanged.

CREATE TABLE IF NOT EXISTS public.impromptu_execution_set_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL
        REFERENCES public.impromptu_executions(id) ON DELETE CASCADE,
    -- Public actions selected for an impromptu session may not yet have a
    -- student_actions UUID. action_index is therefore the stable attachment key.
    action_id UUID,
    action_index INT NOT NULL CHECK (action_index >= 0),
    set_number INT NOT NULL CHECK (set_number >= 1),
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration_seconds INT,
    file_size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (file_size_bytes >= 0),
    storage_path TEXT NOT NULL,
    storage_bucket TEXT NOT NULL DEFAULT 'videos',
    upload_status TEXT NOT NULL DEFAULT 'uploaded'
        CHECK (upload_status IN ('uploading', 'uploaded', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (execution_id, action_index, set_number)
);

CREATE INDEX IF NOT EXISTS idx_impromptu_set_videos_execution
    ON public.impromptu_execution_set_videos(execution_id);
CREATE INDEX IF NOT EXISTS idx_impromptu_set_videos_created
    ON public.impromptu_execution_set_videos(created_at DESC);

DROP TRIGGER IF EXISTS update_impromptu_execution_set_videos_updated_at
    ON public.impromptu_execution_set_videos;
CREATE TRIGGER update_impromptu_execution_set_videos_updated_at
    BEFORE UPDATE ON public.impromptu_execution_set_videos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.impromptu_execution_set_videos ENABLE ROW LEVEL SECURITY;

-- All reads and writes currently pass through authenticated API routes using
-- the service role. Do not grant direct anon/authenticated table access.
REVOKE ALL ON TABLE public.impromptu_execution_set_videos FROM anon, authenticated;
GRANT ALL ON TABLE public.impromptu_execution_set_videos TO service_role;

COMMENT ON TABLE public.impromptu_execution_set_videos IS
    '即兴训练组视频；按 execution + action index + set 唯一关联';
COMMENT ON COLUMN public.impromptu_execution_set_videos.action_index IS
    '动作在即兴训练 action_executions 快照中的零基下标';
COMMENT ON COLUMN public.impromptu_execution_set_videos.action_id IS
    '可选动作 UUID；公共动作尚未复制到个人动作库时允许为空';
COMMENT ON COLUMN public.impromptu_execution_set_videos.storage_path IS
    'COS videos bucket 路径；外链使用 external/ 前缀';
