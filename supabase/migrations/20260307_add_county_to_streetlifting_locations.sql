-- 为 streetlifting_locations 表添加 county 字段，并确保 latitude/longitude 存在
-- 20260307_add_county_to_streetlifting_locations.sql

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='streetlifting_locations' AND column_name='county') THEN
        ALTER TABLE public.streetlifting_locations ADD COLUMN county text;
    END IF;
END $$;

COMMENT ON COLUMN public.streetlifting_locations.county IS '区/县';
