-- Run this on Supabase (Postgres) to add alipay accounts and withdrawals
-- Requires the "pgcrypto" extension for gen_random_uuid() in some setups. Adjust as needed.

BEGIN;

CREATE TABLE IF NOT EXISTS public.alipay_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id uuid NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
    payee_account text NOT NULL,
    payee_type text,
    real_name text,
    verified boolean DEFAULT false,
    verification_method text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alipay_accounts_coach_id ON public.alipay_accounts(coach_id);

CREATE TABLE IF NOT EXISTS public.alipay_withdrawals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id uuid NOT NULL,
    coach_id uuid NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
    amount numeric(12,2) NOT NULL,
    fee numeric(12,2) DEFAULT 0,
    status text NOT NULL DEFAULT 'pending',
    out_biz_no text,
    alipay_order_id text,
    alipay_response jsonb,
    created_at timestamptz DEFAULT now(),
    processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_alipay_withdrawals_wallet_id ON public.alipay_withdrawals(wallet_id);
CREATE INDEX IF NOT EXISTS idx_alipay_withdrawals_out_biz_no ON public.alipay_withdrawals(out_biz_no);

COMMIT;

-- Notes:
-- 1) Consider encrypting `payee_account` and `real_name` using Supabase storage functions or application-level encryption.
-- 2) `wallet_id` stores coach_id to match existing wallet_transactions usage in this project.
