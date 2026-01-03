-- 快速检查：查看 coach_actions 表结构
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'coach_actions'
ORDER BY ordinal_position;
