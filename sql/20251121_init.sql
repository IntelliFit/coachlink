

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."calculate_pull_up_score"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- 计算原始成绩 = 负重重量 + 体重
  NEW.raw_score = NEW.weighted_load + NEW.body_weight;
  
  -- 计算最终成绩 = 原始成绩 * (女性1.5倍系数)
  IF NEW.gender = 'female' THEN
    NEW.final_score = NEW.raw_score * 1.5;
  ELSE
    NEW.final_score = NEW.raw_score;
  END IF;
  
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_pull_up_score"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_pullup_rankings"("target_month" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    rec RECORD;
    current_rank INTEGER := 1;
    current_tier TEXT;
BEGIN
    -- 重置当月所有排名
    UPDATE pullup_leaderboard 
    SET rank_position = NULL, tier = NULL 
    WHERE activity_month = target_month AND is_verified = TRUE;
    
    -- 按重量降序排序并更新排名
    FOR rec IN 
        SELECT id, weight_kg, ROW_NUMBER() OVER (ORDER BY weight_kg DESC) as new_rank
        FROM pullup_leaderboard 
        WHERE activity_month = target_month AND is_verified = TRUE
    LOOP
        -- 确定等级
        IF rec.new_rank <= 10 THEN
            current_tier := 'national_top';
        ELSIF rec.new_rank <= 20 THEN
            current_tier := 'national_first';
        ELSE
            current_tier := 'participant';
        END IF;
        
        -- 更新排名和等级
        UPDATE pullup_leaderboard 
        SET rank_position = rec.new_rank, tier = current_tier
        WHERE id = rec.id;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."calculate_pullup_rankings"("target_month" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_training_progress"("record_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  total integer;
  completed integer;
BEGIN
  SELECT total_sets, completed_sets
  INTO total, completed
  FROM training_records
  WHERE id = record_id;
  
  IF total = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN ROUND((completed::decimal / total::decimal) * 100);
END;
$$;


ALTER FUNCTION "public"."calculate_training_progress"("record_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_training_progress"("record_id" "uuid") IS '计算训练完成百分比';



CREATE OR REPLACE FUNCTION "public"."coaches_tsvector_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.bio, '')), 'C');
  return new;
end
$$;


ALTER FUNCTION "public"."coaches_tsvector_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_coach_rulepack"("p_coach_id" "uuid", "p_key" character varying, "p_name" character varying, "p_domain" character varying, "p_config_json" "jsonb", "p_form_schema" "jsonb", "p_description" "text" DEFAULT ''::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_rulepack_id UUID;
BEGIN
  INSERT INTO coach_rulepacks (
    coach_id, key, name, domain, version, config_json, form_schema, description
  ) VALUES (
    p_coach_id, p_key, p_name, p_domain, '1.0', p_config_json, p_form_schema, p_description
  ) RETURNING id INTO v_rulepack_id;
  
  RETURN v_rulepack_id;
END;
$$;


ALTER FUNCTION "public"."create_coach_rulepack"("p_coach_id" "uuid", "p_key" character varying, "p_name" character varying, "p_domain" character varying, "p_config_json" "jsonb", "p_form_schema" "jsonb", "p_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_sample_challenge"() RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    challenge_id UUID;
BEGIN
    INSERT INTO pullup_challenges (
        month_period, 
        title, 
        description, 
        start_date, 
        end_date, 
        submission_deadline,
        announcement_date,
        status,
        rules,
        prizes
    ) VALUES (
        '2024-01',
        '引体极限挑战赛 - 2024年1月',
        '每月一次的引体极限挑战，展示你的负重引体实力！',
        '2024-01-01',
        '2024-01-31',
        '2024-01-28',
        '2024-01-30',
        'upcoming',
        '1. 一镜到底视频拍摄 2. 手臂必须完全伸直 3. 下巴过杠 4. 无明显借力 5. 60kg以上需要称重',
        '前20名保底肌酸，精英抽奖蛋白粉，全民抽奖更多奖品'
    ) RETURNING id INTO challenge_id;
    
    RETURN challenge_id;
END;
$$;


ALTER FUNCTION "public"."create_sample_challenge"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_coach_rulepacks"("p_coach_id" "uuid") RETURNS TABLE("id" "uuid", "key" character varying, "name" character varying, "domain" character varying, "version" character varying, "description" "text", "is_active" boolean)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id,
    cr.key,
    cr.name,
    cr.domain,
    cr.version,
    cr.description,
    cr.is_active
  FROM coach_rulepacks cr
  WHERE cr.coach_id = p_coach_id
    AND cr.is_active = true
  ORDER BY cr.created_at ASC;
END;
$$;


ALTER FUNCTION "public"."get_coach_rulepacks"("p_coach_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_active_challenge"() RETURNS TABLE("id" "uuid", "month_period" "text", "title" "text", "description" "text", "start_date" "date", "end_date" "date", "submission_deadline" "date", "announcement_date" "date", "status" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.month_period,
        c.title,
        c.description,
        c.start_date,
        c.end_date,
        c.submission_deadline,
        c.announcement_date,
        c.status
    FROM pullup_challenges c
    WHERE c.is_active = TRUE 
    AND c.status IN ('active', 'upcoming')
    ORDER BY c.start_date DESC
    LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_current_active_challenge"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."training_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "training_date" "date" NOT NULL,
    "week_number" integer NOT NULL,
    "day_number" integer NOT NULL,
    "exercises" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "total_sets" integer DEFAULT 0 NOT NULL,
    "completed_sets" integer DEFAULT 0 NOT NULL,
    "skipped_sets" integer DEFAULT 0 NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "duration_minutes" integer,
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "training_records_status_check" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'completed'::"text", 'abandoned'::"text"])))
);


ALTER TABLE "public"."training_records" OWNER TO "postgres";


COMMENT ON TABLE "public"."training_records" IS '学员训练执行记录表';



CREATE OR REPLACE FUNCTION "public"."get_last_training_record"("p_user_id" "uuid", "p_plan_id" "uuid", "p_current_date" "date") RETURNS "public"."training_records"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  result training_records;
BEGIN
  SELECT *
  INTO result
  FROM training_records
  WHERE user_id = p_user_id
  AND plan_id = p_plan_id
  AND training_date < p_current_date
  AND status = 'completed'
  ORDER BY training_date DESC
  LIMIT 1;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_last_training_record"("p_user_id" "uuid", "p_plan_id" "uuid", "p_current_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_last_training_record"("p_user_id" "uuid", "p_plan_id" "uuid", "p_current_date" "date") IS '获取最近的训练记录';



CREATE OR REPLACE FUNCTION "public"."get_pullup_leaderboard_details"() RETURNS TABLE("rank" bigint, "id" "uuid", "name" "text", "gender" "text", "weight_kg" numeric, "video_url" "text", "created_at" timestamp with time zone, "notes" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- 函数体在原有基础上添加 WHERE 过滤条件
    RETURN QUERY
    SELECT
        RANK() OVER (ORDER BY p.weight_kg DESC) as rank,
        p.id,
        COALESCE(u.full_name, p.douyin_nickname) as name,
        p.gender,
        p.weight_kg,
        p.video_url,
        p.created_at,
        p.notes
    FROM
        public.pullup_leaderboard p
    LEFT JOIN
        public.user_profiles u ON p.user_id = u.id
    WHERE
        p.submission_status = 'approved'  -- 只显示已审核通过的记录
    ORDER BY
        p.weight_kg DESC;
END;
$$;


ALTER FUNCTION "public"."get_pullup_leaderboard_details"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.users (id, is_admin, subscription_level)
  VALUES (NEW.id, false, 'basic'); -- 新用户的默认值
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."init_default_rulepacks"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- 注意：这里不直接插入数据，而是通过应用层调用
  -- 教练规则包应该在教练申请通过后自动创建
  -- 或者通过管理界面手动创建
  
  RAISE NOTICE '默认规则包初始化完成';
END;
$$;


ALTER FUNCTION "public"."init_default_rulepacks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_sample_training_record"("p_user_id" "uuid", "p_plan_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  new_record_id uuid;
BEGIN
  INSERT INTO training_records (
    user_id,
    plan_id,
    training_date,
    week_number,
    day_number,
    exercises,
    total_sets,
    completed_sets,
    status
  ) VALUES (
    p_user_id,
    p_plan_id,
    CURRENT_DATE,
    1,
    1,
    '[
      {
        "exercise_index": 0,
        "exercise_name": "深蹲",
        "sets": [
          {
            "set_index": 0,
            "planned_weight": 60,
            "planned_reps": "5",
            "planned_rest_seconds": 180,
            "status": "pending"
          }
        ]
      }
    ]'::jsonb,
    5,
    0,
    'in_progress'
  ) RETURNING id INTO new_record_id;
  
  RETURN new_record_id;
END;
$$;


ALTER FUNCTION "public"."insert_sample_training_record"("p_user_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_pullup_record_creator"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  NEW.created_by = auth.uid();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_pullup_record_creator"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_training_video"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    -- 可以在这里添加级联删除逻辑
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."soft_delete_training_video"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_calculate_rankings"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.is_verified = TRUE AND (OLD.is_verified IS NULL OR OLD.is_verified = FALSE) THEN
        PERFORM calculate_pullup_rankings(NEW.activity_month);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_calculate_rankings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_leaderboard_rankings"("challenge_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- 更新排名和等级
    WITH ranked_participants AS (
        SELECT 
            id,
            ROW_NUMBER() OVER (ORDER BY weight_kg DESC, submission_date ASC) as new_rank
        FROM pullup_leaderboard 
        WHERE challenge_id = challenge_uuid AND is_verified = TRUE
    )
    UPDATE pullup_leaderboard 
    SET 
        rank_position = ranked_participants.new_rank,
        tier = CASE 
            WHEN ranked_participants.new_rank <= 10 THEN '国内顶尖'
            WHEN ranked_participants.new_rank <= 20 THEN '国服一线'
            ELSE '普通参与者'
        END
    FROM ranked_participants
    WHERE pullup_leaderboard.id = ranked_participants.id;
END;
$$;


ALTER FUNCTION "public"."update_leaderboard_rankings"("challenge_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pull_up_rankings"("period" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  WITH ranked_entries AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (ORDER BY final_score DESC, submitted_at ASC) as new_rank
    FROM pull_up_challenge_entries 
    WHERE challenge_period = period 
    AND review_status = 'approved'
  )
  UPDATE pull_up_challenge_entries 
  SET rank = ranked_entries.new_rank
  FROM ranked_entries
  WHERE pull_up_challenge_entries.id = ranked_entries.id;
END;
$$;


ALTER FUNCTION "public"."update_pull_up_rankings"("period" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pullup_king_challenge_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_pullup_king_challenge_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pullup_king_rankings"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- 更新所有记录的排名和等级
  WITH ranked_entries AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (ORDER BY display_value DESC) AS new_rank
    FROM pullup_king_challenge
  )
  UPDATE pullup_king_challenge
  SET 
    rank = ranked_entries.new_rank,
    tier = CASE 
      WHEN ranked_entries.new_rank <= 10 THEN 'champion'
      WHEN ranked_entries.new_rank <= 20 THEN 'elite'
      ELSE 'regular'
    END
  FROM ranked_entries
  WHERE pullup_king_challenge.id = ranked_entries.id;
  
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_pullup_king_rankings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_training_progress"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    plan_id UUID;
    week_num INTEGER;
BEGIN
    IF NEW.status = 'completed' THEN
        SELECT training_plan_id, week_number INTO plan_id, week_num
        FROM training_sessions WHERE id = NEW.id;

        -- 更新进度统计
        INSERT INTO training_progress (user_id, training_plan_id, week_number)
        SELECT user_id, training_plan_id, week_number
        FROM training_sessions WHERE id = NEW.id
        ON CONFLICT (user_id, training_plan_id, week_number) DO UPDATE
        SET 
            completed_sessions = training_progress.completed_sessions + 1,
            progress_percentage = CASE 
                WHEN training_progress.total_sessions > 0 THEN 
                    ROUND((training_progress.completed_sessions + 1) * 100.0 / training_progress.total_sessions)
                ELSE 0
            END,
            last_training_date = NEW.completed_date,
            updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_training_progress"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_training_records_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_training_records_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_training_videos_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.review_status = 'reviewed' AND OLD.review_status != 'reviewed' THEN
    NEW.reviewed_at = now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_training_videos_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "role" "text" NOT NULL,
    "permissions" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "admin_users_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))
);


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alipay_orders" (
    "id" bigint NOT NULL,
    "out_trade_no" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "order_type" "text",
    "order_data" "jsonb",
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "product_code" character varying(32) DEFAULT 'FACE_TO_FACE_PAYMENT'::character varying,
    "qr_code" "text",
    "alipay_trade_no" character varying(64),
    "trade_status" character varying(20),
    CONSTRAINT "alipay_orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'closed'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."alipay_orders" OWNER TO "postgres";


ALTER TABLE "public"."alipay_orders" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."alipay_orders_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."coach_contents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "content_type" "text" NOT NULL,
    "media_urls" "text"[] DEFAULT '{}'::"text"[],
    "thumbnail_url" "text",
    "required_tier" integer DEFAULT 0,
    "is_featured" boolean DEFAULT false,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "likes_count" integer DEFAULT 0,
    "views_count" integer DEFAULT 0,
    "comments_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "coach_contents_content_type_check" CHECK (("content_type" = ANY (ARRAY['text'::"text", 'video'::"text", 'image'::"text", 'live'::"text", 'plan'::"text"]))),
    CONSTRAINT "coach_contents_required_tier_check" CHECK (("required_tier" = ANY (ARRAY[0, 1, 2, 3])))
);


ALTER TABLE "public"."coach_contents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "receiver_id" "uuid" NOT NULL,
    "message_type" "text" NOT NULL,
    "content" "text" NOT NULL,
    "media_url" "text",
    "file_name" "text",
    "file_size" bigint,
    "duration" integer,
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "coach_messages_message_type_check" CHECK (("message_type" = ANY (ARRAY['text'::"text", 'image'::"text", 'video'::"text", 'voice'::"text", 'file'::"text"])))
);


ALTER TABLE "public"."coach_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_videos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "coach_id" "uuid",
    "type" "text" NOT NULL,
    "training_plan_id" "uuid",
    "training_session_id" "uuid",
    "workout_log_id" "uuid",
    "exercise_name" "text",
    "week_number" integer,
    "day_of_week" "text",
    "video_url" "text" NOT NULL,
    "thumbnail_url" "text",
    "file_size" bigint,
    "duration_seconds" integer,
    "requires_review" boolean DEFAULT true,
    "review_status" "text" DEFAULT 'pending'::"text",
    "coach_feedback" "jsonb" DEFAULT '{}'::"jsonb",
    "user_notes" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "processing_status" "text" DEFAULT 'uploading'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "training_videos_processing_status_check" CHECK (("processing_status" = ANY (ARRAY['uploading'::"text", 'processing'::"text", 'ready'::"text", 'failed'::"text"]))),
    CONSTRAINT "training_videos_review_status_check" CHECK (("review_status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'not_required'::"text"]))),
    CONSTRAINT "training_videos_type_check" CHECK (("type" = ANY (ARRAY['baseline'::"text", 'training'::"text", 'completion'::"text"])))
);


ALTER TABLE "public"."training_videos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."coach_pending_reviews" AS
 SELECT "tv"."id",
    "tv"."user_id",
    ("u"."raw_user_meta_data" ->> 'full_name'::"text") AS "user_name",
    "tv"."type",
    "tv"."exercise_name",
    "tv"."training_plan_id",
    "tv"."video_url",
    "tv"."thumbnail_url",
    "tv"."created_at",
    "tv"."user_notes"
   FROM ("public"."training_videos" "tv"
     JOIN "auth"."users" "u" ON (("tv"."user_id" = "u"."id")))
  WHERE (("tv"."requires_review" = true) AND ("tv"."review_status" = 'pending'::"text") AND ("tv"."deleted_at" IS NULL))
  ORDER BY "tv"."created_at";


ALTER VIEW "public"."coach_pending_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_rulepacks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "key" character varying(50) NOT NULL,
    "name" character varying(100) NOT NULL,
    "domain" character varying(50) NOT NULL,
    "version" character varying(10) DEFAULT '1.0'::character varying NOT NULL,
    "config_json" "jsonb" NOT NULL,
    "form_schema" "jsonb" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."coach_rulepacks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "tier" integer NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "start_date" timestamp with time zone DEFAULT "now"(),
    "end_date" timestamp with time zone,
    "auto_renew" boolean DEFAULT true,
    "monthly_price" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "coach_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'cancelled'::"text", 'expired'::"text"]))),
    CONSTRAINT "coach_subscriptions_tier_check" CHECK (("tier" = ANY (ARRAY[1, 2, 3])))
);


ALTER TABLE "public"."coach_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coaches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "title" "text",
    "avatar_url" "text",
    "specialties" "text"[] DEFAULT '{}'::"text"[],
    "bio" "text",
    "rating" numeric(3,2) DEFAULT 0,
    "total_students" integer DEFAULT 0,
    "years_experience" integer DEFAULT 0,
    "achievements" "text"[] DEFAULT '{}'::"text"[],
    "is_featured" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    "search_vector" "tsvector",
    CONSTRAINT "coaches_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."coaches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "interaction_type" "text" NOT NULL,
    "comment_content" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "content_interactions_interaction_type_check" CHECK (("interaction_type" = ANY (ARRAY['like'::"text", 'comment'::"text", 'view'::"text"])))
);


ALTER TABLE "public"."content_interactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "training_plan_id" "uuid",
    "name" "text" NOT NULL,
    "category" "text",
    "description" "text",
    "sets" integer DEFAULT 1,
    "reps" "text",
    "rest_time" integer DEFAULT 60,
    "video_url" "text",
    "image_url" "text",
    "tips" "text"[] DEFAULT '{}'::"text"[],
    "order_index" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lifestyle_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "log_date" "date" NOT NULL,
    "sleep_hours" integer,
    "sleep_quality" integer,
    "diet_notes" "text",
    "meal_photos" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "lifestyle_logs_sleep_quality_check" CHECK ((("sleep_quality" >= 1) AND ("sleep_quality" <= 5)))
);


