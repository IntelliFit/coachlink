-- =====================================================
-- 数据迁移：subscribe_data → questionnaire_responses
-- =====================================================
-- 说明：将 coach_subscriptions.subscribe_data 中的问卷回答
--       迁移到新的 questionnaire_responses 表

-- 前提条件：
-- 1. 已执行 20260106_questionnaire_versioning.sql
-- 2. questionnaire_responses 表已存在

-- Step 1: 迁移现有的 subscribe_data 到 questionnaire_responses
INSERT INTO questionnaire_responses (
  student_id,
  coach_id,
  questionnaire_id,
  questionnaire_version,
  answers,
  context,
  created_at
)
SELECT 
  cs.student_id,
  cs.coach_id,
  cq.id AS questionnaire_id,
  COALESCE(cq.version, 1) AS questionnaire_version,
  cs.subscribe_data AS answers,
  'initial' AS context,  -- 订阅时填写的问卷标记为 initial
  cs.created_at
FROM coach_subscriptions cs
LEFT JOIN coach_questionnaires cq 
  ON cq.coach_id = cs.coach_id 
  AND cq.is_active = true
WHERE cs.subscribe_data IS NOT NULL 
  AND cs.subscribe_data::text != '{}'::text
  AND cs.subscribe_data::text != 'null'::text
  -- 避免重复迁移：只迁移还未创建 response 的订阅
  AND NOT EXISTS (
    SELECT 1 FROM questionnaire_responses qr 
    WHERE qr.student_id = cs.student_id 
      AND qr.coach_id = cs.coach_id
      AND qr.context = 'initial'
      AND qr.created_at = cs.created_at
  );

-- Step 2: 报告迁移结果
DO $$
DECLARE
  migrated_count integer;
BEGIN
  SELECT COUNT(*) INTO migrated_count
  FROM questionnaire_responses
  WHERE context = 'initial';
  
  RAISE NOTICE '成功迁移 % 条问卷回答记录', migrated_count;
END $$;

-- Step 3: (可选) 验证迁移结果
-- 检查是否有 subscribe_data 未被迁移
SELECT 
  cs.id,
  cs.student_id,
  cs.coach_id,
  cs.subscribe_data
FROM coach_subscriptions cs
WHERE cs.subscribe_data IS NOT NULL 
  AND cs.subscribe_data::text != '{}'::text
  AND cs.subscribe_data::text != 'null'::text
  AND NOT EXISTS (
    SELECT 1 FROM questionnaire_responses qr 
    WHERE qr.student_id = cs.student_id 
      AND qr.coach_id = cs.coach_id
      AND qr.context = 'initial'
  );

-- 如果上面的查询返回空，说明所有数据都已迁移成功

SELECT 'Data migration completed successfully' AS result;
