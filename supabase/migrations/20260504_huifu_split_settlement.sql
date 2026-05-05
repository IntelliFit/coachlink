-- 汇付分账结算支持
-- 见 docs/split-payment-rules.md 和计划文档

-- 1. wallet_transactions 新增 platform_fee（平台抽成金额）
ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS platform_fee bigint DEFAULT 0;

COMMENT ON COLUMN public.wallet_transactions.platform_fee
IS '平台抽成金额（分）。coach_subscription 类型为 20%，其余为 0';

-- 2. coaches 新增汇付开户字段
ALTER TABLE public.coaches
ADD COLUMN IF NOT EXISTS huifu_id text,
ADD COLUMN IF NOT EXISTS huifu_open_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS huifu_open_msg text;

COMMENT ON COLUMN public.coaches.huifu_id IS '汇付个人用户开户后返回的 huifu_id，用于分账接收方标识';
COMMENT ON COLUMN public.coaches.huifu_open_status IS '汇付开户状态：pending | opened | failed';
COMMENT ON COLUMN public.coaches.huifu_open_msg IS '汇付开户失败时的错误信息';

-- 唯一索引：一个 huifu_id 只能绑一个教练（防重复开户）
CREATE UNIQUE INDEX IF NOT EXISTS idx_coaches_huifu_id
ON public.coaches (huifu_id) WHERE huifu_id IS NOT NULL;

-- 3. 平台收入汇总表（轻量，用于聚合查询平台抽成收入）
CREATE TABLE IF NOT EXISTS public.platform_revenue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_order_id text NOT NULL,
    order_type text NOT NULL,
    amount bigint NOT NULL,
    coach_id uuid REFERENCES public.coaches(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.platform_revenue IS '平台抽成收入明细。coach_subscription 每笔记录 20% 平台抽成';
COMMENT ON COLUMN public.platform_revenue.source_order_id IS '来源支付订单 id（alipay_orders.id）';
COMMENT ON COLUMN public.platform_revenue.amount IS '平台抽成金额（分）';