ALTER TABLE "public"."lifestyle_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."onboarding_questionnaires" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "coach_id" "uuid",
    "answers" "jsonb" NOT NULL,
    "baseline_video_urls" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."onboarding_questionnaires" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."personal_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "exercise_name" character varying(200) NOT NULL,
    "max_weight" numeric(5,2),
    "max_reps" integer,
    "date_achieved" "date" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."personal_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pullup_leaderboard" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "weight_kg" numeric(5,2) NOT NULL,
    "video_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "douyin_nickname" "text",
    "claim_code" "text",
    "is_claimed" boolean DEFAULT false NOT NULL,
    "gender" "text",
    "notes" "text",
    "submission_status" "text" DEFAULT 'approved'::"text",
    "submitted_by" "uuid",
    "submitted_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "admin_feedback" "text",
    "is_user_submission" boolean DEFAULT false,
    CONSTRAINT "pullup_leaderboard_submission_status_check" CHECK (("submission_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "pullup_leaderboard_weight_kg_check" CHECK (("weight_kg" > (0)::numeric))
);


ALTER TABLE "public"."pullup_leaderboard" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rankingboard_pullup_2025_9_10" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "weight_kg" numeric(5,2) NOT NULL,
    "video_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "douyin_nickname" "text",
    "claim_code" "text",
    "is_claimed" boolean DEFAULT false NOT NULL,
    "gender" "text",
    "notes" "text",
    "submission_status" "text" DEFAULT 'approved'::"text",
    "submitted_by" "uuid",
    "submitted_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "admin_feedback" "text",
    "is_user_submission" boolean DEFAULT false,
    CONSTRAINT "pullup_leaderboard_submission_status_check" CHECK (("submission_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "pullup_leaderboard_weight_kg_check" CHECK (("weight_kg" > (0)::numeric))
);


ALTER TABLE "public"."rankingboard_pullup_2025_9_10" OWNER TO "postgres";


COMMENT ON TABLE "public"."rankingboard_pullup_2025_9_10" IS '引体向上挑战排行榜';



CREATE TABLE IF NOT EXISTS "public"."set_videos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "training_record_id" "uuid" NOT NULL,
    "exercise_index" integer NOT NULL,
    "set_index" integer NOT NULL,
    "video_url" "text" NOT NULL,
    "thumbnail_url" "text",
    "duration_seconds" integer,
    "file_size_bytes" bigint,
    "upload_status" "text" DEFAULT 'uploaded'::"text" NOT NULL,
    "coach_feedback" "text",
    "coach_rating" integer,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "set_videos_coach_rating_check" CHECK ((("coach_rating" >= 1) AND ("coach_rating" <= 5))),
    CONSTRAINT "set_videos_upload_status_check" CHECK (("upload_status" = ANY (ARRAY['uploading'::"text", 'uploaded'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."set_videos" OWNER TO "postgres";


COMMENT ON TABLE "public"."set_videos" IS '训练组视频表';



CREATE TABLE IF NOT EXISTS "public"."shipping_info" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "prize_id" "text" NOT NULL,
    "recipient_name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "address" "text" NOT NULL,
    "notes" "text" DEFAULT ''::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "tracking_number" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "shipping_info_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'shipped'::"text", 'delivered'::"text"])))
);


ALTER TABLE "public"."shipping_info" OWNER TO "postgres";


COMMENT ON TABLE "public"."shipping_info" IS '快递信息表，存储中奖用户的快递地址等信息';



COMMENT ON COLUMN "public"."shipping_info"."user_id" IS '用户ID';



COMMENT ON COLUMN "public"."shipping_info"."prize_id" IS '奖品ID';



COMMENT ON COLUMN "public"."shipping_info"."recipient_name" IS '收件人姓名';



COMMENT ON COLUMN "public"."shipping_info"."phone" IS '收件人手机号';



COMMENT ON COLUMN "public"."shipping_info"."address" IS '详细地址';



COMMENT ON COLUMN "public"."shipping_info"."notes" IS '备注信息';



COMMENT ON COLUMN "public"."shipping_info"."status" IS '快递状态：pending-待处理，processing-处理中，shipped-已发货，delivered-已送达';



COMMENT ON COLUMN "public"."shipping_info"."tracking_number" IS '物流单号';



CREATE TABLE IF NOT EXISTS "public"."specialties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."specialties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "training_session_id" "uuid" NOT NULL,
    "exercise_name" character varying(200) NOT NULL,
    "exercise_type" character varying(20) NOT NULL,
    "sets_planned" integer NOT NULL,
    "reps_planned" character varying(50),
    "load_planned" numeric(5,2),
    "sets_completed" integer,
    "reps_completed" character varying(50),
    "load_actual" numeric(5,2),
    "rest_time" integer,
    "notes" "text",
    "difficulty_rating" integer,
    "technique_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "training_exercises_difficulty_rating_check" CHECK ((("difficulty_rating" >= 1) AND ("difficulty_rating" <= 5)))
);


ALTER TABLE "public"."training_exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_plan_details" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "training_plan_id" "uuid" NOT NULL,
    "week_number" integer NOT NULL,
    "day_of_week" character varying(10) NOT NULL,
    "session_focus" character varying(100),
    "main_exercises" "jsonb" NOT NULL,
    "accessory_exercises" "jsonb" NOT NULL,
    "warmup" "jsonb",
    "cooldown" "jsonb",
    "notes" "text",
    "order_index" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."training_plan_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "coach_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "difficulty_level" "text",
    "duration_weeks" integer DEFAULT 4,
    "ai_generated" boolean DEFAULT true,
    "coach_reviewed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "rulepack_id" "uuid",
    "rulepack_version" character varying(10),
    "domain" character varying(50),
    "assessment_data" "jsonb",
    "enhanced_by_ai" boolean DEFAULT false,
    "ai_enhancements" "jsonb",
    "status" "text" DEFAULT 'draft'::"text",
    "published_at" timestamp with time zone,
    CONSTRAINT "training_plans_difficulty_level_check" CHECK (("difficulty_level" = ANY (ARRAY['beginner'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "training_plans_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."training_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "training_plan_id" "uuid" NOT NULL,
    "week_number" integer NOT NULL,
    "total_sessions" integer DEFAULT 0,
    "completed_sessions" integer DEFAULT 0,
    "skipped_sessions" integer DEFAULT 0,
    "total_exercises" integer DEFAULT 0,
    "completed_exercises" integer DEFAULT 0,
    "total_volume" numeric(10,2) DEFAULT 0,
    "avg_rpe" numeric(3,1) DEFAULT 0,
    "progress_percentage" integer DEFAULT 0,
    "streak_days" integer DEFAULT 0,
    "last_training_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."training_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "training_plan_id" "uuid" NOT NULL,
    "reminder_type" character varying(20) NOT NULL,
    "reminder_time" time without time zone NOT NULL,
    "days_of_week" "text"[],
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."training_reminders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "training_plan_id" "uuid" NOT NULL,
    "week_number" integer NOT NULL,
    "day_of_week" character varying(10) NOT NULL,
    "session_focus" character varying(100),
    "scheduled_date" "date",
    "completed_date" timestamp with time zone,
    "status" character varying(20) DEFAULT 'scheduled'::character varying,
    "notes" "text",
    "rpe" integer,
    "energy_level" integer,
    "sleep_hours" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "training_sessions_energy_level_check" CHECK ((("energy_level" >= 1) AND ("energy_level" <= 10))),
    CONSTRAINT "training_sessions_rpe_check" CHECK ((("rpe" >= 1) AND ("rpe" <= 10)))
);


ALTER TABLE "public"."training_sessions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."training_statistics" AS
 SELECT "user_id",
    "plan_id",
    "count"(*) AS "total_sessions",
    "sum"(
        CASE
            WHEN ("status" = 'completed'::"text") THEN 1
            ELSE 0
        END) AS "completed_sessions",
    "sum"("completed_sets") AS "total_completed_sets",
    "sum"("total_sets") AS "total_sets",
    "avg"("duration_minutes") AS "avg_duration_minutes",
    "max"("training_date") AS "last_training_date",
    "round"(((("sum"("completed_sets"))::numeric / (NULLIF("sum"("total_sets"), 0))::numeric) * (100)::numeric), 2) AS "completion_percentage"
   FROM "public"."training_records" "tr"
  WHERE ("status" <> 'abandoned'::"text")
  GROUP BY "user_id", "plan_id";


ALTER VIEW "public"."training_statistics" OWNER TO "postgres";


COMMENT ON VIEW "public"."training_statistics" IS '训练统计视图';



CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "full_name" "text",
    "nickname" "text",
    "avatar_url" "text",
    "gender" "text",
    "birth_date" "date",
    "height" integer,
    "weight" integer,
    "fitness_goal" "text",
    "fitness_level" "text",
    "bio" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "phone" "text",
    "address" "text",
    CONSTRAINT "user_profiles_fitness_level_check" CHECK (("fitness_level" = ANY (ARRAY['beginner'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "user_profiles_gender_check" CHECK (("gender" = ANY (ARRAY['male'::"text", 'female'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_video_timeline" AS
 SELECT "id",
    "user_id",
    "type",
    "exercise_name",
    "training_plan_id",
    "video_url",
    "thumbnail_url",
    "coach_feedback",
    "review_status",
    "requires_review",
    "created_at",
    "reviewed_at",
    "user_notes",
    "tags"
   FROM "public"."training_videos" "tv"
  WHERE ("deleted_at" IS NULL)
  ORDER BY "created_at" DESC;


ALTER VIEW "public"."user_video_timeline" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text",
    "password_hash" "text" NOT NULL,
    "has_drawn" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_login_at" timestamp with time zone,
    "subscription_level" "text" DEFAULT 'basic'::"text",
    "subscription_expires_at" timestamp with time zone,
    "is_admin" boolean DEFAULT false,
    "admin_role" "text",
    "admin_permissions" "text"[],
    "is_coach" boolean DEFAULT false,
    "coach_status" "text" DEFAULT 'none'::"text",
    "primary_role" "text" DEFAULT 'student'::"text",
    "email" "text",
    CONSTRAINT "users_coach_status_check" CHECK (("coach_status" = ANY (ARRAY['none'::"text", 'pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "users_primary_role_check" CHECK (("primary_role" = ANY (ARRAY['student'::"text", 'coach'::"text", 'admin'::"text"]))),
    CONSTRAINT "users_subscription_level_check" CHECK (("subscription_level" = ANY (ARRAY['basic'::"text", 'advanced'::"text", 'premium'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."video_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "exercise_id" "uuid",
    "video_url" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "coach_feedback" "text",
    "coach_rating" integer,
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_at" timestamp with time zone,
    "purpose" "text",
    CONSTRAINT "video_submissions_coach_rating_check" CHECK ((("coach_rating" >= 1) AND ("coach_rating" <= 5))),
    CONSTRAINT "video_submissions_purpose_check" CHECK (("purpose" = ANY (ARRAY['baseline'::"text", 'workout'::"text"]))),
    CONSTRAINT "video_submissions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'needs_improvement'::"text"])))
);


ALTER TABLE "public"."video_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workout_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "training_session_id" "uuid",
    "training_plan_id" "uuid",
    "week_number" integer,
    "day_of_week" character varying(16),
    "entries" "jsonb",
    "notes" "text",
    "video_urls" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "log_date" "date" DEFAULT ("now"())::"date" NOT NULL
);


ALTER TABLE "public"."workout_logs" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."alipay_orders"
    ADD CONSTRAINT "alipay_orders_out_trade_no_uniq" UNIQUE ("out_trade_no");



ALTER TABLE ONLY "public"."alipay_orders"
    ADD CONSTRAINT "alipay_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_contents"
    ADD CONSTRAINT "coach_contents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_messages"
    ADD CONSTRAINT "coach_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_rulepacks"
    ADD CONSTRAINT "coach_rulepacks_coach_id_key_version_key" UNIQUE ("coach_id", "key", "version");



ALTER TABLE ONLY "public"."coach_rulepacks"
    ADD CONSTRAINT "coach_rulepacks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_subscriptions"
    ADD CONSTRAINT "coach_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coaches"
    ADD CONSTRAINT "coaches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_interactions"
    ADD CONSTRAINT "content_interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lifestyle_logs"
    ADD CONSTRAINT "lifestyle_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lifestyle_logs"
    ADD CONSTRAINT "lifestyle_logs_user_id_log_date_key" UNIQUE ("user_id", "log_date");



ALTER TABLE ONLY "public"."onboarding_questionnaires"
    ADD CONSTRAINT "onboarding_questionnaires_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personal_records"
    ADD CONSTRAINT "personal_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pullup_leaderboard"
    ADD CONSTRAINT "pullup_leaderboard_claim_code_key" UNIQUE ("claim_code");



ALTER TABLE ONLY "public"."pullup_leaderboard"
    ADD CONSTRAINT "pullup_leaderboard_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rankingboard_pullup_2025_9_10"
    ADD CONSTRAINT "rankingboard_pullup_2025_9_10_claim_code_key" UNIQUE ("claim_code");



ALTER TABLE ONLY "public"."rankingboard_pullup_2025_9_10"
    ADD CONSTRAINT "rankingboard_pullup_2025_9_10_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."set_videos"
    ADD CONSTRAINT "set_videos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."set_videos"
    ADD CONSTRAINT "set_videos_training_record_id_exercise_index_set_index_key" UNIQUE ("training_record_id", "exercise_index", "set_index");



ALTER TABLE ONLY "public"."shipping_info"
    ADD CONSTRAINT "shipping_info_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."specialties"
    ADD CONSTRAINT "specialties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_exercises"
    ADD CONSTRAINT "training_exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_plan_details"
    ADD CONSTRAINT "training_plan_details_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_plans"
    ADD CONSTRAINT "training_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_progress"
    ADD CONSTRAINT "training_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_records"
    ADD CONSTRAINT "training_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_records"
    ADD CONSTRAINT "training_records_unique_training" UNIQUE ("user_id", "plan_id", "week_number", "day_number", "training_date");



ALTER TABLE ONLY "public"."training_reminders"
    ADD CONSTRAINT "training_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_sessions"
    ADD CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_videos"
    ADD CONSTRAINT "training_videos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_subscriptions"
    ADD CONSTRAINT "unique_student_coach_subscription" UNIQUE ("student_id", "coach_id");



ALTER TABLE ONLY "public"."content_interactions"
    ADD CONSTRAINT "unique_user_content_like" EXCLUDE USING "btree" ("content_id" WITH =, "user_id" WITH =) WHERE (("interaction_type" = 'like'::"text"));



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "unique_user_profile" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."training_videos"
    ADD CONSTRAINT "unique_user_video_per_exercise" UNIQUE ("user_id", "training_plan_id", "exercise_name", "type") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."video_submissions"
    ADD CONSTRAINT "video_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workout_logs"
    ADD CONSTRAINT "workout_logs_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_admin_users_role" ON "public"."admin_users" USING "btree" ("role");



CREATE INDEX "idx_admin_users_user_id" ON "public"."admin_users" USING "btree" ("user_id");



CREATE INDEX "idx_alipay_orders_created_at" ON "public"."alipay_orders" USING "btree" ("created_at");



CREATE INDEX "idx_alipay_orders_status" ON "public"."alipay_orders" USING "btree" ("status");



CREATE INDEX "idx_alipay_orders_user_id" ON "public"."alipay_orders" USING "btree" ("user_id");



CREATE INDEX "idx_coach_contents_coach" ON "public"."coach_contents" USING "btree" ("coach_id");



CREATE INDEX "idx_coach_contents_created" ON "public"."coach_contents" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_coach_contents_tier" ON "public"."coach_contents" USING "btree" ("required_tier");



CREATE INDEX "idx_coach_contents_type" ON "public"."coach_contents" USING "btree" ("content_type");



CREATE INDEX "idx_coach_messages_conversation" ON "public"."coach_messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_coach_messages_receiver" ON "public"."coach_messages" USING "btree" ("receiver_id");



CREATE INDEX "idx_coach_messages_sender" ON "public"."coach_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_coach_messages_time" ON "public"."coach_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_coach_rulepacks_coach_id" ON "public"."coach_rulepacks" USING "btree" ("coach_id");



CREATE INDEX "idx_coach_rulepacks_domain" ON "public"."coach_rulepacks" USING "btree" ("domain");



CREATE INDEX "idx_coach_rulepacks_key" ON "public"."coach_rulepacks" USING "btree" ("key");



CREATE INDEX "idx_coach_subscriptions_coach" ON "public"."coach_subscriptions" USING "btree" ("coach_id");



CREATE INDEX "idx_coach_subscriptions_status" ON "public"."coach_subscriptions" USING "btree" ("status");



CREATE INDEX "idx_coach_subscriptions_student" ON "public"."coach_subscriptions" USING "btree" ("student_id");



CREATE INDEX "idx_coaches_search" ON "public"."coaches" USING "gin" ("search_vector");



CREATE INDEX "idx_coaches_user_id" ON "public"."coaches" USING "btree" ("user_id");



CREATE INDEX "idx_content_interactions_content" ON "public"."content_interactions" USING "btree" ("content_id");



CREATE INDEX "idx_content_interactions_type" ON "public"."content_interactions" USING "btree" ("interaction_type");



CREATE INDEX "idx_content_interactions_user" ON "public"."content_interactions" USING "btree" ("user_id");



CREATE INDEX "idx_exercises_training_plan_id" ON "public"."exercises" USING "btree" ("training_plan_id");



CREATE INDEX "idx_lifestyle_user_date" ON "public"."lifestyle_logs" USING "btree" ("user_id", "log_date");



CREATE INDEX "idx_onboarding_coach" ON "public"."onboarding_questionnaires" USING "btree" ("coach_id");



CREATE INDEX "idx_onboarding_user" ON "public"."onboarding_questionnaires" USING "btree" ("user_id");



CREATE INDEX "idx_personal_records_user_exercise" ON "public"."personal_records" USING "btree" ("user_id", "exercise_name");



CREATE INDEX "idx_pullup_leaderboard_claim_code" ON "public"."pullup_leaderboard" USING "btree" ("claim_code");



CREATE INDEX "idx_pullup_leaderboard_douyin_nickname" ON "public"."pullup_leaderboard" USING "btree" ("douyin_nickname");



CREATE INDEX "idx_pullup_leaderboard_status" ON "public"."pullup_leaderboard" USING "btree" ("submission_status");



CREATE INDEX "idx_pullup_leaderboard_submitted_by" ON "public"."pullup_leaderboard" USING "btree" ("submitted_by");



CREATE INDEX "idx_pullup_leaderboard_user_id" ON "public"."pullup_leaderboard" USING "btree" ("user_id");



CREATE INDEX "idx_pullup_leaderboard_weight" ON "public"."pullup_leaderboard" USING "btree" ("weight_kg" DESC);



CREATE INDEX "idx_set_videos_record" ON "public"."set_videos" USING "btree" ("training_record_id");



CREATE INDEX "idx_set_videos_reviewed" ON "public"."set_videos" USING "btree" ("reviewed_at") WHERE ("reviewed_at" IS NOT NULL);



CREATE INDEX "idx_set_videos_upload_status" ON "public"."set_videos" USING "btree" ("upload_status");



CREATE INDEX "idx_shipping_info_created_at" ON "public"."shipping_info" USING "btree" ("created_at");



CREATE INDEX "idx_shipping_info_status" ON "public"."shipping_info" USING "btree" ("status");



CREATE INDEX "idx_shipping_info_user_id" ON "public"."shipping_info" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_shipping_info_user_prize" ON "public"."shipping_info" USING "btree" ("user_id", "prize_id");



CREATE UNIQUE INDEX "idx_specialties_name" ON "public"."specialties" USING "btree" ("name");



CREATE INDEX "idx_training_exercises_session_id" ON "public"."training_exercises" USING "btree" ("training_session_id");



CREATE INDEX "idx_training_plan_details_plan_id" ON "public"."training_plan_details" USING "btree" ("training_plan_id");



CREATE INDEX "idx_training_plan_details_week" ON "public"."training_plan_details" USING "btree" ("week_number");



CREATE INDEX "idx_training_plans_coach" ON "public"."training_plans" USING "btree" ("coach_id");



CREATE INDEX "idx_training_plans_status" ON "public"."training_plans" USING "btree" ("status");



CREATE INDEX "idx_training_plans_user" ON "public"."training_plans" USING "btree" ("user_id");



CREATE INDEX "idx_training_plans_user_id" ON "public"."training_plans" USING "btree" ("user_id");



CREATE INDEX "idx_training_progress_user_plan" ON "public"."training_progress" USING "btree" ("user_id", "training_plan_id");



CREATE INDEX "idx_training_records_date" ON "public"."training_records" USING "btree" ("training_date" DESC);



CREATE INDEX "idx_training_records_plan" ON "public"."training_records" USING "btree" ("plan_id");



CREATE INDEX "idx_training_records_status" ON "public"."training_records" USING "btree" ("status");



CREATE INDEX "idx_training_records_user" ON "public"."training_records" USING "btree" ("user_id");



CREATE INDEX "idx_training_records_user_date" ON "public"."training_records" USING "btree" ("user_id", "training_date" DESC);



CREATE INDEX "idx_training_reminders_user_id" ON "public"."training_reminders" USING "btree" ("user_id");



CREATE INDEX "idx_training_sessions_plan_id" ON "public"."training_sessions" USING "btree" ("training_plan_id");



CREATE INDEX "idx_training_sessions_status" ON "public"."training_sessions" USING "btree" ("status");



CREATE INDEX "idx_training_sessions_user_id" ON "public"."training_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_training_sessions_week_day" ON "public"."training_sessions" USING "btree" ("week_number", "day_of_week");



CREATE INDEX "idx_training_videos_coach_id" ON "public"."training_videos" USING "btree" ("coach_id");



CREATE INDEX "idx_training_videos_created_at" ON "public"."training_videos" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_training_videos_requires_review" ON "public"."training_videos" USING "btree" ("requires_review");



CREATE INDEX "idx_training_videos_review_status" ON "public"."training_videos" USING "btree" ("review_status");



CREATE INDEX "idx_training_videos_training_plan_id" ON "public"."training_videos" USING "btree" ("training_plan_id");



CREATE INDEX "idx_training_videos_type" ON "public"."training_videos" USING "btree" ("type");



CREATE INDEX "idx_training_videos_user_id" ON "public"."training_videos" USING "btree" ("user_id");



CREATE INDEX "idx_user_profiles_phone" ON "public"."user_profiles" USING "btree" ("phone");



CREATE INDEX "idx_user_profiles_user_id" ON "public"."user_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_users_coach_status" ON "public"."users" USING "btree" ("coach_status");



CREATE INDEX "idx_users_created_at" ON "public"."users" USING "btree" ("created_at");



CREATE INDEX "idx_users_phone" ON "public"."users" USING "btree" ("phone");



CREATE UNIQUE INDEX "idx_users_phone_unique" ON "public"."users" USING "btree" ("phone");



CREATE INDEX "idx_users_primary_role" ON "public"."users" USING "btree" ("primary_role");



CREATE INDEX "idx_video_purpose" ON "public"."video_submissions" USING "btree" ("purpose");



CREATE INDEX "idx_video_submissions_exercise_id" ON "public"."video_submissions" USING "btree" ("exercise_id");



CREATE INDEX "idx_video_submissions_status" ON "public"."video_submissions" USING "btree" ("status");



CREATE INDEX "idx_video_submissions_submitted_at" ON "public"."video_submissions" USING "btree" ("submitted_at");



CREATE INDEX "idx_video_submissions_user_id" ON "public"."video_submissions" USING "btree" ("user_id");



CREATE INDEX "idx_workout_logs_plan_date" ON "public"."workout_logs" USING "btree" ("training_plan_id", "log_date");



CREATE INDEX "idx_workout_logs_session" ON "public"."workout_logs" USING "btree" ("training_session_id");



CREATE INDEX "idx_workout_logs_user" ON "public"."workout_logs" USING "btree" ("user_id");



CREATE INDEX "idx_workout_logs_user_date" ON "public"."workout_logs" USING "btree" ("user_id", "log_date");



CREATE INDEX "rankingboard_pullup_2025_9_10_claim_code_idx" ON "public"."rankingboard_pullup_2025_9_10" USING "btree" ("claim_code");



CREATE INDEX "rankingboard_pullup_2025_9_10_douyin_nickname_idx" ON "public"."rankingboard_pullup_2025_9_10" USING "btree" ("douyin_nickname");



CREATE INDEX "rankingboard_pullup_2025_9_10_submission_status_idx" ON "public"."rankingboard_pullup_2025_9_10" USING "btree" ("submission_status");



CREATE INDEX "rankingboard_pullup_2025_9_10_submitted_by_idx" ON "public"."rankingboard_pullup_2025_9_10" USING "btree" ("submitted_by");



CREATE INDEX "rankingboard_pullup_2025_9_10_user_id_idx" ON "public"."rankingboard_pullup_2025_9_10" USING "btree" ("user_id");



CREATE INDEX "rankingboard_pullup_2025_9_10_weight_kg_idx" ON "public"."rankingboard_pullup_2025_9_10" USING "btree" ("weight_kg" DESC);



CREATE OR REPLACE TRIGGER "alipay_orders_set_updated_at" BEFORE UPDATE ON "public"."alipay_orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_pullup_record_creator_trigger" BEFORE INSERT ON "public"."pullup_leaderboard" FOR EACH ROW EXECUTE FUNCTION "public"."set_pullup_record_creator"();



CREATE OR REPLACE TRIGGER "soft_delete_training_video" BEFORE UPDATE ON "public"."training_videos" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_training_video"();



CREATE OR REPLACE TRIGGER "trigger_update_progress_on_complete" AFTER UPDATE OF "status" ON "public"."training_sessions" FOR EACH ROW WHEN (((("old"."status")::"text" <> 'completed'::"text") AND (("new"."status")::"text" = 'completed'::"text"))) EXECUTE FUNCTION "public"."update_training_progress"();



CREATE OR REPLACE TRIGGER "tsvectorupdate" BEFORE INSERT OR UPDATE ON "public"."coaches" FOR EACH ROW EXECUTE FUNCTION "public"."coaches_tsvector_trigger"();



CREATE OR REPLACE TRIGGER "update_coach_rulepacks_updated_at" BEFORE UPDATE ON "public"."coach_rulepacks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_training_exercises_updated_at" BEFORE UPDATE ON "public"."training_exercises" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_training_progress_updated_at" BEFORE UPDATE ON "public"."training_progress" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_training_records_updated_at_trigger" BEFORE UPDATE ON "public"."training_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_training_records_updated_at"();



CREATE OR REPLACE TRIGGER "update_training_reminders_updated_at" BEFORE UPDATE ON "public"."training_reminders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_training_sessions_updated_at" BEFORE UPDATE ON "public"."training_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_training_videos_updated_at" BEFORE UPDATE ON "public"."training_videos" FOR EACH ROW EXECUTE FUNCTION "public"."update_training_videos_updated_at"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alipay_orders"
    ADD CONSTRAINT "alipay_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_contents"
    ADD CONSTRAINT "coach_contents_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_messages"
    ADD CONSTRAINT "coach_messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_messages"
    ADD CONSTRAINT "coach_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_rulepacks"
    ADD CONSTRAINT "coach_rulepacks_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_subscriptions"
    ADD CONSTRAINT "coach_subscriptions_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_subscriptions"
    ADD CONSTRAINT "coach_subscriptions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coaches"
    ADD CONSTRAINT "coaches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_interactions"
    ADD CONSTRAINT "content_interactions_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."coach_contents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_interactions"
    ADD CONSTRAINT "content_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_training_plan_id_fkey" FOREIGN KEY ("training_plan_id") REFERENCES "public"."training_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shipping_info"
    ADD CONSTRAINT "fk_shipping_info_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_videos"
    ADD CONSTRAINT "fk_training_videos_coach_id" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "fk_user_profiles_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lifestyle_logs"
    ADD CONSTRAINT "lifestyle_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."onboarding_questionnaires"
    ADD CONSTRAINT "onboarding_questionnaires_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id");



ALTER TABLE ONLY "public"."onboarding_questionnaires"
    ADD CONSTRAINT "onboarding_questionnaires_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."personal_records"
    ADD CONSTRAINT "personal_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pullup_leaderboard"
    ADD CONSTRAINT "pullup_leaderboard_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pullup_leaderboard"
    ADD CONSTRAINT "pullup_leaderboard_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."pullup_leaderboard"
    ADD CONSTRAINT "pullup_leaderboard_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."pullup_leaderboard"
    ADD CONSTRAINT "pullup_leaderboard_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rankingboard_pullup_2025_9_10"
    ADD CONSTRAINT "rankingboard_pullup_2025_9_10_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."rankingboard_pullup_2025_9_10"
    ADD CONSTRAINT "rankingboard_pullup_2025_9_10_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."rankingboard_pullup_2025_9_10"
    ADD CONSTRAINT "rankingboard_pullup_2025_9_10_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."rankingboard_pullup_2025_9_10"
    ADD CONSTRAINT "rankingboard_pullup_2025_9_10_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."set_videos"
    ADD CONSTRAINT "set_videos_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."set_videos"
    ADD CONSTRAINT "set_videos_training_record_id_fkey" FOREIGN KEY ("training_record_id") REFERENCES "public"."training_records"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_exercises"
    ADD CONSTRAINT "training_exercises_training_session_id_fkey" FOREIGN KEY ("training_session_id") REFERENCES "public"."training_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_plan_details"
    ADD CONSTRAINT "training_plan_details_training_plan_id_fkey" FOREIGN KEY ("training_plan_id") REFERENCES "public"."training_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_plans"
    ADD CONSTRAINT "training_plans_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id");



ALTER TABLE ONLY "public"."training_plans"
    ADD CONSTRAINT "training_plans_rulepack_id_fkey" FOREIGN KEY ("rulepack_id") REFERENCES "public"."coach_rulepacks"("id");



ALTER TABLE ONLY "public"."training_progress"
    ADD CONSTRAINT "training_progress_training_plan_id_fkey" FOREIGN KEY ("training_plan_id") REFERENCES "public"."training_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_progress"
    ADD CONSTRAINT "training_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_records"
    ADD CONSTRAINT "training_records_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_records"
    ADD CONSTRAINT "training_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_reminders"
    ADD CONSTRAINT "training_reminders_training_plan_id_fkey" FOREIGN KEY ("training_plan_id") REFERENCES "public"."training_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_reminders"
    ADD CONSTRAINT "training_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_sessions"
    ADD CONSTRAINT "training_sessions_training_plan_id_fkey" FOREIGN KEY ("training_plan_id") REFERENCES "public"."training_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_sessions"
    ADD CONSTRAINT "training_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_submissions"
    ADD CONSTRAINT "video_submissions_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id");



ALTER TABLE ONLY "public"."workout_logs"
    ADD CONSTRAINT "workout_logs_training_plan_id_fkey" FOREIGN KEY ("training_plan_id") REFERENCES "public"."training_plans"("id");



ALTER TABLE ONLY "public"."workout_logs"
    ADD CONSTRAINT "workout_logs_training_session_id_fkey" FOREIGN KEY ("training_session_id") REFERENCES "public"."training_sessions"("id");



ALTER TABLE ONLY "public"."workout_logs"
    ADD CONSTRAINT "workout_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



CREATE POLICY "Admins can manage all coaches" ON "public"."coaches" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND ("users"."is_admin" = true)))));



CREATE POLICY "Anyone can insert users" ON "public"."users" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Anyone can view approved coaches" ON "public"."coaches" FOR SELECT TO "authenticated", "anon" USING (("status" = 'approved'::"text"));



CREATE POLICY "Anyone can view free content" ON "public"."coach_contents" FOR SELECT TO "authenticated", "anon" USING (("required_tier" = 0));



CREATE POLICY "Coaches can manage own content" ON "public"."coach_contents" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."coaches"
  WHERE (("coaches"."id" = "coach_contents"."coach_id") AND (("coaches"."user_id")::"text" = ("auth"."uid"())::"text")))));



CREATE POLICY "Coaches can update own profile" ON "public"."coaches" FOR UPDATE TO "authenticated" USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Coaches can view own subscribers" ON "public"."coach_subscriptions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."coaches"
  WHERE (("coaches"."id" = "coach_subscriptions"."coach_id") AND (("coaches"."user_id")::"text" = ("auth"."uid"())::"text")))));



CREATE POLICY "Content creators can view content interactions" ON "public"."content_interactions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."coach_contents"
     JOIN "public"."coaches" ON (("coaches"."id" = "coach_contents"."coach_id")))
  WHERE (("coach_contents"."id" = "content_interactions"."content_id") AND (("coaches"."user_id")::"text" = ("auth"."uid"())::"text")))));



CREATE POLICY "Students can view own subscriptions" ON "public"."coach_subscriptions" FOR SELECT TO "authenticated" USING ((("auth"."uid"())::"text" = ("student_id")::"text"));



CREATE POLICY "Subscribers can view tier content" ON "public"."coach_contents" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."coach_subscriptions"
  WHERE (("coach_subscriptions"."coach_id" = "coach_contents"."coach_id") AND (("coach_subscriptions"."student_id")::"text" = ("auth"."uid"())::"text") AND ("coach_subscriptions"."status" = 'active'::"text") AND ("coach_subscriptions"."tier" >= "coach_contents"."required_tier")))));



CREATE POLICY "Super admins can manage admin users" ON "public"."admin_users" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true) AND ("users"."admin_role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can view all admin users" ON "public"."admin_users" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true) AND ("users"."admin_role" = 'super_admin'::"text")))));



