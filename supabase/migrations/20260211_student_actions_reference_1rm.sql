-- 学员动作库增加全局参考1RM
-- 说明：
-- 1) 字段可空，仅对资格动作（力量+强度+智能计算）生效
-- 2) 不加 >0 约束，保留对辅助场景（可能出现负值）的兼容能力

ALTER TABLE student_actions
ADD COLUMN IF NOT EXISTS reference_1rm NUMERIC;

COMMENT ON COLUMN student_actions.reference_1rm IS
'学员该动作的全局参考1RM（仅资格动作生效，单位kg）';




