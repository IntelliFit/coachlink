-- Redesign subscription payment confirmation:
-- - Distinguish platform payment (auto-confirm) vs personal QR/offline (coach manual confirm)
-- - Add coach notification tracking for system-confirmed subscriptions

ALTER TABLE public.coach_subscriptions
ADD COLUMN IF NOT EXISTS payment_method text,
ADD COLUMN IF NOT EXISTS payment_confirmed_by text,
ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz,
ADD COLUMN IF NOT EXISTS coach_seen_at timestamptz,
ADD COLUMN IF NOT EXISTS last_payment_order_id text,
ADD COLUMN IF NOT EXISTS payment_data jsonb DEFAULT '{}'::jsonb;

-- Optional: basic consistency (best-effort, not enforced as CHECK to avoid breaking existing data)
CREATE INDEX IF NOT EXISTS idx_coach_subscriptions_payment_confirmed_unseen
  ON public.coach_subscriptions (coach_id, coach_seen_at)
  WHERE payment_confirmed_by = 'system' AND coach_seen_at IS NULL;

