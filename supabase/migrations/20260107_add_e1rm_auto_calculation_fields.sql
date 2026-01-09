-- Migration: Add auto-calculation fields to personal_records_history
-- Purpose: Support automatic e1RM calculation from training data

ALTER TABLE personal_records_history 
ADD COLUMN IF NOT EXISTS is_auto_calculated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS estimated_from jsonb;

COMMENT ON COLUMN personal_records_history.is_auto_calculated IS '是否为系统自动计算的e1RM（非手动标记）';
COMMENT ON COLUMN personal_records_history.estimated_from IS '估算来源数据，格式: {"weight": 75, "reps": 5, "bodyWeight": 70, "epley": 87.5, "brzycki": 86.2, "lombardi": 88.1}';
