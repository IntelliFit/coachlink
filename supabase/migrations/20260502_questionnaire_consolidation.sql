-- =====================================================
-- 问卷体系收口（问卷星化）
-- 创建时间: 2026-05-02
--
-- 目的：
--   1. 归一 coach_questionnaires.questions JSON shape -> { editorType, questions: [...] }
--      （历史 4 种 shape：纯数组 / {questions:[]} / {editorType, questions:[]} / {questions:{questions:[]}}）
--   2. 给所有 question 缺失的 id 自动补 uuid（与运行期 ensureQuestionIds 行为一致）
--   3. 把历史 status='archived' / 空值 等非法值归一为 'draft'，让 (active|draft) 成为唯一二元状态
--   4. 删除冗余字段 coach_questionnaires.is_active —— status 是唯一的"上线版本"标志
--   5. 删除 coaches.profile->'default_questionnaire_id' —— is_default 是唯一的"默认问卷"标志
--
-- 部署顺序（必须按此顺序，否则旧前端读 is_active 会拿到 undefined）：
--   1. 先合代码（所有 Web 路由 / src/lib/questionnaireMigration.ts / 小程序服务层都不再读写 is_active）
--   2. 再跑这条迁移
--
-- 全文使用 DO $$ ... $$ + IF EXISTS / IF NOT EXISTS，可重跑。
-- =====================================================

-- ---------------------------------------------------------------------------
-- Step 1. 归一 status：把历史 'archived' / 空字符串 / NULL 折成 'draft'
-- ---------------------------------------------------------------------------
UPDATE coach_questionnaires
SET status = 'draft'
WHERE status IS NULL
   OR status = ''
   OR status NOT IN ('active', 'draft');

-- ---------------------------------------------------------------------------
-- Step 2. 防御性回填：旧数据中 is_active=true 但 status 仍是 draft 的，标回 active
--   （历史迁移已做过此步，但跑一次幂等无害；一旦 is_active 列不存在则跳过）
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'coach_questionnaires'
          AND column_name = 'is_active'
    ) THEN
        EXECUTE $sql$
            UPDATE coach_questionnaires
            SET status = 'active'
            WHERE status = 'draft' AND is_active = true
        $sql$;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 3. 清理冲突：同一 coach 出现多行 status='active' 时，仅保留最新一行
--   保护后续 publish-questionnaire 单 active 不变量；同时也保护新代码的列表渲染。
-- ---------------------------------------------------------------------------
WITH ranked AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY coach_id
               ORDER BY updated_at DESC NULLS LAST,
                        created_at DESC NULLS LAST,
                        id
           ) AS rn
    FROM coach_questionnaires
    WHERE status = 'active'
)
UPDATE coach_questionnaires cq
SET status = 'draft'
FROM ranked
WHERE cq.id = ranked.id
  AND ranked.rn > 1;

-- ---------------------------------------------------------------------------
-- Step 4. 归一 questions JSON shape -> { editorType, questions: [...] }
--   * 4 种历史 shape 全部铺平
--   * 缺失 id 的 question 自动补 gen_random_uuid()::text
--   * editorType 来源优先级：
--       a) 顶层 editorType in (simple|flow) → 采纳
--       b) 否则扫描 questions[*]，出现 branching/next → 'flow'，否则 'simple'
--   * 仅在 raw IS DISTINCT FROM new_doc 时才 UPDATE，不触发不必要的 updated_at
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    rec RECORD;
    raw jsonb;
    inner_questions jsonb;
    has_explicit_editor_type boolean;
    explicit_editor_type text;
    inferred_editor_type text;
    items_arr jsonb;
    item jsonb;
    item_with_id jsonb;
    new_doc jsonb;
