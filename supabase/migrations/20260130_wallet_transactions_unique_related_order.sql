-- 防止同一支付订单重复入账：related_order_id 唯一（仅对非空值）
-- 先清理已存在的重复流水（同一 related_order_id 只保留一条，保留最早的一条，同时间按 id 保留一条）
DELETE FROM public.wallet_transactions a
USING public.wallet_transactions b
WHERE a.related_order_id IS NOT NULL
  AND b.related_order_id IS NOT NULL
  AND a.related_order_id = b.related_order_id
  AND (a.created_at > b.created_at OR (a.created_at = b.created_at AND a.id > b.id));

-- 唯一约束：同一订单只能有一条收入流水
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_transactions_related_order_id
ON public.wallet_transactions (related_order_id)
WHERE related_order_id IS NOT NULL;

COMMENT ON INDEX public.idx_wallet_transactions_related_order_id IS '防止 notify/return/query 重复入账：同一 alipay 订单只允许一条收入流水';
