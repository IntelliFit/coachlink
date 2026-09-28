-- Keep WeChat Mini Program Virtual Payment callback/query fulfillment
-- idempotent for platform-owned virtual goods. Coach subscriptions remain on
-- the Huifu payment and settlement path and do not create XPay orders.

CREATE UNIQUE INDEX IF NOT EXISTS idx_alipay_orders_xpay_out_trade_no
ON public.alipay_orders ((order_data ->> 'xpay_out_trade_no'))
WHERE payment_provider = 'wechat_xpay'
  AND order_data ->> 'xpay_out_trade_no' IS NOT NULL;

-- XPay refunds are asynchronous and must remain distinguishable from an
-- unpaid/cancelled membership order in purchase history and reconciliation.
ALTER TABLE public.student_membership_orders
DROP CONSTRAINT IF EXISTS student_membership_orders_status_check;

ALTER TABLE public.student_membership_orders
ADD CONSTRAINT student_membership_orders_status_check
CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded'));

COMMENT ON COLUMN public.alipay_orders.payment_provider
IS 'Actual payment channel: alipay, huifu_alipay, wechat, or wechat_xpay.';
