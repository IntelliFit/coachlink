-- 教练汇付绑卡令牌，用于提现接口 encashment
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS huifu_card_token text;
COMMENT ON COLUMN public.coaches.huifu_card_token IS '汇付绑卡后返回的取现令牌(token_no)，用于 encashment 提现接口';
