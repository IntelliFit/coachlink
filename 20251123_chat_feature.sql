-- =====================================================
-- 聊天功能数据库迁移
-- 创建时间: 2025-11-23
-- 描述: 为学员-教练聊天功能创建所需的表、索引和触发器
-- =====================================================

-- =====================================================
-- 1. 创建会话表 (conversations)
-- =====================================================
CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "subscription_id" "uuid",
    "last_message" "text",
    "last_message_at" timestamp with time zone,
    "student_unread" integer DEFAULT 0 NOT NULL,
    "coach_unread" integer DEFAULT 0 NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    
    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "unique_student_coach_conversation" UNIQUE ("student_id", "coach_id"),
    CONSTRAINT "conversations_student_unread_check" CHECK (("student_unread" >= 0)),
    CONSTRAINT "conversations_coach_unread_check" CHECK (("coach_unread" >= 0))
);

ALTER TABLE "public"."conversations" OWNER TO "postgres";

COMMENT ON TABLE "public"."conversations" IS '学员-教练会话表';
COMMENT ON COLUMN "public"."conversations"."student_id" IS '学员ID (users.id)';
COMMENT ON COLUMN "public"."conversations"."coach_id" IS '教练ID (coaches.id)';
COMMENT ON COLUMN "public"."conversations"."subscription_id" IS '关联的订阅ID';
COMMENT ON COLUMN "public"."conversations"."last_message" IS '最后一条消息预览（前100字符）';
COMMENT ON COLUMN "public"."conversations"."last_message_at" IS '最后消息时间';
COMMENT ON COLUMN "public"."conversations"."student_unread" IS '学员未读消息数';
COMMENT ON COLUMN "public"."conversations"."coach_unread" IS '教练未读消息数';

-- =====================================================
-- 2. 添加外键约束
-- =====================================================
ALTER TABLE "public"."conversations"
    ADD CONSTRAINT "conversations_student_id_fkey" 
    FOREIGN KEY ("student_id") 
    REFERENCES "public"."users"("id") 
    ON DELETE CASCADE;

ALTER TABLE "public"."conversations"
    ADD CONSTRAINT "conversations_coach_id_fkey" 
    FOREIGN KEY ("coach_id") 
    REFERENCES "public"."coaches"("id") 
    ON DELETE CASCADE;

ALTER TABLE "public"."conversations"
    ADD CONSTRAINT "conversations_subscription_id_fkey" 
    FOREIGN KEY ("subscription_id") 
    REFERENCES "public"."coach_subscriptions"("id") 
    ON DELETE SET NULL;

-- =====================================================
-- 3. 创建索引（优化查询性能）
-- =====================================================

