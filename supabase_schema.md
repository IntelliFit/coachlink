# Supabase 数据库结构文档（public schema）

- **生成时间**：2025-01-27
- **最后更新**：2025-01-27（通过 MCP 从 Supabase 云端数据库实时获取）
- **数据库版本**：PostgreSQL (Supabase)
- **Schema**：public

> ⚠️ **重要变更说明**：
>
> - 根据数据库分析报告（2025-12-04），已删除6个冗余表
> - **最新更新**（2025-12-26）：新增多个表，包括聊天系统重构、训练执行系统优化、排行榜系统等
> - **字段更新**（2025-12-26）：`coach_plan_instances` 表新增
>   `start_execution_day` 字段，支持老学员中途迁入平台
> - **最新更新**（2025-01-27）：新增多个字段，包括 `coach_pricing.products`、`coach_plan_templates.global_answers`、`execution_set_videos` 表新增审核相关字段等
> - 当前保留 **38个表 + 3个视图 = 41个数据库对象**

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

### 教练相关表（12个）

- `coaches` - 教练基本信息表
- `coach_subscriptions` - 教练订阅关系表
- `coach_contents` - 教练内容库（文章、视频）表
- `coach_rulepacks` - 规则包（AI 生成计划）表 ⚠️ **暂保留**
- `coach_actions` - 教练行为日志表
- `coach_plan_templates` - **核心模板库**（教练设计的可复用训练计划模板）
- `coach_questionnaires` - 教练专属问卷表
- `coach_pricing` - 教练收费套餐表
- `coach_plan_instances` - **教练计划实例表**（从模板生成给学员的计划）
- `coach_reviews` - 教练评价表
- `coach_applications` - 教练申请表 ⭐ **新增**
- `student_comments` - 学员评论表

### 训练相关表（11个）

- `training_plans` - **学员训练计划**表
- `training_plan_details` - **核心计划明细**表（存储每日/每周动作 JSONB）
- `training_sessions` - 训练会话表（计划中的一天）
- `training_records` - 训练执行记录表（每次训练）
- `training_videos` - 训练视频表（完整训练）
- `set_videos` - 训练组视频表（每组）⚠️ **逐步被替代**
- `plan_instance_executions` - 计划实例执行记录表 ⭐ **新增**（替代
  training_records 用于新计划系统）
- `execution_set_videos` - 执行组视频表 ⭐ **新增**（替代 set_videos
  用于新计划系统）
- `personal_records` - 个人记录表 ❌ **已废弃**（仅存最大记录，缺历史）
- `personal_records_history` - 个人记录历史表 ⭐ **新增**（替代
  personal_records，包含完整历史记录）
- `training_items` - 训练项目表 ⭐ **新增**（训练动作/项目库）

### 内容互动表（4个）

- `content_interactions` - 内容交互表（点赞、收藏）
- `chat_rooms` - 聊天室表 ⭐ **重构**（原 conversations 表重构）
- `chat_messages` - 聊天消息表 ⭐ **重构**（原 coach_messages 表重构）
- `chat_room_unreads` - 聊天室未读消息表 ⭐ **新增**

### 其他表（7个）

- `onboarding_questionnaires` - 新用户入职问卷表
- `lifestyle_logs` - 学员生活日志表
- `alipay_orders` - 支付订单记录表
- `pullup_leaderboard` - 当前活跃的引体向上排行榜表
- `leaderboard_templates` - 排行榜模板表 ⭐ **新增**（通用排行榜系统）
- `leaderboard_entries` - 排行榜条目表 ⭐ **新增**（通用排行榜系统）
- `specialties` - 教练专业领域表

**总计：38个表**（用户4 + 教练12 + 训练11 + 内容互动4 + 其他7 = 38）

> **注意**：统计中包含已废弃的表（`personal_records`），实际活跃表为37个

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

## 新增表（最新更新 2025-12-26）

根据最新数据库更新，新增以下表：

### 聊天系统重构（3个表）

1. ⭐ **`chat_rooms`** - 聊天室表（重构自 `conversations`）
   - 用途：学员-教练会话表，支持多成员聊天室
   - 关联：`coach_subscriptions`, `users`
   - 状态：活跃使用中
   - 新特性：支持 `members` 数组、`unread_members` 数组、`type` 字段

2. ⭐ **`chat_messages`** - 聊天消息表（重构自 `coach_messages`）
   - 用途：聊天消息存储，支持多种消息类型
   - 关联：`chat_rooms`, `users`
   - 状态：活跃使用中
   - 新特性：支持 `message_type`（text/image/video/voice/file）、媒体文件支持

3. ⭐ **`chat_room_unreads`** - 聊天室未读消息表
   - 用途：记录每个用户在聊天室的未读消息数
   - 关联：`chat_rooms`, `users`
   - 状态：活跃使用中

### 训练执行系统优化（3个表）

4. ⭐ **`plan_instance_executions`** - 计划实例执行记录表
   - 用途：替代 `training_records`，记录新计划系统的训练执行
   - 关联：`coach_plan_instances`, `users`
   - 状态：活跃使用中
   - 新特性：支持 `action_executions` JSONB、进度百分比计算

