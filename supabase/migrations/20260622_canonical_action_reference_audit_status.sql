-- =====================================================
-- 标准动作参考图 / 缩略演示动画审核状态字段
-- 创建日期: 2026-06-22
-- 功能:
--   1) 给 canonical_actions 增加参考图审核状态字段
--   2) 给 canonical_actions 增加缩略演示动画审核状态字段
--   3) 状态统一为：unreviewed / rejected / approved
-- =====================================================

ALTER TABLE canonical_actions
ADD COLUMN IF NOT EXISTS reference_image_audit_status text NOT NULL DEFAULT 'unreviewed',
ADD COLUMN IF NOT EXISTS reference_animation_audit_status text NOT NULL DEFAULT 'unreviewed';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'canonical_actions_reference_image_audit_status_check'
  ) THEN
    ALTER TABLE canonical_actions
    ADD CONSTRAINT canonical_actions_reference_image_audit_status_check
    CHECK (reference_image_audit_status IN ('unreviewed', 'rejected', 'approved'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'canonical_actions_reference_animation_audit_status_check'
  ) THEN
    ALTER TABLE canonical_actions
    ADD CONSTRAINT canonical_actions_reference_animation_audit_status_check
    CHECK (reference_animation_audit_status IN ('unreviewed', 'rejected', 'approved'));
  END IF;
END $$;

COMMENT ON COLUMN canonical_actions.reference_image_audit_status IS '标准动作参考图审核状态：unreviewed/rejected/approved';
COMMENT ON COLUMN canonical_actions.reference_animation_audit_status IS '标准动作缩略演示动画审核状态：unreviewed/rejected/approved';
