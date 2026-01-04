-- =============================================
-- 添加 prior_training_weeks 字段到 coach_subscriptions 表
-- 用于记录老学员迁入平台前已跟随教练训练的周数
-- =============================================

-- 添加字段：prior_training_weeks（默认为0周）
ALTER TABLE coach_subscriptions 
ADD COLUMN IF NOT EXISTS prior_training_weeks integer DEFAULT 0;

-- 添加注释
COMMENT ON COLUMN coach_subscriptions.prior_training_weeks IS '学员迁入平台前已跟随该教练训练的周数，用于计算总训练时长';

-- 添加约束：确保值非负
ALTER TABLE coach_subscriptions 
ADD CONSTRAINT check_prior_training_weeks_non_negative 
CHECK (prior_training_weeks >= 0);