5. ⭐ **`execution_set_videos`** - 执行组视频表
   - 用途：替代 `set_videos`，记录新计划系统的组视频
   - 关联：`plan_instance_executions`
   - 状态：活跃使用中
   - 新特性：支持 `storage_path`、`storage_bucket`（Supabase Storage 集成）

6. ⭐ **`personal_records_history`** - 个人记录历史表
   - 用途：替代 `personal_records`，包含完整的 PR 历史记录
   - 关联：`plan_instance_executions`, `users`
   - 状态：活跃使用中
   - 新特性：支持 `execution_id`
     关联、`load_formula`、`video_url`、`is_verified`

7. ⭐ **`training_items`** - 训练项目表
   - 用途：训练动作/项目库
   - 状态：活跃使用中

### 其他新增表（3个表）

8. ⭐ **`coach_applications`** - 教练申请表
   - 用途：教练申请入驻功能
   - 关联：`users`
   - 状态：活跃使用中
   - 新特性：支持审核流程、简历、作品集等

9. ⭐ **`leaderboard_templates`** - 排行榜模板表
   - 用途：通用排行榜系统模板
   - 关联：`users`（创建者）
   - 状态：活跃使用中
   - 新特性：支持自定义排名规则、表单结构

10. ⭐ **`leaderboard_entries`** - 排行榜条目表
    - 用途：通用排行榜系统条目
    - 关联：`leaderboard_templates`, `users`
    - 状态：活跃使用中

---

## 表详细说明

### 1. users（统一用户表）

**基本信息**

- 行数：~111
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

- 行数：~108
- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 说明：包含 `sport_cards` 等字段

**字段说明**

| 列名                 | 类型        | 可空 | 默认值            | 约束/备注                                         |
| -------------------- | ----------- | ---- | ----------------- | ------------------------------------------------- |
| id                   | uuid        | NO   | gen_random_uuid() | 主键                                              |
| user_id              | uuid        | YES  |                   | 外键 → users.id，唯一                             |
| full_name            | text        | YES  |                   |                                                   |
| nickname             | text        | YES  |                   |                                                   |
| avatar_url           | text        | YES  |                   |                                                   |
| gender               | text        | YES  |                   | ∈ {'male','female','other'}                       |
| birth_date           | date        | YES  |                   |                                                   |
| height               | integer     | YES  |                   | 单位：厘米                                        |
| weight               | integer     | YES  |                   | 单位：千克                                        |
| fitness_goal         | text        | YES  |                   |                                                   |
| fitness_level        | text        | YES  |                   | ∈ {'beginner','intermediate','advanced'}          |
| bio                  | text        | YES  |                   |                                                   |
| phone                | text        | YES  |                   | **冗余：与 users.phone 重复**                     |
| address              | text        | YES  |                   |                                                   |
| sport_cards          | jsonb       | YES  | '{}'              | ⭐ **新增**：运动数据卡片，包含 activeCards 数组  |
| lifestyle            | text        | YES  |                   | ⭐ **新增**：生活作息描述，如"朝九晚五，久坐办公" |
| onboarding_completed | boolean     | YES  | false             | ⭐ **新增**：初始问卷是否已完成                   |
| age                  | integer     | YES  |                   | ⭐ **新增**：年龄                                 |
| created_at           | timestamptz | YES  | now()             |                                                   |
| updated_at           | timestamptz | YES  | now()             |                                                   |

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

- 行数：~3
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
| profile          | jsonb       | YES  |                   | ⭐ **新增**：教练扩展信息（JSON格式）           |
| payment_qr_code  | text        | YES  |                   | ⭐ **新增**：收款二维码                         |
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

- 行数：~14
- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 说明：关联学员与教练

**字段说明**

| 列名              | 类型        | 可空 | 默认值            | 约束/备注                                         |
| ----------------- | ----------- | ---- | ----------------- | ------------------------------------------------- |
| id                | uuid        | NO   | gen_random_uuid() | 主键                                              |
| student_id        | uuid        | NO   |                   | 外键 → users.id                                   |
| coach_id          | uuid        | NO   |                   | 外键 → coaches.id                                 |
| tier              | integer     | NO   |                   | ∈ {1, 2, 3}                                       |
| status            | text        | YES  | 'active'          | ∈ {'active','inactive','waiting'}                 |
| start_date        | timestamptz | YES  | now()             |                                                   |
| end_date          | timestamptz | YES  |                   |                                                   |
| auto_renew        | boolean     | YES  | true              |                                                   |
| monthly_price     | numeric     | NO   |                   |                                                   |
| order_id          | uuid        | YES  |                   | 订单编号                                          |
| subscribe_data    | jsonb       | YES  |                   | 订阅附带的一些基础信息                            |
| has_remind_coach  | boolean     | YES  | false             | ⭐ **新增**：是否已提醒教练                       |
| remind_coach_note | text        | YES  |                   | ⭐ **新增**：提醒教练的备注信息                   |
| product_id        | text        | YES  |                   | ⭐ **新增**：订阅的具体产品ID                     |
| product_name      | text        | YES  |                   | ⭐ **新增**：订阅时的产品名称快照                 |
| product_tier      | text        | YES  |                   | ⭐ **新增**：订阅时的产品层级(basic/standard/vip) |
| subscribed_weeks  | integer     | YES  | 4                 | ⭐ **新增**：订阅包含的总周数                     |
| created_at        | timestamptz | YES  | now()             |                                                   |
| updated_at        | timestamptz | YES  | now()             |                                                   |

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

