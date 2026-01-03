# Supabase 分支数据库结构文档（public schema）

- **生成时间**：2025-01-27
- **最后更新**：2025-01-27（通过 MCP 从 Supabase 云端数据库实时获取）
- **数据库版本**：PostgreSQL (Supabase)
- **Schema**：public
- **数据库类型**：分支数据库（Branch Database）

> ⚠️ **重要说明**：
>
> - 本文档记录的是分支数据库的结构
> - 分支数据库用于开发和测试，与生产数据库隔离
> - 当前分支数据库结构与主数据库保持一致

## 目录

1. [表清单](#表清单)
2. [视图清单](#视图清单)
3. [表详细说明](#表详细说明)
4. [索引清单](#索引清单)
5. [外键关系](#外键关系)

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
- `coach_actions` - 教练行为日志表 / 教练动作库表
- `coach_plan_templates` - **核心模板库**（教练设计的可复用训练计划模板）
- `coach_questionnaires` - 教练专属问卷表
- `coach_pricing` - 教练收费套餐表
- `coach_plan_instances` - **教练计划实例表**（从模板生成给学员的计划）
- `coach_reviews` - 教练评价表
- `coach_applications` - 教练申请表 ⭐ **新增**
- `student_comments` - 学员评论表

### 训练相关表（14个）

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
- `training_exercises` - 训练动作表
- `student_actions` - 学员个人动作库表 ⭐ **新增**
- `student_plan_favorites` - 学员常用计划表 ⭐ **新增**（学员可复用模板）

### 内容互动表（4个）

- `content_interactions` - 内容交互表（点赞、收藏）
- `chat_rooms` - 聊天室表 ⭐ **重构**（原 conversations 表重构）
- `chat_messages` - 聊天消息表 ⭐ **重构**（原 coach_messages 表重构）
- `chat_room_unreads` - 聊天室未读消息表 ⭐ **新增**

### 其他表（8个）

- `onboarding_questionnaires` - 新用户入职问卷表
- `lifestyle_logs` - 学员生活日志表
- `alipay_orders` - 支付订单记录表
- `pullup_leaderboard` - 当前活跃的引体向上排行榜表
- `rankingboard_pullup_2025_9_10` - 引体向上排行榜历史表
- `leaderboard_templates` - 排行榜模板表 ⭐ **新增**（通用排行榜系统）
- `leaderboard_entries` - 排行榜条目表 ⭐ **新增**（通用排行榜系统）
- `specialties` - 教练专业领域表

**总计：42个表**（用户4 + 教练12 + 训练14 + 内容互动4 + 其他8 = 42）

> **注意**：统计中包含已废弃的表（`personal_records`），实际活跃表为41个

---

## 视图清单

1. `user_video_timeline` - 学员视频时间线视图（关联 `training_videos`）
2. `coach_pending_reviews` - 待审教练内容视图（内容审核队列）
3. `training_statistics` - 训练统计视图（动态计算而非存储）

---

## 表详细说明

### 1. users（统一用户表）

**基本信息**

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

**索引**

- `users_pkey` (id) - 主键索引
- `users_phone_key` (phone) - 唯一索引
- `users_email_key` (email) - 唯一索引
- `idx_users_phone` (phone) - 普通索引
- `idx_users_phone_unique` (phone) - 唯一索引（冗余）
- `idx_users_created_at` (created_at) - 普通索引
- `idx_users_coach_status` (coach_status) - 普通索引
- `idx_users_primary_role` (primary_role) - 普通索引

---

### 2. user_profiles（学员个人档案表）

**基本信息**

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

---

### 3. coaches（教练基本信息表）

**基本信息**

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
- `idx_coaches_user_id` (user_id) - 普通索引
- `idx_coaches_search` (search_vector) - GIN 索引（全文搜索）

---

### 4. coach_plan_templates（核心模板库表）

**基本信息**

- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 说明：**核心模板库**，教练设计的可复用训练计划模板

**字段说明**

| 列名                | 类型        | 可空 | 默认值            | 约束/备注                                                                   |
| ------------------- | ----------- | ---- | ----------------- | --------------------------------------------------------------------------- |
| id                  | uuid        | NO   | gen_random_uuid() | 主键                                                                        |
| coach_id            | uuid        | NO   |                   |                                                                             |
| name                | text        | NO   |                   |                                                                             |
| description         | text        | YES  |                   |                                                                             |
| type                | text        | NO   |                   |                                                                             |
| rest_days_count     | smallint    | YES  |                   |                                                                             |
| tags                | text[]      | YES  |                   |                                                                             |
| suitable_for        | text        | YES  |                   |                                                                             |
| training_days       | jsonb[]     | YES  |                   |                                                                             |
| training_days_count | smallint    | YES  |                   |                                                                             |
| week_days           | int2[]      | YES  |                   | ⭐ **新增**：训练周几数组                                                   |
| contained_options   | text[]      | YES  |                   | ⭐ **新增**：包含的选项数组                                                 |
| global_answers      | jsonb       | YES  | '{}'              | ⭐ **新增**：全局选项问题的答案，格式: {"问题名": 选项索引}，用于AI计划匹配 |
| created_at          | timestamptz | YES  | now()             |                                                                             |
| updated_at          | timestamptz | YES  | now()             |                                                                             |

**索引**

- `coach_plan_templates_pkey` (id) - 主键索引
- `idx_coach_plan_templates_coach_id` (coach_id) - 普通索引
- `idx_coach_plan_templates_type` (type) - 普通索引

---

### 5. coach_plan_instances（教练计划实例表）

**基本信息**

- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 说明：从模板生成给学员的计划实例

**字段说明**

| 列名                   | 类型        | 可空 | 默认值            | 约束/备注                                                             |
| ---------------------- | ----------- | ---- | ----------------- | --------------------------------------------------------------------- |
| id                     | uuid        | NO   | gen_random_uuid() | 主键                                                                  |
| coach_plan_template_id | uuid        | YES  |                   | 外键 → coach_plan_templates.id                                        |
| student_id             | uuid        | YES  |                   | 学员ID                                                                |
| coach_id               | uuid        | YES  |                   | 教练ID                                                                |
| coach_subscription_id  | uuid        | YES  |                   | 外键 → coach_subscriptions.id                                         |
| name                   | varchar     | NO   |                   | 计划名称                                                              |
| description            | text        | YES  |                   | 计划描述                                                              |
| training_days          | jsonb       | NO   |                   | 训练天数详情（JSON格式）                                              |
| status                 | varchar     | YES  | 'active'          | ∈ {'draft','active','paused','completed','archived'}                  |
| start_date             | date        | YES  |                   | 开始日期                                                              |
| end_date               | date        | YES  |                   | 结束日期                                                              |
| start_execution_day    | integer     | YES  | 1                 | 起始执行天数（1-based），用于老学员中途迁入平台 ⭐ **2025-12-26新增** |
| source                 | text        | YES  | 'coach'           | ⭐ **新增**：计划来源，'coach'=教练分配，'self'=学员自建              |
| type                   | text        | YES  |                   | 计划类型                                                              |
| tags                   | text[]      | YES  |                   | 标签                                                                  |
| suitable_for           | text        | YES  |                   | 适合人群                                                              |
| created_at             | timestamptz | YES  | CURRENT_TIMESTAMP |                                                                       |
| updated_at             | timestamptz | YES  | CURRENT_TIMESTAMP |                                                                       |

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
- `idx_coach_plan_instances_start_execution_day` (start_execution_day) -
  普通索引

---

### 6. plan_instance_executions（计划实例执行记录表）

**基本信息**

- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 说明：替代 `training_records`，记录新计划系统的训练执行
- 注释：训练计划实例执行记录 - 每次训练一条记录

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

**外键**

- `plan_instance_executions_instance_id_fkey` (instance_id →
  coach_plan_instances.id)
- `plan_instance_executions_student_id_fkey` (student_id → users.id)

**索引**

- `plan_instance_executions_pkey` (id) - 主键索引
- `idx_exec_student` (student_id) - 普通索引
- `idx_exec_instance_day` (instance_id, day_index) - 复合索引
- `idx_exec_date` (started_at DESC) - 普通索引
- `idx_exec_lookup` (student_id, instance_id, day_index, started_at DESC) -
  复合索引
- `idx_exec_status` (status) WHERE status <> 'completed' - 部分索引

---

### 7. execution_set_videos（执行组视频表）

**基本信息**

- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 说明：替代 `set_videos`，记录新计划系统的组视频
- 注释：训练执行组视频表（替代set_videos），关联plan_instance_executions，支持完整的审阅流程

**字段说明**

| 列名             | 类型        | 可空 | 默认值            | 约束/备注                                                     |
| ---------------- | ----------- | ---- | ----------------- | ------------------------------------------------------------- |
| id               | uuid        | NO   | gen_random_uuid() | 主键                                                          |
| execution_id     | uuid        | NO   |                   | 外键 → plan_instance_executions.id                            |
| action_id        | uuid        | NO   |                   | 动作ID                                                        |
| set_number       | integer     | NO   |                   | 组号（≥ 1）                                                   |
| video_url        | text        | NO   |                   | 视频URL                                                       |
| thumbnail_url    | text        | YES  |                   | 缩略图URL                                                     |
| duration_seconds | integer     | YES  |                   | 时长（秒）                                                    |
| file_size_bytes  | bigint      | YES  |                   | 文件大小（字节）                                              |
| storage_path     | text        | NO   |                   | ⭐ **新增**：Supabase Storage 中的文件路径                    |
| storage_bucket   | text        | YES  | 'videos'          | ⭐ **新增**：存储桶名称                                       |
| upload_status    | text        | YES  | 'uploaded'        | ∈ {'uploading','uploaded','failed'}                           |
| coach_feedback   | text        | YES  |                   | 教练反馈                                                      |
| coach_rating     | integer     | YES  |                   | 教练评分（1-5）                                               |
| reviewed_at      | timestamptz | YES  |                   | 审核时间                                                      |
| reviewed_by      | uuid        | YES  |                   | 外键 → users.id（审核人）                                     |
| user_notes       | text        | YES  |                   | ⭐ **新增**：用户备注                                         |
| review_status    | text        | YES  | 'pending'         | ⭐ **新增**：审核状态 ∈ {'pending','reviewed','not_required'} |
| requires_review  | boolean     | YES  | true              | ⭐ **新增**：是否需要审核                                     |
| exercise_name    | text        | YES  |                   | ⭐ **新增**：动作名称                                         |
| created_at       | timestamptz | NO   | now()             |                                                               |

**外键**

- `execution_set_videos_execution_id_fkey` (execution_id →
  plan_instance_executions.id)
- `execution_set_videos_reviewed_by_fkey` (reviewed_by → users.id)

**索引**

- `execution_set_videos_pkey` (id) - 主键索引
- `idx_set_videos_execution` (execution_id) - 普通索引
- `idx_set_videos_action` (action_id) - 普通索引
- `idx_set_videos_created` (created_at DESC) - 普通索引
- `idx_execution_set_videos_review_status` (review_status) WHERE requires_review
  = true AND review_status = 'pending' - 部分索引
- `execution_set_videos_execution_id_action_id_set_number_key` (execution_id,
  action_id, set_number) - 唯一索引

---

### 8. chat_rooms（聊天室表）

**基本信息**

- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
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

**外键**

- `chat_rooms_subscription_id_fkey` (subscription_id → coach_subscriptions.id)

**索引**

- `chat_rooms_pkey` (id) - 主键索引
- `conversations_members_gin` (members) - GIN 索引
- `idx_conversations_updated` (updated_at DESC) - 普通索引

---

### 9. chat_messages（聊天消息表）

**基本信息**

- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
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

**外键**

- `chat_messages_room_id_fkey` (room_id → chat_rooms.id)
- `chat_messages_sender_id_fkey` (sender_id → users.id)

**索引**

- `chat_messages_pkey` (id) - 主键索引
- `chat_messages_room_id_idx` (room_id) - 普通索引
- `chat_messages_is_read_idx` (is_read) - 普通索引

---

### 10. student_actions（学员个人动作库表）

**基本信息**

- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 说明：学员个人动作库，用于存储学员自定义的动作
- 注释：学员个人动作库

**字段说明**

| 列名       | 类型        | 可空 | 默认值                            | 约束/备注                   |
| ---------- | ----------- | ---- | --------------------------------- | --------------------------- |
| id         | uuid        | NO   | gen_random_uuid()                 | 主键                        |
| user_id    | uuid        | NO   |                                   | 外键 → users.id，所属用户ID |
| name       | text        | NO   |                                   | 动作名称                    |
| detail     | text        | YES  |                                   | 动作详情说明                |
| positions  | text[]      | YES  |                                   | 涉及部位                    |
| attrs      | text[]      | YES  | ['组数','次数','强度','休息时间'] | 动作属性列表                |
| url        | text        | YES  |                                   | 参考视频链接                |
| created_at | timestamptz | YES  | now()                             |                             |
| updated_at | timestamptz | YES  | now()                             |                             |

**外键**

- `student_actions_user_id_fkey` (user_id → users.id)

**索引**

- `student_actions_pkey` (id) - 主键索引
- `idx_student_actions_user_id` (user_id) - 普通索引

---

### 11. student_plan_favorites（学员常用计划表）

**基本信息**

- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 说明：学员常用计划（可复用模板），用于存储学员保存的训练计划模板
- 注释：学员常用计划（可复用模板）

**字段说明**

| 列名          | 类型        | 可空 | 默认值            | 约束/备注                   |
| ------------- | ----------- | ---- | ----------------- | --------------------------- |
| id            | uuid        | NO   | gen_random_uuid() | 主键                        |
| user_id       | uuid        | NO   |                   | 外键 → users.id，所属用户ID |
| name          | text        | NO   |                   | 计划名称                    |
| description   | text        | YES  |                   | 计划描述                    |
| training_days | jsonb       | NO   |                   | 训练日数据（JSON格式）      |
| created_at    | timestamptz | YES  | now()             |                             |
| updated_at    | timestamptz | YES  | now()             |                             |

**外键**

- `student_plan_favorites_user_id_fkey` (user_id → users.id)

**索引**

- `student_plan_favorites_pkey` (id) - 主键索引
- `idx_student_plan_favorites_user_id` (user_id) - 普通索引

---

### 12. coach_actions（教练动作库表）

**基本信息**

- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 说明：教练动作库：存储教练定义的可复用训练动作
- 注释：教练动作库：存储教练定义的可复用训练动作

**字段说明**

| 列名                    | 类型        | 可空 | 默认值            | 约束/备注                          |
| ----------------------- | ----------- | ---- | ----------------- | ---------------------------------- |
| id                      | uuid        | NO   | gen_random_uuid() | 主键                               |
| coach_id                | uuid        | NO   |                   | 所属教练的用户ID                   |
| name                    | text        | NO   |                   | 动作名称，如"深蹲"、"硬拉"         |
| detail                  | text        | YES  |                   |                                    |
| positions               | text[]      | YES  |                   | 动作涉及的身体部位                 |
| attrs                   | text[]      | YES  |                   | 动作属性标签                       |
| url                     | text        | YES  |                   |                                    |
| enableAutoWeightCompute | boolean     | YES  | false             | 是否启用自动重量计算               |
| includesBodyWeight      | boolean     | YES  | false             | 动作是否包含自身体重（如引体向上） |
| created_at              | timestamptz | YES  | now()             |                                    |
| updated_at              | timestamptz | YES  | now()             |                                    |

**外键**

- `coach_actions_coach_id_fkey` (coach_id → users.id)

**索引**

- `coach_actions_pkey` (id) - 主键索引
- `idx_coach_actions_coach_id` (coach_id) - 普通索引
- `idx_coach_actions_name` (name) - 普通索引

---

### 13. personal_records_history（个人记录历史表）

**基本信息**

- RLS：未启用
- 主键：`id` (uuid)
- 状态：✅ 正常使用
- 说明：替代 `personal_records`，包含完整的 PR 历史记录
- 注释：PR历史记录 - 替代旧的 personal_records 表

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

**外键**

- `personal_records_history_user_id_fkey` (user_id → users.id)
- `personal_records_history_execution_id_fkey` (execution_id →
  plan_instance_executions.id)

**索引**

- `personal_records_history_pkey` (id) - 主键索引
- `idx_pr_user_date` (user_id, date_achieved DESC) - 复合索引
- `idx_pr_user_exercise` (user_id, exercise_name) - 复合索引
- `idx_pr_exercise` (exercise_name) - 普通索引
- `idx_pr_execution` (execution_id) WHERE execution_id IS NOT NULL - 部分索引

---

### 14. chat_room_unreads（聊天室未读消息表）

**基本信息**

- RLS：未启用
- 主键：`(room_id, user_id)` - 复合主键
- 状态：✅ 正常使用
- 说明：记录每个用户在聊天室的未读消息数

**字段说明**

| 列名         | 类型        | 可空 | 默认值 | 约束/备注            |
| ------------ | ----------- | ---- | ------ | -------------------- |
| room_id      | uuid        | NO   |        | 外键 → chat_rooms.id |
| user_id      | uuid        | NO   |        | 用户ID               |
| unread_count | integer     | NO   | 0      | 未读消息数           |
| last_read_at | timestamptz | YES  |        | 最后阅读时间         |

**外键**

- `chat_room_unreads_room_id_fkey` (room_id → chat_rooms.id)

**索引**

- `chat_room_unreads_pkey` (room_id, user_id) - 主键索引（复合主键）

---

### 其他表（简要说明）

#### admin_users（系统管理员账号表）

- RLS：未启用
- 主键：`id`
- 外键：`user_id → users.id`
- 说明：用于后台管理

#### alipay_orders（支付订单记录表）

- RLS：未启用
- 主键：`id` (bigint)
- 外键：`user_id → users.id`
- 说明：关联用户支付

#### coach_applications（教练申请表）

- RLS：未启用
- 主键：`id` (uuid)
- 外键：`user_id → users.id`, `reviewed_by → users.id`
- 说明：教练申请入驻功能

#### coach_contents（教练内容库表）

- RLS：未启用
- 主键：`id`
- 外键：`coach_id → coaches.id`
- 说明：内容分发

#### coach_pricing（教练收费套餐表）

- RLS：未启用
- 主键：`id` (uuid)
- 外键：`coach_id → users.id`，唯一
- 说明：计费模型
- 字段：`products` (jsonb) - ⭐ **新增**：产品信息（JSON格式）

#### coach_questionnaires（教练专属问卷表）

- RLS：未启用
- 主键：`id`
- 外键：`coach_id → users.id`
- 说明：用于学员入门评估

#### coach_reviews（教练评价表）

- RLS：未启用
- 主键：`id` (uuid)
- 外键：`coach_subscription_id → coach_subscriptions.id`,
  `student_id → users.id`, `coach_id → coaches.id`
- 说明：学员对教练的评价和反馈

#### coach_rulepacks（规则包表）

- RLS：未启用
- 主键：`id` (uuid)
- 外键：`coach_id → coaches.id`
- 状态：⚠️ **暂保留**
- 说明：规则包（AI 生成计划），未来将被教练端计划编辑取代

#### coach_subscriptions（教练订阅关系表）

- RLS：未启用
- 主键：`id` (uuid)
- 外键：`student_id → users.id`, `coach_id → coaches.id`
- 说明：关联学员与教练
- 字段：`product_id`, `product_name`, `product_tier`, `subscribed_weeks` - ⭐
  **新增**
- 状态字段：`status` ∈ {'active','paused','cancelled','expired'}

#### content_interactions（内容交互表）

- RLS：未启用
- 主键：`id`
- 外键：`user_id → users.id`, `content_id → coach_contents.id`
- 说明：统计交互数据

#### leaderboard_entries（排行榜条目表）

- RLS：未启用
- 主键：`id` (uuid)
- 外键：`template_id → leaderboard_templates.id`, `user_id → users.id`
- 说明：通用排行榜系统条目

#### leaderboard_templates（排行榜模板表）

- RLS：未启用
- 主键：`id` (uuid)
- 外键：`creator_id → users.id`
- 说明：通用排行榜系统模板

#### lifestyle_logs（学员生活日志表）

- RLS：未启用
- 主键：`id`
- 外键：`user_id → users.id`
- 说明：记录作息、饮食等
- 唯一索引：`(user_id, log_date)`

#### onboarding_questionnaires（新用户入职问卷表）

- RLS：未启用
- 主键：`id`
- 外键：`user_id → users.id`, `coach_id → coaches.id`
- 说明：初始信息收集

#### personal_records（个人记录表）

- RLS：未启用
- 主键：`id` (uuid)
- 外键：`user_id → auth.users.id` ⚠️ **不一致**
- 状态：❌ **已废弃**
- 说明：仅存最大记录，缺历史。建议用 `personal_records_history` 替代

#### pullup_leaderboard（引体向上排行榜表）

- RLS：未启用
- 主键：`id` (uuid)
- 外键：`user_id → auth.users.id` ⚠️ **不一致**
- 说明：当前活跃的引体向上排行榜，学员提交记录

#### rankingboard_pullup_2025_9_10（引体向上排行榜历史表）

- RLS：未启用
- 主键：`id` (uuid)
- 外键：`user_id → auth.users.id` ⚠️ **不一致**
- 注释：引体向上挑战排行榜
- 说明：**历史归档**，仅作历史快照

#### set_videos（训练组视频表）

- RLS：未启用
- 主键：`id` (uuid)
- 外键：`training_record_id → training_records.id`
- 注释：训练组视频表
- 状态：⚠️ **逐步被替代**

#### shipping_info（快递信息表）

- RLS：未启用
- 主键：`id`
- 外键：`user_id → users.id`
- 注释：快递信息表，存储中奖用户的快递地址等信息

#### specialties（教练专业领域表）

- RLS：未启用
- 主键：`id`
- 说明：用于标签过滤
- 唯一索引：`name`

#### student_comments（学员评论表）

- RLS：未启用
- 主键：`id` (uuid)
- 外键：`student_id → users.id`, `content_id → coach_contents.id`
- 说明：学员的评论功能

#### training_exercises（训练动作表）

- RLS：未启用
- 主键：`id` (uuid)
- 外键：`training_session_id → training_sessions.id`

#### training_items（训练项目表）

- RLS：未启用
- 主键：`id` (uuid)
- 说明：训练动作/项目库
- 索引：`training_items_pkey` (id) - 主键索引，`idx_training_items_name`
  (name) - 普通索引

#### training_plan_details（核心计划明细表）

- RLS：未启用
- 主键：`id` (uuid)
- 外键：`training_plan_id → training_plans.id`
- 说明：**核心计划明细**，存储每日/每周动作 JSONB

#### training_plans（学员训练计划表）

- RLS：未启用
- 主键：`id` (uuid)
- 外键：`coach_id → coaches.id`, `rulepack_id → coach_rulepacks.id`
- 说明：关联 `training_plan_details`

#### training_records（训练执行记录表）

- RLS：未启用
- 主键：`id` (uuid)
- 外键：`user_id → users.id`, `plan_id → training_plans.id`
- 注释：学员训练执行记录表
- 说明：关联 `training_plans`，记录学员的训练执行情况

#### training_sessions（训练会话表）

- RLS：未启用
- 主键：`id` (uuid)
- 外键：`user_id → auth.users.id` ⚠️ **不一致**,
  `training_plan_id → training_plans.id`
- 说明：训练会话（计划中的一天），关联 `training_plan_details`

#### training_videos（训练视频表）

- RLS：未启用
- 主键：`id` (uuid)
- 外键：`coach_id → coaches.id`
- 说明：训练视频（完整训练），关联 `training_records`

---

## 索引清单

### 按表分类的主要索引

**users 表**

- 主键索引：`users_pkey`
- 唯一索引：`users_phone_key`, `users_email_key`, `idx_users_phone_unique`
- 普通索引：`idx_users_phone`, `idx_users_created_at`, `idx_users_coach_status`,
  `idx_users_primary_role`

**user_profiles 表**

- 主键索引：`user_profiles_pkey`
- 唯一索引：`user_profiles_user_id_key`, `unique_user_profile`
- 普通索引：`idx_user_profiles_user_id`, `idx_user_profiles_phone`

**coaches 表**

- 主键索引：`coaches_pkey`
- 普通索引：`idx_coaches_user_id`
- GIN 索引：`idx_coaches_search`（全文搜索）

**coach_plan_templates 表**

- 主键索引：`coach_plan_templates_pkey`
- 普通索引：`idx_coach_plan_templates_coach_id`, `idx_coach_plan_templates_type`

**coach_plan_instances 表**

- 主键索引：`coach_plan_instances_pkey`
- 普通索引：`idx_plan_instances_template`, `idx_plan_instances_student`,
  `idx_plan_instances_coach`, `idx_coach_plan_instances_start_execution_day`

**plan_instance_executions 表**

- 主键索引：`plan_instance_executions_pkey`
- 普通索引：`idx_exec_student`, `idx_exec_date`
- 复合索引：`idx_exec_instance_day`, `idx_exec_lookup`
- 部分索引：`idx_exec_status`

**execution_set_videos 表**

- 主键索引：`execution_set_videos_pkey`
- 普通索引：`idx_set_videos_execution`, `idx_set_videos_action`,
  `idx_set_videos_created`, `idx_execution_set_videos_requires_review`
- 唯一索引：`execution_set_videos_execution_id_action_id_set_number_key`
- 部分索引：`idx_execution_set_videos_review_status`

**chat_rooms 表**

- 主键索引：`chat_rooms_pkey`
- GIN 索引：`conversations_members_gin`
- 普通索引：`idx_conversations_updated`

**chat_messages 表**

- 主键索引：`chat_messages_pkey`
- 普通索引：`chat_messages_room_id_idx`, `chat_messages_is_read_idx`

**student_actions 表**

- 主键索引：`student_actions_pkey`
- 普通索引：`idx_student_actions_user_id`

**student_plan_favorites 表**

- 主键索引：`student_plan_favorites_pkey`
- 普通索引：`idx_student_plan_favorites_user_id`

**coach_actions 表**

- 主键索引：`coach_actions_pkey`
- 普通索引：`idx_coach_actions_coach_id`, `idx_coach_actions_name`

**personal_records_history 表**

- 主键索引：`personal_records_history_pkey`
- 复合索引：`idx_pr_user_date`, `idx_pr_user_exercise`
- 普通索引：`idx_pr_exercise`
- 部分索引：`idx_pr_execution`

（更多索引信息请参考数据库实际结构）

---

## 外键关系

### 主要外键关系

**users 表（被引用）**

- `user_profiles.user_id` → `users.id`
- `coaches.user_id` → `users.id`
- `coach_subscriptions.student_id` → `users.id`
- `coach_plan_instances.student_id` → `users.id`
- `plan_instance_executions.student_id` → `users.id`
- `chat_messages.sender_id` → `users.id`
- `execution_set_videos.reviewed_by` → `users.id`
- `personal_records_history.user_id` → `users.id`
- `student_actions.user_id` → `users.id`
- `student_plan_favorites.user_id` → `users.id`
- `coach_actions.coach_id` → `users.id`
- `coach_pricing.coach_id` → `users.id`
- `coach_questionnaires.coach_id` → `users.id`
- `leaderboard_templates.creator_id` → `users.id`
- `leaderboard_entries.user_id` → `users.id`
- `coach_applications.user_id` → `users.id`
- `coach_applications.reviewed_by` → `users.id`
- `admin_users.user_id` → `users.id`
- `admin_users.created_by` → `users.id`
- `alipay_orders.user_id` → `users.id`
- `content_interactions.user_id` → `users.id`
- `lifestyle_logs.user_id` → `users.id`
- `onboarding_questionnaires.user_id` → `users.id`
- `shipping_info.user_id` → `users.id`
- `student_comments.student_id` → `users.id`

**coaches 表（被引用）**

- `coach_subscriptions.coach_id` → `coaches.id`
- `coach_contents.coach_id` → `coaches.id`
- `coach_plan_instances.coach_id` → `coaches.id`
- `coach_reviews.coach_id` → `coaches.id`
- `coach_rulepacks.coach_id` → `coaches.id`
- `training_plans.coach_id` → `coaches.id`
- `training_videos.coach_id` → `coaches.id`
- `onboarding_questionnaires.coach_id` → `coaches.id`

**coach_plan_templates 表（被引用）**

- `coach_plan_instances.coach_plan_template_id` → `coach_plan_templates.id`

**coach_plan_instances 表（被引用）**

- `plan_instance_executions.instance_id` → `coach_plan_instances.id`

**plan_instance_executions 表（被引用）**

- `execution_set_videos.execution_id` → `plan_instance_executions.id`
- `personal_records_history.execution_id` → `plan_instance_executions.id`

**coach_subscriptions 表（被引用）**

- `coach_plan_instances.coach_subscription_id` → `coach_subscriptions.id`
- `coach_reviews.coach_subscription_id` → `coach_subscriptions.id`
- `chat_rooms.subscription_id` → `coach_subscriptions.id`

**chat_rooms 表（被引用）**

- `chat_messages.room_id` → `chat_rooms.id`
- `chat_room_unreads.room_id` → `chat_rooms.id`

**coach_contents 表（被引用）**

- `content_interactions.content_id` → `coach_contents.id`
- `student_comments.content_id` → `coach_contents.id`

**training_plans 表（被引用）**

- `training_plan_details.training_plan_id` → `training_plans.id`
- `training_records.plan_id` → `training_plans.id`
- `training_sessions.training_plan_id` → `training_plans.id`

**training_records 表（被引用）**

- `set_videos.training_record_id` → `training_records.id`

**training_sessions 表（被引用）**

- `training_exercises.training_session_id` → `training_sessions.id`

**leaderboard_templates 表（被引用）**

- `leaderboard_entries.template_id` → `leaderboard_templates.id`

---

## 总结

本文档包含了 Supabase 分支数据库中 `public` schema 的完整结构信息，包括：

- ✅ **42个表**的详细说明（包含1个已废弃表，实际活跃表41个）
- ✅ **3个视图**的定义
- ✅ 所有索引信息
- ✅ 外键关系

> **文档更新方式**：本文档通过 MCP（Model Context Protocol）从 Supabase
> 云端数据库实时获取最新结构信息，确保文档与数据库保持同步。

**分支数据库特点：**

1. 与主数据库结构保持一致
2. 用于开发和测试环境
3. 数据与生产环境隔离
4. 可以安全地进行实验性更改

**下一步建议：**

1. 定期同步主数据库的迁移到分支数据库
2. 在分支数据库上测试新的数据库变更
3. 验证迁移脚本的正确性
4. 确认无误后再应用到生产环境
