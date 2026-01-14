-- Add per-user invited visibility mode override for coach invitation links
-- Purpose: allow a coach to share both "exclusive" and "open" invite posters/links at the same time.

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS invited_visibility_mode VARCHAR(20);

-- Nullable: when null, fall back to coach.invitation_mode at runtime.
ALTER TABLE public.users
ADD CONSTRAINT IF NOT EXISTS check_users_invited_visibility_mode
CHECK (invited_visibility_mode IN ('exclusive', 'open'));

COMMENT ON COLUMN public.users.invited_visibility_mode IS
'Visibility mode chosen at registration via coach invite link (exclusive/open). When null, fall back to coach.invitation_mode.';

