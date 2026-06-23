-- =====================================================
-- 标准动作参考图字段
-- 创建日期: 2026-06-21
-- 功能:
--   1) 给 canonical_actions 增加标准动作参考图 URL 字段
--   2) 供动作库标准动作三关键帧图上传 COS 后回写
-- =====================================================

ALTER TABLE canonical_actions
ADD COLUMN IF NOT EXISTS reference_image_url text,
ADD COLUMN IF NOT EXISTS reference_gif_url text;

COMMENT ON COLUMN canonical_actions.reference_image_url IS '标准动作参考图 URL';
COMMENT ON COLUMN canonical_actions.reference_gif_url IS '标准动作参考动图 URL';
