-- =========================================================
-- Content purchase -> coach wallet credit (idempotent)
-- Created at: 2026-01-30
-- =========================================================

-- 1) Ensure idempotency for wallet transactions by order + type
CREATE UNIQUE INDEX IF NOT EXISTS ux_wallet_transactions_related_order_type
  ON public.wallet_transactions (related_order_id, type)
  WHERE related_order_id IS NOT NULL;

-- 2) Atomic credit function: insert transaction (on conflict do nothing),
--    and only if inserted, update wallet totals.
CREATE OR REPLACE FUNCTION public.credit_coach_wallet(
  p_coach_id uuid,
  p_amount bigint,
  p_related_order_id uuid,
  p_description text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN;
  END IF;

  -- Ensure wallet exists
  INSERT INTO public.coach_wallets (coach_id, balance, total_income, frozen_amount, created_at, updated_at)
  VALUES (p_coach_id, 0, 0, 0, now(), now())
  ON CONFLICT (coach_id) DO NOTHING;

  -- Insert transaction (idempotent on order+type)
  INSERT INTO public.wallet_transactions (wallet_id, amount, type, related_order_id, description, created_at)
  VALUES (p_coach_id, p_amount, 'income', p_related_order_id, p_description, now())
  ON CONFLICT (related_order_id, type) DO NOTHING;

  -- Only update wallet totals if we actually inserted a new transaction
  IF FOUND THEN
    UPDATE public.coach_wallets
    SET balance = balance + p_amount,
        total_income = total_income + p_amount,
        updated_at = now()
    WHERE coach_id = p_coach_id;
  END IF;
END;
$$;


