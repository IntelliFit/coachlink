-- 删除除枭马葛之外的所有教练及其相关数据
-- 保留的教练ID: 99fffd99-b775-4551-b06a-a6bf2370f21a (枭马葛)
-- 执行时间: 2025-12-29

-- 注意：按照外键依赖关系，从最底层开始删除
-- 使用 NOT IN 排除要保留的教练

BEGIN;

-- 1. 删除执行组视频（依赖 plan_instance_executions）
DELETE FROM execution_set_videos
WHERE execution_id IN (
    SELECT id FROM plan_instance_executions
    WHERE instance_id IN (
        SELECT id FROM coach_plan_instances
        WHERE coach_subscription_id IN (
            SELECT id FROM coach_subscriptions
            WHERE coach_id != '99fffd99-b775-4551-b06a-a6bf2370f21a'
        )
    )
);

-- 2. 删除计划实例执行记录（依赖 coach_plan_instances）
DELETE FROM plan_instance_executions
WHERE instance_id IN (
    SELECT id FROM coach_plan_instances
    WHERE coach_subscription_id IN (
        SELECT id FROM coach_subscriptions
        WHERE coach_id != '99fffd99-b775-4551-b06a-a6bf2370f21a'
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
            WHERE coach_id != '99fffd99-b775-4551-b06a-a6bf2370f21a'
        )
    )
);

-- 4. 删除聊天消息（依赖 chat_rooms）
DELETE FROM chat_messages
WHERE room_id IN (
    SELECT id FROM chat_rooms
    WHERE subscription_id IN (
        SELECT id FROM coach_subscriptions
        WHERE coach_id != '99fffd99-b775-4551-b06a-a6bf2370f21a'
    )
);

-- 5. 删除聊天室未读消息（依赖 chat_rooms）
DELETE FROM chat_room_unreads
WHERE room_id IN (
    SELECT id FROM chat_rooms
    WHERE subscription_id IN (
        SELECT id FROM coach_subscriptions
        WHERE coach_id != '99fffd99-b775-4551-b06a-a6bf2370f21a'
    )
);

-- 6. 删除聊天室（依赖 coach_subscriptions）
DELETE FROM chat_rooms
WHERE subscription_id IN (
    SELECT id FROM coach_subscriptions
    WHERE coach_id != '99fffd99-b775-4551-b06a-a6bf2370f21a'
);

-- 7. 删除教练评价（依赖 coach_subscriptions）
DELETE FROM coach_reviews
WHERE coach_subscription_id IN (
    SELECT id FROM coach_subscriptions
    WHERE coach_id != '99fffd99-b775-4551-b06a-a6bf2370f21a'
);

-- 8. 删除计划实例（依赖 coach_subscriptions）
DELETE FROM coach_plan_instances
WHERE coach_subscription_id IN (
    SELECT id FROM coach_subscriptions
    WHERE coach_id != '99fffd99-b775-4551-b06a-a6bf2370f21a'
);

-- 9. 删除旧系统的训练记录（可能关联订阅）
DELETE FROM training_records
WHERE plan_id IN (
    SELECT id FROM training_plans
    WHERE coach_id != '99fffd99-b775-4551-b06a-a6bf2370f21a'
);

-- 10. 删除旧系统的组视频（依赖 training_records）
DELETE FROM set_videos
WHERE training_record_id IN (
    SELECT id FROM training_records
    WHERE plan_id IN (
        SELECT id FROM training_plans
        WHERE coach_id != '99fffd99-b775-4551-b06a-a6bf2370f21a'
    )
);

-- 11. 删除训练计划详情（依赖 training_plans）
DELETE FROM training_plan_details
WHERE training_plan_id IN (
    SELECT id FROM training_plans
    WHERE coach_id != '99fffd99-b775-4551-b06a-a6bf2370f21a'
);

-- 12. 删除训练视频（先删除，因为依赖 training_plans）
DELETE FROM training_videos
WHERE coach_id != '99fffd99-b775-4551-b06a-a6bf2370f21a'
   OR training_plan_id IN (
       SELECT id FROM training_plans
       WHERE coach_id != '99fffd99-b775-4551-b06a-a6bf2370f21a'
   );

-- 13. 删除训练计划（关联教练）
DELETE FROM training_plans
WHERE coach_id != '99fffd99-b775-4551-b06a-a6bf2370f21a';

-- 14. 删除入职问卷（可能关联订阅）
DELETE FROM onboarding_questionnaires
WHERE coach_id != '99fffd99-b775-4551-b06a-a6bf2370f21a';

-- 15. 删除学员评论（关联教练）
DELETE FROM student_comments
WHERE coach_id != '99fffd99-b775-4551-b06a-a6bf2370f21a';

-- 16. 删除订阅关系
DELETE FROM coach_subscriptions
WHERE coach_id != '99fffd99-b775-4551-b06a-a6bf2370f21a';

-- 17. 删除教练内容库
DELETE FROM coach_contents
WHERE coach_id != '99fffd99-b775-4551-b06a-a6bf2370f21a';

-- 18. 删除教练问卷
DELETE FROM coach_questionnaires
WHERE coach_id != '99fffd99-b775-4551-b06a-a6bf2370f21a';

-- 19. 删除教练规则包
DELETE FROM coach_rulepacks
WHERE coach_id != '99fffd99-b775-4551-b06a-a6bf2370f21a';

-- 20. 删除教练计划模板
DELETE FROM coach_plan_templates
WHERE coach_id != '99fffd99-b775-4551-b06a-a6bf2370f21a';

-- 21. 删除教练定价
DELETE FROM coach_pricing
WHERE coach_id != '99fffd99-b775-4551-b06a-a6bf2370f21a';

-- 22. 删除教练行为日志
DELETE FROM coach_actions
WHERE coach_id != '99fffd99-b775-4551-b06a-a6bf2370f21a';

-- 23. 最后删除其他教练记录
DELETE FROM coaches
WHERE id != '99fffd99-b775-4551-b06a-a6bf2370f21a';

COMMIT;

-- 查询删除结果统计
SELECT 
    'coaches' as table_name,
    COUNT(*) as remaining_count,
    string_agg(name, ', ') as coach_names
FROM coaches
UNION ALL
SELECT 
    'coach_subscriptions' as table_name,
    COUNT(*) as remaining_count,
    '' as coach_names
FROM coach_subscriptions
UNION ALL
SELECT 
    'coach_plan_instances' as table_name,
    COUNT(*) as remaining_count,
    '' as coach_names
FROM coach_plan_instances;

