-- =====================================================
-- 修复动作库重复数据 & 添加唯一约束
-- 1. 删除 coach_actions 中的重复记录（保留最新的）
-- 2. 删除 student_actions 中的重复记录（保留最新的）
-- 3. 添加唯一约束防止未来重复
-- =====================================================

-- Step 1: 删除 coach_actions 中的重复记录
-- 对于每个 (coach_id, name) 组合，只保留 created_at 最新的记录
DELETE FROM coach_actions
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY coach_id, name
                   ORDER BY created_at DESC
               ) AS rn
        FROM coach_actions
    ) ranked
    WHERE rn > 1
);

-- Step 2: 删除 student_actions 中的重复记录（如果存在）
-- 对于每个 (user_id, name) 组合，只保留 created_at 最新的记录
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'student_actions') THEN
        DELETE FROM student_actions
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY user_id, name
                           ORDER BY created_at DESC
                       ) AS rn
                FROM student_actions
            ) ranked
            WHERE rn > 1
        );
    END IF;
END $$;

-- Step 3: 添加唯一约束到 coach_actions
-- 防止同一教练创建同名动作
ALTER TABLE coach_actions
DROP CONSTRAINT IF EXISTS unique_coach_action_name;

ALTER TABLE coach_actions
ADD CONSTRAINT unique_coach_action_name UNIQUE (coach_id, name);

-- Step 4: 添加唯一约束到 student_actions（如果存在）
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'student_actions') THEN
        EXECUTE 'ALTER TABLE student_actions DROP CONSTRAINT IF EXISTS unique_student_action_name';
        EXECUTE 'ALTER TABLE student_actions ADD CONSTRAINT unique_student_action_name UNIQUE (user_id, name)';
    END IF;
END $$;

SELECT '动作库重复数据已清理，唯一约束已添加' AS status;
