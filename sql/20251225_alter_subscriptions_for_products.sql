-- 订阅系统升级：添加产品化订阅支持
-- 执行时间：2025-12-25
-- 说明：此脚本只添加新字段，不修改或删除现有数据，确保安全。

-- 1. 扩展 coach_subscriptions 表
-- product_id: 关联的具体产品ID
-- product_name: 订阅时的产品快照名称 (防止后续改名影响历史记录)
-- product_tier: 产品的层级 (basic/standard/vip)
-- subscribed_weeks: 订阅的总周数 (用于计算进度)
ALTER TABLE coach_subscriptions 
ADD COLUMN IF NOT EXISTS product_id TEXT,
ADD COLUMN IF NOT EXISTS product_name TEXT,
ADD COLUMN IF NOT EXISTS product_tier TEXT,
ADD COLUMN IF NOT EXISTS subscribed_weeks INTEGER DEFAULT 4;

-- 2. 添加注释
COMMENT ON COLUMN coach_subscriptions.product_id IS '订阅的具体产品ID';
COMMENT ON COLUMN coach_subscriptions.product_name IS '订阅时的产品名称快照';
COMMENT ON COLUMN coach_subscriptions.product_tier IS '订阅时的产品层级(basic/standard/vip)';
COMMENT ON COLUMN coach_subscriptions.subscribed_weeks IS '订阅包含的总周数';
