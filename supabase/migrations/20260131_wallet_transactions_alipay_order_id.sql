-- 将 related_order_id 重命名为 alipay_order_id，表示关联的支付宝账单 id（alipay_orders.id）
-- 新增 related_income_tx_id：退款流水通过此字段指向被退款的原始收入流水（wallet_transactions.id）
ALTER TABLE public.wallet_transactions
RENAME COLUMN related_order_id TO alipay_order_id;

COMMENT ON COLUMN public.wallet_transactions.alipay_order_id IS '关联的支付宝账单 id（alipay_orders.id）';

ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS related_income_tx_id uuid REFERENCES public.wallet_transactions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.wallet_transactions.related_income_tx_id IS '仅退款流水使用：指向被退款的原始收入流水 id，便于从退款流水找到对应收入流水';

-- 唯一索引原建立在 related_order_id 上，重命名后自动变为 alipay_order_id；若之前未执行 20260131 的 partial 索引则需重建
DROP INDEX IF EXISTS public.idx_wallet_transactions_related_order_id;
DROP INDEX IF EXISTS public.idx_wallet_transactions_related_order_id_income;

CREATE UNIQUE INDEX idx_wallet_transactions_alipay_order_id_income
ON public.wallet_transactions (alipay_order_id)
WHERE alipay_order_id IS NOT NULL AND type = 'income';

COMMENT ON INDEX public.idx_wallet_transactions_alipay_order_id_income IS '防止重复入账：同一支付宝订单只允许一条收入流水；退款流水可共用同一 alipay_order_id';

-- 回填已有退款流水的 related_income_tx_id
UPDATE public.wallet_transactions r
SET related_income_tx_id = i.id
FROM public.wallet_transactions i
WHERE r.type = 'refund'
  AND r.alipay_order_id IS NOT NULL
  AND i.type = 'income'
  AND i.alipay_order_id = r.alipay_order_id
  AND i.wallet_id = r.wallet_id
  AND r.related_income_tx_id IS NULL;