BEGIN
    FOR rec IN SELECT id, questions FROM coach_questionnaires LOOP
        raw := rec.questions;

        -- 取出内部 questions 数组与 editorType（如有）
        IF jsonb_typeof(raw) = 'array' THEN
            inner_questions := raw;
            has_explicit_editor_type := false;
            explicit_editor_type := NULL;
        ELSIF jsonb_typeof(raw) = 'object' THEN
            IF jsonb_typeof(raw->'questions') = 'array' THEN
                inner_questions := raw->'questions';
            ELSIF jsonb_typeof(raw->'questions') = 'object'
                  AND jsonb_typeof(raw#>'{questions,questions}') = 'array' THEN
                inner_questions := raw#>'{questions,questions}';
            ELSE
                inner_questions := '[]'::jsonb;
            END IF;
            has_explicit_editor_type := raw ? 'editorType';
            explicit_editor_type := raw->>'editorType';
        ELSE
            -- null / string / number 等异常值都当作空列表
            inner_questions := '[]'::jsonb;
            has_explicit_editor_type := false;
            explicit_editor_type := NULL;
        END IF;

        -- 推断 editorType
        IF has_explicit_editor_type
           AND explicit_editor_type IN ('simple', 'flow') THEN
            inferred_editor_type := explicit_editor_type;
        ELSIF EXISTS (
            SELECT 1
            FROM jsonb_array_elements(inner_questions) AS q
            WHERE jsonb_typeof(q) = 'object'
              AND (q ? 'branching' OR q ? 'next')
        ) THEN
            inferred_editor_type := 'flow';
        ELSE
            inferred_editor_type := 'simple';
        END IF;

        -- 给每条 question 补 id；极老的纯字符串数据折成 text 题
        items_arr := '[]'::jsonb;
        FOR item IN SELECT value FROM jsonb_array_elements(inner_questions) LOOP
            IF jsonb_typeof(item) = 'string' THEN
                item_with_id := jsonb_build_object(
                    'id', gen_random_uuid()::text,
                    'type', 'text',
                    'question', item #>> '{}'
                );
            ELSIF jsonb_typeof(item) = 'object' THEN
                IF NOT (item ? 'id')
                   OR jsonb_typeof(item->'id') <> 'string'
                   OR coalesce(item->>'id', '') = '' THEN
                    item_with_id := item || jsonb_build_object('id', gen_random_uuid()::text);
                ELSE
                    item_with_id := item;
                END IF;
            ELSE
                -- null / number / boolean 等无法救：跳过
                CONTINUE;
            END IF;
            items_arr := items_arr || jsonb_build_array(item_with_id);
        END LOOP;

        new_doc := jsonb_build_object(
            'editorType', inferred_editor_type,
            'questions', items_arr
        );

        IF raw IS DISTINCT FROM new_doc THEN
            UPDATE coach_questionnaires
            SET questions = new_doc
            WHERE id = rec.id;
        END IF;
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Step 5. DROP COLUMN coach_questionnaires.is_active
--   破坏性变更，必须放在代码下线对它的读写之后。
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'coach_questionnaires'
          AND column_name = 'is_active'
    ) THEN
        ALTER TABLE coach_questionnaires DROP COLUMN is_active;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 6. 清理 coaches.profile->'default_questionnaire_id'
--   is_default 是默认问卷的唯一真相，profile 里的字段不再使用。
-- ---------------------------------------------------------------------------
UPDATE coaches
SET profile = profile - 'default_questionnaire_id'
WHERE profile ? 'default_questionnaire_id';

-- ---------------------------------------------------------------------------
-- Step 7. 校验：迁移结束后断言关键不变量
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    bad_count integer;
BEGIN
    -- 7.1 每个 coach 至多一行 status='active'
    SELECT count(*) INTO bad_count FROM (
        SELECT 1
        FROM coach_questionnaires
        WHERE status = 'active'
        GROUP BY coach_id
        HAVING count(*) > 1
    ) AS violations;
    IF bad_count > 0 THEN
        RAISE EXCEPTION '同一 coach 仍有多行 status=active：% 个 coach', bad_count;
    END IF;

    -- 7.2 每个 coach 至多一行 is_default=true（已被 partial unique index 保护，再断言一次防御）
    SELECT count(*) INTO bad_count FROM (
        SELECT 1
        FROM coach_questionnaires
        WHERE is_default
        GROUP BY coach_id
        HAVING count(*) > 1
    ) AS violations;
    IF bad_count > 0 THEN
        RAISE EXCEPTION '同一 coach 仍有多行 is_default=true：% 个 coach', bad_count;
    END IF;

    -- 7.3 questions JSON 必须已是 { editorType, questions: [...] } shape
    SELECT count(*) INTO bad_count
    FROM coach_questionnaires
    WHERE NOT (
        jsonb_typeof(questions) = 'object'
        AND questions ? 'editorType'
        AND questions->>'editorType' IN ('simple', 'flow')
        AND jsonb_typeof(questions->'questions') = 'array'
    );
    IF bad_count > 0 THEN
        RAISE EXCEPTION '问卷 JSON shape 归一后仍有 % 行不合规', bad_count;
    END IF;

    -- 7.4 status 仅允许 active / draft
    SELECT count(*) INTO bad_count
    FROM coach_questionnaires
    WHERE status NOT IN ('active', 'draft');
    IF bad_count > 0 THEN
        RAISE EXCEPTION 'status 列出现非法值：% 行', bad_count;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 8. 注释收尾
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN coach_questionnaires.questions
    IS '问卷文档：{ editorType: "simple" | "flow", questions: TrainingItem[] }；新建/更新走 src/lib/questionnaireDocument.ts 归一';
COMMENT ON COLUMN coach_questionnaires.status
    IS '问卷状态：active=已上线（每个 coach 至多 1 行）/ draft=草稿';
COMMENT ON COLUMN coach_questionnaires.is_default
    IS '默认问卷标记，每个 coach 至多 1 行（partial unique index）';

SELECT '20260502_questionnaire_consolidation.sql migration completed' AS result;
