-- Track the second Huifu onboarding stage separately from basic personal-user opening.
-- A coach is payment-ready only after user business onboarding returns token_no.

ALTER TABLE public.coaches
ADD COLUMN IF NOT EXISTS huifu_apply_no text,
ADD COLUMN IF NOT EXISTS huifu_business_status text,
ADD COLUMN IF NOT EXISTS huifu_resp_business jsonb;

COMMENT ON COLUMN public.coaches.huifu_apply_no
IS 'Huifu user business onboarding apply_no when the request enters review.';

COMMENT ON COLUMN public.coaches.huifu_business_status
IS 'Huifu user business onboarding state: basic_opened | submitting | business_pending | opened | failed.';

COMMENT ON COLUMN public.coaches.huifu_resp_business
IS 'Raw Huifu resp_business payload from user business onboarding for audit/debugging.';

UPDATE public.coaches
SET huifu_business_status = CASE
    WHEN huifu_open_status = 'opened' AND huifu_card_token IS NOT NULL THEN 'opened'
    WHEN huifu_open_status = 'opened' AND huifu_card_token IS NULL THEN 'failed'
    WHEN huifu_open_status IS NOT NULL THEN huifu_open_status
    ELSE huifu_business_status
END
WHERE huifu_business_status IS NULL;
