-- Track the actual payment rail for alipay_orders.
-- Coach subscription orders can now be direct Alipay, Huifu Alipay, or Huifu WeChat,
-- and fulfillment/refund logic must distinguish those rails.
ALTER TABLE public.alipay_orders
ADD COLUMN IF NOT EXISTS payment_provider text;

CREATE INDEX IF NOT EXISTS idx_alipay_orders_payment_provider
ON public.alipay_orders (payment_provider);

COMMENT ON COLUMN public.alipay_orders.payment_provider
IS 'Payment rail used by this order, for example alipay, huifu_alipay, or wechat.';