CREATE POLICY "User delete own orders" ON "public"."alipay_orders" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "User insert own orders" ON "public"."alipay_orders" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "User select own orders" ON "public"."alipay_orders" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "User update own orders" ON "public"."alipay_orders" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can access own messages" ON "public"."coach_messages" TO "authenticated" USING (((("auth"."uid"())::"text" = ("sender_id")::"text") OR (("auth"."uid"())::"text" = ("receiver_id")::"text")));



CREATE POLICY "Users can create coach applications" ON "public"."coaches" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can delete own video submissions" ON "public"."video_submissions" FOR DELETE TO "authenticated" USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can insert own profile" ON "public"."user_profiles" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can insert own shipping info" ON "public"."shipping_info" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can insert own video submissions" ON "public"."video_submissions" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can manage own interactions" ON "public"."content_interactions" TO "authenticated" USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can manage own training plans" ON "public"."training_plans" TO "authenticated" USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can manage their own videos" ON "public"."training_videos" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read own data" ON "public"."users" FOR SELECT TO "authenticated" USING ((("auth"."uid"())::"text" = ("id")::"text"));



CREATE POLICY "Users can read own profile" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can update own data" ON "public"."users" FOR UPDATE TO "authenticated" USING ((("auth"."uid"())::"text" = ("id")::"text"));



