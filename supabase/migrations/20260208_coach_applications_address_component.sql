-- 地址字段平铺：省、市、区分开存，对应 province、city、county
-- coaches：在原有 city/address/latitude/longitude 基础上增加 province、county
-- coach_applications：位置字段平铺为 province、city、county、address、latitude、longitude

-- coaches 表：增加省、区
ALTER TABLE coaches
ADD COLUMN IF NOT EXISTS province VARCHAR(100),
ADD COLUMN IF NOT EXISTS county VARCHAR(100);

COMMENT ON COLUMN coaches.province IS '省';
COMMENT ON COLUMN coaches.city IS '市';
COMMENT ON COLUMN coaches.county IS '区/县';

-- coach_applications 表：位置字段（若尚未存在则添加），不存 address_component
ALTER TABLE coach_applications
ADD COLUMN IF NOT EXISTS province VARCHAR(100),
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS county VARCHAR(100),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7);

COMMENT ON COLUMN coach_applications.province IS '省';
COMMENT ON COLUMN coach_applications.city IS '市';
COMMENT ON COLUMN coach_applications.county IS '区/县';
COMMENT ON COLUMN coach_applications.address IS '详细地址（选填）';
COMMENT ON COLUMN coach_applications.latitude IS '位置纬度';
COMMENT ON COLUMN coach_applications.longitude IS '位置经度';

-- 若之前已添加过 address_component 列，可取消注释以删除
-- ALTER TABLE coach_applications DROP COLUMN IF EXISTS address_component;
