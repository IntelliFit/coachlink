-- =============================================
-- 支付模式系统数据库迁移
-- 创建时间: 2026-01-04
-- 功能: 支持灵活的支付模式切换
-- =============================================

-- 1. 创建全局平台设置表
CREATE TABLE IF NOT EXISTS platform_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key varchar NOT NULL UNIQUE,
    value jsonb NOT NULL,
    description text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 创建更新时间触发器
CREATE OR REPLACE TRIGGER platform_settings_set_updated_at
    BEFORE UPDATE ON platform_settings
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- 初始化全局支付模式配置
INSERT INTO platform_settings (key, value, description)
VALUES ('payment_mode', '{"default_mode": "qrcode"}', '全局默认支付模式配置')
ON CONFLICT (key) DO NOTHING;

-- 2. 修改 coaches 表

-- 2.1 添加 payment_qr_codes 字段（JSONB，支持多个收款码）
-- 格式: [{"type": "wechat", "name": "微信支付", "url": "..."}, {"type": "alipay", "name": "支付宝", "url": "..."}]
DO $$
BEGIN
    -- 检查是否存在旧的 payment_qr_code 字段
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'coaches' 
        AND column_name = 'payment_qr_code'
    ) THEN
        -- 如果存在旧字段，先迁移数据再删除
        ALTER TABLE coaches ADD COLUMN IF NOT EXISTS payment_qr_codes jsonb DEFAULT '[]';
        
        -- 迁移旧数据：将单个二维码转为数组格式
        UPDATE coaches 
        SET payment_qr_codes = jsonb_build_array(
            jsonb_build_object('type', 'alipay', 'name', '支付宝', 'url', payment_qr_code)
        )
        WHERE payment_qr_code IS NOT NULL 
        AND payment_qr_code != ''
        AND (payment_qr_codes IS NULL OR payment_qr_codes = '[]');
        
        -- 删除旧字段
        ALTER TABLE coaches DROP COLUMN payment_qr_code;
    ELSE
        -- 如果不存在旧字段，直接添加新字段
        ALTER TABLE coaches ADD COLUMN IF NOT EXISTS payment_qr_codes jsonb DEFAULT '[]';
    END IF;
END $$;

-- 2.2 添加 payment_mode 字段
-- 值: NULL(使用全局设置) | 'qrcode' | 'alipay_api' | 'both'
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS payment_mode varchar DEFAULT NULL;

-- 2.3 添加 allow_personal_qrcode 字段
-- 管理员控制教练是否允许使用个人二维码
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS allow_personal_qrcode boolean DEFAULT true;

-- 3. 添加约束
DO $$
BEGIN
    -- 检查约束是否已存在
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'coaches_payment_mode_check'
    ) THEN
        ALTER TABLE coaches ADD CONSTRAINT coaches_payment_mode_check 
        CHECK (payment_mode IS NULL OR payment_mode IN ('qrcode', 'alipay_api', 'both'));
    END IF;
END $$;

-- 4. 添加索引
CREATE INDEX IF NOT EXISTS idx_coaches_payment_mode ON coaches(payment_mode);
CREATE INDEX IF NOT EXISTS idx_coaches_allow_personal_qrcode ON coaches(allow_personal_qrcode);

-- 5. 添加 RLS 策略（如果需要）
-- platform_settings 表的 RLS
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- 允许所有已认证用户读取配置
CREATE POLICY "Allow authenticated read platform settings" 
ON platform_settings FOR SELECT 
TO authenticated 
USING (true);

-- 仅管理员可以更新配置（通过 service_role 或自定义逻辑）
CREATE POLICY "Allow service role full access to platform settings" 
ON platform_settings FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- 6. 授予权限
GRANT SELECT ON platform_settings TO authenticated;
GRANT ALL ON platform_settings TO service_role;

-- 7. 添加注释
COMMENT ON TABLE platform_settings IS '平台全局配置表';
COMMENT ON COLUMN platform_settings.key IS '配置项键名';
COMMENT ON COLUMN platform_settings.value IS '配置项值（JSONB格式）';

COMMENT ON COLUMN coaches.payment_qr_codes IS '教练收款二维码列表，格式: [{"type": "wechat/alipay", "name": "名称", "url": "图片URL"}]';
COMMENT ON COLUMN coaches.payment_mode IS '教练支付模式: NULL(使用全局), qrcode, alipay_api, both';
COMMENT ON COLUMN coaches.allow_personal_qrcode IS '是否允许教练使用个人收款二维码';
