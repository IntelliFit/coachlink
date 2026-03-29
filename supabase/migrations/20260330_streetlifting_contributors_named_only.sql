-- ============================================================================
-- 修复：贡献榜不再统计无署名历史数据，并优先显示 user_profiles 中的真实昵称
-- 1) 排除 contributor_user_id / user_contact / contributor_name_snapshot 都为空的历史点位
-- 2) 已登录用户优先使用 user_profiles.nickname / full_name 作为展示名
-- ============================================================================

DELETE FROM public.streetlifting_location_contributors;

WITH source AS (
  SELECT
    CASE
      WHEN contributor_user_id IS NOT NULL THEN 'user:' || contributor_user_id::TEXT
      WHEN NULLIF(BTRIM(COALESCE(user_contact, '')), '') IS NOT NULL THEN 'contact:' || LOWER(BTRIM(user_contact))
      WHEN NULLIF(BTRIM(COALESCE(contributor_name_snapshot, '')), '') IS NOT NULL THEN 'contact:' || LOWER(BTRIM(contributor_name_snapshot))
      ELSE NULL
    END AS contributor_key,
    contributor_user_id,
    COALESCE(
      NULLIF(BTRIM(up.nickname), ''),
      NULLIF(BTRIM(up.full_name), ''),
      NULLIF(BTRIM(loc.contributor_name_snapshot), ''),
      NULLIF(BTRIM(loc.user_contact), '')
    ) AS display_name,
    loc.created_at,
    (
      1
      + CASE
          WHEN CHAR_LENGTH(BTRIM(COALESCE(loc.description, ''))) >= 24 THEN 3
          WHEN CHAR_LENGTH(BTRIM(COALESCE(loc.description, ''))) >= 8 THEN 2
          WHEN CHAR_LENGTH(BTRIM(COALESCE(loc.description, ''))) > 0 THEN 1
          ELSE 0
        END
      + CASE WHEN NULLIF(BTRIM(COALESCE(loc.address, '')), '') IS NOT NULL THEN 2 ELSE 0 END
      + CASE WHEN NULLIF(BTRIM(COALESCE(loc.province, '')), '') IS NOT NULL THEN 1 ELSE 0 END
      + CASE WHEN NULLIF(BTRIM(COALESCE(loc.city, '')), '') IS NOT NULL THEN 1 ELSE 0 END
      + CASE WHEN NULLIF(BTRIM(COALESCE(loc.county, '')), '') IS NOT NULL THEN 1 ELSE 0 END
      + CASE WHEN loc.latitude IS NOT NULL AND loc.longitude IS NOT NULL THEN 2 ELSE 0 END
      + LEAST(
          GREATEST(
            COALESCE(cardinality(loc.image_urls), 0),
            CASE WHEN NULLIF(BTRIM(COALESCE(loc.image_url, '')), '') IS NOT NULL THEN 1 ELSE 0 END
          ),
          3
        )
    )::INTEGER AS detail_score,
    GREATEST(
      COALESCE(cardinality(loc.image_urls), 0),
      CASE WHEN NULLIF(BTRIM(COALESCE(loc.image_url, '')), '') IS NOT NULL THEN 1 ELSE 0 END
    )::INTEGER AS image_count
  FROM public.streetlifting_locations loc
  LEFT JOIN public.user_profiles up
    ON up.user_id = loc.contributor_user_id
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
