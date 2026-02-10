-- =====================================================
-- 公共动作库共建（审核 + 贡献者记录）
-- 创建日期: 2026-02-05
-- 功能:
--   1) 新增编辑提案表 community_action_edits
--   2) 新增贡献者记录表 community_action_contributors
--   3) community_actions 增加 owner_user_id / last_approved_edit_id
-- =====================================================

-- 1) 主表补充 owner 与审核追踪
ALTER TABLE community_actions
    ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS last_approved_edit_id uuid;

COMMENT ON COLUMN community_actions.owner_user_id IS '首位上传者（动作负责人）';
COMMENT ON COLUMN community_actions.last_approved_edit_id IS '最近一次通过的编辑提案ID';

-- 2) 编辑提案表
CREATE TABLE IF NOT EXISTS community_action_edits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id uuid NOT NULL REFERENCES community_actions(id) ON DELETE CASCADE,
    proposer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending',
    proposed_name text,
    proposed_detail text,
    proposed_positions text[],
    proposed_attrs text[],
    proposed_url text,
    proposed_type text,
    proposed_item_schema jsonb,
    proposed_suggested_time text,
    proposed_enableAutoWeightCompute boolean,
    proposed_includesBodyWeight boolean,
    proposed_canonical_action_id text REFERENCES canonical_actions(id),
    created_at timestamptz DEFAULT now(),
    reviewed_at timestamptz,
    reviewer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    review_note text
);

ALTER TABLE community_action_edits
    DROP CONSTRAINT IF EXISTS community_action_edits_status_check;
ALTER TABLE community_action_edits
    ADD CONSTRAINT community_action_edits_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_community_action_edits_action
    ON community_action_edits(action_id);
CREATE INDEX IF NOT EXISTS idx_community_action_edits_status
    ON community_action_edits(status);
CREATE INDEX IF NOT EXISTS idx_community_action_edits_proposer
    ON community_action_edits(proposer_user_id);
CREATE INDEX IF NOT EXISTS idx_community_action_edits_created_at
    ON community_action_edits(created_at DESC);

COMMENT ON TABLE community_action_edits IS '公共动作编辑提案（需 owner 审核后生效）';

-- 3) 贡献者记录表
CREATE TABLE IF NOT EXISTS community_action_contributors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id uuid NOT NULL REFERENCES community_actions(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role text DEFAULT 'editor',
    contribution_count integer NOT NULL DEFAULT 0,
    first_contributed_at timestamptz DEFAULT now(),
    last_contributed_at timestamptz DEFAULT now()
);

ALTER TABLE community_action_contributors
    DROP CONSTRAINT IF EXISTS unique_community_action_contributor;
ALTER TABLE community_action_contributors
    ADD CONSTRAINT unique_community_action_contributor UNIQUE (action_id, user_id);

CREATE INDEX IF NOT EXISTS idx_community_action_contributors_action
    ON community_action_contributors(action_id);
CREATE INDEX IF NOT EXISTS idx_community_action_contributors_user
    ON community_action_contributors(user_id);

COMMENT ON TABLE community_action_contributors IS '公共动作贡献者记录（通过的编辑/贡献）';

-- 4) 迁移历史数据：owner=contributor
UPDATE community_actions
SET owner_user_id = contributor_user_id
WHERE owner_user_id IS NULL;

-- 5) 迁移历史数据：贡献者记录
INSERT INTO community_action_contributors (action_id, user_id, role, contribution_count)
SELECT id, contributor_user_id, 'owner', 1
FROM community_actions
ON CONFLICT (action_id, user_id) DO NOTHING;

SELECT 'public action coedit migration completed!' AS status;