CREATE POLICY "Users can update own pending shipping info" ON "public"."shipping_info" FOR UPDATE TO "authenticated" USING (((("auth"."uid"())::"text" = ("user_id")::"text") AND ("status" = 'pending'::"text")));



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can update own video submissions" ON "public"."video_submissions" FOR UPDATE TO "authenticated" USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can view exercises of own training plans" ON "public"."exercises" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."training_plans" "tp"
  WHERE (("tp"."id" = "exercises"."training_plan_id") AND (("tp"."user_id")::"text" = ("auth"."uid"())::"text")))));



CREATE POLICY "Users can view own shipping info" ON "public"."shipping_info" FOR SELECT TO "authenticated" USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can view own video submissions" ON "public"."video_submissions" FOR SELECT TO "authenticated" USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "允许所有人查看排行榜" ON "public"."pullup_leaderboard" FOR SELECT USING (true);



CREATE POLICY "允许用户读取自己的信息" ON "public"."users" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "只允许管理员修改记录" ON "public"."pullup_leaderboard" FOR UPDATE TO "authenticated" USING (( SELECT "users"."is_admin"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))) WITH CHECK (( SELECT "users"."is_admin"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())));



CREATE POLICY "只允许管理员删除记录" ON "public"."pullup_leaderboard" FOR DELETE TO "authenticated" USING (( SELECT "users"."is_admin"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())));



