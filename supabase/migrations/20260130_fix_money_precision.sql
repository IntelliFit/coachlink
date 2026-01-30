-- 修复金额精度问题：将所有金额字段从 numeric 改为 bigint，存储单位为"分"（整数）
-- 这样可以避免浮点数精度问题

BEGIN;

-- 1. 修改 coach_wallets 表
-- 先将现有数据从元转换为分（乘以100），然后修改字段类型
ALTER TABLE public.coach_wallets
    ALTER COLUMN balance TYPE bigint USING ROUND(COALESCE(balance, 0) * 100)::bigint,
    ALTER COLUMN total_income TYPE bigint USING ROUND(COALESCE(total_income, 0) * 100)::bigint,
    ALTER COLUMN frozen_amount TYPE bigint USING ROUND(COALESCE(frozen_amount, 0) * 100)::bigint;

-- 设置默认值为 0（分）
ALTER TABLE public.coach_wallets
    ALTER COLUMN balance SET DEFAULT 0,
    ALTER COLUMN total_income SET DEFAULT 0,
    ALTER COLUMN frozen_amount SET DEFAULT 0;

-- 2. 修改 wallet_transactions 表
ALTER TABLE public.wallet_transactions
    ALTER COLUMN amount TYPE bigint USING ROUND(COALESCE(amount, 0) * 100)::bigint;

-- 设置 NOT NULL 约束（如果还没有）
ALTER TABLE public.wallet_transactions
    ALTER COLUMN amount SET NOT NULL;

-- 3. 修改 alipay_orders 表
ALTER TABLE public.alipay_orders
    ALTER COLUMN total_amount TYPE bigint USING ROUND(COALESCE(total_amount, 0) * 100)::bigint;

-- 设置 NOT NULL 约束（如果还没有）
ALTER TABLE public.alipay_orders
    ALTER COLUMN total_amount SET NOT NULL;

-- 4. 修改 alipay_withdrawals 表
ALTER TABLE public.alipay_withdrawals
    ALTER COLUMN amount TYPE bigint USING ROUND(COALESCE(amount, 0) * 100)::bigint,
    ALTER COLUMN fee TYPE bigint USING ROUND(COALESCE(fee, 0) * 100)::bigint;

-- 设置默认值和约束
ALTER TABLE public.alipay_withdrawals
    ALTER COLUMN amount SET NOT NULL,
    ALTER COLUMN fee SET DEFAULT 0;

-- 5. 修改 student_membership_orders 表（如果存在）
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'student_membership_orders' 
        AND column_name = 'amount'
    ) THEN
        ALTER TABLE public.student_membership_orders
            ALTER COLUMN amount TYPE bigint USING ROUND(COALESCE(amount, 0) * 100)::bigint,
            ALTER COLUMN original_amount TYPE bigint USING ROUND(COALESCE(original_amount, 0) * 100)::bigint;
        
        ALTER TABLE public.student_membership_orders
            ALTER COLUMN amount SET NOT NULL,
            ALTER COLUMN original_amount SET NOT NULL;
    END IF;
END $$;

-- 6. 修改 student_coupons 表（如果存在相关金额字段）
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'student_coupons' 
        AND column_name = 'value'
    ) THEN
        ALTER TABLE public.student_coupons
            ALTER COLUMN value TYPE bigint USING ROUND(COALESCE(value, 0) * 100)::bigint;
        
        ALTER TABLE public.student_coupons
            ALTER COLUMN value SET NOT NULL;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'student_coupons' 
        AND column_name = 'condition_min_amount'
    ) THEN
        ALTER TABLE public.student_coupons
            ALTER COLUMN condition_min_amount TYPE bigint USING ROUND(COALESCE(condition_min_amount, 0) * 100)::bigint;
        
        ALTER TABLE public.student_coupons
            ALTER COLUMN condition_min_amount SET DEFAULT 0;
    END IF;
END $$;

-- 7. 修改 coach_subscriptions 表的 monthly_price 字段（如果存在）
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'coach_subscriptions' 
        AND column_name = 'monthly_price'
    ) THEN
        ALTER TABLE public.coach_subscriptions
            ALTER COLUMN monthly_price TYPE bigint USING ROUND(COALESCE(monthly_price, 0) * 100)::bigint;
        
        ALTER TABLE public.coach_subscriptions
            ALTER COLUMN monthly_price SET NOT NULL;
    END IF;
END $$;

-- 添加注释说明字段单位
COMMENT ON COLUMN public.coach_wallets.balance IS '余额（单位：分，整数）';
COMMENT ON COLUMN public.coach_wallets.total_income IS '累计总收入（单位：分，整数）';
COMMENT ON COLUMN public.coach_wallets.frozen_amount IS '冻结金额（单位：分，整数）';
COMMENT ON COLUMN public.wallet_transactions.amount IS '交易金额（单位：分，整数，正数表示收入，负数表示支出）';
COMMENT ON COLUMN public.alipay_orders.total_amount IS '订单总金额（单位：分，整数）';
COMMENT ON COLUMN public.alipay_withdrawals.amount IS '提现金额（单位：分，整数）';
COMMENT ON COLUMN public.alipay_withdrawals.fee IS '手续费（单位：分，整数）';

COMMIT;

-- 注意：
-- 1. 所有金额字段现在存储的是"分"（整数），例如：100 表示 1.00 元
-- 2. 在代码中使用时，需要将元转换为分存储，将分转换为元显示
-- 3. 使用 moneyUtils.ts 中的工具函数进行转换
-- 4. 所有金额计算都在整数（分）层面进行，避免浮点数精度问题
