-- Migration: Fix personal_records_history column names and add e1rm field
-- Purpose: Rename misleading max_weight/max_reps to weight/reps, add explicit e1rm column
-- Created: 2026-01-07

-- 1. Rename columns for clarity
-- max_weight -> weight (the actual training weight used)
-- max_reps -> reps (the actual reps performed)
ALTER TABLE personal_records_history 
  RENAME COLUMN max_weight TO weight;

ALTER TABLE personal_records_history 
  RENAME COLUMN max_reps TO reps;

-- 2. Add explicit e1rm column to store calculated estimated 1RM
-- Formula: weight × (1 + (0.0333 × reps) + (36 / (37 - reps)) + reps ^ 0.1) / 3
ALTER TABLE personal_records_history 
  ADD COLUMN IF NOT EXISTS e1rm NUMERIC(6,2);

-- 3. Add comments for clarity
COMMENT ON COLUMN personal_records_history.weight IS '实际训练重量 (kg)';
COMMENT ON COLUMN personal_records_history.reps IS '实际完成次数';
COMMENT ON COLUMN personal_records_history.e1rm IS '估算极限 (e1RM) - 三公式平均值: weight × (1 + (0.0333 × reps) + (36 / (37 - reps)) + reps ^ 0.1) / 3';

-- 4. Update existing records: calculate e1rm from weight and reps
-- Only for records where weight and reps are both present
UPDATE personal_records_history
SET e1rm = ROUND(
    weight * (1 + (0.0333 * reps) + (36.0 / (37.0 - reps)) + POWER(reps, 0.1)) / 3,
    2
)
WHERE weight IS NOT NULL 
  AND reps IS NOT NULL 
  AND reps > 0 
  AND reps < 37  -- Brzycki formula requires reps < 37
  AND e1rm IS NULL;

-- For single rep (reps = 1), e1RM = weight
UPDATE personal_records_history
SET e1rm = weight
WHERE weight IS NOT NULL 
  AND reps = 1 
  AND e1rm IS NULL;

-- For initial questionnaire records (no reps data), e1RM = weight (they entered their 1RM directly)
UPDATE personal_records_history
SET e1rm = weight
WHERE weight IS NOT NULL 
  AND reps IS NULL 
  AND e1rm IS NULL;
