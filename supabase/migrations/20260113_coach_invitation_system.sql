-- ============================================================================
-- 教练邀请码与订阅期视野控制系统
-- ============================================================================
-- 功能：
-- 1. 为教练添加唯一邀请码，用于邀请学员注册
-- 2. 为教练添加邀请模式设置（专属/开放）
-- 3. 记录学员的邀请来源教练
-- ============================================================================

-- 1. 为 coaches 表添加邀请码相关字段
ALTER TABLE coaches 
ADD COLUMN IF NOT EXISTS invitation_code VARCHAR(16) UNIQUE,
ADD COLUMN IF NOT EXISTS invitation_mode VARCHAR(20) DEFAULT 'exclusive';

-- 添加约束确保邀请模式只能是 exclusive 或 open
ALTER TABLE coaches 
ADD CONSTRAINT check_invitation_mode 
CHECK (invitation_mode IN ('exclusive', 'open'));

-- 2. 为 users 表添加邀请来源字段
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS referrer_coach_id UUID REFERENCES coaches(id);

-- 3. 为现有教练生成唯一邀请码（8位大写字母数字）
-- 使用 DO 块确保每个教练获得唯一的邀请码
DO $$
DECLARE
    coach_record RECORD;
    new_code VARCHAR(16);
    code_exists BOOLEAN;
BEGIN
    FOR coach_record IN SELECT id FROM coaches WHERE invitation_code IS NULL LOOP
        LOOP
            -- 生成 8 位随机邀请码
            new_code := UPPER(SUBSTR(MD5(RANDOM()::TEXT || clock_timestamp()::TEXT), 1, 8));
            
            -- 检查是否已存在
            SELECT EXISTS(SELECT 1 FROM coaches WHERE invitation_code = new_code) INTO code_exists;
            
            -- 如果不存在则退出循环
            EXIT WHEN NOT code_exists;
        END LOOP;
        
        -- 更新该教练的邀请码
        UPDATE coaches SET invitation_code = new_code WHERE id = coach_record.id;
    END LOOP;
END $$;

-- 4. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_users_referrer_coach ON users(referrer_coach_id);
CREATE INDEX IF NOT EXISTS idx_coaches_invitation_code ON coaches(invitation_code);

-- 5. 添加注释
COMMENT ON COLUMN coaches.invitation_code IS '教练唯一邀请码，用于邀请学员注册';
COMMENT ON COLUMN coaches.invitation_mode IS '邀请模式：exclusive（专属模式-学员只能看到该教练）或 open（开放模式-学员可看到所有教练）';
COMMENT ON COLUMN users.referrer_coach_id IS '邀请该用户注册的教练ID，用于视野控制';