- 行数：~6
- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 说明：**核心模板库**，教练设计的可复用训练计划模板

**字段说明**

| 列名                | 类型        | 可空 | 默认值            | 约束/备注                   |
| ------------------- | ----------- | ---- | ----------------- | --------------------------- |
| id                  | uuid        | NO   | gen_random_uuid() | 主键                        |
| coach_id            | uuid        | NO   |                   |                             |
| name                | text        | NO   |                   |                             |
| description         | text        | YES  |                   |                             |
| type                | text        | NO   |                   |                             |
| rest_days_count     | smallint    | YES  |                   |                             |
| tags                | text[]      | YES  |                   |                             |
| suitable_for        | text        | YES  |                   |                             |
| training_days       | jsonb[]     | YES  |                   |                             |
| training_days_count | smallint    | YES  |                   |                             |
| week_days           | int2[]      | YES  |                   | ⭐ **新增**：训练周几数组   |
| contained_options   | text[]      | YES  |                   | ⭐ **新增**：包含的选项数组 |
| global_answers      | jsonb       | YES  | '{}'              | ⭐ **新增**：全局选项问题的答案，格式: {"问题名": 选项索引}，用于AI计划匹配 |
| created_at          | timestamptz | YES  | now()             |                             |
| updated_at          | timestamptz | YES  | now()             |                             |

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
| products   | jsonb       | YES  | '[]'              | ⭐ **新增**：产品信息（JSON格式） |
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

**索引**

- `shipping_info_pkey` (id) - 主键索引
- `idx_shipping_info_user_id` (user_id) - 普通索引
- `idx_shipping_info_status` (status) - 普通索引
- `idx_shipping_info_created_at` (created_at) - 普通索引
- `idx_shipping_info_user_prize` (user_id, prize_id) - 唯一索引

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

#### 23. coach_questionnaires（教练专属问卷表）

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

#### 30. coach_plan_instances（教练计划实例表）⭐ 新增

- 行数：~8
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`coach_plan_template_id → coach_plan_templates.id`,
  `coach_subscription_id → coach_subscriptions.id`
- 说明：从模板生成给学员的计划实例

**字段说明**

| 列名                   | 类型        | 可空 | 默认值                        | 约束/备注                                                             |
| ---------------------- | ----------- | ---- | ----------------------------- | --------------------------------------------------------------------- |
| id                     | uuid        | NO   | extensions.uuid_generate_v4() | 主键                                                                  |
| coach_plan_template_id | uuid        | YES  |                               | 外键 → coach_plan_templates.id                                        |
| student_id             | uuid        | YES  |                               | 学员ID                                                                |
| coach_id               | uuid        | YES  |                               | 教练ID                                                                |
| coach_subscription_id  | uuid        | YES  |                               | 外键 → coach_subscriptions.id                                         |
| name                   | varchar     | NO   |                               | 计划名称                                                              |
| description            | text        | YES  |                               | 计划描述                                                              |
| training_days          | jsonb       | NO   |                               | 训练天数详情（JSON格式）                                              |
| status                 | varchar     | YES  | 'active'                      | ∈ {'draft','active','paused','completed','archived'}                  |
| start_date             | date        | YES  |                               | 开始日期                                                              |
| end_date               | date        | YES  |                               | 结束日期                                                              |
| start_execution_day    | integer     | YES  | 1                             | 起始执行天数（1-based），用于老学员中途迁入平台 ⭐ **2025-12-26新增** |
| type                   | text        | YES  |                               | 计划类型                                                              |
| tags                   | text[]      | YES  |                               | 标签                                                                  |
| suitable_for           | text        | YES  |                               | 适合人群                                                              |
| created_at             | timestamptz | YES  | CURRENT_TIMESTAMP             |                                                                       |
| updated_at             | timestamptz | YES  | CURRENT_TIMESTAMP             |                                                                       |

**外键**

- `fk_plan_template` (coach_plan_template_id → coach_plan_templates.id)
- `coach_plan_instances_coach_subscription_id_fkey` (coach_subscription_id →
  coach_subscriptions.id)
- `coach_plan_instances_student_id_fkey` (student_id → users.id)
- `coach_plan_instances_coach_id_fkey` (coach_id → coaches.id)

**索引**

- `coach_plan_instances_pkey` (id) - 主键索引
- `idx_plan_instances_template` (coach_plan_template_id) - 普通索引
- `idx_plan_instances_student` (student_id) - 普通索引
- `idx_plan_instances_coach` (coach_id) - 普通索引
- `idx_coach_plan_instances_start_execution_day` (start_execution_day) - 普通索引

#### 31. coach_reviews（教练评价表）⭐ 新增

- 行数：~2
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`coach_subscription_id → coach_subscriptions.id`,
  `student_id → users.id`, `coach_id → coaches.id`
- 说明：学员对教练的评价和反馈

**字段说明**

