-- ============================================================================
-- 修复：历史点位无 user_contact / contributor_user_id 时 contributor_key 为 NULL，
-- 导致 streetlifting_location_contributors 全空，与 streetlifting_locations 全量统计不一致。
-- 将无归属行统一归入 legacy:anonymous，与 contributorStats.ts 一致。
-- ============================================================================

DELETE FROM public.streetlifting_location_contributors;

WITH source AS (
  SELECT
    CASE
      WHEN contributor_user_id IS NOT NULL THEN 'user:' || contributor_user_id::TEXT
      WHEN NULLIF(BTRIM(COALESCE(user_contact, '')), '') IS NOT NULL THEN 'contact:' || LOWER(BTRIM(user_contact))
      ELSE 'legacy:anonymous'
    END AS contributor_key,
    contributor_user_id,
    COALESCE(
      NULLIF(BTRIM(contributor_name_snapshot), ''),
      NULLIF(BTRIM(user_contact), ''),
      CASE
        WHEN contributor_user_id IS NULL AND NULLIF(BTRIM(COALESCE(user_contact, '')), '') IS NULL THEN '未署名贡献（历史数据）'
        ELSE '未署名贡献者'
      END
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
  COALESCE((ARRAY_AGG(display_name ORDER BY created_at DESC NULLS LAST))[1], '未署名贡献（历史数据）') AS display_name,
  COUNT(*)::INTEGER AS upload_count,
  COALESCE(SUM(detail_score), 0)::INTEGER AS detail_score_total,
  COALESCE(SUM(image_count), 0)::INTEGER AS image_count_total,
  (COUNT(*)::INTEGER * 12 + COALESCE(SUM(detail_score), 0)::INTEGER) AS contribution_score,
  MAX(created_at) AS last_contributed_at,
  NOW() AS created_at,
  NOW() AS updated_at
FROM source
GROUP BY contributor_key, contributor_user_id;
