-- 提现确认人：独立列存 user_id，展示时再查 name，避免改名后历史显示错误
ALTER TABLE public.alipay_withdrawals
ADD COLUMN IF NOT EXISTS confirmed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.alipay_withdrawals.confirmed_by_user_id IS '点击确认到账的管理员 user_id，展示时从 user_profiles 查 name';

CREATE INDEX IF NOT EXISTS idx_alipay_withdrawals_confirmed_by_user_id
ON public.alipay_withdrawals(confirmed_by_user_id) WHERE confirmed_by_user_id IS NOT NULL;

-- 历史数据回填：之前写在 alipay_response 里的 confirmed_by_user_id 迁到新列
UPDATE public.alipay_withdrawals
SET confirmed_by_user_id = (alipay_response->>'confirmed_by_user_id')::uuid
WHERE confirmed_by_user_id IS NULL
  AND alipay_response IS NOT NULL
  AND alipay_response->>'confirmed_by_user_id' IS NOT NULL
  AND (alipay_response->>'confirmed_by_user_id')::uuid IS NOT NULL;
