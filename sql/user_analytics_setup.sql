-- 用户分析系统数据库设计

-- 1. 用户行为事件表
CREATE TABLE IF NOT EXISTS user_behavior_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL,
    user_type       text NOT NULL,  -- 'coach' | 'student' | 'admin'
    event_name      text NOT NULL,  -- 事件名称
    event_category  text NOT NULL,  -- 事件分类
    event_data      jsonb,          -- 事件附加数据
    page_path       text,           -- 页面路径
    session_id      text,           -- 会话ID
    device_type     text,           -- 设备类型
    created_at      timestamptz DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_events_user_id ON user_behavior_events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_name ON user_behavior_events(event_name);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON user_behavior_events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_category ON user_behavior_events(event_category);
CREATE INDEX IF NOT EXISTS idx_events_user_type ON user_behavior_events(user_type);


-- 2. 功能发布标记表
CREATE TABLE IF NOT EXISTS feature_releases (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,           -- 功能名称
    description     text,                    -- 功能描述
    release_date    date NOT NULL,           -- 发布日期
    tracked_events  text[] NOT NULL,         -- 关联的事件名称数组
    target_users    text DEFAULT 'all',      -- 'coach' | 'student' | 'all'
    is_active       boolean DEFAULT true,
    created_at      timestamptz DEFAULT now()
);


-- 3. 统计聚合视图 (Materialized Views)

-- 每日活跃用户统计
DROP MATERIALIZED VIEW IF EXISTS daily_active_users;
CREATE MATERIALIZED VIEW daily_active_users AS
SELECT 
    date_trunc('day', created_at) AS date,
    user_type,
    COUNT(DISTINCT user_id) AS active_users
FROM user_behavior_events
GROUP BY date_trunc('day', created_at), user_type;

CREATE INDEX IF NOT EXISTS idx_daily_active_users_date ON daily_active_users(date);

-- 功能使用统计
DROP MATERIALIZED VIEW IF EXISTS feature_usage_stats;
CREATE MATERIALIZED VIEW feature_usage_stats AS
SELECT 
    date_trunc('day', created_at) AS date,
    event_name,
    event_category,
    user_type,
    COUNT(*) AS usage_count,
    COUNT(DISTINCT user_id) AS unique_users
FROM user_behavior_events
GROUP BY date_trunc('day', created_at), event_name, event_category, user_type;

CREATE INDEX IF NOT EXISTS idx_feature_usage_stats_date ON feature_usage_stats(date);
CREATE INDEX IF NOT EXISTS idx_feature_usage_stats_event ON feature_usage_stats(event_name);

-- 刷新策略: 建议在应用层定期触发，或者使用 pg_cron (如果支持)
-- REFRESH MATERIALIZED VIEW daily_active_users;
-- REFRESH MATERIALIZED VIEW feature_usage_stats;

-- RLS 策略 (如果启用了 RLS)
ALTER TABLE user_behavior_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_releases ENABLE ROW LEVEL SECURITY;

-- 允许 Service Role (API)读写所有数据
-- 允许用户插入自己的数据 (通过 API 鉴权后，这里通常由 Service Role 代理写入，或者配置 authenticated 写入)
-- 简单起见，假设通过 Service Role 写入，这里配置基本的 RLS 以防直接访问

CREATE POLICY "Service role can do all" ON user_behavior_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role can do all" ON feature_releases
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
