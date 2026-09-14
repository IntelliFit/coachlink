BEGIN;

-- Resolve every active two-person room to real users.id values. Historical
-- mini-program builds sometimes stored coaches.id as the second member.
CREATE TEMP TABLE _chat_room_member_map ON COMMIT DROP AS
SELECT
  r.id AS room_id,
  r.members AS original_members,
  r.members[1] AS original_member_1,
  r.members[2] AS original_member_2,
  COALESCE(user_1.id, coach_user_1.id) AS mapped_member_1,
  COALESCE(user_2.id, coach_user_2.id) AS mapped_member_2,
  (user_1.id IS NOT NULL AND user_2.id IS NOT NULL) AS originally_valid,
  r.created_at,
  r.updated_at,
  r.type
FROM public.chat_rooms r
LEFT JOIN public.users user_1
  ON user_1.id = r.members[1]
LEFT JOIN public.coaches coach_1
  ON user_1.id IS NULL
 AND coach_1.id = r.members[1]
LEFT JOIN public.users coach_user_1
  ON coach_user_1.id = coach_1.user_id
LEFT JOIN public.users user_2
  ON user_2.id = r.members[2]
LEFT JOIN public.coaches coach_2
  ON user_2.id IS NULL
 AND coach_2.id = r.members[2]
LEFT JOIN public.users coach_user_2
  ON coach_user_2.id = coach_2.user_id
WHERE COALESCE(r.is_archived, false) = false
  AND cardinality(r.members) = 2;

-- Unknown or self-referencing rooms with messages require manual review. The
-- migration must fail rather than silently lose or redirect their content.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM _chat_room_member_map member_map
    WHERE (
        member_map.mapped_member_1 IS NULL
        OR member_map.mapped_member_2 IS NULL
        OR member_map.mapped_member_1 = member_map.mapped_member_2
      )
      AND EXISTS (
        SELECT 1
        FROM public.chat_messages message
        WHERE message.room_id = member_map.room_id
      )
  ) THEN
    RAISE EXCEPTION 'Cannot automatically repair an active chat room with messages and unresolved members';
  END IF;
END;
$$;

-- Empty unresolved rooms have no user-visible history. Archive them so they no
-- longer render as "未知用户" and cannot receive new messages.
UPDATE public.chat_rooms room
SET
  is_archived = true,
  unread_members = '{}'::uuid[],
  updated_at = now()
FROM _chat_room_member_map member_map
WHERE room.id = member_map.room_id
  AND (
    member_map.mapped_member_1 IS NULL
    OR member_map.mapped_member_2 IS NULL
    OR member_map.mapped_member_1 = member_map.mapped_member_2
  );

DELETE FROM public.chat_room_unreads unread
USING _chat_room_member_map member_map
WHERE unread.room_id = member_map.room_id
  AND (
    member_map.mapped_member_1 IS NULL
    OR member_map.mapped_member_2 IS NULL
    OR member_map.mapped_member_1 = member_map.mapped_member_2
  );

-- Build one canonical target for every unordered pair. Prefer an existing
-- active room that already used users.id, then the room with most history.
CREATE TEMP TABLE _chat_room_merge_plan ON COMMIT DROP AS
WITH repairable AS (
  SELECT
    member_map.*,
    LEAST(member_map.mapped_member_1, member_map.mapped_member_2) AS member_a,
    GREATEST(member_map.mapped_member_1, member_map.mapped_member_2) AS member_b,
    (
      SELECT count(*)::integer
      FROM public.chat_messages message
      WHERE message.room_id = member_map.room_id
    ) AS message_count
  FROM _chat_room_member_map member_map
  WHERE member_map.mapped_member_1 IS NOT NULL
    AND member_map.mapped_member_2 IS NOT NULL
    AND member_map.mapped_member_1 <> member_map.mapped_member_2
), annotated AS (
  SELECT
    repairable.*,
    count(*) OVER (
      PARTITION BY repairable.member_a, repairable.member_b
    ) AS pair_room_count
  FROM repairable
), affected AS (
  SELECT *
  FROM annotated
  WHERE pair_room_count > 1
     OR originally_valid = false
), ranked AS (
  SELECT
    affected.*,
    first_value(affected.room_id) OVER (
      PARTITION BY affected.member_a, affected.member_b
      ORDER BY
        affected.originally_valid DESC,
        affected.message_count DESC,
        affected.created_at ASC,
        affected.room_id ASC
    ) AS target_room_id
  FROM affected
)
SELECT * FROM ranked;

-- Snapshot unread state before moving messages or deleting duplicate rows.
CREATE TEMP TABLE _chat_room_merged_unreads ON COMMIT DROP AS
WITH mapped_unreads AS (
  SELECT
    plan.target_room_id,
    CASE
      WHEN unread.user_id = plan.original_member_1 THEN plan.mapped_member_1
      WHEN unread.user_id = plan.original_member_2 THEN plan.mapped_member_2
      ELSE NULL
    END AS user_id,
    unread.unread_count,
    unread.last_read_at
  FROM _chat_room_merge_plan plan
  JOIN public.chat_room_unreads unread
    ON unread.room_id = plan.room_id
)
SELECT
  target_room_id,
  user_id,
  sum(unread_count)::integer AS unread_count,
  max(last_read_at) AS last_read_at
FROM mapped_unreads
WHERE user_id IS NOT NULL
GROUP BY target_room_id, user_id;

