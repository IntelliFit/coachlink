-- 清理街健数据社区中超出合理范围（kg）的提交记录，与前后端校验上限一致。
-- 上限见 src/lib/streetliftingSubmissionLimits.ts（当前：体重、附加负重均 ≤ 250）

delete from public.streetlifting_submissions
where bodyweight > 250
   or added_weight > 250;