| 列名                  | 类型        | 可空 | 默认值                        | 约束/备注                     |
| --------------------- | ----------- | ---- | ----------------------------- | ----------------------------- |
| id                    | uuid        | NO   | extensions.uuid_generate_v4() | 主键                          |
| coach_subscription_id | uuid        | NO   |                               | 外键 → coach_subscriptions.id |
| student_id            | uuid        | YES  |                               | 外键 → users.id               |
| coach_id              | uuid        | YES  |                               | 外键 → coaches.id             |
| review_text           | text        | YES  |                               | 评价文本                      |
| media_urls            | text[]      | YES  |                               | 媒体 URL 列表                 |
| created_at            | timestamptz | YES  | CURRENT_TIMESTAMP             |                               |
| updated_at            | timestamptz | YES  | CURRENT_TIMESTAMP             |                               |

**外键**

- `fk_coach_subscription` (coach_subscription_id → coach_subscriptions.id)
- `coach_reviews_student_id_fkey` (student_id → users.id)
- `coach_reviews_coach_id_fkey` (coach_id → coaches.id)

#### 32. student_comments（学员评论表）

- 行数：~1
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`student_id → users.id`, `coach_id → coaches.id`
- 说明：学员的评论功能

**字段说明**

| 列名       | 类型        | 可空 | 默认值            | 约束/备注            |
| ---------- | ----------- | ---- | ----------------- | -------------------- |
| id         | uuid        | NO   | gen_random_uuid() | 主键                 |
| student_id | uuid        | NO   |                   | 外键 → users.id      |
| coach_id   | uuid        | NO   |                   | 外键 → coaches.id    |
| comment    | text        | NO   |                   | 评论内容             |
| media      | jsonb       | YES  |                   | 媒体信息（JSON格式） |
| rating     | smallint    | YES  |                   | ⭐ **新增**：评分    |
| created_at | timestamptz | YES  | now()             |                      |
| updated_at | timestamptz | YES  | now()             |                      |

**外键**

- `student_comments_student_id_fkey` (student_id → users.id)
- `student_comments_coach_id_fkey` (coach_id → coaches.id)

---

#### 33. chat_rooms（聊天室表）⭐ 新增

- 行数：~5
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`subscription_id → coach_subscriptions.id`
- 说明：学员-教练会话表，重构自 `conversations` 表

**字段说明**

| 列名            | 类型        | 可空 | 默认值            | 约束/备注                         |
| --------------- | ----------- | ---- | ----------------- | --------------------------------- |
| id              | uuid        | NO   | gen_random_uuid() | 主键                              |
| subscription_id | uuid        | YES  |                   | 外键 → coach_subscriptions.id     |
| last_message    | text        | YES  |                   | 最后一条消息预览（前100字符）     |
| last_message_at | timestamptz | YES  |                   | 最后消息时间                      |
| is_archived     | boolean     | NO   | false             |                                   |
| members         | uuid[]      | YES  |                   | ⭐ **新增**：聊天室成员ID数组     |
| unread_members  | uuid[]      | YES  |                   | ⭐ **新增**：未读消息的用户ID数组 |
| type            | text        | YES  |                   | ⭐ **新增**：聊天室类型           |
| created_at      | timestamptz | NO   | now()             |                                   |
| updated_at      | timestamptz | NO   | now()             |                                   |

**索引**

- `conversations_pkey` (id) - 主键索引
- `conversations_members_gin` (members) - GIN 索引
- `idx_conversations_updated` (updated_at DESC) - 普通索引

---

#### 34. chat_messages（聊天消息表）⭐ 新增

- 行数：~26
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`room_id → chat_rooms.id`, `sender_id → users.id`
- 说明：聊天消息表，重构自 `coach_messages` 表

**字段说明**

| 列名         | 类型        | 可空 | 默认值            | 约束/备注                                 |
| ------------ | ----------- | ---- | ----------------- | ----------------------------------------- |
| id           | uuid        | NO   | gen_random_uuid() | 主键                                      |
| room_id      | uuid        | NO   |                   | 外键 → chat_rooms.id                      |
| sender_id    | uuid        | NO   |                   | 外键 → users.id                           |
| message_type | text        | NO   |                   | ∈ {'text','image','video','voice','file'} |
| content      | text        | NO   |                   | 消息内容                                  |
| media_url    | text        | YES  |                   | ⭐ **新增**：媒体文件URL                  |
| file_name    | text        | YES  |                   | ⭐ **新增**：文件名                       |
| file_size    | bigint      | YES  |                   | ⭐ **新增**：文件大小（字节）             |
| duration     | integer     | YES  |                   | ⭐ **新增**：音频/视频时长（秒）          |
| is_read      | boolean     | YES  | false             | 是否已读                                  |
| created_at   | timestamptz | YES  | now()             |                                           |

**索引**

- `coach_messages_pkey` (id) - 主键索引
- `chat_messages_room_id_idx` (room_id) - 普通索引
- `idx_coach_messages_conversation` (room_id) - 普通索引
- `idx_coach_messages_sender` (sender_id) - 普通索引
- `idx_coach_messages_time` (created_at DESC) - 普通索引
- `chat_messages_is_read_idx` (is_read) - 普通索引

---

#### 35. chat_room_unreads（聊天室未读消息表）⭐ 新增

- 行数：~12
- 状态：✅ 正常使用
- 主键：`(room_id, user_id)`
- 外键：`room_id → chat_rooms.id`
- 说明：记录每个用户在聊天室的未读消息数

