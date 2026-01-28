-- =====================================================
-- 公共动作库共建生态（阶段 1）
-- 创建日期: 2026-01-28
-- 功能:
--   1) 新增公共动作资产表 community_actions
--   2) 新增点赞关系表 community_action_likes
--   3) 触发器维护 community_actions.like_count
--   4) 关闭 RLS（按项目约定）
-- =====================================================

-- 1) 公共动作资产表（承载“公共动作库”，不改变现有 coach_actions/student_actions 定义）
CREATE TABLE IF NOT EXISTS community_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- 贡献者（users 表主键）
    contributor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- 动作核心字段（尽量与现有动作库对齐）
    name text NOT NULL,
    detail text,
    positions text[],
    attrs text[],
    url text,

    -- polymorphic action types（与现有 student_actions/coach_actions 的实践对齐）
    type text DEFAULT 'STRENGTH',
    item_schema jsonb,
    suggested_time text,

    "enableAutoWeightCompute" boolean DEFAULT false,
    "includesBodyWeight" boolean DEFAULT false,

    -- 可选：标准动作字典关联（用于标准化/搜索辅助）
    canonical_action_id text REFERENCES canonical_actions(id),

    -- 生态字段
    like_count integer NOT NULL DEFAULT 0,

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE community_actions IS '公共动作库（共建生态）：平台公共动作资产（阶段1，不含评论/审核）';
COMMENT ON COLUMN community_actions.contributor_user_id IS '贡献者 users.id';
COMMENT ON COLUMN community_actions.like_count IS '点赞数（由触发器维护）';

-- 基础索引：列表/搜索/排序
CREATE INDEX IF NOT EXISTS idx_community_actions_created_at
    ON community_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_actions_like_count
    ON community_actions(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_community_actions_contributor
    ON community_actions(contributor_user_id);
CREATE INDEX IF NOT EXISTS idx_community_actions_name
    ON community_actions(name);
CREATE INDEX IF NOT EXISTS idx_community_actions_type
    ON community_actions(type);

-- 同一贡献者下避免重复同名（对齐现有 unique_*_action_name 的策略）
ALTER TABLE community_actions
    DROP CONSTRAINT IF EXISTS unique_community_action_name;
ALTER TABLE community_actions
    ADD CONSTRAINT unique_community_action_name UNIQUE (contributor_user_id, name);

-- 2) 点赞关系表（同一用户对同一动作 0/1）
CREATE TABLE IF NOT EXISTS community_action_likes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id uuid NOT NULL REFERENCES community_actions(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE community_action_likes IS '公共动作点赞关系表（用户对动作 0/1 点赞）';

ALTER TABLE community_action_likes
    DROP CONSTRAINT IF EXISTS unique_community_action_like;
ALTER TABLE community_action_likes
    ADD CONSTRAINT unique_community_action_like UNIQUE (action_id, user_id);

CREATE INDEX IF NOT EXISTS idx_community_action_likes_action
    ON community_action_likes(action_id);
CREATE INDEX IF NOT EXISTS idx_community_action_likes_user
    ON community_action_likes(user_id);

-- 3) 触发器：维护 like_count
CREATE OR REPLACE FUNCTION public.tg_community_action_like_count()
RETURNS trigger AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE community_actions
        SET like_count = like_count + 1,
            updated_at = now()
        WHERE id = NEW.action_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE community_actions
        SET like_count = GREATEST(like_count - 1, 0),
            updated_at = now()
        WHERE id = OLD.action_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_community_action_like_count_insert ON community_action_likes;
DROP TRIGGER IF EXISTS trg_community_action_like_count_delete ON community_action_likes;

CREATE TRIGGER trg_community_action_like_count_insert
AFTER INSERT ON community_action_likes
FOR EACH ROW EXECUTE FUNCTION public.tg_community_action_like_count();

CREATE TRIGGER trg_community_action_like_count_delete
AFTER DELETE ON community_action_likes
FOR EACH ROW EXECUTE FUNCTION public.tg_community_action_like_count();

-- 4) 关闭 RLS（项目约定）
ALTER TABLE community_actions DISABLE ROW LEVEL SECURITY;
ALTER TABLE community_action_likes DISABLE ROW LEVEL SECURITY;

SELECT 'public action ecosystem migration completed!' AS status;

