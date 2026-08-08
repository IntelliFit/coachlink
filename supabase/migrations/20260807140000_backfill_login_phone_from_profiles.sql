BEGIN;

-- Historical imports sometimes wrote the phone only to user_profiles. The
-- authentication authority is users.phone. Backfill only an unambiguous,
-- unclaimed phone; conflicts are intentionally left for verified account merge.
WITH unique_profile_phones AS (
  SELECT trim(phone) AS phone, min(user_id::text)::uuid AS user_id
  FROM public.user_profiles
  WHERE phone IS NOT NULL
    AND trim(phone) ~ '^1[3-9][0-9]{9}$'
  GROUP BY trim(phone)
  HAVING count(*) = 1
), safe_candidates AS (
  SELECT candidate.user_id, candidate.phone
  FROM unique_profile_phones candidate
  JOIN public.users target ON target.id = candidate.user_id
  WHERE target.phone IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.users claimed
      WHERE claimed.phone = candidate.phone
        AND claimed.id <> candidate.user_id
    )
)
UPDATE public.users target
SET phone = candidate.phone,
    updated_at = now()
FROM safe_candidates candidate
WHERE target.id = candidate.user_id
  AND target.phone IS NULL;

COMMIT;
