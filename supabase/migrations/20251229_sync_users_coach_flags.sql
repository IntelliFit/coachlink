-- 将教练资格以 coaches 表为真源，同步 users 的标记，保持一致性
-- 使用前请确认已连接正确的数据库环境
-- 逻辑：
--   1) 先全部降级为学员（管理员保持 admin 角色）
--   2) 对在 coaches 中已批准的用户，提升为教练（或 admin 仍保持 admin）

BEGIN;

-- 1) 全量降级：清理脏标记
UPDATE users
SET is_coach = false,
    coach_status = 'none',
    primary_role = CASE WHEN is_admin THEN 'admin' ELSE 'student' END;

-- 2) 以 coaches.status='approved' 作为教练真源，同步回 users
UPDATE users u
SET is_coach = true,
    coach_status = 'approved',
    primary_role = CASE WHEN u.is_admin THEN 'admin' ELSE 'coach' END
FROM coaches c
WHERE c.user_id = u.id
  AND c.status = 'approved';

COMMIT;

-- 可选：执行后检查
-- SELECT is_coach, coach_status, primary_role, COUNT(*) FROM users GROUP BY 1,2,3;
-- SELECT COUNT(*) FROM coaches WHERE status='approved';

