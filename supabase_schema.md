# Supabase 数据库结构文档（public schema）

- **生成时间**：2025-01-27
- **数据库版本**：PostgreSQL (Supabase)
- **Schema**：public

## 目录

1. [表清单](#表清单)
2. [视图清单](#视图清单)
3. [表详细说明](#表详细说明)
4. [视图详细说明](#视图详细说明)
5. [索引清单](#索引清单)
6. [冗余分析与优化建议](#冗余分析与优化建议)
7. [原始结构转储（JSON）](#原始结构转储json)

---

## 表清单

### 用户相关表（4个）
- `users` - 用户基础表
- `user_profiles` - 用户档案表
- `admin_users` - 管理员用户表
- `shipping_info` - 快递信息表

### 教练相关表（9个）
- `coaches` - 教练表
- `coach_subscriptions` - 教练订阅表
- `coach_contents` - 教练内容表
- `coach_messages` - 教练消息表
- `coach_rulepacks` - 教练规则包表
- `coach_actions` - 教练行动表（新增）
- `coach_plan_templates` - 教练计划模板表（新增）
- `coach_plan_template_tags` - 教练计划模板标签表（新增）
- `coach_questionnaires` - 教练问卷表（新增）
- `coach_pricing` - 教练定价表（新增）

### 训练相关表（11个）
- `training_plans` - 训练计划表
- `training_plan_details` - 训练计划详情表
- `training_sessions` - 训练会话表
- `training_exercises` - 训练动作表
- `training_progress` - 训练进度表
- `training_records` - 训练记录表
- `training_reminders` - 训练提醒表
- `training_videos` - 训练视频表
- `exercises` - 动作库表
- `personal_records` - 个人记录表
- `workout_logs` - 训练日志表

### 视频相关表（2个）
- `video_submissions` - 视频提交表
- `set_videos` - 组视频表

### 内容互动表（2个）
- `content_interactions` - 内容互动表
- `conversations` - 会话表（新增）

### 其他表（7个）
- `onboarding_questionnaires` - 入门问卷表
- `lifestyle_logs` - 生活方式日志表
- `alipay_orders` - 支付宝订单表
- `pullup_leaderboard` - 引体向上排行榜表
- `rankingboard_pullup_2025_9_10` - 引体向上排行榜历史表（2025年9-10月）
- `specialties` - 专业领域表

**总计：35个表**

---

## 视图清单

1. `user_video_timeline` - 用户视频时间线视图（基于 training_videos）
2. `coach_pending_reviews` - 教练待审核视图
3. `training_statistics` - 训练统计视图

---

## 表详细说明

### 1. users（用户基础表）

**基本信息**
- 行数：~98
- RLS：未启用
- 主键：`id` (uuid)

**字段说明**

| 列名 | 类型 | 可空 | 默认值 | 约束/备注 |
|------|------|------|--------|-----------|
| id | uuid | NO | gen_random_uuid() | 主键 |
| phone | text | YES | | 唯一索引 |
| password_hash | text | NO | | |
| email | text | YES | | 唯一索引 |
| has_drawn | boolean | YES | false | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |
| last_login_at | timestamptz | YES | | |
| subscription_level | text | YES | 'basic' | ∈ {'basic','advanced','premium'} |
| subscription_expires_at | timestamptz | YES | | |
| is_admin | boolean | YES | false | |
| admin_role | text | YES | | |
| admin_permissions | text[] | YES | | |
| is_coach | boolean | YES | false | |
| coach_status | text | YES | 'none' | ∈ {'none','pending','approved','rejected'} |
| primary_role | text | YES | 'student' | ∈ {'student','coach','admin'} |

**外键**
- 无（被其他表引用）

**索引**
- `users_pkey` (id) - 主键索引
- `users_phone_key` (phone) - 唯一索引
- `users_email_key` (email) - 唯一索引
- `idx_users_phone` (phone) - 普通索引
- `idx_users_phone_unique` (phone) - 唯一索引（冗余）
- `idx_users_created_at` (created_at) - 普通索引
- `idx_users_coach_status` (coach_status) - 普通索引
- `idx_users_primary_role` (primary_role) - 普通索引

**优化建议**
- `phone` 字段存在重复的唯一索引，建议删除 `idx_users_phone_unique`
- `subscription_level` 和 `subscription_expires_at` 可以考虑移到独立的订阅表

---

### 2. user_profiles（用户档案表）

**基本信息**
- 行数：~94
- RLS：未启用
- 主键：`id` (uuid)

**字段说明**

| 列名 | 类型 | 可空 | 默认值 | 约束/备注 |
|------|------|------|--------|-----------|
| id | uuid | NO | gen_random_uuid() | 主键 |
| user_id | uuid | YES | | 外键 → users.id，唯一 |
| full_name | text | YES | | |
| nickname | text | YES | | |
| avatar_url | text | YES | | |
| gender | text | YES | | ∈ {'male','female','other'} |
| birth_date | date | YES | | |
| height | integer | YES | | 单位：厘米 |
| weight | integer | YES | | 单位：千克 |
| fitness_goal | text | YES | | |
| fitness_level | text | YES | | ∈ {'beginner','intermediate','advanced'} |
| bio | text | YES | | |
| phone | text | YES | | **冗余：与 users.phone 重复** |
| address | text | YES | | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

**外键**
- `fk_user_profiles_user` (user_id → users.id)

**索引**
- `user_profiles_pkey` (id) - 主键索引
- `user_profiles_user_id_key` (user_id) - 唯一索引
- `unique_user_profile` (user_id) - 唯一索引（冗余）
- `idx_user_profiles_user_id` (user_id) - 普通索引（冗余）
- `idx_user_profiles_phone` (phone) - 普通索引

**优化建议**
- `phone` 字段与 `users.phone` 重复，建议删除此字段，通过 JOIN 获取
- `user_id` 存在多个索引，建议只保留唯一索引

---

### 3. coaches（教练表）

**基本信息**
- 行数：~2
- RLS：未启用
- 主键：`id` (uuid)

**字段说明**

| 列名 | 类型 | 可空 | 默认值 | 约束/备注 |
|------|------|------|--------|-----------|
| id | uuid | NO | gen_random_uuid() | 主键 |
| user_id | uuid | YES | | 外键 → users.id，唯一 |
| name | text | NO | | |
| title | text | YES | | |
| avatar_url | text | YES | | |
| specialties | text[] | YES | '{}' | |
| bio | text | YES | | |
| rating | numeric | YES | 0 | |
| total_students | integer | YES | 0 | |
| years_experience | integer | YES | 0 | |
| achievements | text[] | YES | '{}' | |
| is_featured | boolean | YES | false | |
| status | text | YES | 'pending' | ∈ {'pending','approved','rejected','suspended'} |
| search_vector | tsvector | YES | | 全文搜索向量 |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

**外键**
- `coaches_user_id_fkey` (user_id → users.id)

**索引**
- `coaches_pkey` (id) - 主键索引
- `coaches_user_id_unique` (user_id) - 唯一索引
- `idx_coaches_user_id` (user_id) - 普通索引（冗余）
- `idx_coaches_search` (search_vector) - GIN 索引（全文搜索）

**优化建议**
- `user_id` 存在重复索引，建议删除 `idx_coaches_user_id`

---

### 4. training_plans（训练计划表）

**基本信息**
- 行数：~7
- RLS：未启用
- 主键：`id` (uuid)

**字段说明**

| 列名 | 类型 | 可空 | 默认值 | 约束/备注 |
|------|------|------|--------|-----------|
| id | uuid | NO | gen_random_uuid() | 主键 |
| user_id | uuid | NO | | 学员ID |
| coach_id | uuid | YES | | 外键 → coaches.id |
| title | text | NO | | |
| description | text | YES | | |
| difficulty_level | text | YES | | ∈ {'beginner','intermediate','advanced'} |
| duration_weeks | integer | YES | 4 | |
| ai_generated | boolean | YES | true | |
| coach_reviewed | boolean | YES | false | |
| rulepack_id | uuid | YES | | 外键 → coach_rulepacks.id |
| rulepack_version | varchar | YES | | |
| domain | varchar | YES | | |
| assessment_data | jsonb | YES | | |
| enhanced_by_ai | boolean | YES | false | |
| ai_enhancements | jsonb | YES | | |
| status | text | YES | 'draft' | ∈ {'draft','published','archived'} |
| published_at | timestamptz | YES | | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

**外键**
- `training_plans_coach_id_fkey` (coach_id → coaches.id)
- `training_plans_rulepack_id_fkey` (rulepack_id → coach_rulepacks.id)

**索引**
- `training_plans_pkey` (id) - 主键索引
- `idx_training_plans_user` (user_id) - 普通索引
- `idx_training_plans_user_id` (user_id) - 普通索引（冗余）
- `idx_training_plans_coach` (coach_id) - 普通索引
- `idx_training_plans_status` (status) - 普通索引

**优化建议**
- `user_id` 存在重复索引，建议删除 `idx_training_plans_user_id`

---

### 5. training_videos（训练视频表）

**基本信息**
- 行数：~5
- RLS：未启用
- 主键：`id` (uuid)

**字段说明**

| 列名 | 类型 | 可空 | 默认值 | 约束/备注 |
|------|------|------|--------|-----------|
| id | uuid | NO | gen_random_uuid() | 主键 |
| user_id | uuid | YES | | |
| coach_id | uuid | YES | | 外键 → coaches.id |
| type | text | NO | | ∈ {'baseline','training','completion'} |
| training_plan_id | uuid | YES | | |
| training_session_id | uuid | YES | | |
| workout_log_id | uuid | YES | | |
| exercise_name | text | YES | | |
| week_number | integer | YES | | |
| day_of_week | text | YES | | |
| video_url | text | NO | | |
| thumbnail_url | text | YES | | |
| file_size | bigint | YES | | 单位：字节 |
| duration_seconds | integer | YES | | |
| requires_review | boolean | YES | true | |
| review_status | text | YES | 'pending' | ∈ {'pending','reviewed','not_required'} |
| coach_feedback | jsonb | YES | '{}' | |
| user_notes | text | YES | | |
| tags | text[] | YES | '{}' | |
| processing_status | text | YES | 'uploading' | ∈ {'uploading','processing','ready','failed'} |
| metadata | jsonb | YES | '{}' | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |
| reviewed_at | timestamptz | YES | | |
| deleted_at | timestamptz | YES | | 软删除标记 |

**外键**
- `fk_training_videos_coach_id` (coach_id → coaches.id)

**索引**
- `training_videos_pkey` (id) - 主键索引
- `idx_training_videos_user_id` (user_id) - 普通索引
- `idx_training_videos_coach_id` (coach_id) - 普通索引
- `idx_training_videos_training_plan_id` (training_plan_id) - 普通索引
- `idx_training_videos_type` (type) - 普通索引
- `idx_training_videos_requires_review` (requires_review) - 普通索引
- `idx_training_videos_review_status` (review_status) - 普通索引
- `idx_training_videos_created_at` (created_at DESC) - 普通索引
- `unique_user_video_per_exercise` (user_id, training_plan_id, exercise_name, type) - 唯一索引

**优化建议**
- 建议添加 `user_id` 和 `training_plan_id` 的外键约束
- `training_session_id` 和 `workout_log_id` 建议添加外键约束

---

### 6. video_submissions（视频提交表）

**基本信息**
- 行数：~0
- RLS：未启用
- 主键：`id` (uuid)

**字段说明**

| 列名 | 类型 | 可空 | 默认值 | 约束/备注 |
|------|------|------|--------|-----------|
| id | uuid | NO | gen_random_uuid() | 主键 |
| user_id | uuid | NO | | |
| exercise_id | uuid | YES | | 外键 → exercises.id |
| video_url | text | NO | | |
| description | text | YES | | |
| status | text | YES | 'pending' | ∈ {'pending','reviewed','needs_improvement'} |
| coach_feedback | text | YES | | |
| coach_rating | integer | YES | | 1 ≤ coach_rating ≤ 5 |
| submitted_at | timestamptz | YES | now() | |
| reviewed_at | timestamptz | YES | | |
| purpose | text | YES | | ∈ {'baseline','workout'} |

**外键**
- `video_submissions_exercise_id_fkey` (exercise_id → exercises.id)

**索引**
- `video_submissions_pkey` (id) - 主键索引
- `idx_video_submissions_user_id` (user_id) - 普通索引
- `idx_video_submissions_exercise_id` (exercise_id) - 普通索引
- `idx_video_submissions_status` (status) - 普通索引
- `idx_video_submissions_submitted_at` (submitted_at) - 普通索引
- `idx_video_purpose` (purpose) - 普通索引

**优化建议**
- 建议添加 `user_id` 的外键约束
- 此表与 `training_videos` 表功能有重叠，建议评估是否可以合并

---

### 7. training_records（训练执行记录表）

**基本信息**
- 行数：~25
- RLS：未启用
- 主键：`id` (uuid)
- 注释：学员训练执行记录表

**字段说明**

| 列名 | 类型 | 可空 | 默认值 | 约束/备注 |
|------|------|------|--------|-----------|
| id | uuid | NO | gen_random_uuid() | 主键 |
| user_id | uuid | NO | | 外键 → users.id |
| plan_id | uuid | NO | | 外键 → training_plans.id |
| training_date | date | NO | | |
| week_number | integer | NO | | |
| day_number | integer | NO | | |
| exercises | jsonb | NO | '[]' | 训练动作详情 |
| total_sets | integer | NO | 0 | |
| completed_sets | integer | NO | 0 | |
| skipped_sets | integer | NO | 0 | |
| started_at | timestamptz | NO | now() | |
| completed_at | timestamptz | YES | | |
| duration_minutes | integer | YES | | |
| status | text | NO | 'in_progress' | ∈ {'in_progress','completed','abandoned'} |
| notes | text | YES | | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**外键**
- `training_records_user_id_fkey` (user_id → users.id)
- `training_records_plan_id_fkey` (plan_id → training_plans.id)

**索引**
- `training_records_pkey` (id) - 主键索引
- `idx_training_records_user` (user_id) - 普通索引
- `idx_training_records_plan` (plan_id) - 普通索引
- `idx_training_records_status` (status) - 普通索引
- `idx_training_records_date` (training_date DESC) - 普通索引
- `idx_training_records_user_date` (user_id, training_date DESC) - 复合索引
- `training_records_unique_training` (user_id, plan_id, week_number, day_number, training_date) - 唯一索引

---

### 8. set_videos（训练组视频表）

**基本信息**
- 行数：~1
- RLS：未启用
- 主键：`id` (uuid)
- 注释：训练组视频表

**字段说明**

| 列名 | 类型 | 可空 | 默认值 | 约束/备注 |
|------|------|------|--------|-----------|
| id | uuid | NO | gen_random_uuid() | 主键 |
| training_record_id | uuid | NO | | 外键 → training_records.id |
| exercise_index | integer | NO | | |
| set_index | integer | NO | | |
| video_url | text | NO | | |
| thumbnail_url | text | YES | | |
| duration_seconds | integer | YES | | |
| file_size_bytes | bigint | YES | | |
| upload_status | text | NO | 'uploaded' | ∈ {'uploading','uploaded','failed'} |
| coach_feedback | text | YES | | |
| coach_rating | integer | YES | | 1 ≤ coach_rating ≤ 5 |
| reviewed_at | timestamptz | YES | | |
| reviewed_by | uuid | YES | | 外键 → users.id |
| created_at | timestamptz | NO | now() | |

**外键**
- `set_videos_training_record_id_fkey` (training_record_id → training_records.id)
- `set_videos_reviewed_by_fkey` (reviewed_by → users.id)

**索引**
- `set_videos_pkey` (id) - 主键索引
- `idx_set_videos_record` (training_record_id) - 普通索引
- `idx_set_videos_upload_status` (upload_status) - 普通索引
- `idx_set_videos_reviewed` (reviewed_at) WHERE reviewed_at IS NOT NULL - 部分索引
- `set_videos_training_record_id_exercise_index_set_index_key` (training_record_id, exercise_index, set_index) - 唯一索引

---

### 9. conversations（会话表）⭐ 新增

**基本信息**
- 行数：~5
- RLS：未启用
- 主键：`id` (uuid)
- 注释：学员-教练会话表

**字段说明**

| 列名 | 类型 | 可空 | 默认值 | 约束/备注 |
|------|------|------|--------|-----------|
| id | uuid | NO | gen_random_uuid() | 主键 |
| student_id | uuid | NO | | 外键 → users.id，学员ID |
| coach_id | uuid | NO | | 外键 → coaches.id，教练ID |
| subscription_id | uuid | YES | | 外键 → coach_subscriptions.id，关联的订阅ID |
| last_message | text | YES | | 最后一条消息预览（前100字符） |
| last_message_at | timestamptz | YES | | 最后消息时间 |
| student_unread | integer | NO | 0 | 学员未读消息数，≥ 0 |
| coach_unread | integer | NO | 0 | 教练未读消息数，≥ 0 |
| is_archived | boolean | NO | false | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**外键**
- `conversations_student_id_fkey` (student_id → users.id)
- `conversations_coach_id_fkey` (coach_id → coaches.id)
- `conversations_subscription_id_fkey` (subscription_id → coach_subscriptions.id)

**索引**
- `conversations_pkey` (id) - 主键索引
- `unique_student_coach_conversation` (student_id, coach_id) - 唯一索引
- `idx_conversations_student` (student_id, updated_at DESC) - 复合索引
- `idx_conversations_coach` (coach_id, updated_at DESC) - 复合索引
- `idx_conversations_updated` (updated_at DESC) - 普通索引
- `idx_conversations_student_unread` (student_id) WHERE coach_unread > 0 - 部分索引
- `idx_conversations_coach_unread` (coach_id) WHERE coach_unread > 0 - 部分索引

---

### 10. coach_subscriptions（教练订阅表）

**基本信息**
- 行数：~3
- RLS：未启用
- 主键：`id` (uuid)

**字段说明**

| 列名 | 类型 | 可空 | 默认值 | 约束/备注 |
|------|------|------|--------|-----------|
| id | uuid | NO | gen_random_uuid() | 主键 |
| student_id | uuid | NO | | 外键 → users.id |
| coach_id | uuid | NO | | 外键 → coaches.id |
| tier | integer | NO | | ∈ {1, 2, 3} |
| status | text | YES | 'active' | ∈ {'active','paused','cancelled','expired'} |
| start_date | timestamptz | YES | now() | |
| end_date | timestamptz | YES | | |
| auto_renew | boolean | YES | true | |
| monthly_price | numeric | NO | | |
| order_id | uuid | YES | | **新增：订单编号** |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

**外键**
- `coach_subscriptions_student_id_fkey` (student_id → users.id)
- `coach_subscriptions_coach_id_fkey` (coach_id → coaches.id)

**索引**
- `coach_subscriptions_pkey` (id) - 主键索引
- `unique_student_coach_subscription` (student_id, coach_id) - 唯一索引
- `idx_coach_subscriptions_student` (student_id) - 普通索引
- `idx_coach_subscriptions_coach` (coach_id) - 普通索引
- `idx_coach_subscriptions_status` (status) - 普通索引

**优化建议**
- `order_id` 字段建议添加外键约束到 `alipay_orders.id`

---

### 11. alipay_orders（支付宝订单表）

**基本信息**
- 行数：~70
- RLS：未启用
- 主键：`id` (uuid)

**字段说明**

| 列名 | 类型 | 可空 | 默认值 | 约束/备注 |
|------|------|------|--------|-----------|
| id | uuid | NO | gen_random_uuid() | 主键 ⚠️ **变更：从 bigint 改为 uuid** |
| out_trade_no | text | NO | | 商户订单号，唯一 |
| subject | text | NO | | 订单标题 |
| total_amount | numeric | NO | | 订单金额 |
| order_type | text | YES | | |
| order_data | jsonb | YES | | |
| user_id | uuid | NO | | 外键 → users.id |
| status | text | NO | 'pending' | ∈ {'pending','paid','failed','closed','refunded'} |
| product_code | varchar | YES | 'FACE_TO_FACE_PAYMENT' | |
| qr_code | text | YES | | 二维码 |
| alipay_trade_no | varchar | YES | | 支付宝交易号 |
| trade_status | varchar | YES | | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**外键**
- `alipay_orders_user_id_fkey` (user_id → users.id)

**索引**
- `alipay_orders_pkey` (id) - 主键索引
- `idx_alipay_orders_user_id` (user_id) - 普通索引
- `idx_alipay_orders_status` (status) - 普通索引
- `idx_alipay_orders_created_at` (created_at) - 普通索引

**优化建议**
- `out_trade_no` 字段建议添加唯一索引（如果还没有）

---

### 12. coach_pricing（教练定价表）⭐ 新增

**基本信息**
- 行数：~1
- RLS：未启用
- 主键：`id` (uuid)

**字段说明**

| 列名 | 类型 | 可空 | 默认值 | 约束/备注 |
|------|------|------|--------|-----------|
| id | uuid | NO | gen_random_uuid() | 主键 |
| coach_id | uuid | NO | | 外键 → coaches.id，唯一 |
| pricings | jsonb | NO | '[]' | 定价信息（JSON格式） |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**外键**
- `coach_pricing_coach_id_fkey` (coach_id → coaches.id)

**索引**
- `coach_pricing_pkey` (id) - 主键索引
- `coach_pricing_coach_id_key` (coach_id) - 唯一索引

---

### 13. coach_plan_templates（教练计划模板表）⭐ 新增

**基本信息**
- 行数：~1
- RLS：未启用
- 主键：`id` (uuid)

**字段说明**

| 列名 | 类型 | 可空 | 默认值 | 约束/备注 |
|------|------|------|--------|-----------|
| id | uuid | NO | gen_random_uuid() | 主键 |
| coach_id | uuid | NO | | |
| name | text | NO | | |
| description | text | YES | | |
| type | text | NO | | |
| rest_days_count | smallint | YES | | |
| tags | text[] | YES | | |
| suitable_for | text | YES | | |
| training_days | jsonb[] | YES | | |
| training_days_count | smallint | YES | | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

**索引**
- `coach_plan_templates_pkey` (id) - 主键索引
- `idx_coach_plan_templates_coach_id` (coach_id) - 普通索引
- `idx_coach_plan_templates_type` (type) - 普通索引

**优化建议**
- `coach_id` 建议添加外键约束到 `coaches.id`

---

### 14. coach_actions（教练行动表）⭐ 新增

**基本信息**
- 行数：~4
- RLS：未启用
- 主键：`id` (uuid)

**字段说明**

| 列名 | 类型 | 可空 | 默认值 | 约束/备注 |
|------|------|------|--------|-----------|
| id | uuid | NO | gen_random_uuid() | 主键 |
| coach_id | uuid | NO | | |
| name | text | NO | | |
| url | text | YES | | |
| detail | text | YES | | |
| positions | text[] | YES | '{}' | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**索引**
- `coach_actions_pkey` (id) - 主键索引

**优化建议**
- `coach_id` 建议添加外键约束到 `coaches.id`
- 建议添加 `coach_id` 的索引

---

### 15. coach_questionnaires（教练问卷表）⭐ 新增

**基本信息**
- 行数：~1
- RLS：未启用
- 主键：`id` (uuid)

**字段说明**

| 列名 | 类型 | 可空 | 默认值 | 约束/备注 |
|------|------|------|--------|-----------|
| id | uuid | NO | gen_random_uuid() | 主键 |
| coach_id | uuid | NO | | |
| questions | jsonb | NO | | 问卷问题（JSON格式） |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

**索引**
- `coach_questionnaires_pkey` (id) - 主键索引
- `idx_coach_questionnaires_coach_id` (coach_id) - 普通索引

**优化建议**
- `coach_id` 建议添加外键约束到 `coaches.id`

---

### 16. coach_plan_template_tags（教练计划模板标签表）⭐ 新增

**基本信息**
- 行数：~0
- RLS：未启用
- 主键：`id` (integer)

**字段说明**

| 列名 | 类型 | 可空 | 默认值 | 约束/备注 |
|------|------|------|--------|-----------|
| id | integer | NO | nextval(...) | 主键，自增 |
| name | varchar | NO | | 唯一 |
| description | text | YES | | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

**索引**
- `coach_plan_template_tags_pkey` (id) - 主键索引
- `coach_plan_template_tags_name_key` (name) - 唯一索引

---

### 其他表（简要说明）

#### 17. admin_users（管理员用户表）
- 行数：~1
- 主键：`id`
- 外键：`user_id → users.id`

#### 18. shipping_info（快递信息表）
- 行数：~0
- 主键：`id`
- 外键：`user_id → users.id`
- 注释：快递信息表，存储中奖用户的快递地址等信息

#### 19. coach_contents（教练内容表）
- 行数：~6
- 主键：`id`
- 外键：`coach_id → coaches.id`

#### 20. coach_messages（教练消息表）
- 行数：~9
- 主键：`id`
- 外键：`sender_id → users.id`, `receiver_id → users.id`
- 索引：包含 conversation_id、sender_id、receiver_id、is_read 等索引

#### 21. coach_rulepacks（教练规则包表）
- 行数：~0
- 主键：`id`
- 外键：`coach_id → coaches.id`
- 唯一索引：`(coach_id, key, version)`

#### 22. content_interactions（内容互动表）
- 行数：~0
- 主键：`id`
- 外键：`user_id → users.id`, `content_id → coach_contents.id`

#### 23. exercises（动作库表）
- 行数：~0
- 主键：`id`
- 外键：`training_plan_id → training_plans.id`

#### 24. lifestyle_logs（生活方式日志表）
- 行数：~1
- 主键：`id`
- 外键：`user_id → users.id`
- 唯一索引：`(user_id, log_date)`

#### 25. onboarding_questionnaires（入门问卷表）
- 行数：~28
- 主键：`id`
- 外键：`user_id → users.id`, `coach_id → coaches.id`

#### 26. personal_records（个人记录表）
- 行数：~0
- 主键：`id`
- 外键：`user_id → auth.users.id` ⚠️ **注意：引用 auth.users 而非 public.users**

#### 27. pullup_leaderboard（引体向上排行榜表）
- 行数：~68
- 主键：`id`
- 外键：部分引用 `auth.users`，部分引用 `public.users` ⚠️ **不一致**

#### 28. rankingboard_pullup_2025_9_10（引体向上排行榜历史表）
- 行数：~68
- 主键：`id`
- 注释：引体向上挑战排行榜（2025年9-10月）
- 外键：部分引用 `auth.users`，部分引用 `public.users` ⚠️ **不一致**

#### 29. specialties（专业领域表）
- 行数：~11
- 主键：`id`
- 唯一索引：`name`

#### 30. training_exercises（训练动作表）
- 行数：~0
- 主键：`id`
- 外键：`training_session_id → training_sessions.id`

#### 31. training_plan_details（训练计划详情表）
- 行数：~132
- 主键：`id`
- 外键：`training_plan_id → training_plans.id`

#### 32. training_progress（训练进度表）
- 行数：~0
- 主键：`id`
- 外键：`user_id → auth.users.id`, `training_plan_id → training_plans.id` ⚠️ **注意：引用 auth.users**

#### 33. training_reminders（训练提醒表）
- 行数：~0
- 主键：`id`
- 外键：`user_id → auth.users.id`, `training_plan_id → training_plans.id` ⚠️ **注意：引用 auth.users**

#### 34. training_sessions（训练会话表）
- 行数：~0
- 主键：`id`
- 外键：`user_id → auth.users.id`, `training_plan_id → training_plans.id` ⚠️ **注意：引用 auth.users**

#### 35. workout_logs（训练日志表）
- 行数：~1
- 主键：`id`
- 外键：`user_id → users.id`, `training_session_id → training_sessions.id`, `training_plan_id → training_plans.id`

---

## 视图详细说明

### 1. user_video_timeline（用户视频时间线视图）

**定义**
```sql
SELECT 
    id, user_id, type, exercise_name, training_plan_id,
    video_url, thumbnail_url, coach_feedback, review_status,
    requires_review, created_at, reviewed_at, user_notes, tags
FROM training_videos tv
WHERE deleted_at IS NULL
ORDER BY created_at DESC;
```

**说明**
- 基于 `training_videos` 表
- 过滤已删除的视频（`deleted_at IS NULL`）
- 按创建时间倒序排列
- 用于展示用户的视频时间线

---

### 2. coach_pending_reviews（教练待审核视图）

**定义**
```sql
SELECT 
    tv.id, tv.user_id,
    (u.raw_user_meta_data ->> 'full_name'::text) AS user_name,
    tv.type, tv.exercise_name, tv.training_plan_id,
    tv.video_url, tv.thumbnail_url, tv.created_at, tv.user_notes
FROM training_videos tv
JOIN auth.users u ON tv.user_id = u.id
WHERE tv.requires_review = true 
  AND tv.review_status = 'pending'
  AND tv.deleted_at IS NULL
ORDER BY tv.created_at;
```

**说明**
- 用于教练查看待审核的视频
- 关联 `auth.users` 表获取用户姓名
- 过滤条件：需要审核、状态为待审核、未删除

---

### 3. training_statistics（训练统计视图）

**定义**
```sql
SELECT 
    user_id, plan_id,
    count(*) AS total_sessions,
    sum(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_sessions,
    sum(completed_sets) AS total_completed_sets,
    sum(total_sets) AS total_sets,
    avg(duration_minutes) AS avg_duration_minutes,
    max(training_date) AS last_training_date,
    round((sum(completed_sets)::numeric / NULLIF(sum(total_sets), 0)::numeric * 100), 2) AS completion_percentage
FROM training_records tr
WHERE status <> 'abandoned'
GROUP BY user_id, plan_id;
```

**说明**
- 基于 `training_records` 表
- 统计每个用户每个训练计划的训练数据
- 排除已放弃的训练记录

---

## 索引清单

### 按表分类的主要索引

**users 表**
- 主键索引：`users_pkey`
- 唯一索引：`users_phone_key`, `users_email_key`
- 普通索引：`idx_users_phone`, `idx_users_created_at`, `idx_users_coach_status`, `idx_users_primary_role`

**training_videos 表**
- 主键索引：`training_videos_pkey`
- 普通索引：`idx_training_videos_user_id`, `idx_training_videos_coach_id`, `idx_training_videos_training_plan_id`, `idx_training_videos_type`, `idx_training_videos_requires_review`, `idx_training_videos_review_status`, `idx_training_videos_created_at`
- 唯一索引：`unique_user_video_per_exercise`

**conversations 表**
- 主键索引：`conversations_pkey`
- 唯一索引：`unique_student_coach_conversation`
- 复合索引：`idx_conversations_student`, `idx_conversations_coach`, `idx_conversations_updated`
- 部分索引：`idx_conversations_student_unread`, `idx_conversations_coach_unread`

**training_records 表**
- 主键索引：`training_records_pkey`
- 普通索引：`idx_training_records_user`, `idx_training_records_plan`, `idx_training_records_status`, `idx_training_records_date`
- 复合索引：`idx_training_records_user_date`
- 唯一索引：`training_records_unique_training`

**coach_messages 表**
- 主键索引：`coach_messages_pkey`
- 普通索引：`idx_coach_messages_conversation`, `idx_coach_messages_sender`, `idx_coach_messages_receiver`, `idx_coach_messages_time`
- 复合索引：`idx_coach_messages_receiver_unread`
- 部分索引：`idx_coach_messages_unread`

（更多索引信息请参考原始结构转储）

---

## 冗余分析与优化建议

### 🔴 严重冗余问题

1. **user_profiles.phone 与 users.phone 重复**
   - 问题：`user_profiles` 表中有 `phone` 字段，与 `users.phone` 重复
   - 建议：删除 `user_profiles.phone`，通过 JOIN 获取

2. **users.phone 存在重复的唯一索引**
   - 问题：`users_phone_key` 和 `idx_users_phone_unique` 都是唯一索引
   - 建议：删除 `idx_users_phone_unique`

3. **user_profiles.user_id 存在重复索引**
   - 问题：`user_profiles_user_id_key` 和 `unique_user_profile` 都是唯一索引
   - 建议：删除 `unique_user_profile`

4. **coaches.user_id 存在重复索引**
   - 问题：`coaches_user_id_unique` 和 `idx_coaches_user_id` 都是唯一索引
   - 建议：删除 `idx_coaches_user_id`

5. **training_plans.user_id 存在重复索引**
   - 问题：`idx_training_plans_user` 和 `idx_training_plans_user_id` 都是普通索引
   - 建议：删除 `idx_training_plans_user_id`

### 🟡 外键不一致问题

1. **部分表引用 auth.users，部分引用 public.users**
   - 问题：`personal_records`, `training_progress`, `training_reminders`, `training_sessions` 引用 `auth.users.id`
   - 而其他表引用 `public.users.id`
   - 建议：统一使用 `public.users.id`，或明确区分使用场景

2. **pullup_leaderboard 和 rankingboard_pullup_2025_9_10 外键不一致**
   - 问题：部分字段引用 `auth.users`，部分引用 `public.users`
   - 建议：统一引用 `public.users`

### 🟢 建议优化

1. **video_submissions 与 training_videos 功能重叠**
   - 建议：评估是否可以合并这两个表，或明确各自的使用场景

2. **缺少外键约束**
   - `training_videos.user_id` → `users.id`（建议添加）
   - `training_videos.training_plan_id` → `training_plans.id`（建议添加）
   - `coach_actions.coach_id` → `coaches.id`（建议添加）
   - `coach_plan_templates.coach_id` → `coaches.id`（建议添加）
   - `coach_questionnaires.coach_id` → `coaches.id`（建议添加）
   - `coach_subscriptions.order_id` → `alipay_orders.id`（建议添加）

3. **索引优化**
   - 部分表缺少常用查询字段的索引
   - 建议根据实际查询模式添加复合索引

4. **数据一致性**
   - `coach_subscriptions.order_id` 字段建议添加外键约束
   - 确保订单与订阅的关联关系正确

---

## 原始结构转储（JSON）

以下为 `public` schema 的完整结构转储，包含：字段、类型、可空、默认值、检查约束、主键、外键、注释、行数估计等元数据。

```json
[{"schema":"public","name":"user_profiles","rls_enabled":false,"rows":94,"columns":[{"name":"id","data_type":"uuid","format":"uuid","options":["updatable"],"default_value":"gen_random_uuid()"},{"name":"user_id","data_type":"uuid","format":"uuid","options":["nullable","updatable","unique"]},{"name":"full_name","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"nickname","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"avatar_url","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"gender","data_type":"text","format":"text","options":["nullable","updatable"],"check":"gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text])"},{"name":"birth_date","data_type":"date","format":"date","options":["nullable","updatable"]},{"name":"height","data_type":"integer","format":"int4","options":["nullable","updatable"]},{"name":"weight","data_type":"integer","format":"int4","options":["nullable","updatable"]},{"name":"fitness_goal","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"fitness_level","data_type":"text","format":"text","options":["nullable","updatable"],"check":"fitness_level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text])"},{"name":"bio","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"created_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"],"default_value":"now()"},{"name":"updated_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"],"default_value":"now()"},{"name":"phone","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"address","data_type":"text","format":"text","options":["nullable","updatable"]}],"primary_keys":["id"],"foreign_key_constraints":[{"name":"fk_user_profiles_user","source":"public.user_profiles.user_id","target":"public.users.id"}]},{"schema":"public","name":"users","rls_enabled":false,"rows":98,"columns":[{"name":"id","data_type":"uuid","format":"uuid","options":["updatable"],"default_value":"gen_random_uuid()"},{"name":"phone","data_type":"text","format":"text","options":["nullable","updatable","unique"]},{"name":"password_hash","data_type":"text","format":"text","options":["updatable"]},{"name":"has_drawn","data_type":"boolean","format":"bool","options":["nullable","updatable"],"default_value":"false"},{"name":"created_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"],"default_value":"now()"},{"name":"updated_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"],"default_value":"now()"},{"name":"last_login_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"]},{"name":"subscription_level","data_type":"text","format":"text","options":["nullable","updatable"],"default_value":"'basic'::text","check":"subscription_level = ANY (ARRAY['basic'::text, 'advanced'::text, 'premium'::text])"},{"name":"subscription_expires_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"]},{"name":"is_admin","data_type":"boolean","format":"bool","options":["nullable","updatable"],"default_value":"false"},{"name":"admin_role","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"admin_permissions","data_type":"ARRAY","format":"_text","options":["nullable","updatable"]},{"name":"is_coach","data_type":"boolean","format":"bool","options":["nullable","updatable"],"default_value":"false"},{"name":"coach_status","data_type":"text","format":"text","options":["nullable","updatable"],"default_value":"'none'::text","check":"coach_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])"},{"name":"primary_role","data_type":"text","format":"text","options":["nullable","updatable"],"default_value":"'student'::text","check":"primary_role = ANY (ARRAY['student'::text, 'coach'::text, 'admin'::text])"},{"name":"email","data_type":"text","format":"text","options":["nullable","updatable","unique"]}],"primary_keys":["id"]},{"schema":"public","name":"coaches","rls_enabled":false,"rows":2,"columns":[{"name":"id","data_type":"uuid","format":"uuid","options":["updatable"],"default_value":"gen_random_uuid()"},{"name":"name","data_type":"text","format":"text","options":["updatable"]},{"name":"title","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"avatar_url","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"specialties","data_type":"ARRAY","format":"_text","options":["nullable","updatable"],"default_value":"'{}'::text[]"},{"name":"bio","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"rating","data_type":"numeric","format":"numeric","options":["nullable","updatable"],"default_value":"0"},{"name":"total_students","data_type":"integer","format":"int4","options":["nullable","updatable"],"default_value":"0"},{"name":"years_experience","data_type":"integer","format":"int4","options":["nullable","updatable"],"default_value":"0"},{"name":"achievements","data_type":"ARRAY","format":"_text","options":["nullable","updatable"],"default_value":"'{}'::text[]"},{"name":"is_featured","data_type":"boolean","format":"bool","options":["nullable","updatable"],"default_value":"false"},{"name":"created_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"],"default_value":"now()"},{"name":"updated_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"],"default_value":"now()"},{"name":"user_id","data_type":"uuid","format":"uuid","options":["nullable","updatable","unique"]},{"name":"status","data_type":"text","format":"text","options":["nullable","updatable"],"default_value":"'pending'::text","check":"status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'suspended'::text])"},{"name":"search_vector","data_type":"tsvector","format":"tsvector","options":["nullable","updatable"]}],"primary_keys":["id"],"foreign_key_constraints":[{"name":"coaches_user_id_fkey","source":"public.coaches.user_id","target":"public.users.id"}]},{"schema":"public","name":"training_plans","rls_enabled":false,"rows":7,"columns":[{"name":"id","data_type":"uuid","format":"uuid","options":["updatable"],"default_value":"gen_random_uuid()"},{"name":"user_id","data_type":"uuid","format":"uuid","options":["updatable"]},{"name":"coach_id","data_type":"uuid","format":"uuid","options":["nullable","updatable"]},{"name":"title","data_type":"text","format":"text","options":["updatable"]},{"name":"description","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"difficulty_level","data_type":"text","format":"text","options":["nullable","updatable"],"check":"difficulty_level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text])"},{"name":"duration_weeks","data_type":"integer","format":"int4","options":["nullable","updatable"],"default_value":"4"},{"name":"ai_generated","data_type":"boolean","format":"bool","options":["nullable","updatable"],"default_value":"true"},{"name":"coach_reviewed","data_type":"boolean","format":"bool","options":["nullable","updatable"],"default_value":"false"},{"name":"created_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"],"default_value":"now()"},{"name":"updated_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"],"default_value":"now()"},{"name":"rulepack_id","data_type":"uuid","format":"uuid","options":["nullable","updatable"]},{"name":"rulepack_version","data_type":"character varying","format":"varchar","options":["nullable","updatable"]},{"name":"domain","data_type":"character varying","format":"varchar","options":["nullable","updatable"]},{"name":"assessment_data","data_type":"jsonb","format":"jsonb","options":["nullable","updatable"]},{"name":"enhanced_by_ai","data_type":"boolean","format":"bool","options":["nullable","updatable"],"default_value":"false"},{"name":"ai_enhancements","data_type":"jsonb","format":"jsonb","options":["nullable","updatable"]},{"name":"status","data_type":"text","format":"text","options":["nullable","updatable"],"default_value":"'draft'::text","check":"status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])"},{"name":"published_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"]}],"primary_keys":["id"],"foreign_key_constraints":[{"name":"training_plans_coach_id_fkey","source":"public.training_plans.coach_id","target":"public.coaches.id"},{"name":"training_plans_rulepack_id_fkey","source":"public.training_plans.rulepack_id","target":"public.coach_rulepacks.id"}]},{"schema":"public","name":"training_videos","rls_enabled":false,"rows":5,"columns":[{"name":"id","data_type":"uuid","format":"uuid","options":["updatable"],"default_value":"gen_random_uuid()"},{"name":"user_id","data_type":"uuid","format":"uuid","options":["nullable","updatable"]},{"name":"coach_id","data_type":"uuid","format":"uuid","options":["nullable","updatable"]},{"name":"type","data_type":"text","format":"text","options":["updatable"],"check":"type = ANY (ARRAY['baseline'::text, 'training'::text, 'completion'::text])"},{"name":"training_plan_id","data_type":"uuid","format":"uuid","options":["nullable","updatable"]},{"name":"training_session_id","data_type":"uuid","format":"uuid","options":["nullable","updatable"]},{"name":"workout_log_id","data_type":"uuid","format":"uuid","options":["nullable","updatable"]},{"name":"exercise_name","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"week_number","data_type":"integer","format":"int4","options":["nullable","updatable"]},{"name":"day_of_week","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"video_url","data_type":"text","format":"text","options":["updatable"]},{"name":"thumbnail_url","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"file_size","data_type":"bigint","format":"int8","options":["nullable","updatable"]},{"name":"duration_seconds","data_type":"integer","format":"int4","options":["nullable","updatable"]},{"name":"requires_review","data_type":"boolean","format":"bool","options":["nullable","updatable"],"default_value":"true"},{"name":"review_status","data_type":"text","format":"text","options":["nullable","updatable"],"default_value":"'pending'::text","check":"review_status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'not_required'::text])"},{"name":"coach_feedback","data_type":"jsonb","format":"jsonb","options":["nullable","updatable"],"default_value":"'{}'::jsonb"},{"name":"user_notes","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"tags","data_type":"ARRAY","format":"_text","options":["nullable","updatable"],"default_value":"'{}'::text[]"},{"name":"processing_status","data_type":"text","format":"text","options":["nullable","updatable"],"default_value":"'uploading'::text","check":"processing_status = ANY (ARRAY['uploading'::text, 'processing'::text, 'ready'::text, 'failed'::text])"},{"name":"metadata","data_type":"jsonb","format":"jsonb","options":["nullable","updatable"],"default_value":"'{}'::jsonb"},{"name":"created_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"],"default_value":"now()"},{"name":"updated_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"],"default_value":"now()"},{"name":"reviewed_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"]},{"name":"deleted_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"]}],"primary_keys":["id"],"foreign_key_constraints":[{"name":"fk_training_videos_coach_id","source":"public.training_videos.coach_id","target":"public.coaches.id"}]},{"schema":"public","name":"video_submissions","rls_enabled":false,"rows":0,"columns":[{"name":"id","data_type":"uuid","format":"uuid","options":["updatable"],"default_value":"gen_random_uuid()"},{"name":"user_id","data_type":"uuid","format":"uuid","options":["updatable"]},{"name":"exercise_id","data_type":"uuid","format":"uuid","options":["nullable","updatable"]},{"name":"video_url","data_type":"text","format":"text","options":["updatable"]},{"name":"description","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"status","data_type":"text","format":"text","options":["nullable","updatable"],"default_value":"'pending'::text","check":"status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'needs_improvement'::text])"},{"name":"coach_feedback","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"coach_rating","data_type":"integer","format":"int4","options":["nullable","updatable"],"check":"coach_rating >= 1 AND coach_rating <= 5"},{"name":"submitted_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"],"default_value":"now()"},{"name":"reviewed_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"]},{"name":"purpose","data_type":"text","format":"text","options":["nullable","updatable"],"check":"purpose = ANY (ARRAY['baseline'::text, 'workout'::text])"}],"primary_keys":["id"],"foreign_key_constraints":[{"name":"video_submissions_exercise_id_fkey","source":"public.video_submissions.exercise_id","target":"public.exercises.id"}]},{"schema":"public","name":"training_records","rls_enabled":false,"rows":25,"columns":[{"name":"id","data_type":"uuid","format":"uuid","options":["updatable"],"default_value":"gen_random_uuid()"},{"name":"user_id","data_type":"uuid","format":"uuid","options":["updatable"]},{"name":"plan_id","data_type":"uuid","format":"uuid","options":["updatable"]},{"name":"training_date","data_type":"date","format":"date","options":["updatable"]},{"name":"week_number","data_type":"integer","format":"int4","options":["updatable"]},{"name":"day_number","data_type":"integer","format":"int4","options":["updatable"]},{"name":"exercises","data_type":"jsonb","format":"jsonb","options":["updatable"],"default_value":"'[]'::jsonb"},{"name":"total_sets","data_type":"integer","format":"int4","options":["updatable"],"default_value":"0"},{"name":"completed_sets","data_type":"integer","format":"int4","options":["updatable"],"default_value":"0"},{"name":"skipped_sets","data_type":"integer","format":"int4","options":["updatable"],"default_value":"0"},{"name":"started_at","data_type":"timestamp with time zone","format":"timestamptz","options":["updatable"],"default_value":"now()"},{"name":"completed_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"]},{"name":"duration_minutes","data_type":"integer","format":"int4","options":["nullable","updatable"]},{"name":"status","data_type":"text","format":"text","options":["updatable"],"default_value":"'in_progress'::text","check":"status = ANY (ARRAY['in_progress'::text, 'completed'::text, 'abandoned'::text])"},{"name":"notes","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"created_at","data_type":"timestamp with time zone","format":"timestamptz","options":["updatable"],"default_value":"now()"},{"name":"updated_at","data_type":"timestamp with time zone","format":"timestamptz","options":["updatable"],"default_value":"now()"}],"primary_keys":["id"],"comment":"学员训练执行记录表","foreign_key_constraints":[{"name":"training_records_user_id_fkey","source":"public.training_records.user_id","target":"public.users.id"},{"name":"training_records_plan_id_fkey","source":"public.training_records.plan_id","target":"public.training_plans.id"},{"name":"set_videos_training_record_id_fkey","source":"public.set_videos.training_record_id","target":"public.training_records.id"}]},{"schema":"public","name":"set_videos","rls_enabled":false,"rows":1,"columns":[{"name":"id","data_type":"uuid","format":"uuid","options":["updatable"],"default_value":"gen_random_uuid()"},{"name":"training_record_id","data_type":"uuid","format":"uuid","options":["updatable"]},{"name":"exercise_index","data_type":"integer","format":"int4","options":["updatable"]},{"name":"set_index","data_type":"integer","format":"int4","options":["updatable"]},{"name":"video_url","data_type":"text","format":"text","options":["updatable"]},{"name":"thumbnail_url","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"duration_seconds","data_type":"integer","format":"int4","options":["nullable","updatable"]},{"name":"file_size_bytes","data_type":"bigint","format":"int8","options":["nullable","updatable"]},{"name":"upload_status","data_type":"text","format":"text","options":["updatable"],"default_value":"'uploaded'::text","check":"upload_status = ANY (ARRAY['uploading'::text, 'uploaded'::text, 'failed'::text])"},{"name":"coach_feedback","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"coach_rating","data_type":"integer","format":"int4","options":["nullable","updatable"],"check":"coach_rating >= 1 AND coach_rating <= 5"},{"name":"reviewed_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"]},{"name":"reviewed_by","data_type":"uuid","format":"uuid","options":["nullable","updatable"]},{"name":"created_at","data_type":"timestamp with time zone","format":"timestamptz","options":["updatable"],"default_value":"now()"}],"primary_keys":["id"],"comment":"训练组视频表","foreign_key_constraints":[{"name":"set_videos_training_record_id_fkey","source":"public.set_videos.training_record_id","target":"public.training_records.id"},{"name":"set_videos_reviewed_by_fkey","source":"public.set_videos.reviewed_by","target":"public.users.id"}]},{"schema":"public","name":"conversations","rls_enabled":false,"rows":5,"columns":[{"name":"id","data_type":"uuid","format":"uuid","options":["updatable"],"default_value":"gen_random_uuid()"},{"name":"student_id","data_type":"uuid","format":"uuid","options":["updatable"],"comment":"学员ID (users.id)"},{"name":"coach_id","data_type":"uuid","format":"uuid","options":["updatable"],"comment":"教练ID (coaches.id)"},{"name":"subscription_id","data_type":"uuid","format":"uuid","options":["nullable","updatable"],"comment":"关联的订阅ID"},{"name":"last_message","data_type":"text","format":"text","options":["nullable","updatable"],"comment":"最后一条消息预览（前100字符）"},{"name":"last_message_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"],"comment":"最后消息时间"},{"name":"student_unread","data_type":"integer","format":"int4","options":["updatable"],"default_value":"0","check":"student_unread >= 0","comment":"学员未读消息数"},{"name":"coach_unread","data_type":"integer","format":"int4","options":["updatable"],"default_value":"0","check":"coach_unread >= 0","comment":"教练未读消息数"},{"name":"is_archived","data_type":"boolean","format":"bool","options":["updatable"],"default_value":"false"},{"name":"created_at","data_type":"timestamp with time zone","format":"timestamptz","options":["updatable"],"default_value":"now()"},{"name":"updated_at","data_type":"timestamp with time zone","format":"timestamptz","options":["updatable"],"default_value":"now()"}],"primary_keys":["id"],"comment":"学员-教练会话表","foreign_key_constraints":[{"name":"conversations_student_id_fkey","source":"public.conversations.student_id","target":"public.users.id"},{"name":"conversations_coach_id_fkey","source":"public.conversations.coach_id","target":"public.coaches.id"},{"name":"conversations_subscription_id_fkey","source":"public.conversations.subscription_id","target":"public.coach_subscriptions.id"}]},{"schema":"public","name":"coach_subscriptions","rls_enabled":false,"rows":3,"columns":[{"name":"id","data_type":"uuid","format":"uuid","options":["updatable"],"default_value":"gen_random_uuid()"},{"name":"student_id","data_type":"uuid","format":"uuid","options":["updatable"]},{"name":"coach_id","data_type":"uuid","format":"uuid","options":["updatable"]},{"name":"tier","data_type":"integer","format":"int4","options":["updatable"],"check":"tier = ANY (ARRAY[1, 2, 3])"},{"name":"status","data_type":"text","format":"text","options":["nullable","updatable"],"default_value":"'active'::text","check":"status = ANY (ARRAY['active'::text, 'paused'::text, 'cancelled'::text, 'expired'::text])"},{"name":"start_date","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"],"default_value":"now()"},{"name":"end_date","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"]},{"name":"auto_renew","data_type":"boolean","format":"bool","options":["nullable","updatable"],"default_value":"true"},{"name":"monthly_price","data_type":"numeric","format":"numeric","options":["updatable"]},{"name":"order_id","data_type":"uuid","format":"uuid","options":["nullable","updatable"],"comment":"订单编号"},{"name":"created_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"],"default_value":"now()"},{"name":"updated_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"],"default_value":"now()"}],"primary_keys":["id"],"foreign_key_constraints":[{"name":"coach_subscriptions_student_id_fkey","source":"public.coach_subscriptions.student_id","target":"public.users.id"},{"name":"coach_subscriptions_coach_id_fkey","source":"public.coach_subscriptions.coach_id","target":"public.coaches.id"},{"name":"conversations_subscription_id_fkey","source":"public.conversations.subscription_id","target":"public.coach_subscriptions.id"}]},{"schema":"public","name":"alipay_orders","rls_enabled":false,"rows":70,"columns":[{"name":"subject","data_type":"text","format":"text","options":["updatable"]},{"name":"total_amount","data_type":"numeric","format":"numeric","options":["updatable"]},{"name":"order_type","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"order_data","data_type":"jsonb","format":"jsonb","options":["nullable","updatable"]},{"name":"user_id","data_type":"uuid","format":"uuid","options":["updatable"]},{"name":"status","data_type":"text","format":"text","options":["updatable"],"default_value":"'pending'::text","check":"status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'closed'::text, 'refunded'::text])"},{"name":"created_at","data_type":"timestamp with time zone","format":"timestamptz","options":["updatable"],"default_value":"now()"},{"name":"updated_at","data_type":"timestamp with time zone","format":"timestamptz","options":["updatable"],"default_value":"now()"},{"name":"product_code","data_type":"character varying","format":"varchar","options":["nullable","updatable"],"default_value":"'FACE_TO_FACE_PAYMENT'::character varying"},{"name":"qr_code","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"alipay_trade_no","data_type":"character varying","format":"varchar","options":["nullable","updatable"]},{"name":"trade_status","data_type":"character varying","format":"varchar","options":["nullable","updatable"]},{"name":"id","data_type":"uuid","format":"uuid","options":["updatable"],"default_value":"gen_random_uuid()"}],"primary_keys":["id"],"foreign_key_constraints":[{"name":"alipay_orders_user_id_fkey","source":"public.alipay_orders.user_id","target":"public.users.id"}]},{"schema":"public","name":"coach_pricing","rls_enabled":false,"rows":1,"columns":[{"name":"id","data_type":"uuid","format":"uuid","options":["updatable"],"default_value":"gen_random_uuid()"},{"name":"coach_id","data_type":"uuid","format":"uuid","options":["updatable","unique"]},{"name":"pricings","data_type":"jsonb","format":"jsonb","options":["updatable"],"default_value":"'[]'::jsonb"},{"name":"created_at","data_type":"timestamp with time zone","format":"timestamptz","options":["updatable"],"default_value":"now()"},{"name":"updated_at","data_type":"timestamp with time zone","format":"timestamptz","options":["updatable"],"default_value":"now()"}],"primary_keys":["id"],"foreign_key_constraints":[{"name":"coach_pricing_coach_id_fkey","source":"public.coach_pricing.coach_id","target":"public.coaches.id"}]},{"schema":"public","name":"coach_plan_templates","rls_enabled":false,"rows":1,"columns":[{"name":"id","data_type":"uuid","format":"uuid","options":["updatable"],"default_value":"gen_random_uuid()"},{"name":"coach_id","data_type":"uuid","format":"uuid","options":["updatable"]},{"name":"name","data_type":"text","format":"text","options":["updatable"]},{"name":"description","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"type","data_type":"text","format":"text","options":["updatable"]},{"name":"created_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"],"default_value":"now()"},{"name":"updated_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"],"default_value":"now()"},{"name":"rest_days_count","data_type":"smallint","format":"int2","options":["nullable","updatable"]},{"name":"tags","data_type":"ARRAY","format":"_text","options":["nullable","updatable"]},{"name":"suitable_for","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"training_days","data_type":"ARRAY","format":"_jsonb","options":["nullable","updatable"]},{"name":"training_days_count","data_type":"smallint","format":"int2","options":["nullable","updatable"]}],"primary_keys":["id"]},{"schema":"public","name":"coach_actions","rls_enabled":false,"rows":4,"columns":[{"name":"id","data_type":"uuid","format":"uuid","options":["updatable"],"default_value":"gen_random_uuid()"},{"name":"coach_id","data_type":"uuid","format":"uuid","options":["updatable"]},{"name":"name","data_type":"text","format":"text","options":["updatable"]},{"name":"url","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"detail","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"positions","data_type":"ARRAY","format":"_text","options":["nullable","updatable"],"default_value":"'{}'::text[]"},{"name":"created_at","data_type":"timestamp with time zone","format":"timestamptz","options":["updatable"],"default_value":"now()"},{"name":"updated_at","data_type":"timestamp with time zone","format":"timestamptz","options":["updatable"],"default_value":"now()"}],"primary_keys":["id"]},{"schema":"public","name":"coach_questionnaires","rls_enabled":false,"rows":1,"columns":[{"name":"id","data_type":"uuid","format":"uuid","options":["updatable"],"default_value":"gen_random_uuid()"},{"name":"coach_id","data_type":"uuid","format":"uuid","options":["updatable"]},{"name":"questions","data_type":"jsonb","format":"jsonb","options":["updatable"]},{"name":"created_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"],"default_value":"now()"},{"name":"updated_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"],"default_value":"now()"}],"primary_keys":["id"]},{"schema":"public","name":"coach_plan_template_tags","rls_enabled":false,"rows":0,"columns":[{"name":"id","data_type":"integer","format":"int4","options":["updatable"],"default_value":"nextval('coach_plan_template_tags_id_seq'::regclass)"},{"name":"name","data_type":"character varying","format":"varchar","options":["updatable","unique"]},{"name":"description","data_type":"text","format":"text","options":["nullable","updatable"]},{"name":"created_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"],"default_value":"now()"},{"name":"updated_at","data_type":"timestamp with time zone","format":"timestamptz","options":["nullable","updatable"],"default_value":"now()"}],"primary_keys":["id"]}]
```

---

## 总结

本文档包含了 Supabase 数据库中 `public` schema 的完整结构信息，包括：

- ✅ 35个表的详细说明
- ✅ 3个视图的定义
- ✅ 所有索引信息
- ✅ 外键关系
- ✅ 冗余分析和优化建议
- ✅ 新增表的标注

**主要发现：**
1. 新增了6个表：`conversations`, `coach_pricing`, `coach_plan_templates`, `coach_plan_template_tags`, `coach_actions`, `coach_questionnaires`
2. `alipay_orders.id` 字段类型从 `bigint` 改为 `uuid`
3. `coach_subscriptions` 新增了 `order_id` 字段
4. 存在多处索引冗余，建议清理
5. 部分表缺少外键约束，建议补充
6. `user_profiles.phone` 与 `users.phone` 重复，建议删除

**下一步建议：**
1. 清理冗余索引
2. 补充缺失的外键约束
3. 统一外键引用（`auth.users` vs `public.users`）
4. 评估 `video_submissions` 与 `training_videos` 的合并可能性
