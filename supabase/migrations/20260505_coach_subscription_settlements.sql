-- Track Huifu balance-payment settlement for coach subscription orders.
-- The row is the idempotency guard for the external split call, separate from
-- wallet_transactions which only records local wallet credit after split success.

CREATE TABLE IF NOT EXISTS public.coach_subscription_settlements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    alipay_order_id text NOT NULL UNIQUE,
    subscription_id uuid REFERENCES public.coach_subscriptions(id) ON DELETE SET NULL,
    coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE RESTRICT,
    student_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    order_type text NOT NULL,
    total_amount bigint NOT NULL,
    coach_amount bigint NOT NULL,
    platform_fee bigint NOT NULL,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'split_success', 'split_failed', 'wallet_credited')),
    req_date text,
    req_seq_id text,
    huifu_hf_seq_id text,
    trans_stat text,
    acct_split_bunch jsonb,
    error_message text,
    attempts integer NOT NULL DEFAULT 0,
    last_attempt_at timestamptz,
    split_completed_at timestamptz,
    wallet_credited_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_subscription_settlements_coach_id
ON public.coach_subscription_settlements (coach_id);

CREATE INDEX IF NOT EXISTS idx_coach_subscription_settlements_subscription_id
ON public.coach_subscription_settlements (subscription_id)
WHERE subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coach_subscription_settlements_status
ON public.coach_subscription_settlements (status, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_revenue_source_order_id
ON public.platform_revenue (source_order_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_coach_subscription_settlements_req_seq_id
ON public.coach_subscription_settlements (req_seq_id)
WHERE req_seq_id IS NOT NULL;

DROP TRIGGER IF EXISTS coach_subscription_settlements_set_updated_at
ON public.coach_subscription_settlements;

CREATE TRIGGER coach_subscription_settlements_set_updated_at
BEFORE UPDATE ON public.coach_subscription_settlements
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.coach_subscription_settlements
IS 'Coach subscription Huifu balance-payment settlement status. One row per paid order.';

COMMENT ON COLUMN public.coach_subscription_settlements.alipay_order_id
IS 'Source payment order id from alipay_orders.id.';

COMMENT ON COLUMN public.coach_subscription_settlements.status
IS 'pending/processing/split_success/split_failed/wallet_credited. Wallet credit is allowed only after split_success.';

COMMENT ON COLUMN public.coach_subscription_settlements.acct_split_bunch
IS 'Huifu returned split detail, used as the source of truth for local wallet/platform revenue amounts.';

GRANT ALL ON TABLE public.coach_subscription_settlements TO service_role;
