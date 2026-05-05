-- Backfill legacy coach subscription wallet income that was credited at 100%
-- before Huifu split settlement was introduced.
--
-- Scope:
-- - only income wallet_transactions linked to coach subscription orders
-- - only rows whose amount still equals the source order total
-- - only rows with platform_fee missing/zero
--
-- Result:
-- - wallet_transactions.amount becomes coach net income (80%)
-- - wallet_transactions.platform_fee becomes platform share (20%)
-- - matching refund rows are reduced to the coach net amount
-- - coach_wallets are recomputed from wallet_transactions

BEGIN;

CREATE TABLE IF NOT EXISTS public.wallet_split_backfill_adjustments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_transaction_id uuid NOT NULL UNIQUE REFERENCES public.wallet_transactions(id) ON DELETE CASCADE,
    alipay_order_id text NOT NULL,
    coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
    original_amount bigint NOT NULL,
    adjusted_amount bigint NOT NULL,
    platform_fee bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.wallet_split_backfill_adjustments
IS 'Audit log for legacy coach subscription wallet income adjusted from 100% gross to 80/20 split.';

WITH legacy_income AS (
    SELECT
        wt.id AS wallet_transaction_id,
        wt.alipay_order_id,
        wt.wallet_id AS coach_id,
        wt.amount AS original_amount,
        (wt.amount - floor((wt.amount * 20)::numeric / 100)::bigint) AS adjusted_amount,
        floor((wt.amount * 20)::numeric / 100)::bigint AS platform_fee
    FROM public.wallet_transactions wt
    JOIN public.alipay_orders ao ON ao.id::text = wt.alipay_order_id::text
    WHERE wt.type = 'income'
      AND wt.alipay_order_id IS NOT NULL
      AND ao.order_type IN ('subscription', 'subscription_renew', 'coach_subscription', 'coach_subscription_renew')
      AND COALESCE(wt.platform_fee, 0) = 0
      AND wt.amount = ao.total_amount
      AND wt.amount > 0
      AND NOT EXISTS (
          SELECT 1
          FROM public.wallet_split_backfill_adjustments existing
          WHERE existing.wallet_transaction_id = wt.id
      )
),
inserted AS (
    INSERT INTO public.wallet_split_backfill_adjustments (
        wallet_transaction_id,
        alipay_order_id,
        coach_id,
        original_amount,
        adjusted_amount,
        platform_fee
    )
    SELECT
        wallet_transaction_id,
        alipay_order_id,
        coach_id,
        original_amount,
        adjusted_amount,
        platform_fee
    FROM legacy_income
    RETURNING wallet_transaction_id, alipay_order_id, adjusted_amount, platform_fee
)
UPDATE public.wallet_transactions wt
SET
    amount = inserted.adjusted_amount,
    platform_fee = inserted.platform_fee
FROM inserted
WHERE wt.id = inserted.wallet_transaction_id;

-- Refund rows store a positive amount but are subtracted from wallet balance by
-- application semantics. Keep historical refunds aligned with the corrected
-- coach net income instead of the gross order amount.
UPDATE public.wallet_transactions refund
SET amount = adj.adjusted_amount
FROM public.wallet_split_backfill_adjustments adj
WHERE refund.type = 'refund'
  AND refund.alipay_order_id::text = adj.alipay_order_id::text
  AND refund.wallet_id = adj.coach_id
  AND refund.amount = adj.original_amount;

-- Backfill platform revenue records for historical orders when missing.
INSERT INTO public.platform_revenue (
    source_order_id,
    order_type,
    amount,
    coach_id,
    created_at
)
SELECT
    adj.alipay_order_id,
    COALESCE(ao.order_type, 'coach_subscription'),
    adj.platform_fee,
    adj.coach_id,
    adj.created_at
FROM public.wallet_split_backfill_adjustments adj
LEFT JOIN public.alipay_orders ao ON ao.id::text = adj.alipay_order_id::text
ON CONFLICT (source_order_id) DO NOTHING;

-- Recompute wallet balances from the transaction ledger.
WITH wallet_totals AS (
    SELECT
        wallet_id AS coach_id,
        COALESCE(SUM(
            CASE
                WHEN type = 'income' THEN amount
                WHEN type IN ('withdrawal', 'refund') THEN -ABS(amount)
                ELSE 0
            END
        ), 0)::bigint AS balance,
        COALESCE(SUM(
            CASE WHEN type = 'income' THEN amount ELSE 0 END
        ), 0)::bigint AS total_income
    FROM public.wallet_transactions
    WHERE wallet_id IS NOT NULL
    GROUP BY wallet_id
)
UPDATE public.coach_wallets wallet
SET
    balance = wallet_totals.balance,
    total_income = wallet_totals.total_income,
    updated_at = now()
FROM wallet_totals
WHERE wallet.coach_id = wallet_totals.coach_id;

-- Wallets with no transactions should not keep stale balances.
UPDATE public.coach_wallets wallet
SET
    balance = 0,
    total_income = 0,
    updated_at = now()
WHERE NOT EXISTS (
    SELECT 1
    FROM public.wallet_transactions wt
    WHERE wt.wallet_id = wallet.coach_id
);

COMMIT;
