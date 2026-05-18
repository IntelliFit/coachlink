-- Huifu coach-subscription settlement hardening:
-- 1. keep Huifu-paid coach funds in the platform account during the refund window;
-- 2. track Huifu original-payment refund and balance-payment refund/reversal state;
-- 3. make payment_provider durable on alipay_orders for provider-aware refund/fulfillment.

ALTER TABLE public.alipay_orders
ADD COLUMN IF NOT EXISTS payment_provider text;

ALTER TABLE public.coach_subscription_settlements
ADD COLUMN IF NOT EXISTS eligible_at timestamptz,
ADD COLUMN IF NOT EXISTS refund_req_date text,
ADD COLUMN IF NOT EXISTS refund_req_seq_id text,
ADD COLUMN IF NOT EXISTS refund_huifu_hf_seq_id text,
ADD COLUMN IF NOT EXISTS refund_status text,
ADD COLUMN IF NOT EXISTS refund_error_message text,
ADD COLUMN IF NOT EXISTS refund_completed_at timestamptz,
ADD COLUMN IF NOT EXISTS balance_refund_req_date text,
ADD COLUMN IF NOT EXISTS balance_refund_req_seq_id text,
ADD COLUMN IF NOT EXISTS balance_refund_huifu_hf_seq_id text,
ADD COLUMN IF NOT EXISTS balance_refund_status text,
ADD COLUMN IF NOT EXISTS balance_refund_error_message text,
ADD COLUMN IF NOT EXISTS balance_refund_completed_at timestamptz;

ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS huifu_req_date text,
ADD COLUMN IF NOT EXISTS huifu_req_seq_id text,
ADD COLUMN IF NOT EXISTS huifu_hf_seq_id text,
ADD COLUMN IF NOT EXISTS huifu_trans_stat text,
ADD COLUMN IF NOT EXISTS huifu_error_message text;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'coach_subscription_settlements_status_check'
          AND conrelid = 'public.coach_subscription_settlements'::regclass
    ) THEN
        ALTER TABLE public.coach_subscription_settlements
        DROP CONSTRAINT coach_subscription_settlements_status_check;
    END IF;
END $$;

ALTER TABLE public.coach_subscription_settlements
ADD CONSTRAINT coach_subscription_settlements_status_check
CHECK (status IN ('pending', 'processing', 'split_success', 'split_failed', 'wallet_credited', 'refunded'));

UPDATE public.coach_subscription_settlements
SET eligible_at = COALESCE(eligible_at, created_at)
WHERE eligible_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_coach_subscription_settlements_due
ON public.coach_subscription_settlements (eligible_at, status)
WHERE status IN ('pending', 'split_failed');

CREATE INDEX IF NOT EXISTS idx_coach_subscription_settlements_processing
ON public.coach_subscription_settlements (last_attempt_at, status)
WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_alipay_orders_payment_provider
ON public.alipay_orders (payment_provider)
WHERE payment_provider IS NOT NULL;

COMMENT ON COLUMN public.alipay_orders.payment_provider
IS 'Actual payment provider/channel, e.g. alipay, huifu_alipay, wechat.';

COMMENT ON COLUMN public.coach_subscription_settlements.eligible_at
IS 'Earliest time when Huifu balance-payment settlement may be initiated after the refund window.';

COMMENT ON COLUMN public.coach_subscription_settlements.refund_status
IS 'Original Huifu collection refund state for this source payment order.';

COMMENT ON COLUMN public.coach_subscription_settlements.balance_refund_status
IS 'Huifu balance-payment refund/reversal state when coach share had already been transferred.';

COMMENT ON COLUMN public.wallet_transactions.huifu_req_seq_id
IS 'Huifu request sequence id for withdrawals or future wallet-related Huifu operations.';
