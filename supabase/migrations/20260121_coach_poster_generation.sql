-- ============================================================================
-- 教练高清海报：后台生成状态表 + Storage bucket（缓存海报图片）
-- ============================================================================
-- 目标：
-- - 后台生成教练邀请高清海报并上传至 Storage
-- - 记录生成状态（queued/generating/ready/failed）、错误信息
-- - 记录 Storage 链接与图像元数据（jsonb）

-- 1) 海报记录表（按 coach_id + poster_type 唯一）
CREATE TABLE IF NOT EXISTS coach_posters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  poster_type TEXT NOT NULL DEFAULT 'invitation_hd',
  status TEXT NOT NULL DEFAULT 'queued',
  image_url TEXT,
  storage_bucket TEXT,
  storage_path TEXT,
  image_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_by UUID,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generation_started_at TIMESTAMPTZ,
  generation_finished_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT coach_posters_status_check CHECK (status IN ('queued', 'generating', 'ready', 'failed')),
  CONSTRAINT coach_posters_unique_coach_type UNIQUE (coach_id, poster_type)
);

CREATE INDEX IF NOT EXISTS idx_coach_posters_coach_id ON coach_posters(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_posters_status ON coach_posters(status);
CREATE INDEX IF NOT EXISTS idx_coach_posters_updated_at ON coach_posters(updated_at);

COMMENT ON TABLE coach_posters IS '教练海报后台生成记录（缓存到 Storage，记录状态与元数据）';
COMMENT ON COLUMN coach_posters.poster_type IS '海报类型：当前用于 invitation_hd（邀请高清海报）';
COMMENT ON COLUMN coach_posters.image_meta IS '图像元数据（jsonb）：如 contentType、bytes、生成来源、模板等';

-- 2) Storage bucket：coach-posters（用于缓存生成后的海报图片，公开读取）
INSERT INTO storage.buckets (id, name, public)
VALUES ('coach-posters', 'coach-posters', true)
ON CONFLICT (id) DO NOTHING;

-- 允许已认证用户上传到 coach-posters bucket（限制在自己的文件夹）
CREATE POLICY "Allow authenticated users to upload coach posters"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'coach-posters'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 允许公开读取（bucket 公开）
CREATE POLICY "Allow public read access to coach posters"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'coach-posters');

-- 允许用户删除自己的海报文件
CREATE POLICY "Allow users to delete own coach posters"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'coach-posters'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

