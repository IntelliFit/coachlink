-- 为 coaches 表添加位置信息字段
-- 用于记录教练的常住城市和详细地址信息

-- 添加位置相关字段
ALTER TABLE coaches 
ADD COLUMN IF NOT EXISTS city VARCHAR(100),           -- 常住城市（省市区格式）
ADD COLUMN IF NOT EXISTS address TEXT,                -- 详细地址
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7),     -- 纬度（精确到7位小数，约1厘米精度）
ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7);    -- 经度（精确到7位小数，约1厘米精度）

-- 添加注释
COMMENT ON COLUMN coaches.city IS '教练常住城市，格式：省-市-区，例如：北京市-北京市-朝阳区';
COMMENT ON COLUMN coaches.address IS '教练详细地址（选填）';
COMMENT ON COLUMN coaches.latitude IS '教练位置纬度坐标';
COMMENT ON COLUMN coaches.longitude IS '教练位置经度坐标';

-- 为经纬度字段创建索引，便于地理位置查询
CREATE INDEX IF NOT EXISTS idx_coaches_location ON coaches(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- 添加约束：纬度范围 -90 到 90
ALTER TABLE coaches 
ADD CONSTRAINT IF NOT EXISTS check_coaches_latitude 
CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));

-- 添加约束：经度范围 -180 到 180
ALTER TABLE coaches 
ADD CONSTRAINT IF NOT EXISTS check_coaches_longitude 
CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
