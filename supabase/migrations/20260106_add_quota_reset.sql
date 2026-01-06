-- Add last_reset_date to student_quotas for monthly quota reset logic
ALTER TABLE student_quotas
ADD COLUMN IF NOT EXISTS last_reset_date timestamptz DEFAULT now();

-- Add usage tracking column for monthly cycle (optional but good practice to separate from total balance if balance is meant to be 'current available')
-- For now, we reuse ai_import_balance as 'Current Remaining Monthly Quota'
-- But we might want 'extra_ai_balance' for purchased packs in future.
-- Following the design doc, we stick to last_reset_date for now.
