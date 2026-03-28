-- ============================================================================
-- 单杠位置贡献榜：贡献者归属字段 + 聚合排行榜表
-- 目标：
-- 1) 为 streetlifting_locations 增加稳定贡献者标识
-- 2) 建立 streetlifting_location_contributors 聚合表，直接存贡献分
-- 3) 对现有点位数据做一次性回填，避免前端现场扫全表统计
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.streetlifting_locations
  ADD COLUMN IF NOT EXISTS contributor_user_id UUID,
  ADD COLUMN IF NOT EXISTS contributor_name_snapshot TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'streetlifting_locations_contributor_user_id_fkey'
  ) THEN
    ALTER TABLE public.streetlifting_locations
      ADD CONSTRAINT streetlifting_locations_contributor_user_id_fkey
      FOREIGN KEY (contributor_user_id)
      REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_streetlifting_locations_contributor_user_id
  ON public.streetlifting_locations(contributor_user_id);

UPDATE public.streetlifting_locations
SET contributor_name_snapshot = COALESCE(
  NULLIF(BTRIM(contributor_name_snapshot), ''),
  NULLIF(BTRIM(user_contact), '')
)
WHERE contributor_name_snapshot IS NULL
   OR BTRIM(contributor_name_snapshot) = '';

CREATE TABLE IF NOT EXISTS public.streetlifting_location_contributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_key TEXT NOT NULL UNIQUE,
  contributor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  upload_count INTEGER NOT NULL DEFAULT 0,
  detail_score_total INTEGER NOT NULL DEFAULT 0,
  image_count_total INTEGER NOT NULL DEFAULT 0,
  contribution_score INTEGER NOT NULL DEFAULT 0,
  last_contributed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.streetlifting_location_contributors DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_streetlifting_location_contributors_score
  ON public.streetlifting_location_contributors(contribution_score DESC, upload_count DESC);

CREATE INDEX IF NOT EXISTS idx_streetlifting_location_contributors_user_id
  ON public.streetlifting_location_contributors(contributor_user_id);

COMMENT ON TABLE public.streetlifting_location_contributors IS '单杠位置贡献榜聚合表，按贡献者缓存上传次数、详细度和贡献分';
COMMENT ON COLUMN public.streetlifting_location_contributors.contributor_key IS '贡献者唯一键：user:<uuid> 或 contact:<normalized text>';
COMMENT ON COLUMN public.streetlifting_location_contributors.contribution_score IS '综合贡献分：上传次数基础分 + 点位详细度分';

DELETE FROM public.streetlifting_location_contributors;

WITH source AS (
  SELECT
    CASE
      WHEN contributor_user_id IS NOT NULL THEN 'user:' || contributor_user_id::TEXT
      WHEN NULLIF(BTRIM(COALESCE(user_contact, '')), '') IS NOT NULL THEN 'contact:' || LOWER(BTRIM(user_contact))
      ELSE NULL
    END AS contributor_key,
    contributor_user_id,
    COALESCE(
      NULLIF(BTRIM(contributor_name_snapshot), ''),
      NULLIF(BTRIM(user_contact), ''),
      '未署名贡献者'
    ) AS display_name,
    created_at,
    (
      1
      + CASE
          WHEN CHAR_LENGTH(BTRIM(COALESCE(description, ''))) >= 24 THEN 3
          WHEN CHAR_LENGTH(BTRIM(COALESCE(description, ''))) >= 8 THEN 2
          WHEN CHAR_LENGTH(BTRIM(COALESCE(description, ''))) > 0 THEN 1
          ELSE 0
        END
      + CASE WHEN NULLIF(BTRIM(COALESCE(address, '')), '') IS NOT NULL THEN 2 ELSE 0 END
      + CASE WHEN NULLIF(BTRIM(COALESCE(province, '')), '') IS NOT NULL THEN 1 ELSE 0 END
      + CASE WHEN NULLIF(BTRIM(COALESCE(city, '')), '') IS NOT NULL THEN 1 ELSE 0 END
      + CASE WHEN NULLIF(BTRIM(COALESCE(county, '')), '') IS NOT NULL THEN 1 ELSE 0 END
      + CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 2 ELSE 0 END
      + LEAST(
          GREATEST(
            COALESCE(cardinality(image_urls), 0),
            CASE WHEN NULLIF(BTRIM(COALESCE(image_url, '')), '') IS NOT NULL THEN 1 ELSE 0 END
          ),
          3
        )
    )::INTEGER AS detail_score,
    GREATEST(
      COALESCE(cardinality(image_urls), 0),
      CASE WHEN NULLIF(BTRIM(COALESCE(image_url, '')), '') IS NOT NULL THEN 1 ELSE 0 END
    )::INTEGER AS image_count
  FROM public.streetlifting_locations
)
INSERT INTO public.streetlifting_location_contributors (
  contributor_key,
  contributor_user_id,
  display_name,
  upload_count,
  detail_score_total,
  image_count_total,
  contribution_score,
  last_contributed_at,
  created_at,
  updated_at
)
SELECT
  contributor_key,
  contributor_user_id,
  COALESCE((ARRAY_AGG(display_name ORDER BY created_at DESC NULLS LAST))[1], '未署名贡献者') AS display_name,
  COUNT(*)::INTEGER AS upload_count,
  COALESCE(SUM(detail_score), 0)::INTEGER AS detail_score_total,
  COALESCE(SUM(image_count), 0)::INTEGER AS image_count_total,
  (COUNT(*)::INTEGER * 12 + COALESCE(SUM(detail_score), 0)::INTEGER) AS contribution_score,
  MAX(created_at) AS last_contributed_at,
  NOW() AS created_at,
  NOW() AS updated_at
FROM source
WHERE contributor_key IS NOT NULL
GROUP BY contributor_key, contributor_user_id;
