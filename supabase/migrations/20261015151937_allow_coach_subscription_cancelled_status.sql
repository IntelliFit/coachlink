-- The cancellation endpoints and clients already use "cancelled". Production
-- still had a legacy active/inactive/waiting-only check, rejecting termination.
-- Retain every previously allowed state and add only the cancellation state.
ALTER TABLE public.coach_subscriptions
  DROP CONSTRAINT coach_subscriptions_status_check;

ALTER TABLE public.coach_subscriptions
  ADD CONSTRAINT coach_subscriptions_status_check
  CHECK (status = ANY (ARRAY['active', 'inactive', 'waiting', 'cancelled']::text[]));
