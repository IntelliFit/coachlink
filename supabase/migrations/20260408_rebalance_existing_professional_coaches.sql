-- Rebalance existing coach tracks:
-- keep a small set as professional, downgrade the rest of the current
-- professional coaches to growth (second level between buddy and professional).

WITH keep_professional(name) AS (
  VALUES
    ('刘三乐'::text),
    ('枭马葛'::text),
    ('四方力量-五花肉'::text),
    ('文武双缺的杰'::text)
),
keep_professional_user_ids(user_id) AS (
  VALUES
    ('e0bdc782-9495-4f1c-b394-c7d2a24b490d'::uuid),
    ('f9eac5b1-45f9-4479-9ab8-8223a5db8835'::uuid),
    ('dc1bf7c5-761b-4d18-a182-fea2cf0d2717'::uuid),
    ('d0bd5ea3-16d8-40c9-898c-80aa0ec2b6e8'::uuid)
),
affected_coaches AS (
  SELECT c.user_id
  FROM public.coaches c
  WHERE c.status = 'approved'
    AND c.coach_track = 'professional'
    AND c.user_id NOT IN (SELECT user_id FROM keep_professional_user_ids)
    AND btrim(c.name) NOT IN (SELECT name FROM keep_professional)
)
UPDATE public.coaches c
SET coach_track = 'growth'
WHERE c.user_id IN (SELECT user_id FROM affected_coaches);

WITH keep_professional(name) AS (
  VALUES
    ('刘三乐'::text),
    ('枭马葛'::text),
    ('四方力量-五花肉'::text),
    ('文武双缺的杰'::text)
),
keep_professional_user_ids(user_id) AS (
  VALUES
    ('e0bdc782-9495-4f1c-b394-c7d2a24b490d'::uuid),
    ('f9eac5b1-45f9-4479-9ab8-8223a5db8835'::uuid),
    ('dc1bf7c5-761b-4d18-a182-fea2cf0d2717'::uuid),
    ('d0bd5ea3-16d8-40c9-898c-80aa0ec2b6e8'::uuid)
),
affected_applications AS (
  SELECT ca.user_id
  FROM public.coach_applications ca
  WHERE ca.status = 'approved'
    AND ca.coach_track = 'professional'
    AND ca.user_id NOT IN (SELECT user_id FROM keep_professional_user_ids)
    AND btrim(ca.name) NOT IN (SELECT name FROM keep_professional)
)
UPDATE public.coach_applications ca
SET coach_track = 'growth'
WHERE ca.user_id IN (SELECT user_id FROM affected_applications)
  AND ca.status = 'approved';
