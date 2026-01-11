-- Add guides completion tracking for onboarding tours
-- This fixes repeated guides caused by missing persistence column.

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS guides_completed jsonb NOT NULL DEFAULT '{}'::jsonb;