-- Preserve the latest list preview across every room being merged.
CREATE TEMP TABLE _chat_room_latest_state ON COMMIT DROP AS
SELECT DISTINCT ON (plan.target_room_id)
  plan.target_room_id,
  room.last_message,
  room.last_message_at,
  room.updated_at
FROM _chat_room_merge_plan plan
JOIN public.chat_rooms room
  ON room.id = plan.room_id
ORDER BY
  plan.target_room_id,
  room.last_message_at DESC NULLS LAST,
  room.updated_at DESC NULLS LAST,
  room.id ASC;

-- Message IDs, timestamps, media references, replies, and read flags remain
-- unchanged; only the room foreign key moves to the canonical room.
UPDATE public.chat_messages message
SET room_id = plan.target_room_id
FROM _chat_room_merge_plan plan
WHERE message.room_id = plan.room_id
  AND plan.room_id <> plan.target_room_id;

DELETE FROM public.chat_room_unreads unread
USING _chat_room_merge_plan plan
WHERE unread.room_id = plan.room_id;

-- Normalize the canonical room and retain the latest preview.
UPDATE public.chat_rooms room
SET
  members = ARRAY[target.member_a, target.member_b]::uuid[],
  type = 'private',
  is_archived = false,
  last_message = latest.last_message,
  last_message_at = latest.last_message_at,
  updated_at = COALESCE(latest.updated_at, room.updated_at)
FROM (
  SELECT DISTINCT target_room_id, member_a, member_b
  FROM _chat_room_merge_plan
) target
LEFT JOIN _chat_room_latest_state latest
  ON latest.target_room_id = target.target_room_id
WHERE room.id = target.target_room_id;

-- Keep duplicate room IDs as auditable redirects. They no longer contain
-- messages and are excluded from normal room lists.
UPDATE public.chat_rooms room
SET
  is_archived = true,
  unread_members = '{}'::uuid[],
  updated_at = now()
FROM _chat_room_merge_plan plan
WHERE room.id = plan.room_id
  AND plan.room_id <> plan.target_room_id;

WITH target_members AS (
  SELECT DISTINCT
    plan.target_room_id,
    unnest(ARRAY[plan.member_a, plan.member_b]::uuid[]) AS user_id
  FROM _chat_room_merge_plan plan
)
INSERT INTO public.chat_room_unreads (room_id, user_id, unread_count, last_read_at)
SELECT
  target.target_room_id,
  target.user_id,
  COALESCE(merged.unread_count, 0),
  merged.last_read_at
FROM target_members target
LEFT JOIN _chat_room_merged_unreads merged
  ON merged.target_room_id = target.target_room_id
 AND merged.user_id = target.user_id
ON CONFLICT (room_id, user_id) DO UPDATE
SET
  unread_count = EXCLUDED.unread_count,
  last_read_at = EXCLUDED.last_read_at;

UPDATE public.chat_rooms room
SET unread_members = COALESCE(unread_state.unread_members, '{}'::uuid[])
FROM (
  SELECT
    plan.target_room_id,
    array_agg(unread.user_id ORDER BY unread.user_id)
      FILTER (WHERE unread.unread_count > 0) AS unread_members
  FROM (
    SELECT DISTINCT target_room_id
    FROM _chat_room_merge_plan
  ) plan
  LEFT JOIN public.chat_room_unreads unread
    ON unread.room_id = plan.target_room_id
  GROUP BY plan.target_room_id
) unread_state
WHERE room.id = unread_state.target_room_id;

-- Database-level protection: active rooms may only reference real users.
CREATE OR REPLACE FUNCTION public.validate_chat_room_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_count integer;
  distinct_member_count integer;
  existing_user_count integer;
BEGIN
  IF COALESCE(NEW.is_archived, false) THEN
    RETURN NEW;
  END IF;

  member_count := cardinality(NEW.members);
  IF NEW.members IS NULL OR member_count < 2 THEN
    RAISE EXCEPTION 'chat room must contain at least two members';
  END IF;

  IF COALESCE(NEW.type, 'private') = 'private' AND member_count <> 2 THEN
    RAISE EXCEPTION 'private chat room must contain exactly two members';
  END IF;

  SELECT
    count(DISTINCT member_id),
    count(app_user.id)
  INTO distinct_member_count, existing_user_count
  FROM unnest(NEW.members) AS member_id
  LEFT JOIN public.users app_user
    ON app_user.id = member_id;

  IF distinct_member_count <> member_count THEN
    RAISE EXCEPTION 'chat room members must be unique and non-null';
  END IF;

  IF existing_user_count <> member_count THEN
    RAISE EXCEPTION 'chat room members must reference users.id';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_chat_room_members() FROM PUBLIC;

DROP TRIGGER IF EXISTS trigger_validate_chat_room_members ON public.chat_rooms;
CREATE TRIGGER trigger_validate_chat_room_members
BEFORE INSERT OR UPDATE OF members, is_archived, type
ON public.chat_rooms
FOR EACH ROW
EXECUTE FUNCTION public.validate_chat_room_members();

-- Enforce one active private room per unordered user pair. This also closes
-- the check-then-insert race in both chat creation endpoints.
CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_active_private_member_pair_unique
ON public.chat_rooms (
  LEAST(members[1], members[2]),
  GREATEST(members[1], members[2])
)
WHERE COALESCE(is_archived, false) = false
  AND COALESCE(type, 'private') = 'private'
  AND cardinality(members) = 2;

COMMENT ON FUNCTION public.validate_chat_room_members() IS
  'Ensures active chat-room members are unique users.id values; coaches.id is never a chat member.';

COMMIT;
