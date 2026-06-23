-- =====================================================
-- 标准动作缩略演示动画字段
-- 创建日期: 2026-06-22
-- 功能:
--   1) 给 canonical_actions 增加缩略演示动画 URL 字段
--   2) reference_gif_url 保留为历史兼容字段，新后台使用 reference_animation_url
-- =====================================================

ALTER TABLE canonical_actions
ADD COLUMN IF NOT EXISTS reference_animation_url text;

COMMENT ON COLUMN canonical_actions.reference_animation_url IS '标准动作缩略演示动画 URL';
