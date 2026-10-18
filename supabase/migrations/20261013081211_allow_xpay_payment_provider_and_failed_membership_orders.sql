-- The earlier XPay migration added an idempotency index and refund status,
-- but left the existing provider CHECK unchanged. Preserve all existing
-- allowed providers/statuses, NULL semantics, and validation; add only the
-- values used by the current XPay create route and failure compensation.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public.alipay_orders, public.student_membership_orders IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
    previous_expression text;
    value_already_allowed boolean;
BEGIN
    SELECT pg_get_expr(conbin, conrelid) INTO STRICT previous_expression
    FROM pg_constraint
    WHERE conrelid = 'public.alipay_orders'::regclass
      AND conname = 'alipay_orders_payment_provider_check'
      AND contype = 'c';
    EXECUTE format('SELECT (%s) IS NOT FALSE FROM (SELECT %L::text AS payment_provider) candidate',
        previous_expression, 'wechat_xpay') INTO value_already_allowed;
    IF NOT value_already_allowed THEN
        ALTER TABLE public.alipay_orders DROP CONSTRAINT alipay_orders_payment_provider_check;
        EXECUTE format('ALTER TABLE public.alipay_orders ADD CONSTRAINT alipay_orders_payment_provider_check CHECK ((%s) OR payment_provider = %L)',
            previous_expression, 'wechat_xpay');
    END IF;

    SELECT pg_get_expr(conbin, conrelid) INTO STRICT previous_expression
    FROM pg_constraint
    WHERE conrelid = 'public.student_membership_orders'::regclass
      AND conname = 'student_membership_orders_status_check'
      AND contype = 'c';
    EXECUTE format('SELECT (%s) IS NOT FALSE FROM (SELECT %L::text AS status) candidate',
        previous_expression, 'failed') INTO value_already_allowed;
    IF NOT value_already_allowed THEN
        ALTER TABLE public.student_membership_orders DROP CONSTRAINT student_membership_orders_status_check;
        EXECUTE format('ALTER TABLE public.student_membership_orders ADD CONSTRAINT student_membership_orders_status_check CHECK ((%s) OR status = %L)',
            previous_expression, 'failed');
    END IF;
END $$;
COMMIT;
