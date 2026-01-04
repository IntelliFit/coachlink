-- =============================================================================
-- Migration: Create social_friendships table
-- Phase 2: Friends and Observation System
-- =============================================================================

-- 好友关系表
CREATE TABLE IF NOT EXISTS public.social_friendships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 请求发起方
    requester_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- 请求接收方
    addressee_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- 关系状态: 'pending', 'accepted', 'rejected', 'blocked'
    status text NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
    
    -- 时间戳
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- 防止重复请求
    UNIQUE(requester_id, addressee_id),
    
    -- 防止自己加自己
    CHECK (requester_id != addressee_id)
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON social_friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON social_friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON social_friendships(status);
CREATE INDEX IF NOT EXISTS idx_friendships_requester_status ON social_friendships(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee_status ON social_friendships(addressee_id, status);

-- 触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_friendships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_friendships_updated_at ON social_friendships;
CREATE TRIGGER trigger_friendships_updated_at
    BEFORE UPDATE ON social_friendships
    FOR EACH ROW
    EXECUTE FUNCTION update_friendships_updated_at();

-- =============================================================================
-- 修改 user_profiles 表：添加搜索 ID
-- =============================================================================

-- 用户可设置一个唯一的搜索 ID（类似微信号）
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS search_id text UNIQUE;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_search_id ON user_profiles(search_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_nickname ON user_profiles(nickname);

-- =============================================================================
-- 注释
-- =============================================================================
COMMENT ON TABLE social_friendships IS '好友关系表，存储用户之间的好友关系和请求状态';
COMMENT ON COLUMN social_friendships.requester_id IS '发起好友请求的用户';
COMMENT ON COLUMN social_friendships.addressee_id IS '接收好友请求的用户';
COMMENT ON COLUMN social_friendships.status IS '关系状态: pending=待确认, accepted=已接受, rejected=已拒绝, blocked=已拉黑';
COMMENT ON COLUMN user_profiles.search_id IS '用户自定义的搜索ID，用于精确搜索添加好友';
