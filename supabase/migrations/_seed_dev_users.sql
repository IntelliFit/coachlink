-- =====================================================
-- 开发环境种子数据
-- 用于分支数据库初始化测试用户
-- =====================================================

-- 生成固定的 UUID（方便后续引用）
-- 管理员: 11111111-1111-1111-1111-111111111111
-- 学员:   22222222-2222-2222-2222-222222222222  
-- 教练:   33333333-3333-3333-3333-333333333333

-- 1. 创建用户
INSERT INTO users (id, phone, password_hash, is_admin, is_coach, primary_role, created_at, updated_at) VALUES
  ('11111111-1111-1111-1111-111111111111', '13915850621', '$2a$10$dummy_hash_admin', true, false, 'admin', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '13921064643', '$2a$10$dummy_hash_student', false, false, 'student', now(), now()),
  ('33333333-3333-3333-3333-333333333333', '18115072586', '$2a$10$dummy_hash_coach', false, true, 'coach', now(), now())
ON CONFLICT (phone) DO NOTHING;

-- 2. 创建用户档案
INSERT INTO user_profiles (id, user_id, full_name, nickname, phone, created_at, updated_at) VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '教链小助手', '教链小助手', '13915850621', now(), now()),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '沈妈妈', '沈妈妈', '13921064643', now(), now()),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', '枭马葛', '枭马葛', '18115072586', now(), now())
ON CONFLICT (user_id) DO NOTHING;

-- 3. 创建教练记录
INSERT INTO coaches (id, user_id, name, title, bio, status, created_at, updated_at) VALUES
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', '枭马葛', '资深力量教练', '专注力量训练10年', 'approved', now(), now())
ON CONFLICT DO NOTHING;

-- 4. 创建管理员记录
INSERT INTO admin_users (id, user_id, role, permissions, created_at) VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'super_admin', ARRAY['all'], now())
ON CONFLICT (user_id) DO NOTHING;

SELECT '种子数据插入完成！' AS status;
