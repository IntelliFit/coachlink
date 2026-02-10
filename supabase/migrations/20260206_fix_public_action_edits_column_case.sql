-- =====================================================
-- 修复 community_action_edits camelCase 列名（PostgREST schema cache / 字段匹配）
-- 创建日期: 2026-02-06
-- 背景:
--   未加双引号的列名会被 PostgreSQL 自动转为小写，
--   导致 PostgREST 找不到 camelCase 列（PGRST204）。
-- =====================================================

DO $$
BEGIN
    -- proposed_enableAutoWeightCompute
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'community_action_edits'
          AND column_name = 'proposed_enableautoweightcompute'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'community_action_edits'
          AND column_name = 'proposed_enableAutoWeightCompute'
    ) THEN
        ALTER TABLE public.community_action_edits
            RENAME COLUMN proposed_enableautoweightcompute TO "proposed_enableAutoWeightCompute";
    END IF;

    -- proposed_includesBodyWeight
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'community_action_edits'
          AND column_name = 'proposed_includesbodyweight'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'community_action_edits'
          AND column_name = 'proposed_includesBodyWeight'
    ) THEN
        ALTER TABLE public.community_action_edits
            RENAME COLUMN proposed_includesbodyweight TO "proposed_includesBodyWeight";
    END IF;
END $$;

SELECT 'fix community_action_edits column case completed!' AS status;