-- conversations 表索引
CREATE INDEX IF NOT EXISTS "idx_conversations_student" 
    ON "public"."conversations"("student_id", "updated_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_conversations_coach" 
    ON "public"."conversations"("coach_id", "updated_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_conversations_updated" 
    ON "public"."conversations"("updated_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_conversations_student_unread" 
    ON "public"."conversations"("student_id") 
    WHERE "student_unread" > 0;

CREATE INDEX IF NOT EXISTS "idx_conversations_coach_unread" 
    ON "public"."conversations"("coach_id") 
    WHERE "coach_unread" > 0;

-- coach_messages 表索引（如果不存在）
CREATE INDEX IF NOT EXISTS "idx_coach_messages_conversation" 
    ON "public"."coach_messages"("conversation_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_coach_messages_sender" 
    ON "public"."coach_messages"("sender_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_coach_messages_receiver_unread" 
    ON "public"."coach_messages"("receiver_id", "is_read", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_coach_messages_unread" 
    ON "public"."coach_messages"("receiver_id", "conversation_id") 
    WHERE "is_read" = false;

-- =====================================================
-- 4. 创建触发器函数 - 新消息时更新会话
-- =====================================================
CREATE OR REPLACE FUNCTION "public"."update_conversation_on_new_message"()
RETURNS TRIGGER AS $$
DECLARE
    v_coach_id uuid;
    v_student_id uuid;
    is_sender_student boolean := false;
BEGIN
    -- 获取会话信息
    SELECT coach_id, student_id 
    INTO v_coach_id, v_student_id
    FROM conversations 
    WHERE id = NEW.conversation_id;
    
    -- 判断发送者是学员还是教练
    IF NEW.sender_id = v_student_id THEN
        is_sender_student := true;
    END IF;
    
    -- 更新会话信息
    UPDATE conversations
    SET 
        last_message = LEFT(NEW.content, 100),
        last_message_at = NEW.created_at,
        updated_at = NEW.created_at,
        -- 如果是学员发送，增加教练未读数；否则增加学员未读数
        student_unread = CASE 
            WHEN is_sender_student THEN student_unread 
            ELSE student_unread + 1 
        END,
        coach_unread = CASE 
            WHEN is_sender_student THEN coach_unread + 1 
            ELSE coach_unread 
        END
    WHERE id = NEW.conversation_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION "public"."update_conversation_on_new_message"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."update_conversation_on_new_message"() 
IS '新消息插入时自动更新会话的最后消息和未读数';

-- =====================================================
-- 5. 创建触发器函数 - 标记已读时更新未读数
-- =====================================================
CREATE OR REPLACE FUNCTION "public"."update_conversation_unread_on_read"()
RETURNS TRIGGER AS $$
DECLARE
    v_coach_id uuid;
    v_student_id uuid;
    is_reader_student boolean := false;
BEGIN
    -- 只在 is_read 从 false 变为 true 时执行
    IF NEW.is_read = true AND OLD.is_read = false THEN
        -- 获取会话信息
        SELECT coach_id, student_id 
        INTO v_coach_id, v_student_id
        FROM conversations 
        WHERE id = NEW.conversation_id;
        
        -- 判断读取者是学员还是教练
        IF NEW.receiver_id = v_student_id THEN
            is_reader_student := true;
        END IF;
        
        -- 减少相应的未读数（最小为0）
        UPDATE conversations
        SET 
            student_unread = CASE 
                WHEN is_reader_student THEN GREATEST(student_unread - 1, 0)
                ELSE student_unread
            END,
            coach_unread = CASE 
                WHEN is_reader_student THEN coach_unread
                ELSE GREATEST(coach_unread - 1, 0)
            END
        WHERE id = NEW.conversation_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION "public"."update_conversation_unread_on_read"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."update_conversation_unread_on_read"() 
IS '消息标记为已读时自动减少会话的未读数';

-- =====================================================
-- 6. 创建触发器函数 - 自动更新 updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION "public"."update_conversations_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION "public"."update_conversations_updated_at"() OWNER TO "postgres";

-- =====================================================
-- 7. 绑定触发器到表
-- =====================================================

-- 新消息时更新会话
DROP TRIGGER IF EXISTS "trigger_update_conversation_on_new_message" 
    ON "public"."coach_messages";
    
CREATE TRIGGER "trigger_update_conversation_on_new_message"
    AFTER INSERT ON "public"."coach_messages"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_conversation_on_new_message"();

-- 标记已读时更新未读数
DROP TRIGGER IF EXISTS "trigger_update_conversation_unread_on_read" 
    ON "public"."coach_messages";
    
CREATE TRIGGER "trigger_update_conversation_unread_on_read"
    AFTER UPDATE OF "is_read" ON "public"."coach_messages"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_conversation_unread_on_read"();

-- 更新会话的 updated_at 字段
DROP TRIGGER IF EXISTS "trigger_update_conversations_updated_at" 
    ON "public"."conversations";
    
CREATE TRIGGER "trigger_update_conversations_updated_at"
    BEFORE UPDATE ON "public"."conversations"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_conversations_updated_at"();

-- =====================================================
-- 8. 设置行级安全策略 (RLS)
-- =====================================================

-- 启用 RLS
ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;

-- 学员可以查看自己的会话
CREATE POLICY "Students can view own conversations" 
    ON "public"."conversations"
    FOR SELECT 
    TO "authenticated"
    USING (("auth"."uid"())::"text" = ("student_id")::"text");

-- 教练可以查看自己的会话
CREATE POLICY "Coaches can view own conversations" 
    ON "public"."conversations"
    FOR SELECT 
    TO "authenticated"
    USING (
        EXISTS (
            SELECT 1 
            FROM "public"."coaches" 
            WHERE ("coaches"."user_id")::"text" = ("auth"."uid"())::"text"
            AND "coaches"."id" = "conversations"."coach_id"
        )
    );

-- 学员可以创建会话（如果有订阅）
CREATE POLICY "Students can create conversations with subscribed coaches" 
    ON "public"."conversations"
    FOR INSERT 
    TO "authenticated"
    WITH CHECK (
        ("auth"."uid"())::"text" = ("student_id")::"text"
        AND EXISTS (
            SELECT 1 
            FROM "public"."coach_subscriptions" 
            WHERE "coach_subscriptions"."student_id" = "conversations"."student_id"
            AND "coach_subscriptions"."coach_id" = "conversations"."coach_id"
            AND "coach_subscriptions"."status" = 'active'
        )
    );

-- 会话参与者可以更新会话（归档、未读数等）
CREATE POLICY "Participants can update conversations" 
    ON "public"."conversations"
    FOR UPDATE 
    TO "authenticated"
    USING (
        ("auth"."uid"())::"text" = ("student_id")::"text"
        OR EXISTS (
            SELECT 1 
            FROM "public"."coaches" 
            WHERE ("coaches"."user_id")::"text" = ("auth"."uid"())::"text"
            AND "coaches"."id" = "conversations"."coach_id"
        )
    );

-- =====================================================
-- 9. 授权
-- =====================================================
GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";

GRANT ALL ON FUNCTION "public"."update_conversation_on_new_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversation_on_new_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversation_on_new_message"() TO "service_role";

GRANT ALL ON FUNCTION "public"."update_conversation_unread_on_read"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversation_unread_on_read"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversation_unread_on_read"() TO "service_role";

GRANT ALL ON FUNCTION "public"."update_conversations_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversations_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversations_updated_at"() TO "service_role";

-- =====================================================
-- 10. 数据验证和测试查询
-- =====================================================

-- 验证表是否创建成功
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'conversations'
    ) THEN
        RAISE NOTICE '✅ conversations 表创建成功';
    ELSE
        RAISE EXCEPTION '❌ conversations 表创建失败';
    END IF;
    
    -- 验证索引
    IF EXISTS (
        SELECT FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'conversations' 
        AND indexname = 'idx_conversations_student'
    ) THEN
        RAISE NOTICE '✅ 索引创建成功';
    END IF;
    
    -- 验证触发器
    IF EXISTS (
        SELECT FROM pg_trigger 
        WHERE tgname = 'trigger_update_conversation_on_new_message'
    ) THEN
        RAISE NOTICE '✅ 触发器创建成功';
    END IF;
    
    RAISE NOTICE '===========================================';
    RAISE NOTICE '聊天功能数据库迁移完成！';
    RAISE NOTICE '===========================================';
END $$;

-- =====================================================
-- 迁移说明和使用示例
-- =====================================================

/*
迁移完成后的使用示例：

1. 查看某个学员的所有会话：
SELECT * FROM conversations WHERE student_id = 'USER_ID' ORDER BY updated_at DESC;

2. 查看某个教练的所有会话：
SELECT * FROM conversations WHERE coach_id = 'COACH_ID' ORDER BY updated_at DESC;

3. 获取学员的未读消息总数：
SELECT SUM(student_unread) FROM conversations WHERE student_id = 'USER_ID';

4. 获取教练的未读消息总数：
SELECT SUM(coach_unread) FROM conversations WHERE coach_id = 'COACH_ID';

5. 创建新会话（通过API，不直接操作）：
INSERT INTO conversations (student_id, coach_id, subscription_id)
VALUES ('STUDENT_ID', 'COACH_ID', 'SUBSCRIPTION_ID');

6. 发送新消息（会自动触发会话更新）：
INSERT INTO coach_messages (conversation_id, sender_id, receiver_id, message_type, content)
VALUES ('CONVERSATION_ID', 'SENDER_ID', 'RECEIVER_ID', 'text', 'Hello!');

7. 标记消息为已读（会自动减少未读数）：
UPDATE coach_messages 
SET is_read = true 
WHERE conversation_id = 'CONVERSATION_ID' 
AND receiver_id = 'USER_ID' 
AND is_read = false;

注意事项：
- 所有会话操作都应通过 API 进行，而不是直接操作数据库
- 触发器会自动维护 last_message、last_message_at 和未读数
- 删除学员或教练时，相关会话会被级联删除
- 删除订阅时，会话的 subscription_id 会被设置为 NULL，但会话本身不会被删除
*/

-- =====================================================
-- 10. 配置 Row-Level Security (RLS) 策略
-- =====================================================

-- 启用 RLS
ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."coach_messages" ENABLE ROW LEVEL SECURITY;

-- conversations 表的 RLS 策略

-- 策略：学员可以查看自己参与的会话
CREATE POLICY "conversations_select_student" ON "public"."conversations"
    FOR SELECT
    USING (student_id = auth.uid());

-- 策略：教练可以查看自己参与的会话
CREATE POLICY "conversations_select_coach" ON "public"."conversations"
    FOR SELECT
    USING (
        coach_id IN (
            SELECT id FROM coaches WHERE user_id = auth.uid()
        )
    );

-- 策略：学员可以创建与教练的会话
CREATE POLICY "conversations_insert_student" ON "public"."conversations"
    FOR INSERT
    WITH CHECK (student_id = auth.uid());

-- 策略：学员可以更新自己的会话（如标记已读）
CREATE POLICY "conversations_update_student" ON "public"."conversations"
    FOR UPDATE
    USING (student_id = auth.uid());

-- 策略：教练可以更新自己的会话（如标记已读）
CREATE POLICY "conversations_update_coach" ON "public"."conversations"
    FOR UPDATE
    USING (
        coach_id IN (
            SELECT id FROM coaches WHERE user_id = auth.uid()
        )
    );

-- coach_messages 表的 RLS 策略

-- 策略：用户可以查看自己发送或接收的消息
CREATE POLICY "coach_messages_select" ON "public"."coach_messages"
    FOR SELECT
    USING (
        sender_id = auth.uid() OR receiver_id = auth.uid()
    );

-- 策略：用户可以发送消息（作为发送者）
CREATE POLICY "coach_messages_insert" ON "public"."coach_messages"
    FOR INSERT
    WITH CHECK (sender_id = auth.uid());

-- 策略：用户可以更新自己接收的消息（如标记已读）
CREATE POLICY "coach_messages_update" ON "public"."coach_messages"
    FOR UPDATE
    USING (receiver_id = auth.uid());

COMMENT ON POLICY "conversations_select_student" ON "public"."conversations" IS '学员可以查看自己的会话';
COMMENT ON POLICY "conversations_select_coach" ON "public"."conversations" IS '教练可以查看自己的会话';
COMMENT ON POLICY "conversations_insert_student" ON "public"."conversations" IS '学员可以创建会话';
COMMENT ON POLICY "conversations_update_student" ON "public"."conversations" IS '学员可以更新自己的会话';
COMMENT ON POLICY "conversations_update_coach" ON "public"."conversations" IS '教练可以更新自己的会话';
COMMENT ON POLICY "coach_messages_select" ON "public"."coach_messages" IS '用户可以查看相关消息';
COMMENT ON POLICY "coach_messages_insert" ON "public"."coach_messages" IS '用户可以发送消息';
COMMENT ON POLICY "coach_messages_update" ON "public"."coach_messages" IS '用户可以更新接收的消息';

