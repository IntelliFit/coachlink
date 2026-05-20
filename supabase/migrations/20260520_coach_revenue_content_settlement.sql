-- Extend the Huifu delayed-settlement ledger from coach subscriptions to all
-- coach-owned revenue, starting with single-content purchases.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'content_purchases_status_check'
          AND conrelid = 'public.content_purchases'::regclass
    ) THEN
        ALTER TABLE public.content_purchases
        DROP CONSTRAINT content_purchases_status_check;
    END IF;
END $$;

ALTER TABLE public.content_purchases
ADD CONSTRAINT content_purchases_status_check
CHECK (status IN ('pending', 'paid', 'refunded'));

CREATE INDEX IF NOT EXISTS idx_coach_subscription_settlements_order_type
ON public.coach_subscription_settlements (order_type, status, eligible_at);

COMMENT ON TABLE public.coach_subscription_settlements
IS 'Huifu balance-payment settlement status for coach-owned revenue orders, including coach subscriptions and paid coach content.';

COMMENT ON COLUMN public.coach_subscription_settlements.order_type
IS 'Source alipay_orders.order_type, e.g. coach_subscription, coach_subscription_renew, content_purchase.';