**字段说明**

| 列名         | 类型        | 可空 | 默认值 | 约束/备注            |
| ------------ | ----------- | ---- | ------ | -------------------- |
| room_id      | uuid        | NO   |        | 外键 → chat_rooms.id |
| user_id      | uuid        | NO   |        | 用户ID               |
| unread_count | integer     | NO   | 0      | 未读消息数           |
| last_read_at | timestamptz | YES  |        | 最后阅读时间         |

**索引**

- `chat_room_unreads_pkey` (room_id, user_id) - 主键索引

---

#### 36. coach_applications（教练申请表）⭐ 新增

- 行数：~1
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`user_id → users.id`, `reviewed_by → users.id`
- 说明：教练申请入驻功能

**字段说明**

| 列名                | 类型        | 可空 | 默认值            | 约束/备注                                                    |
| ------------------- | ----------- | ---- | ----------------- | ------------------------------------------------------------ |
| id                  | uuid        | NO   | gen_random_uuid() | 主键                                                         |
| user_id             | uuid        | NO   |                   | 外键 → users.id                                              |
| applied_at          | timestamptz | NO   | now()             |                                                              |
| status              | text        | NO   | 'pending'         | ∈ {'pending','reviewing','approved','rejected','needs_info'} |
| name                | text        | NO   |                   |                                                              |
| title               | text        | YES  |                   |                                                              |
| avatar_url          | text        | YES  |                   |                                                              |
| specialties         | text[]      | YES  | '{}'              |                                                              |
| bio                 | text        | YES  |                   |                                                              |
| years_experience    | integer     | YES  | 0                 |                                                              |
| achievements        | text[]      | YES  | '{}'              |                                                              |
| teaching_philosophy | text        | YES  |                   | 教学理念                                                     |
| credentials         | jsonb[]     | YES  | '{}'              | 资质证明                                                     |
| case_studies        | text[]      | YES  | '{}'              | 案例研究                                                     |
| contact_email       | text        | YES  |                   | 邮箱（需符合邮箱格式）                                       |
| contact_phone       | text        | YES  |                   | 联系电话                                                     |
| resume_url          | text        | YES  |                   | 简历URL                                                      |
| portfolio_url       | text        | YES  |                   | 作品集URL                                                    |
| social_links        | jsonb       | YES  | '{}'              | 社交媒体链接                                                 |
| reviewed_by         | uuid        | YES  |                   | 外键 → users.id（审核人）                                    |
| reviewed_at         | timestamptz | YES  |                   | 审核时间                                                     |
| review_notes        | text        | YES  |                   | 审核备注                                                     |
| created_at          | timestamptz | NO   | now()             |                                                              |
| updated_at          | timestamptz | NO   | now()             |                                                              |

**索引**

- `coach_applications_pkey` (id) - 主键索引
- `coach_applications_user_id_idx` (user_id) - 普通索引
- `coach_applications_status_idx` (status) - 普通索引
- `coach_applications_applied_at_idx` (applied_at DESC) - 普通索引
- `coach_applications_reviewed_by_idx` (reviewed_by) - 普通索引

---

#### 37. plan_instance_executions（计划实例执行记录表）⭐ 新增

- 行数：~9
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`instance_id → coach_plan_instances.id`, `student_id → users.id`
- 说明：替代 `training_records`，记录新计划系统的训练执行

**字段说明**

| 列名              | 类型        | 可空 | 默认值            | 约束/备注                                          |
| ----------------- | ----------- | ---- | ----------------- | -------------------------------------------------- |
| id                | uuid        | NO   | gen_random_uuid() | 主键                                               |
| instance_id       | uuid        | NO   |                   | 外键 → coach_plan_instances.id                     |
| student_id        | uuid        | NO   |                   | 外键 → users.id                                    |
| day_index         | integer     | NO   |                   | 训练日索引（≥ 1）                                  |
| started_at        | timestamptz | NO   | now()             |                                                    |
| completed_at      | timestamptz | YES  |                   |                                                    |
| status            | text        | NO   | 'in_progress'     | ∈ {'in_progress','completed','abandoned','paused'} |
| action_executions | jsonb       | NO   | '[]'              | JSONB结构存储所有动作和组的执行数据                |
| total_sets        | integer     | NO   | 0                 | 总组数                                             |
| completed_sets    | integer     | NO   | 0                 | 完成组数                                           |
| progress_percent  | numeric     | YES  |                   | 进度百分比（计算列）                               |
| session_notes     | text        | YES  |                   | 整体训练备注                                       |
| last_saved_at     | timestamptz | YES  | now()             | 最后保存时间                                       |
| created_at        | timestamptz | NO   | now()             |                                                    |
| updated_at        | timestamptz | NO   | now()             |                                                    |

**索引**

- `plan_instance_executions_pkey` (id) - 主键索引
- `idx_exec_student` (student_id) - 普通索引
- `idx_exec_instance_day` (instance_id, day_index) - 复合索引
- `idx_exec_date` (started_at DESC) - 普通索引
- `idx_exec_lookup` (student_id, instance_id, day_index, started_at DESC) -
  复合索引
- `idx_exec_status` (status) WHERE status <> 'completed' - 部分索引

---

#### 38. execution_set_videos（执行组视频表）⭐ 新增

