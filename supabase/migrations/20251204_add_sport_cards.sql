-- Migration: Add sport cards and onboarding fields to user_profiles
-- Created: 2025-12-04

-- 添加运动数据卡片字段 (JSONB)
-- 存储结构: { "activeCards": ["powerlifting"], "powerlifting": { "squat": 60, "bench": 50, "deadlift": 70 }, ... }
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS sport_cards jsonb DEFAULT '{}';

-- 添加生活作息字段
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS lifestyle text;

-- 添加问卷完成标记
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- 添加年龄字段（如果不存在，可通过 birth_date 计算但直接存储更方便）
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS age integer;

-- 添加注释
COMMENT ON COLUMN user_profiles.sport_cards IS '运动数据卡片 JSONB，包含 activeCards 数组和各卡片数据';
COMMENT ON COLUMN user_profiles.lifestyle IS '生活作息描述，如"朝九晚五，久坐办公"';
COMMENT ON COLUMN user_profiles.onboarding_completed IS '初始问卷是否已完成';
