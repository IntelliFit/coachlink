# Supabase 数据库结构文档（public schema）

- **生成时间**：2025-01-27（已更新）
- **最后更新**：2025-12-04（根据数据库分析报告更新）
- **数据库版本**：PostgreSQL (Supabase)
- **Schema**：public

> ⚠️
> **重要变更说明**：根据数据库分析报告（2025-12-04），已删除6个冗余表，当前保留
> **29个表 + 3个视图 = 32个数据库对象**。

## 目录

1. [表清单](#表清单)
2. [视图清单](#视图清单)
3. [已删除的表（历史记录）](#已删除的表历史记录)
4. [表详细说明](#表详细说明)
5. [视图详细说明](#视图详细说明)
6. [索引清单](#索引清单)
7. [冗余分析与优化建议](#冗余分析与优化建议)
8. [数据库变更历史](#数据库变更历史)

---

## 表清单

### 用户相关表（4个）

- `users` - 统一用户表（auth）
- `user_profiles` - 学员个人档案表
- `admin_users` - 系统管理员账号表
- `shipping_info` - 快递信息表

### 教练相关表（9个）

- `coaches` - 教练基本信息表
- `coach_subscriptions` - 教练订阅关系表
- `coach_contents` - 教练内容库（文章、视频）表
- `coach_messages` - 教练与学员私信表
- `coach_rulepacks` - 规则包（AI 生成计划）表 ⚠️ **暂保留**
- `coach_actions` - 教练行为日志表
- `coach_plan_templates` - **核心模板库**（教练设计的可复用训练计划模板）
- `coach_plan_template_tags` - 模板标签表
- `coach_questionnaires` - 教练专属问卷表
- `coach_pricing` - 教练收费套餐表

### 训练相关表（7个）

- `training_plans` - **学员训练计划**表
- `training_plan_details` - **核心计划明细**表（存储每日/每周动作 JSONB）
- `training_sessions` - 训练会话表（计划中的一天）
- `training_records` - 训练执行记录表（每次训练）
- `training_videos` - 训练视频表（完整训练）
- `set_videos` - 训练组视频表（每组）
- `personal_records` - 个人记录表 ❌ **已废弃**（仅存最大记录，缺历史）

### 内容互动表（2个）

- `content_interactions` - 内容交互表（点赞、收藏）
- `conversations` - 课堂/群聊会话表

### 其他表（7个）

- `onboarding_questionnaires` - 新用户入职问卷表
- `lifestyle_logs` - 学员生活日志表
- `alipay_orders` - 支付订单记录表
- `pullup_leaderboard` - 当前活跃的引体向上排行榜表
- `rankingboard_pullup_2025_9_10` - **历史归档**表（2025年9-10月，仅作历史快照）
- `specialties` - 教练专业领域表
- `coach_pending_reviews` - ⚠️ **注：实际为视图**（待审教练内容，内容审核队列）

**总计：29个表**（用户4 + 教练9 + 训练7 + 内容互动2 + 其他7* =
29，*其中1个标记为视图）

---

## 视图清单

1. `user_video_timeline` - 学员视频时间线视图（关联 `training_videos`）
2. `coach_pending_reviews` - 待审教练内容视图（内容审核队列）
3. `training_statistics` - 训练统计视图（动态计算而非存储）

---

## 已删除的表（历史记录）

根据数据库分析报告，以下表已被删除：

### 已删除的表（6个）

- ❌ `exercises` - 动作库表（已删除，因 `video_submissions` 依赖已清理）
- ❌ `video_submissions` - 视频提交表（已删除，功能被 `training_videos` 替代）
- ❌ `training_exercises` - 训练动作表（已合并至新结构）
- ❌ `training_progress` - 训练进度表（未使用，统计改为动态视图
  `training_statistics`）
- ❌ `training_reminders` - 训练提醒表（未使用，已删除）
- ❌ `workout_logs` - 训练日志表（功能已合并至 `training_records`）

**删除原因：**

- 功能重叠或冗余
- 未使用或使用率低
- 已合并到其他表

---

## 表详细说明

### 1. users（统一用户表）

**基本信息**

- 行数：~98
- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用

**字段说明**

| 列名                    | 类型        | 可空 | 默认值            | 约束/备注                                  |
| ----------------------- | ----------- | ---- | ----------------- | ------------------------------------------ |
| id                      | uuid        | NO   | gen_random_uuid() | 主键                                       |
| phone                   | text        | YES  |                   | 唯一索引                                   |
| password_hash           | text        | NO   |                   |                                            |
| email                   | text        | YES  |                   | 唯一索引                                   |
| has_drawn               | boolean     | YES  | false             |                                            |
| created_at              | timestamptz | YES  | now()             |                                            |
| updated_at              | timestamptz | YES  | now()             |                                            |
| last_login_at           | timestamptz | YES  |                   |                                            |
| subscription_level      | text        | YES  | 'basic'           | ∈ {'basic','advanced','premium'}           |
| subscription_expires_at | timestamptz | YES  |                   |                                            |
| is_admin                | boolean     | YES  | false             |                                            |
| admin_role              | text        | YES  |                   |                                            |
| admin_permissions       | text[]      | YES  |                   |                                            |
| is_coach                | boolean     | YES  | false             |                                            |
| coach_status            | text        | YES  | 'none'            | ∈ {'none','pending','approved','rejected'} |
| primary_role            | text        | YES  | 'student'         | ∈ {'student','coach','admin'}              |

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

### 2. user_profiles（学员个人档案表）

**基本信息**

- 行数：~94
- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 说明：包含 `sport_cards` 等字段

**字段说明**

| 列名          | 类型        | 可空 | 默认值            | 约束/备注                                |
| ------------- | ----------- | ---- | ----------------- | ---------------------------------------- |
| id            | uuid        | NO   | gen_random_uuid() | 主键                                     |
| user_id       | uuid        | YES  |                   | 外键 → users.id，唯一                    |
| full_name     | text        | YES  |                   |                                          |
| nickname      | text        | YES  |                   |                                          |
| avatar_url    | text        | YES  |                   |                                          |
| gender        | text        | YES  |                   | ∈ {'male','female','other'}              |
| birth_date    | date        | YES  |                   |                                          |
| height        | integer     | YES  |                   | 单位：厘米                               |
| weight        | integer     | YES  |                   | 单位：千克                               |
| fitness_goal  | text        | YES  |                   |                                          |
| fitness_level | text        | YES  |                   | ∈ {'beginner','intermediate','advanced'} |
| bio           | text        | YES  |                   |                                          |
| phone         | text        | YES  |                   | **冗余：与 users.phone 重复**            |
| address       | text        | YES  |                   |                                          |
| created_at    | timestamptz | YES  | now()             |                                          |
| updated_at    | timestamptz | YES  | now()             |                                          |

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

### 3. coaches（教练基本信息表）

**基本信息**

- 行数：~2
- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用

**字段说明**

| 列名             | 类型        | 可空 | 默认值            | 约束/备注                                       |
| ---------------- | ----------- | ---- | ----------------- | ----------------------------------------------- |
| id               | uuid        | NO   | gen_random_uuid() | 主键                                            |
| user_id          | uuid        | YES  |                   | 外键 → users.id，唯一                           |
| name             | text        | NO   |                   |                                                 |
| title            | text        | YES  |                   |                                                 |
| avatar_url       | text        | YES  |                   |                                                 |
| specialties      | text[]      | YES  | '{}'              |                                                 |
| bio              | text        | YES  |                   |                                                 |
| rating           | numeric     | YES  | 0                 |                                                 |
| total_students   | integer     | YES  | 0                 |                                                 |
| years_experience | integer     | YES  | 0                 |                                                 |
| achievements     | text[]      | YES  | '{}'              |                                                 |
| is_featured      | boolean     | YES  | false             |                                                 |
| status           | text        | YES  | 'pending'         | ∈ {'pending','approved','rejected','suspended'} |
| search_vector    | tsvector    | YES  |                   | 全文搜索向量                                    |
| created_at       | timestamptz | YES  | now()             |                                                 |
| updated_at       | timestamptz | YES  | now()             |                                                 |

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

### 4. training_plans（学员训练计划表）

**基本信息**

- 行数：~7
- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 说明：关联 `training_plan_details`

**字段说明**

| 列名             | 类型        | 可空 | 默认值            | 约束/备注                                                   |
| ---------------- | ----------- | ---- | ----------------- | ----------------------------------------------------------- |
| id               | uuid        | NO   | gen_random_uuid() | 主键                                                        |
| user_id          | uuid        | NO   |                   | 学员ID                                                      |
| coach_id         | uuid        | YES  |                   | 外键 → coaches.id                                           |
| title            | text        | NO   |                   |                                                             |
| description      | text        | YES  |                   |                                                             |
| difficulty_level | text        | YES  |                   | ∈ {'beginner','intermediate','advanced'}                    |
| duration_weeks   | integer     | YES  | 4                 |                                                             |
| ai_generated     | boolean     | YES  | true              |                                                             |
| coach_reviewed   | boolean     | YES  | false             |                                                             |
| rulepack_id      | uuid        | YES  |                   | 外键 → coach_rulepacks.id ⚠️ **未来将被教练端计划编辑取代** |
| rulepack_version | varchar     | YES  |                   |                                                             |
| domain           | varchar     | YES  |                   |                                                             |
| assessment_data  | jsonb       | YES  |                   |                                                             |
| enhanced_by_ai   | boolean     | YES  | false             |                                                             |
| ai_enhancements  | jsonb       | YES  |                   |                                                             |
| status           | text        | YES  | 'draft'           | ∈ {'draft','published','archived'}                          |
| published_at     | timestamptz | YES  |                   |                                                             |
| created_at       | timestamptz | YES  | now()             |                                                             |
| updated_at       | timestamptz | YES  | now()             |                                                             |

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
- `rulepack_id` 相关字段未来将逐步淘汰

---

### 5. training_plan_details（核心计划明细表）

**基本信息**

- 行数：~132
- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 说明：**核心计划明细**，存储每日/每周动作 JSONB

**字段说明**

| 列名                | 类型        | 可空 | 默认值            | 约束/备注                |
| ------------------- | ----------- | ---- | ----------------- | ------------------------ |
| id                  | uuid        | NO   | gen_random_uuid() | 主键                     |
| training_plan_id    | uuid        | NO   |                   | 外键 → training_plans.id |
| week_number         | integer     | NO   |                   |                          |
| day_of_week         | varchar     | NO   |                   |                          |
| session_focus       | varchar     | YES  |                   |                          |
| main_exercises      | jsonb       | NO   |                   | 主要动作（JSON格式）     |
| accessory_exercises | jsonb       | NO   |                   | 辅助动作（JSON格式）     |
| warmup              | jsonb       | YES  |                   | 热身（JSON格式）         |
| cooldown            | jsonb       | YES  |                   | 放松（JSON格式）         |
| notes               | text        | YES  |                   |                          |
| order_index         | integer     | YES  | 0                 |                          |
| created_at          | timestamptz | YES  | now()             |                          |
| updated_at          | timestamptz | YES  | now()             |                          |

**外键**

- `training_plan_details_training_plan_id_fkey` (training_plan_id →
  training_plans.id)

**索引**

- `training_plan_details_pkey` (id) - 主键索引
- `idx_training_plan_details_plan_id` (training_plan_id) - 普通索引
- `idx_training_plan_details_week` (week_number) - 普通索引

**未来改进方向**

- 根据数据库分析报告，未来将采用快照表
  `student_training_plans`、`student_plan_days`、`student_plan_exercises`，保存生成时的完整动作信息（包括
  `demo_video_url`、`execution_details`）

---

### 6. training_records（训练执行记录表）

**基本信息**

- 行数：~25
- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 注释：学员训练执行记录表，记录实际完成情况
- 说明：关联 `training_records`

**字段说明**

| 列名             | 类型        | 可空 | 默认值            | 约束/备注                                 |
| ---------------- | ----------- | ---- | ----------------- | ----------------------------------------- |
| id               | uuid        | NO   | gen_random_uuid() | 主键                                      |
| user_id          | uuid        | NO   |                   | 外键 → users.id                           |
| plan_id          | uuid        | NO   |                   | 外键 → training_plans.id                  |
| training_date    | date        | NO   |                   |                                           |
| week_number      | integer     | NO   |                   |                                           |
| day_number       | integer     | NO   |                   |                                           |
| exercises        | jsonb       | NO   | '[]'              | 训练动作详情                              |
| total_sets       | integer     | NO   | 0                 |                                           |
| completed_sets   | integer     | NO   | 0                 |                                           |
| skipped_sets     | integer     | NO   | 0                 |                                           |
| started_at       | timestamptz | NO   | now()             |                                           |
| completed_at     | timestamptz | YES  |                   |                                           |
| duration_minutes | integer     | YES  |                   |                                           |
| status           | text        | NO   | 'in_progress'     | ∈ {'in_progress','completed','abandoned'} |
| notes            | text        | YES  |                   |                                           |
| created_at       | timestamptz | NO   | now()             |                                           |
| updated_at       | timestamptz | NO   | now()             |                                           |

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
- `training_records_unique_training` (user_id, plan_id, week_number, day_number,
  training_date) - 唯一索引

---

### 7. training_sessions（训练会话表）

**基本信息**

- 行数：~0
- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 说明：训练会话（计划中的一天），关联 `training_plan_details`

**字段说明**

| 列名             | 类型        | 可空 | 默认值            | 约束/备注                                         |
| ---------------- | ----------- | ---- | ----------------- | ------------------------------------------------- |
| id               | uuid        | NO   | gen_random_uuid() | 主键                                              |
| user_id          | uuid        | NO   |                   | 外键 → auth.users.id ⚠️ **注意：引用 auth.users** |
| training_plan_id | uuid        | NO   |                   | 外键 → training_plans.id                          |
| week_number      | integer     | NO   |                   |                                                   |
| day_of_week      | varchar     | NO   |                   |                                                   |
| session_focus    | varchar     | YES  |                   |                                                   |
| scheduled_date   | date        | YES  |                   |                                                   |
| completed_date   | timestamptz | YES  |                   |                                                   |
| status           | varchar     | YES  | 'scheduled'       |                                                   |
| notes            | text        | YES  |                   |                                                   |
| rpe              | integer     | YES  |                   | 1 ≤ rpe ≤ 10                                      |
| energy_level     | integer     | YES  |                   | 1 ≤ energy_level ≤ 10                             |
| sleep_hours      | integer     | YES  |                   |                                                   |
| created_at       | timestamptz | YES  | now()             |                                                   |
| updated_at       | timestamptz | YES  | now()             |                                                   |

**外键**

- `training_sessions_user_id_fkey` (user_id → auth.users.id) ⚠️ **需要统一为
  public.users.id**
- `training_sessions_training_plan_id_fkey` (training_plan_id →
  training_plans.id)

**索引**

- `training_sessions_pkey` (id) - 主键索引
- `idx_training_sessions_user_id` (user_id) - 普通索引
- `idx_training_sessions_plan_id` (training_plan_id) - 普通索引
- `idx_training_sessions_status` (status) - 普通索引
- `idx_training_sessions_week_day` (week_number, day_of_week) - 复合索引

**优化建议**

- `user_id` 外键应统一为 `public.users.id` 而非 `auth.users.id`

---

### 8. training_videos（训练视频表）

**基本信息**

- 行数：~5
- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 说明：训练视频（完整训练），关联 `training_records`

**字段说明**

| 列名                | 类型        | 可空 | 默认值            | 约束/备注                                     |
| ------------------- | ----------- | ---- | ----------------- | --------------------------------------------- |
| id                  | uuid        | NO   | gen_random_uuid() | 主键                                          |
| user_id             | uuid        | YES  |                   |                                               |
| coach_id            | uuid        | YES  |                   | 外键 → coaches.id                             |
| type                | text        | NO   |                   | ∈ {'baseline','training','completion'}        |
| training_plan_id    | uuid        | YES  |                   |                                               |
| training_session_id | uuid        | YES  |                   |                                               |
| workout_log_id      | uuid        | YES  |                   | ⚠️ **已废弃字段**（workout_logs 表已删除）    |
| exercise_name       | text        | YES  |                   |                                               |
| week_number         | integer     | YES  |                   |                                               |
| day_of_week         | text        | YES  |                   |                                               |
| video_url           | text        | NO   |                   |                                               |
| thumbnail_url       | text        | YES  |                   |                                               |
| file_size           | bigint      | YES  |                   | 单位：字节                                    |
| duration_seconds    | integer     | YES  |                   |                                               |
| requires_review     | boolean     | YES  | true              |                                               |
| review_status       | text        | YES  | 'pending'         | ∈ {'pending','reviewed','not_required'}       |
| coach_feedback      | jsonb       | YES  | '{}'              |                                               |
| user_notes          | text        | YES  |                   |                                               |
| tags                | text[]      | YES  | '{}'              |                                               |
| processing_status   | text        | YES  | 'uploading'       | ∈ {'uploading','processing','ready','failed'} |
| metadata            | jsonb       | YES  | '{}'              |                                               |
| created_at          | timestamptz | YES  | now()             |                                               |
| updated_at          | timestamptz | YES  | now()             |                                               |
| reviewed_at         | timestamptz | YES  |                   |                                               |
| deleted_at          | timestamptz | YES  |                   | 软删除标记                                    |

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
- `unique_user_video_per_exercise` (user_id, training_plan_id, exercise_name,
  type) - 唯一索引

**优化建议**

- 建议添加 `user_id` 和 `training_plan_id` 的外键约束
- `workout_log_id` 字段可以删除（`workout_logs` 表已删除）

---

### 9. set_videos（训练组视频表）

**基本信息**

- 行数：~1
- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 注释：训练组视频表（每组）
- 说明：关联 `training_records`

**字段说明**

| 列名               | 类型        | 可空 | 默认值            | 约束/备注                           |
| ------------------ | ----------- | ---- | ----------------- | ----------------------------------- |
| id                 | uuid        | NO   | gen_random_uuid() | 主键                                |
| training_record_id | uuid        | NO   |                   | 外键 → training_records.id          |
| exercise_index     | integer     | NO   |                   |                                     |
| set_index          | integer     | NO   |                   |                                     |
| video_url          | text        | NO   |                   |                                     |
| thumbnail_url      | text        | YES  |                   |                                     |
| duration_seconds   | integer     | YES  |                   |                                     |
| file_size_bytes    | bigint      | YES  |                   |                                     |
| upload_status      | text        | NO   | 'uploaded'        | ∈ {'uploading','uploaded','failed'} |
| coach_feedback     | text        | YES  |                   |                                     |
| coach_rating       | integer     | YES  |                   | 1 ≤ coach_rating ≤ 5                |
| reviewed_at        | timestamptz | YES  |                   |                                     |
| reviewed_by        | uuid        | YES  |                   | 外键 → users.id                     |
| created_at         | timestamptz | NO   | now()             |                                     |

**外键**

- `set_videos_training_record_id_fkey` (training_record_id →
  training_records.id)
- `set_videos_reviewed_by_fkey` (reviewed_by → users.id)

**索引**

- `set_videos_pkey` (id) - 主键索引
- `idx_set_videos_record` (training_record_id) - 普通索引
- `idx_set_videos_upload_status` (upload_status) - 普通索引
- `idx_set_videos_reviewed` (reviewed_at) WHERE reviewed_at IS NOT NULL -
  部分索引
- `set_videos_training_record_id_exercise_index_set_index_key`
  (training_record_id, exercise_index, set_index) - 唯一索引

---

### 10. personal_records（个人记录表）

**基本信息**

- 行数：~0
- RLS：未启用
- 主键：`id` (uuid)
- 状态：❌ **已废弃**
- 说明：仅存最大记录，缺历史。建议用 `user_1rm_history` 替代

**字段说明**

| 列名          | 类型        | 可空 | 默认值            | 约束/备注                                         |
| ------------- | ----------- | ---- | ----------------- | ------------------------------------------------- |
| id            | uuid        | NO   | gen_random_uuid() | 主键                                              |
| user_id       | uuid        | NO   |                   | 外键 → auth.users.id ⚠️ **注意：引用 auth.users** |
| exercise_name | varchar     | NO   |                   |                                                   |
| max_weight    | numeric     | YES  |                   |                                                   |
| max_reps      | integer     | YES  |                   |                                                   |
| date_achieved | date        | NO   |                   |                                                   |
| notes         | text        | YES  |                   |                                                   |
| created_at    | timestamptz | YES  | now()             |                                                   |

**外键**

- `personal_records_user_id_fkey` (user_id → auth.users.id) ⚠️ **需要统一为
  public.users.id**

**索引**

- `personal_records_pkey` (id) - 主键索引
- `idx_personal_records_user_exercise` (user_id, exercise_name) - 复合索引

**未来改进**

- 根据数据库分析报告，将创建 `user_1rm_history`（历史 1RM 表），并在 UI
  中绘制进步曲线
- `personal_records` 将在后期迁移或直接删除

---

### 11. conversations（课堂/群聊会话表）

**基本信息**

- 行数：~5
- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 注释：学员-教练会话表，记录聊天历史

**字段说明**

| 列名            | 类型        | 可空 | 默认值            | 约束/备注                                   |
| --------------- | ----------- | ---- | ----------------- | ------------------------------------------- |
| id              | uuid        | NO   | gen_random_uuid() | 主键                                        |
| student_id      | uuid        | NO   |                   | 外键 → users.id，学员ID                     |
| coach_id        | uuid        | NO   |                   | 外键 → coaches.id，教练ID                   |
| subscription_id | uuid        | YES  |                   | 外键 → coach_subscriptions.id，关联的订阅ID |
| last_message    | text        | YES  |                   | 最后一条消息预览（前100字符）               |
| last_message_at | timestamptz | YES  |                   | 最后消息时间                                |
| student_unread  | integer     | NO   | 0                 | 学员未读消息数，≥ 0                         |
| coach_unread    | integer     | NO   | 0                 | 教练未读消息数，≥ 0                         |
| is_archived     | boolean     | NO   | false             |                                             |
| created_at      | timestamptz | NO   | now()             |                                             |
| updated_at      | timestamptz | NO   | now()             |                                             |

**外键**

- `conversations_student_id_fkey` (student_id → users.id)
- `conversations_coach_id_fkey` (coach_id → coaches.id)
- `conversations_subscription_id_fkey` (subscription_id →
  coach_subscriptions.id)

**索引**

- `conversations_pkey` (id) - 主键索引
- `unique_student_coach_conversation` (student_id, coach_id) - 唯一索引
- `idx_conversations_student` (student_id, updated_at DESC) - 复合索引
- `idx_conversations_coach` (coach_id, updated_at DESC) - 复合索引
- `idx_conversations_updated` (updated_at DESC) - 普通索引
- `idx_conversations_student_unread` (student_id) WHERE coach_unread > 0 -
  部分索引
- `idx_conversations_coach_unread` (coach_id) WHERE coach_unread > 0 - 部分索引

---

### 12. coach_subscriptions（教练订阅关系表）

**基本信息**

- 行数：~5
- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 说明：关联学员与教练

**字段说明**

| 列名           | 类型        | 可空 | 默认值            | 约束/备注                                   |
| -------------- | ----------- | ---- | ----------------- | ------------------------------------------- |
| id             | uuid        | NO   | gen_random_uuid() | 主键                                        |
| student_id     | uuid        | NO   |                   | 外键 → users.id                             |
| coach_id       | uuid        | NO   |                   | 外键 → coaches.id                           |
| tier           | integer     | NO   |                   | ∈ {1, 2, 3}                                 |
| status         | text        | YES  | 'active'          | ∈ {'active','paused','cancelled','expired'} |
| start_date     | timestamptz | YES  | now()             |                                             |
| end_date       | timestamptz | YES  |                   |                                             |
| auto_renew     | boolean     | YES  | true              |                                             |
| monthly_price  | numeric     | NO   |                   |                                             |
| order_id       | uuid        | YES  |                   | 订单编号                                    |
| subscribe_data | jsonb       | YES  |                   | **新增：订阅附带的一些基础信息**            |
| created_at     | timestamptz | YES  | now()             |                                             |
| updated_at     | timestamptz | YES  | now()             |                                             |

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

### 13. coach_rulepacks（规则包表）

**基本信息**

- 行数：~0
- RLS：未启用
- 主键：`id` (uuid)
- 状态：⚠️ **暂保留**
- 说明：规则包（AI 生成计划），未来将被教练端计划编辑取代。保留仅作 **AI
  生成备选**（未来可在规则包上叠加 AI），但不再作为学员生成入口。

**字段说明**

| 列名        | 类型        | 可空 | 默认值            | 约束/备注         |
| ----------- | ----------- | ---- | ----------------- | ----------------- |
| id          | uuid        | NO   | gen_random_uuid() | 主键              |
| coach_id    | uuid        | NO   |                   | 外键 → coaches.id |
| key         | varchar     | NO   |                   |                   |
| name        | varchar     | NO   |                   |                   |
| domain      | varchar     | NO   |                   |                   |
| version     | varchar     | NO   | '1.0'             |                   |
| config_json | jsonb       | NO   |                   |                   |
| form_schema | jsonb       | NO   |                   |                   |
| description | text        | YES  |                   |                   |
| is_active   | boolean     | YES  | true              |                   |
| created_at  | timestamptz | YES  | now()             |                   |
| updated_at  | timestamptz | YES  | now()             |                   |

**外键**

- `coach_rulepacks_coach_id_fkey` (coach_id → coaches.id)

**索引**

- `coach_rulepacks_pkey` (id) - 主键索引
- `coach_rulepacks_coach_id_key_version_key` (coach_id, key, version) - 唯一索引
- `idx_coach_rulepacks_coach_id` (coach_id) - 普通索引
- `idx_coach_rulepacks_domain` (domain) - 普通索引
- `idx_coach_rulepacks_key` (key) - 普通索引

**未来计划**

- 逐步淘汰 `coach_rulepacks`，保留仅作 **AI 生成备选**
- 未来可在规则包上叠加 AI，但不再作为学员生成入口

---

### 14. coach_plan_templates（核心模板库表）

**基本信息**

- 行数：~1
- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 说明：**核心模板库**，教练设计的可复用训练计划模板

**字段说明**

| 列名                | 类型        | 可空 | 默认值            | 约束/备注 |
| ------------------- | ----------- | ---- | ----------------- | --------- |
| id                  | uuid        | NO   | gen_random_uuid() | 主键      |
| coach_id            | uuid        | NO   |                   |           |
| name                | text        | NO   |                   |           |
| description         | text        | YES  |                   |           |
| type                | text        | NO   |                   |           |
| rest_days_count     | smallint    | YES  |                   |           |
| tags                | text[]      | YES  |                   |           |
| suitable_for        | text        | YES  |                   |           |
| training_days       | jsonb[]     | YES  |                   |           |
| training_days_count | smallint    | YES  |                   |           |
| created_at          | timestamptz | YES  | now()             |           |
| updated_at          | timestamptz | YES  | now()             |           |

**索引**

- `coach_plan_templates_pkey` (id) - 主键索引
- `idx_coach_plan_templates_coach_id` (coach_id) - 普通索引
- `idx_coach_plan_templates_type` (type) - 普通索引

**优化建议**

- `coach_id` 建议添加外键约束到 `coaches.id`

---

### 15. coach_pricing（教练收费套餐表）

**基本信息**

- 行数：~1
- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 说明：计费模型

**字段说明**

| 列名       | 类型        | 可空 | 默认值            | 约束/备注               |
| ---------- | ----------- | ---- | ----------------- | ----------------------- |
| id         | uuid        | NO   | gen_random_uuid() | 主键                    |
| coach_id   | uuid        | NO   |                   | 外键 → coaches.id，唯一 |
| pricings   | jsonb       | NO   | '[]'              | 定价信息（JSON格式）    |
| created_at | timestamptz | NO   | now()             |                         |
| updated_at | timestamptz | NO   | now()             |                         |

**外键**

- `coach_pricing_coach_id_fkey` (coach_id → coaches.id)

**索引**

- `coach_pricing_pkey` (id) - 主键索引
- `coach_pricing_coach_id_key` (coach_id) - 唯一索引

---

### 16. rankingboard_pullup_2025_9_10（引体向上排行榜历史表）

**基本信息**

- 行数：~68
- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 注释：引体向上挑战排行榜（2025年9-10月）
- 说明：**历史归档**，仅作历史快照

**字段说明**

| 列名               | 类型        | 可空 | 默认值                        | 约束/备注                           |
| ------------------ | ----------- | ---- | ----------------------------- | ----------------------------------- |
| id                 | uuid        | NO   | extensions.uuid_generate_v4() | 主键                                |
| user_id            | uuid        | YES  |                               | 外键 → auth.users.id ⚠️ **不一致**  |
| weight_kg          | numeric     | NO   |                               | weight_kg > 0                       |
| video_url          | text        | YES  |                               |                                     |
| created_at         | timestamptz | YES  | now()                         |                                     |
| created_by         | uuid        | YES  |                               | 外键 → auth.users.id ⚠️ **不一致**  |
| douyin_nickname    | text        | YES  |                               |                                     |
| claim_code         | text        | YES  |                               | 唯一索引                            |
| is_claimed         | boolean     | NO   | false                         |                                     |
| gender             | text        | YES  |                               |                                     |
| notes              | text        | YES  |                               |                                     |
| submission_status  | text        | YES  | 'approved'                    | ∈ {'pending','approved','rejected'} |
| submitted_by       | uuid        | YES  |                               | 外键 → users.id                     |
| submitted_at       | timestamptz | YES  |                               |                                     |
| reviewed_by        | uuid        | YES  |                               | 外键 → users.id                     |
| reviewed_at        | timestamptz | YES  |                               |                                     |
| admin_feedback     | text        | YES  |                               |                                     |
| is_user_submission | boolean     | YES  | false                         |                                     |

**外键**

- `rankingboard_pullup_2025_9_10_user_id_fkey` (user_id → auth.users.id) ⚠️
  **不一致**
- `rankingboard_pullup_2025_9_10_created_by_fkey` (created_by → auth.users.id)
  ⚠️ **不一致**
- `rankingboard_pullup_2025_9_10_submitted_by_fkey` (submitted_by → users.id)
- `rankingboard_pullup_2025_9_10_reviewed_by_fkey` (reviewed_by → users.id)

**索引**

- `rankingboard_pullup_2025_9_10_pkey` (id) - 主键索引
- `rankingboard_pullup_2025_9_10_claim_code_key` (claim_code) - 唯一索引
- `rankingboard_pullup_2025_9_10_claim_code_idx` (claim_code) - 普通索引
- `rankingboard_pullup_2025_9_10_douyin_nickname_idx` (douyin_nickname) -
  普通索引
- `rankingboard_pullup_2025_9_10_submission_status_idx` (submission_status) -
  普通索引
- `rankingboard_pullup_2025_9_10_submitted_by_idx` (submitted_by) - 普通索引
- `rankingboard_pullup_2025_9_10_user_id_idx` (user_id) - 普通索引
- `rankingboard_pullup_2025_9_10_weight_kg_idx` (weight_kg DESC) - 普通索引

**优化建议**

- 外键应统一引用 `public.users` 而非 `auth.users`

---

### 17. pullup_leaderboard（引体向上排行榜表）

**基本信息**

- 行数：~68
- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 说明：当前活跃的引体向上排行榜，学员提交记录

**字段说明**

| 列名               | 类型        | 可空 | 默认值                        | 约束/备注                           |
| ------------------ | ----------- | ---- | ----------------------------- | ----------------------------------- |
| id                 | uuid        | NO   | extensions.uuid_generate_v4() | 主键                                |
| user_id            | uuid        | YES  |                               | 外键 → auth.users.id ⚠️ **不一致**  |
| weight_kg          | numeric     | NO   |                               | weight_kg > 0                       |
| video_url          | text        | YES  |                               |                                     |
| created_at         | timestamptz | YES  | now()                         |                                     |
| created_by         | uuid        | YES  |                               | 外键 → auth.users.id ⚠️ **不一致**  |
| douyin_nickname    | text        | YES  |                               |                                     |
| claim_code         | text        | YES  |                               | 唯一索引                            |
| is_claimed         | boolean     | NO   | false                         |                                     |
| gender             | text        | YES  |                               |                                     |
| notes              | text        | YES  |                               |                                     |
| submission_status  | text        | YES  | 'approved'                    | ∈ {'pending','approved','rejected'} |
| submitted_by       | uuid        | YES  |                               | 外键 → users.id                     |
| submitted_at       | timestamptz | YES  |                               |                                     |
| reviewed_by        | uuid        | YES  |                               | 外键 → users.id                     |
| reviewed_at        | timestamptz | YES  |                               |                                     |
| admin_feedback     | text        | YES  |                               |                                     |
| is_user_submission | boolean     | YES  | false                         |                                     |

**外键**

- `pullup_leaderboard_user_id_fkey` (user_id → auth.users.id) ⚠️ **不一致**
- `pullup_leaderboard_created_by_fkey` (created_by → auth.users.id) ⚠️
  **不一致**
- `pullup_leaderboard_submitted_by_fkey` (submitted_by → users.id)
- `pullup_leaderboard_reviewed_by_fkey` (reviewed_by → users.id)

**索引**

- `pullup_leaderboard_pkey` (id) - 主键索引
- `pullup_leaderboard_claim_code_key` (claim_code) - 唯一索引
- `idx_pullup_leaderboard_claim_code` (claim_code) - 普通索引
- `idx_pullup_leaderboard_douyin_nickname` (douyin_nickname) - 普通索引
- `idx_pullup_leaderboard_status` (submission_status) - 普通索引
- `idx_pullup_leaderboard_submitted_by` (submitted_by) - 普通索引
- `idx_pullup_leaderboard_user_id` (user_id) - 普通索引
- `idx_pullup_leaderboard_weight` (weight_kg DESC) - 普通索引

**优化建议**

- 外键应统一引用 `public.users` 而非 `auth.users`
- `pullup_leaderboard` 为 **实时排行榜**，`rankingboard_pullup_2025_9_10` 为
  **历史归档**（每个挑战期结束后快照）

---

### 其他表（简要说明）

#### 18. admin_users（系统管理员账号表）

- 行数：~1
- 状态：✅ 正常使用
- 主键：`id`
- 外键：`user_id → users.id`
- 说明：用于后台管理

#### 19. shipping_info（快递信息表）

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id`
- 外键：`user_id → users.id`
- 注释：快递信息表，存储中奖用户的快递地址等信息

#### 20. coach_contents（教练内容库表）

- 行数：~6
- 状态：✅ 正常使用
- 主键：`id`
- 外键：`coach_id → coaches.id`
- 说明：内容分发

#### 21. coach_messages（教练与学员私信表）

- 行数：~9
- 状态：✅ 正常使用
- 主键：`id`
- 外键：`sender_id → users.id`, `receiver_id → users.id`
- 说明：实时聊天
- 索引：包含 conversation_id、sender_id、receiver_id、is_read 等索引

#### 22. coach_actions（教练行为日志表）

- 行数：~4
- 状态：✅ 正常使用
- 主键：`id`
- 说明：用于统计教练活跃度
- 优化建议：`coach_id` 建议添加外键约束到 `coaches.id`

#### 23. coach_plan_template_tags（模板标签表）

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id` (integer)
- 说明：便于分类检索
- 唯一索引：`name`

#### 24. coach_questionnaires（教练专属问卷表）

- 行数：~1
- 状态：✅ 正常使用
- 主键：`id`
- 说明：用于学员入门评估
- 优化建议：`coach_id` 建议添加外键约束到 `coaches.id`

#### 25. content_interactions（内容交互表）

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id`
- 外键：`user_id → users.id`, `content_id → coach_contents.id`
- 说明：统计交互数据

#### 26. lifestyle_logs（学员生活日志表）

- 行数：~1
- 状态：✅ 正常使用
- 主键：`id`
- 外键：`user_id → users.id`
- 说明：记录作息、饮食等
- 唯一索引：`(user_id, log_date)`

#### 27. onboarding_questionnaires（新用户入职问卷表）

- 行数：~28
- 状态：✅ 正常使用
- 主键：`id`
- 外键：`user_id → users.id`, `coach_id → coaches.id`
- 说明：初始信息收集

#### 28. specialties（教练专业领域表）

- 行数：~11
- 状态：✅ 正常使用
- 主键：`id`
- 说明：用于标签过滤
- 唯一索引：`name`

#### 29. alipay_orders（支付订单记录表）

- 行数：~71
- 状态：✅ 正常使用
- 主键：`id` (uuid) ⚠️ **变更：从 bigint 改为 uuid**
- 外键：`user_id → users.id`
- 说明：关联用户支付

---

## 视图详细说明

### 1. user_video_timeline（学员视频时间线视图）

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

### 2. coach_pending_reviews（待审教练内容视图）

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
- 状态：✅ 正常使用
- 说明：内容审核队列

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
- 状态：✅ 正常使用
- 说明：动态计算而非存储

---

## 索引清单

### 按表分类的主要索引

**users 表**

- 主键索引：`users_pkey`
- 唯一索引：`users_phone_key`, `users_email_key`
- 普通索引：`idx_users_phone`, `idx_users_created_at`, `idx_users_coach_status`,
  `idx_users_primary_role`

**training_videos 表**

- 主键索引：`training_videos_pkey`
- 普通索引：`idx_training_videos_user_id`, `idx_training_videos_coach_id`,
  `idx_training_videos_training_plan_id`, `idx_training_videos_type`,
  `idx_training_videos_requires_review`, `idx_training_videos_review_status`,
  `idx_training_videos_created_at`
- 唯一索引：`unique_user_video_per_exercise`

**conversations 表**

- 主键索引：`conversations_pkey`
- 唯一索引：`unique_student_coach_conversation`
- 复合索引：`idx_conversations_student`, `idx_conversations_coach`,
  `idx_conversations_updated`
- 部分索引：`idx_conversations_student_unread`, `idx_conversations_coach_unread`

**training_records 表**

- 主键索引：`training_records_pkey`
- 普通索引：`idx_training_records_user`, `idx_training_records_plan`,
  `idx_training_records_status`, `idx_training_records_date`
- 复合索引：`idx_training_records_user_date`
- 唯一索引：`training_records_unique_training`

**coach_messages 表**

- 主键索引：`coach_messages_pkey`
- 普通索引：`idx_coach_messages_conversation`, `idx_coach_messages_sender`,
  `idx_coach_messages_receiver`, `idx_coach_messages_time`
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
   - 问题：`idx_training_plans_user` 和 `idx_training_plans_user_id`
     都是普通索引
   - 建议：删除 `idx_training_plans_user_id`

### 🟡 外键不一致问题

1. **部分表引用 auth.users，部分引用 public.users**
   - 问题：`personal_records`, `training_sessions`, `pullup_leaderboard`,
     `rankingboard_pullup_2025_9_10` 引用 `auth.users.id`
   - 而其他表引用 `public.users.id`
   - 建议：统一使用 `public.users.id`，或明确区分使用场景

2. **pullup_leaderboard 和 rankingboard_pullup_2025_9_10 外键不一致**
   - 问题：部分字段引用 `auth.users`，部分引用 `public.users`
   - 建议：统一引用 `public.users`

### 🟢 建议优化

1. **缺少外键约束**
   - `training_videos.user_id` → `users.id`（建议添加）
   - `training_videos.training_plan_id` → `training_plans.id`（建议添加）
   - `coach_actions.coach_id` → `coaches.id`（建议添加）
   - `coach_plan_templates.coach_id` → `coaches.id`（建议添加）
   - `coach_questionnaires.coach_id` → `coaches.id`（建议添加）
   - `coach_subscriptions.order_id` → `alipay_orders.id`（建议添加）

2. **索引优化**
   - 部分表缺少常用查询字段的索引
   - 建议根据实际查询模式添加复合索引

3. **数据一致性**
   - `coach_subscriptions.order_id` 字段建议添加外键约束
   - 确保订单与订阅的关联关系正确

4. **已废弃字段清理**
   - `training_videos.workout_log_id` 字段可以删除（`workout_logs` 表已删除）

---

## 数据库变更历史

### 2025-12-04（根据数据库分析报告）

**已删除的表（6个）**

- ❌ `exercises` - 动作库表（已删除，因 `video_submissions` 依赖已清理）
- ❌ `video_submissions` - 视频提交表（已删除，功能被 `training_videos` 替代）
- ❌ `training_exercises` - 训练动作表（已合并至新结构）
- ❌ `training_progress` - 训练进度表（未使用，统计改为动态视图
  `training_statistics`）
- ❌ `training_reminders` - 训练提醒表（未使用，已删除）
- ❌ `workout_logs` - 训练日志表（功能已合并至 `training_records`）

**表状态更新**

- ⚠️ `coach_rulepacks` - 暂保留，未来将被教练端计划编辑取代
- ❌ `personal_records` - 已废弃，仅存最大记录，缺历史。建议用
  `user_1rm_history` 替代
- ✅ `rankingboard_pullup_2025_9_10` - 历史归档（2025年9-10月），仅作历史快照
- ✅ `coach_plan_templates` - 核心模板库，教练设计的可复用训练计划模板
- ✅ `conversations` - 课堂/群聊会话，记录聊天历史

**字段变更**

- `coach_subscriptions.subscribe_data` - 新增字段：订阅附带的一些基础信息

**未来计划**

- 创建
  `coach_exercises`、`student_training_plans`、`student_plan_days`、`student_plan_exercises`
  表
- 创建 `user_1rm_history` 表替代 `personal_records`
- 统一外键引用（`auth.users` → `public.users`）

---

## 总结

本文档包含了 Supabase 数据库中 `public` schema 的完整结构信息，包括：

- ✅ **29个表**的详细说明（已删除6个冗余表）
- ✅ **3个视图**的定义
- ✅ 所有索引信息
- ✅ 外键关系
- ✅ 冗余分析和优化建议
- ✅ 数据库变更历史

**主要变更（2025-12-04）：**

1. 删除了6个冗余表：`exercises`, `video_submissions`, `training_exercises`,
   `training_progress`, `training_reminders`, `workout_logs`
2. `coach_rulepacks` 标记为暂保留，未来将被教练端计划编辑取代
3. `personal_records` 标记为已废弃，建议用 `user_1rm_history` 替代
4. `coach_subscriptions` 新增 `subscribe_data` 字段
5. 明确了表的用途和状态
6. **数据库对象统计**：29个表 + 3个视图 = 32个数据库对象

**下一步建议：**

1. 清理冗余索引
2. 补充缺失的外键约束
3. 统一外键引用（`auth.users` vs `public.users`）
4. 创建新的快照表结构（`student_training_plans` 等）
5. 创建 `user_1rm_history` 表替代 `personal_records`