- 行数：~7
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`execution_id → plan_instance_executions.id`, `reviewed_by → users.id`
- 说明：替代 `set_videos`，记录新计划系统的组视频

**字段说明**

| 列名             | 类型        | 可空 | 默认值            | 约束/备注                                  |
| ---------------- | ----------- | ---- | ----------------- | ------------------------------------------ |
| id               | uuid        | NO   | gen_random_uuid() | 主键                                       |
| execution_id     | uuid        | NO   |                   | 外键 → plan_instance_executions.id         |
| action_id        | uuid        | NO   |                   | 动作ID                                     |
| set_number       | integer     | NO   |                   | 组号（≥ 1）                                |
| video_url        | text        | NO   |                   | 视频URL                                    |
| thumbnail_url    | text        | YES  |                   | 缩略图URL                                  |
| duration_seconds | integer     | YES  |                   | 时长（秒）                                 |
| file_size_bytes  | bigint      | YES  |                   | 文件大小（字节）                           |
| storage_path     | text        | NO   |                   | ⭐ **新增**：Supabase Storage 中的文件路径 |
| storage_bucket   | text        | YES  | 'videos'          | ⭐ **新增**：存储桶名称                    |
| upload_status    | text        | YES  | 'uploaded'        | ∈ {'uploading','uploaded','failed'}        |
| coach_feedback   | text        | YES  |                   | 教练反馈                                   |
| coach_rating     | integer     | YES  |                   | 教练评分（1-5）                            |
| reviewed_at      | timestamptz | YES  |                   | 审核时间                                   |
| reviewed_by      | uuid        | YES  |                   | 外键 → users.id（审核人）                  |
| user_notes       | text        | YES  |                   | ⭐ **新增**：用户备注                       |
| review_status    | text        | YES  | 'pending'         | ⭐ **新增**：审核状态 ∈ {'pending','reviewed','not_required'} |
| requires_review   | boolean     | YES  | true              | ⭐ **新增**：是否需要审核                   |
| exercise_name    | text        | YES  |                   | ⭐ **新增**：动作名称                       |
| created_at       | timestamptz | NO   | now()             |                                            |

**索引**

- `execution_set_videos_pkey` (id) - 主键索引
- `idx_set_videos_execution` (execution_id) - 普通索引
- `idx_set_videos_action` (action_id) - 普通索引
- `idx_set_videos_created` (created_at DESC) - 普通索引
- `idx_execution_set_videos_review_status` (review_status) WHERE requires_review = true AND review_status = 'pending' - 部分索引
- `execution_set_videos_execution_id_action_id_set_number_key` (execution_id,
  action_id, set_number) - 唯一索引

---

#### 39. personal_records_history（个人记录历史表）⭐ 新增

- 行数：~5
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`user_id → users.id`, `execution_id → plan_instance_executions.id`
- 说明：替代 `personal_records`，包含完整的 PR 历史记录

**字段说明**

| 列名                 | 类型        | 可空 | 默认值            | 约束/备注                                       |
| -------------------- | ----------- | ---- | ----------------- | ----------------------------------------------- |
| id                   | uuid        | NO   | gen_random_uuid() | 主键                                            |
| user_id              | uuid        | NO   |                   | 外键 → users.id                                 |
| action_id            | uuid        | YES  |                   | 动作ID                                          |
| exercise_name        | varchar     | NO   |                   | 动作名称                                        |
| max_weight           | numeric     | YES  |                   | 最大重量                                        |
| max_reps             | integer     | YES  |                   | 最大次数                                        |
| load_formula         | varchar     | YES  |                   | ⭐ **新增**：计算公式，如 "60kg × 10次 @ RPE 8" |
| execution_id         | uuid        | YES  |                   | ⭐ **新增**：外键 → plan_instance_executions.id |
| execution_set_number | integer     | YES  |                   | ⭐ **新增**：执行组号                           |
| date_achieved        | date        | NO   |                   | 达成日期                                        |
| notes                | text        | YES  |                   | 备注                                            |
| video_url            | text        | YES  |                   | ⭐ **新增**：视频URL                            |
| is_verified          | boolean     | YES  | false             | ⭐ **新增**：是否已验证                         |
| created_at           | timestamptz | YES  | now()             |                                                 |

**索引**

- `personal_records_history_pkey` (id) - 主键索引
- `idx_pr_user_date` (user_id, date_achieved DESC) - 复合索引
- `idx_pr_user_exercise` (user_id, exercise_name) - 复合索引
- `idx_pr_exercise` (exercise_name) - 普通索引
- `idx_pr_execution` (execution_id) WHERE execution_id IS NOT NULL - 部分索引

---

#### 40. training_items（训练项目表）⭐ 新增

- 行数：~19
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 说明：训练动作/项目库

**字段说明**

| 列名        | 类型 | 可空 | 默认值            | 约束/备注 |
| ----------- | ---- | ---- | ----------------- | --------- |
| id          | uuid | NO   | gen_random_uuid() | 主键      |
| name        | text | NO   |                   | 唯一索引  |
| description | text | YES  |                   | 描述      |

**索引**

- `training_items_pkey` (id) - 主键索引
- `training_items_name_key` (name) - 唯一索引

---

