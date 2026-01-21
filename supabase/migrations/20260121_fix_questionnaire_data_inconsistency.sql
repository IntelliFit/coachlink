-- 修复问卷数据不一致问题
-- 确保 status 和 is_active 保持一致

-- 情况1：修复 status='active' 但 is_active=false 的数据
-- 这些数据应该被修复为 is_active=true
UPDATE coach_questionnaires
SET is_active = true
WHERE status = 'active' AND is_active = false;

-- 情况2：修复 status='archived' 但 is_active=true 的数据
-- 这些数据应该被修复为 is_active=false
UPDATE coach_questionnaires
SET is_active = false
WHERE status = 'archived' AND is_active = true;

-- 情况3：修复 status 为空但 is_active 有值的数据
-- 从 is_active 推导 status
UPDATE coach_questionnaires
SET status = CASE 
    WHEN is_active = true THEN 'active'
    WHEN is_active = false THEN 'archived'
    ELSE 'archived'  -- 默认值
END
WHERE (status IS NULL OR status = '') 
  AND is_active IS NOT NULL;

-- 情况4：修复 is_active 为空但 status 有值的数据
-- 从 status 推导 is_active
UPDATE coach_questionnaires
SET is_active = (status = 'active')
WHERE (is_active IS NULL)
  AND status IS NOT NULL 
  AND status != '';

-- 验证修复结果（可选，用于检查）
-- 查询仍然不一致的数据（应该返回空结果）
-- SELECT id, coach_id, status, is_active, updated_at
-- FROM coach_questionnaires
-- WHERE 
--   (status = 'active' AND is_active = false) OR
--   (status = 'archived' AND is_active = true) OR
--   (status IS NULL AND is_active IS NOT NULL) OR
--   (is_active IS NULL AND status IS NOT NULL AND status != '');
