-- 收入流水被退款时写入 refunded_at，列表不依赖分页即可判断「已退款」并隐藏退款按钮
ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS refunded_at timestamptz NULL;

COMMENT ON COLUMN public.wallet_transactions.refunded_at IS '该笔收入对应的订单被退款时写入，用于前端隐藏退款按钮及展示「已退款」描述';

-- 回填：已有退款流水的订单，对应收入流水补上 refunded_at
UPDATE public.wallet_transactions a
SET refunded_at = b.created_at
FROM public.wallet_transactions b
WHERE a.related_order_id IS NOT NULL
  AND a.type = 'income'
  AND b.related_order_id = a.related_order_id
  AND b.type = 'refund'
  AND a.refunded_at IS NULL;
