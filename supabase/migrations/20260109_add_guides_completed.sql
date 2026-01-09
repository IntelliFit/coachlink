-- Migration: Add guides_completed column to user_profiles
-- This column tracks which onboarding guides a user has completed.
-- Using JSONB for flexibility (e.g., {"onboarding": true, "plan_editor": false})

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS guides_completed JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN user_profiles.guides_completed IS 'JSONB object tracking completed onboarding guides';