#### 41. leaderboard_templates（排行榜模板表）⭐ 新增

- 行数：~2
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`creator_id → users.id`
- 说明：通用排行榜系统模板

**字段说明**

| 列名          | 类型        | 可空 | 默认值            | 约束/备注                 |
| ------------- | ----------- | ---- | ----------------- | ------------------------- |
| id            | uuid        | NO   | gen_random_uuid() | 主键                      |
| title         | text        | NO   |                   | 排行榜标题                |
| type          | text        | YES  |                   | 排行榜类型                |
| start_at      | timestamptz | YES  |                   | 开始时间                  |
| end_at        | timestamptz | YES  |                   | 结束时间                  |
| creator_id    | uuid        | YES  |                   | 外键 → users.id（创建者） |
| description   | text        | YES  |                   | 描述                      |
| rules         | jsonb       | YES  | '[]'              | 规则（JSON格式）          |
| form_schema   | jsonb       | YES  | '[]'              | 表单结构（JSON格式）      |
| rank_by_field | text        | NO   |                   | 排名字段                  |
| sort_order    | text        | YES  | 'desc'            | ∈ {'asc','desc'} 排序方式 |
| remarks       | text        | YES  |                   | 备注                      |
| initiator     | text        | YES  |                   | 发起者                    |
| created_at    | timestamptz | YES  | now()             |                           |

**索引**

- `leaderboard_templates_pkey` (id) - 主键索引

---

#### 42. leaderboard_entries（排行榜条目表）⭐ 新增

- 行数：~72
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`template_id → leaderboard_templates.id`, `user_id → users.id`
- 说明：通用排行榜系统条目

**字段说明**

| 列名         | 类型        | 可空 | 默认值            | 约束/备注                           |
| ------------ | ----------- | ---- | ----------------- | ----------------------------------- |
| id           | uuid        | NO   | gen_random_uuid() | 主键                                |
| template_id  | uuid        | YES  |                   | 外键 → leaderboard_templates.id     |
| user_id      | uuid        | YES  |                   | 外键 → users.id                     |
| form_data    | jsonb       | NO   |                   | 表单数据（JSON格式）                |
| score        | numeric     | YES  |                   | 分数                                |
| status       | text        | YES  | 'pending'         | ∈ {'pending','approved','rejected'} |
| evidence_url | text        | YES  |                   | 证据URL（视频/图片）                |
| extra_data   | jsonb       | YES  |                   | 扩展数据（JSON格式）                |
| note         | text        | YES  |                   | 备注                                |
| created_at   | timestamptz | YES  | now()             |                                     |

**索引**

- `leaderboard_entries_pkey` (id) - 主键索引
- `idx_leaderboard_score` (template_id, score DESC) - 复合索引

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
   - `coach_plan_instances.student_id` → `users.id`（建议添加）
   - `coach_plan_instances.coach_id` → `coaches.id`（建议添加）

2. **索引优化**
   - 部分表缺少常用查询字段的索引
   - 建议根据实际查询模式添加复合索引
   - `coach_plan_instances` 建议添加 `student_id`, `coach_id`, `status` 索引

3. **数据一致性**
   - `coach_subscriptions.order_id` 字段建议添加外键约束
   - 确保订单与订阅的关联关系正确

4. **已废弃字段清理**
   - `training_videos.workout_log_id` 字段可以删除（`workout_logs` 表已删除）

5. **新增表的优化**
   - `coach_reviews` 建议添加 `coach_id` 和 `student_id` 的复合索引
   - `student_comments` 建议添加 `coach_id` 和 `created_at` 的复合索引

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

- `coach_subscriptions.subscribe_data` (jsonb) -
  新增字段：订阅附带的一些基础信息
- `user_profiles.sport_cards` (jsonb) - 新增字段：运动数据卡片 JSONB
- `user_profiles.lifestyle` (text) - 新增字段：生活作息描述
- `user_profiles.onboarding_completed` (boolean) - 新增字段：初始问卷是否已完成
- `user_profiles.age` (integer) - 新增字段：年龄

**未来计划**

- 创建
  `coach_exercises`、`student_training_plans`、`student_plan_days`、`student_plan_exercises`
  表
- 创建 `user_1rm_history` 表替代 `personal_records`
- 统一外键引用（`auth.users` → `public.users`）
- 为新增表（`coach_plan_instances`, `coach_reviews`,
  `student_comments`）添加必要的索引和外键约束

---

## 总结

本文档包含了 Supabase 数据库中 `public` schema 的完整结构信息，包括：

- ✅ **38个表**的详细说明（已删除6个冗余表，新增多个表，重构聊天系统）
- ✅ **3个视图**的定义
- ✅ 所有索引信息（159个索引）
- ✅ 外键关系
- ✅ 冗余分析和优化建议
- ✅ 数据库变更历史

> **文档更新方式**：本文档通过 MCP（Model Context Protocol）从 Supabase
> 云端数据库实时获取最新结构信息，确保文档与数据库保持同步。

**主要变更（2025-12-04）：**

1. 删除了6个冗余表：`exercises`, `video_submissions`, `training_exercises`,
   `training_progress`, `training_reminders`, `workout_logs`
