-- 提现手动流程完整迁移
-- 确保 alipay_withdrawals 表存在并包含所有必要字段和约束

-- 1. 确保表存在（如果不存在则创建）
CREATE TABLE IF NOT EXISTS public.alipay_withdrawals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id uuid NOT NULL,
    coach_id uuid NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
    amount numeric(12,2) NOT NULL CHECK (amount > 0),
    fee numeric(12,2) DEFAULT 0 CHECK (fee >= 0),
    status text NOT NULL DEFAULT 'pending',
    out_biz_no text,
    alipay_order_id text,
    alipay_response jsonb,
    created_at timestamptz DEFAULT now(),
    processed_at timestamptz
);

-- 2. 添加状态约束（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'alipay_withdrawals_status_check'
  ) THEN
    ALTER TABLE public.alipay_withdrawals
    ADD CONSTRAINT alipay_withdrawals_status_check
    CHECK (status IN ('pending', 'success', 'failed', 'cancelled'));
  END IF;
END $$;

-- 3. 创建索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_alipay_withdrawals_wallet_id ON public.alipay_withdrawals(wallet_id);
CREATE INDEX IF NOT EXISTS idx_alipay_withdrawals_coach_id ON public.alipay_withdrawals(coach_id);
CREATE INDEX IF NOT EXISTS idx_alipay_withdrawals_status ON public.alipay_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_alipay_withdrawals_coach_status ON public.alipay_withdrawals(coach_id, status);
CREATE INDEX IF NOT EXISTS idx_alipay_withdrawals_out_biz_no ON public.alipay_withdrawals(out_biz_no);
CREATE INDEX IF NOT EXISTS idx_alipay_withdrawals_created_at ON public.alipay_withdrawals(created_at DESC);

-- 4. 添加注释
COMMENT ON TABLE public.alipay_withdrawals IS '教练提现记录表，支持手动转账流程';
COMMENT ON COLUMN public.alipay_withdrawals.status IS 'pending=待处理, success=已到账, failed=拒绝/失败, cancelled=用户撤回';
COMMENT ON COLUMN public.alipay_withdrawals.alipay_order_id IS '管理员填写的人工转账订单号，确认到账时填写';
COMMENT ON COLUMN public.alipay_withdrawals.out_biz_no IS '提现业务单号，系统生成';
COMMENT ON COLUMN public.alipay_withdrawals.processed_at IS '处理时间，状态变更时更新';

-- 5. 确保 alipay_accounts 表存在（如果不存在则创建）
CREATE TABLE IF NOT EXISTS public.alipay_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id uuid NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
    payee_account text NOT NULL,
    payee_type text,
    real_name text,
    verified boolean DEFAULT false,
    verification_method text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT alipay_accounts_coach_id_unique UNIQUE (coach_id)
);

CREATE INDEX IF NOT EXISTS idx_alipay_accounts_coach_id ON public.alipay_accounts(coach_id);

COMMENT ON TABLE public.alipay_accounts IS '教练支付宝账号绑定表';
COMMENT ON COLUMN public.alipay_accounts.payee_account IS '支付宝账号（手机号/邮箱/UID）';
COMMENT ON COLUMN public.alipay_accounts.payee_type IS '账号类型：ALIPAY_LOGON_ID（登录号）或 ALIPAY_USERID（UID）';
COMMENT ON COLUMN public.alipay_accounts.real_name IS '真实姓名（登录号类型必填）';
