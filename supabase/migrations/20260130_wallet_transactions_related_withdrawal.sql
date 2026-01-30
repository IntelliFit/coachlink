-- 钱包流水关联提现单，便于到账/撤回时更新描述；提现确认人记录在 alipay_response 中
ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS related_withdrawal_id uuid;

COMMENT ON COLUMN public.wallet_transactions.related_withdrawal_id IS '关联的提现单 id（alipay_withdrawals.id），用于到账/撤回时更新描述';

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_related_withdrawal
ON public.wallet_transactions(related_withdrawal_id) WHERE related_withdrawal_id IS NOT NULL;