2. `coach_rulepacks` 标记为暂保留，未来将被教练端计划编辑取代
3. `personal_records` 标记为已废弃，建议用 `user_1rm_history` 替代
4. `coach_subscriptions` 新增 `subscribe_data` 字段
5. 明确了表的用途和状态

**最新变更（2025-12-05）：**

1. ⭐ **新增3个表**：
   - `coach_plan_instances` - 教练计划实例表（从模板生成给学员的计划）
   - `coach_reviews` - 教练评价表（学员对教练的评价和反馈）
   - `student_comments` - 学员评论表（学员的评论功能）

2. 📝 **user_profiles 表新增4个字段**：
   - `sport_cards` (jsonb) - 运动数据卡片
   - `lifestyle` (text) - 生活作息描述
   - `onboarding_completed` (boolean) - 初始问卷是否已完成
   - `age` (integer) - 年龄

**最新变更（2025-12-26）：**

1. ⭐ **聊天系统重构（3个表）**：
   - `chat_rooms` - 聊天室表（重构自 `conversations`），支持多成员聊天室
   - `chat_messages` - 聊天消息表（重构自 `coach_messages`），支持多种消息类型
   - `chat_room_unreads` - 聊天室未读消息表，优化未读消息管理

2. ⭐ **训练执行系统优化（4个表）**：
   - `plan_instance_executions` - 计划实例执行记录表，替代 `training_records`
   - `execution_set_videos` - 执行组视频表，替代 `set_videos`，支持 Supabase
     Storage
   - `personal_records_history` - 个人记录历史表，替代
     `personal_records`，包含完整历史
   - `training_items` - 训练项目表，训练动作/项目库

3. ⭐ **其他新增表（3个表）**：
   - `coach_applications` - 教练申请表，支持教练申请入驻功能
   - `leaderboard_templates` - 排行榜模板表，通用排行榜系统
   - `leaderboard_entries` - 排行榜条目表，通用排行榜系统

4. 📝 **字段变更**：
   - `coaches.profile` (jsonb) - 教练扩展信息
   - `coaches.payment_qr_code` (text) - 收款二维码
   - `coach_subscriptions.has_remind_coach` (boolean) - 是否已提醒教练
   - `coach_subscriptions.remind_coach_note` (text) - 提醒教练的备注信息
   - `coach_subscriptions.product_id` (text) - 订阅的具体产品ID
   - `coach_subscriptions.product_name` (text) - 订阅时的产品名称快照
   - `coach_subscriptions.product_tier` (text) - 订阅时的产品层级
   - `coach_subscriptions.subscribed_weeks` (integer) - 订阅包含的总周数
   - `coach_subscriptions.status` - 约束值更新为 {'active','inactive','waiting'}
   - `student_comments.rating` (smallint) - 评分字段
   - `coach_plan_templates.week_days` (int2[]) - 训练周几数组
   - `coach_plan_templates.contained_options` (text[]) - 包含的选项数组

5. 📊 **数据库对象统计**：38个表 + 3个视图 = 41个数据库对象

**最新变更（2025-01-27）：**

1. 📝 **字段新增**：
   - `coach_pricing.products` (jsonb) - 产品信息（JSON格式），用于存储教练的产品配置
   - `coach_plan_templates.global_answers` (jsonb) - 全局选项问题的答案，格式: {"问题名": 选项索引}，用于AI计划匹配
   - `execution_set_videos.user_notes` (text) - 用户备注
   - `execution_set_videos.review_status` (text) - 审核状态，∈ {'pending','reviewed','not_required'}
   - `execution_set_videos.requires_review` (boolean) - 是否需要审核
   - `execution_set_videos.exercise_name` (text) - 动作名称

2. 🔍 **索引新增**：
   - `coach_plan_instances` 表新增 `idx_coach_plan_instances_start_execution_day` 索引
   - `execution_set_videos` 表新增 `idx_execution_set_videos_review_status` 部分索引（用于优化待审核视频查询）
   - `shipping_info` 表新增多个索引（`idx_shipping_info_created_at`, `idx_shipping_info_status`, `idx_shipping_info_user_id`, `idx_shipping_info_user_prize`）

3. 📊 **数据统计更新**：
   - `user_profiles`: 95 → 108 行
   - `users`: 99 → 111 行
   - `coach_subscriptions`: 11 → 14 行
   - `chat_messages`: 26 → 31 行
   - `chat_rooms`: 5 → 6 行
   - `chat_room_unreads`: 10 → 12 行
   - `coach_plan_instances`: 1 → 8 行
   - `plan_instance_executions`: 8 → 9 行
   - `execution_set_videos`: 5 → 7 行
   - `coach_plan_templates`: 5 → 6 行
   - `leaderboard_entries`: 70 → 72 行

**下一步建议：**

1. ✅ 已为新增表添加必要的索引（大部分已完成）
2. ✅ 已为新增表添加外键约束（大部分已完成）
3. 清理冗余索引（部分表仍存在重复索引）
4. 统一外键引用（`auth.users` vs `public.users`）
5. 考虑清理 `training_videos.workout_log_id` 等已废弃字段
6. 考虑清理 `personal_records` 表（已被 `personal_records_history` 替代）
7. 考虑清理 `set_videos` 表（逐步被 `execution_set_videos` 替代）
8. 统一 `coach_subscriptions.status` 字段的值域定义
