-- 删除教练枭马葛的所有学员订阅关系及相关数据
-- 教练ID: 87eec87c-aa2f-46bb-8208-4b54e261e492
-- 用户ID: f9eac5b1-45f9-4479-9ab8-8223a5db8835
-- 执行时间: 2025-12-29

-- 注意：按照外键依赖关系，从最底层开始删除

BEGIN;

-- 1. 删除执行组视频（依赖 plan_instance_executions）
DELETE FROM execution_set_videos
WHERE execution_id IN (
    SELECT id FROM plan_instance_executions
    WHERE instance_id IN (
        SELECT id FROM coach_plan_instances
        WHERE coach_subscription_id IN (
            SELECT id FROM coach_subscriptions
            WHERE coach_id = '87eec87c-aa2f-46bb-8208-4b54e261e492'
        )
    )
);

-- 2. 删除计划实例执行记录（依赖 coach_plan_instances）
DELETE FROM plan_instance_executions
WHERE instance_id IN (
    SELECT id FROM coach_plan_instances
    WHERE coach_subscription_id IN (
        SELECT id FROM coach_subscriptions
        WHERE coach_id = '87eec87c-aa2f-46bb-8208-4b54e261e492'
    )
);

-- 3. 删除个人记录历史（可能关联执行记录）
DELETE FROM personal_records_history
WHERE execution_id IN (
    SELECT id FROM plan_instance_executions
    WHERE instance_id IN (
        SELECT id FROM coach_plan_instances
        WHERE coach_subscription_id IN (
            SELECT id FROM coach_subscriptions
            WHERE coach_id = '87eec87c-aa2f-46bb-8208-4b54e261e492'
        )
    )
);

-- 4. 删除聊天消息（依赖 chat_rooms）
DELETE FROM chat_messages
WHERE room_id IN (
    SELECT id FROM chat_rooms
    WHERE subscription_id IN (
        SELECT id FROM coach_subscriptions
        WHERE coach_id = '87eec87c-aa2f-46bb-8208-4b54e261e492'
    )
);

-- 5. 删除聊天室未读消息（依赖 chat_rooms）
DELETE FROM chat_room_unreads
WHERE room_id IN (
    SELECT id FROM chat_rooms
    WHERE subscription_id IN (
        SELECT id FROM coach_subscriptions
        WHERE coach_id = '87eec87c-aa2f-46bb-8208-4b54e261e492'
    )
);

-- 6. 删除聊天室（依赖 coach_subscriptions）
DELETE FROM chat_rooms
WHERE subscription_id IN (
    SELECT id FROM coach_subscriptions
    WHERE coach_id = '87eec87c-aa2f-46bb-8208-4b54e261e492'
);

-- 7. 删除教练评价（依赖 coach_subscriptions）
DELETE FROM coach_reviews
WHERE coach_subscription_id IN (
    SELECT id FROM coach_subscriptions
    WHERE coach_id = '87eec87c-aa2f-46bb-8208-4b54e261e492'
);

-- 8. 删除计划实例（依赖 coach_subscriptions）
DELETE FROM coach_plan_instances
WHERE coach_subscription_id IN (
    SELECT id FROM coach_subscriptions
    WHERE coach_id = '87eec87c-aa2f-46bb-8208-4b54e261e492'
);

-- 9. 删除旧系统的训练记录（可能关联订阅）
DELETE FROM training_records
WHERE plan_id IN (
    SELECT id FROM training_plans
    WHERE coach_id = '87eec87c-aa2f-46bb-8208-4b54e261e492'
);

-- 10. 删除旧系统的组视频（依赖 training_records）
DELETE FROM set_videos
WHERE training_record_id IN (
    SELECT id FROM training_records
    WHERE plan_id IN (
        SELECT id FROM training_plans
        WHERE coach_id = '87eec87c-aa2f-46bb-8208-4b54e261e492'
    )
);

-- 11. 删除训练计划详情（依赖 training_plans）
DELETE FROM training_plan_details
WHERE training_plan_id IN (
    SELECT id FROM training_plans
    WHERE coach_id = '87eec87c-aa2f-46bb-8208-4b54e261e492'
);

-- 12. 删除训练视频（先删除，因为依赖 training_plans）
DELETE FROM training_videos
WHERE coach_id = '87eec87c-aa2f-46bb-8208-4b54e261e492'
   OR training_plan_id IN (
       SELECT id FROM training_plans
       WHERE coach_id = '87eec87c-aa2f-46bb-8208-4b54e261e492'
   );

-- 13. 删除训练计划（关联教练）
DELETE FROM training_plans
WHERE coach_id = '87eec87c-aa2f-46bb-8208-4b54e261e492';

-- 14. 删除入职问卷（可能关联订阅）
DELETE FROM onboarding_questionnaires
WHERE coach_id = '87eec87c-aa2f-46bb-8208-4b54e261e492';

-- 15. 删除学员评论（关联教练）
DELETE FROM student_comments
WHERE coach_id = '87eec87c-aa2f-46bb-8208-4b54e261e492';

-- 16. 删除旧系统的会话表（已重构为 chat_rooms，已在步骤6中处理，跳过）
-- DELETE FROM conversations  -- 表已不存在，已重构为 chat_rooms

-- 17. 最后删除订阅关系
DELETE FROM coach_subscriptions
WHERE coach_id = '87eec87c-aa2f-46bb-8208-4b54e261e492';

COMMIT;

-- 查询删除结果统计
SELECT 
    'execution_set_videos' as table_name,
    COUNT(*) as remaining_count
FROM execution_set_videos
WHERE execution_id IN (
    SELECT id FROM plan_instance_executions
    WHERE instance_id IN (
        SELECT id FROM coach_plan_instances
        WHERE coach_subscription_id IN (
            SELECT id FROM coach_subscriptions
            WHERE coach_id = '87eec87c-aa2f-46bb-8208-4b54e261e492'
        )
    )
)
UNION ALL
SELECT 
    'plan_instance_executions' as table_name,
    COUNT(*) as remaining_count
FROM plan_instance_executions
WHERE instance_id IN (
    SELECT id FROM coach_plan_instances
    WHERE coach_subscription_id IN (
        SELECT id FROM coach_subscriptions
        WHERE coach_id = '87eec87c-aa2f-46bb-8208-4b54e261e492'
    )
)
UNION ALL
SELECT 
    'coach_plan_instances' as table_name,
    COUNT(*) as remaining_count
FROM coach_plan_instances
WHERE coach_subscription_id IN (
    SELECT id FROM coach_subscriptions
    WHERE coach_id = '87eec87c-aa2f-46bb-8208-4b54e261e492'
)
UNION ALL
SELECT 
    'coach_subscriptions' as table_name,
    COUNT(*) as remaining_count
FROM coach_subscriptions
WHERE coach_id = '87eec87c-aa2f-46bb-8208-4b54e261e492';