CREATE POLICY "只允许管理员添加记录" ON "public"."pullup_leaderboard" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "users"."is_admin"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())));



CREATE POLICY "教练可以更新点评信息" ON "public"."training_videos" FOR UPDATE USING ((("requires_review" = true) AND (EXISTS ( SELECT 1
   FROM "public"."coach_subscriptions" "cs"
  WHERE (("cs"."coach_id" = "auth"."uid"()) AND ("cs"."student_id" = "training_videos"."user_id") AND ("cs"."status" = 'active'::"text")))))) WITH CHECK (("coach_id" = "auth"."uid"()));



CREATE POLICY "教练可以查看需要点评的视频" ON "public"."training_videos" FOR SELECT USING ((("requires_review" = true) AND ("review_status" = 'pending'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."coach_subscriptions" "cs"
  WHERE (("cs"."coach_id" = "auth"."uid"()) AND ("cs"."student_id" = "training_videos"."user_id") AND ("cs"."status" = 'active'::"text"))))));



CREATE POLICY "用户可以删除自己的视频" ON "public"."training_videos" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND ("deleted_at" IS NOT NULL)));



CREATE POLICY "用户可以插入自己的视频" ON "public"."training_videos" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "用户可以更新自己的视频" ON "public"."training_videos" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "用户可以查看自己的视频" ON "public"."training_videos" FOR SELECT USING (("user_id" = "auth"."uid"()));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_pull_up_score"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_pull_up_score"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_pull_up_score"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_pullup_rankings"("target_month" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_pullup_rankings"("target_month" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_pullup_rankings"("target_month" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_training_progress"("record_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_training_progress"("record_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_training_progress"("record_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."coaches_tsvector_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."coaches_tsvector_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."coaches_tsvector_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_coach_rulepack"("p_coach_id" "uuid", "p_key" character varying, "p_name" character varying, "p_domain" character varying, "p_config_json" "jsonb", "p_form_schema" "jsonb", "p_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_coach_rulepack"("p_coach_id" "uuid", "p_key" character varying, "p_name" character varying, "p_domain" character varying, "p_config_json" "jsonb", "p_form_schema" "jsonb", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_coach_rulepack"("p_coach_id" "uuid", "p_key" character varying, "p_name" character varying, "p_domain" character varying, "p_config_json" "jsonb", "p_form_schema" "jsonb", "p_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_sample_challenge"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_sample_challenge"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_sample_challenge"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_coach_rulepacks"("p_coach_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_coach_rulepacks"("p_coach_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_coach_rulepacks"("p_coach_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_active_challenge"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_active_challenge"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_active_challenge"() TO "service_role";



GRANT ALL ON TABLE "public"."training_records" TO "anon";
GRANT ALL ON TABLE "public"."training_records" TO "authenticated";
GRANT ALL ON TABLE "public"."training_records" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_last_training_record"("p_user_id" "uuid", "p_plan_id" "uuid", "p_current_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_last_training_record"("p_user_id" "uuid", "p_plan_id" "uuid", "p_current_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_last_training_record"("p_user_id" "uuid", "p_plan_id" "uuid", "p_current_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pullup_leaderboard_details"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_pullup_leaderboard_details"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pullup_leaderboard_details"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."init_default_rulepacks"() TO "anon";
GRANT ALL ON FUNCTION "public"."init_default_rulepacks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."init_default_rulepacks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_sample_training_record"("p_user_id" "uuid", "p_plan_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_sample_training_record"("p_user_id" "uuid", "p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_sample_training_record"("p_user_id" "uuid", "p_plan_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_pullup_record_creator"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_pullup_record_creator"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_pullup_record_creator"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."soft_delete_training_video"() TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_training_video"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_training_video"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_calculate_rankings"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_calculate_rankings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_calculate_rankings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_leaderboard_rankings"("challenge_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_leaderboard_rankings"("challenge_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_leaderboard_rankings"("challenge_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pull_up_rankings"("period" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_pull_up_rankings"("period" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pull_up_rankings"("period" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pullup_king_challenge_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_pullup_king_challenge_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pullup_king_challenge_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pullup_king_rankings"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_pullup_king_rankings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pullup_king_rankings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_training_progress"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_training_progress"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_training_progress"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_training_records_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_training_records_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_training_records_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_training_videos_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_training_videos_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_training_videos_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."admin_users" TO "anon";
GRANT ALL ON TABLE "public"."admin_users" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_users" TO "service_role";



GRANT ALL ON TABLE "public"."alipay_orders" TO "anon";
GRANT ALL ON TABLE "public"."alipay_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."alipay_orders" TO "service_role";



GRANT ALL ON SEQUENCE "public"."alipay_orders_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."alipay_orders_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."alipay_orders_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."coach_contents" TO "anon";
GRANT ALL ON TABLE "public"."coach_contents" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_contents" TO "service_role";



GRANT ALL ON TABLE "public"."coach_messages" TO "anon";
GRANT ALL ON TABLE "public"."coach_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_messages" TO "service_role";



GRANT ALL ON TABLE "public"."training_videos" TO "anon";
GRANT ALL ON TABLE "public"."training_videos" TO "authenticated";
GRANT ALL ON TABLE "public"."training_videos" TO "service_role";



GRANT ALL ON TABLE "public"."coach_pending_reviews" TO "anon";
GRANT ALL ON TABLE "public"."coach_pending_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_pending_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."coach_rulepacks" TO "anon";
GRANT ALL ON TABLE "public"."coach_rulepacks" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_rulepacks" TO "service_role";



GRANT ALL ON TABLE "public"."coach_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."coach_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."coaches" TO "anon";
GRANT ALL ON TABLE "public"."coaches" TO "authenticated";
GRANT ALL ON TABLE "public"."coaches" TO "service_role";



GRANT ALL ON TABLE "public"."content_interactions" TO "anon";
GRANT ALL ON TABLE "public"."content_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."content_interactions" TO "service_role";



GRANT ALL ON TABLE "public"."exercises" TO "anon";
GRANT ALL ON TABLE "public"."exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."exercises" TO "service_role";



GRANT ALL ON TABLE "public"."lifestyle_logs" TO "anon";
GRANT ALL ON TABLE "public"."lifestyle_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."lifestyle_logs" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_questionnaires" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_questionnaires" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_questionnaires" TO "service_role";



GRANT ALL ON TABLE "public"."personal_records" TO "anon";
GRANT ALL ON TABLE "public"."personal_records" TO "authenticated";
GRANT ALL ON TABLE "public"."personal_records" TO "service_role";



GRANT ALL ON TABLE "public"."pullup_leaderboard" TO "anon";
GRANT ALL ON TABLE "public"."pullup_leaderboard" TO "authenticated";
GRANT ALL ON TABLE "public"."pullup_leaderboard" TO "service_role";



GRANT ALL ON TABLE "public"."rankingboard_pullup_2025_9_10" TO "anon";
GRANT ALL ON TABLE "public"."rankingboard_pullup_2025_9_10" TO "authenticated";
GRANT ALL ON TABLE "public"."rankingboard_pullup_2025_9_10" TO "service_role";



GRANT ALL ON TABLE "public"."set_videos" TO "anon";
GRANT ALL ON TABLE "public"."set_videos" TO "authenticated";
GRANT ALL ON TABLE "public"."set_videos" TO "service_role";



GRANT ALL ON TABLE "public"."shipping_info" TO "anon";
GRANT ALL ON TABLE "public"."shipping_info" TO "authenticated";
GRANT ALL ON TABLE "public"."shipping_info" TO "service_role";



GRANT ALL ON TABLE "public"."specialties" TO "anon";
GRANT ALL ON TABLE "public"."specialties" TO "authenticated";
GRANT ALL ON TABLE "public"."specialties" TO "service_role";



GRANT ALL ON TABLE "public"."training_exercises" TO "anon";
GRANT ALL ON TABLE "public"."training_exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."training_exercises" TO "service_role";



GRANT ALL ON TABLE "public"."training_plan_details" TO "anon";
GRANT ALL ON TABLE "public"."training_plan_details" TO "authenticated";
GRANT ALL ON TABLE "public"."training_plan_details" TO "service_role";



GRANT ALL ON TABLE "public"."training_plans" TO "anon";
GRANT ALL ON TABLE "public"."training_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."training_plans" TO "service_role";



GRANT ALL ON TABLE "public"."training_progress" TO "anon";
GRANT ALL ON TABLE "public"."training_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."training_progress" TO "service_role";



GRANT ALL ON TABLE "public"."training_reminders" TO "anon";
GRANT ALL ON TABLE "public"."training_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."training_reminders" TO "service_role";



GRANT ALL ON TABLE "public"."training_sessions" TO "anon";
GRANT ALL ON TABLE "public"."training_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."training_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."training_statistics" TO "anon";
GRANT ALL ON TABLE "public"."training_statistics" TO "authenticated";
GRANT ALL ON TABLE "public"."training_statistics" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_video_timeline" TO "anon";
GRANT ALL ON TABLE "public"."user_video_timeline" TO "authenticated";
GRANT ALL ON TABLE "public"."user_video_timeline" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."video_submissions" TO "anon";
GRANT ALL ON TABLE "public"."video_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."video_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."workout_logs" TO "anon";
GRANT ALL ON TABLE "public"."workout_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."workout_logs" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






