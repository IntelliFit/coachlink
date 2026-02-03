-- =====================================================
-- 公共动作库排序视图（综合评分）
-- 创建日期: 2026-02-04
-- 目标:
--   1) 将点赞量 + 动作内容丰富度 + 贡献者影响力组合成 rank_score
--   2) 前端列表直接按 rank_score 排序
-- =====================================================

DROP VIEW IF EXISTS community_actions_ranked;

CREATE VIEW community_actions_ranked AS
SELECT
    ca.*,
    COALESCE(c.total_students, 0) AS contributor_student_count,
    COALESCE(c.rating, 0) AS contributor_rating,
    (
        (ca.like_count * 5)
        + CASE
            WHEN ca.url IS NOT NULL AND btrim(ca.url) <> '' THEN 15
            ELSE 0
          END
        + CASE
            WHEN ca.detail IS NOT NULL AND length(btrim(ca.detail)) >= 20 THEN 2
            ELSE 0
          END
        + (COALESCE(array_length(ca.attrs, 1), 0) * 0.6)
        + (COALESCE(array_length(ca.positions, 1), 0) * 0.4)
        + (LEAST(COALESCE(c.total_students, 0), 200) / 20.0)
        + (COALESCE(c.rating, 0) * 1.5)
    )::numeric(10, 2) AS rank_score
FROM community_actions ca
LEFT JOIN coaches c ON c.user_id = ca.contributor_user_id;

COMMENT ON VIEW community_actions_ranked IS
    '公共动作库排序视图（综合评分：点赞/丰富度/贡献者影响力）';

