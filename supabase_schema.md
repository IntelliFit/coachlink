# Supabase 数据库结构文档（public schema）

- **生成时间**：2026-01-26
- **最后更新**：2026-01-30（通过 MCP 从 Supabase 云端数据库实时获取）
- **数据库版本**：PostgreSQL (Supabase)
- **Schema**：public

> ⚠️ **重要变更说明**：
>
> - 2026-01-26：新增 **知识库系统**（knowledge_books / knowledge_videos / knowledge_progress / knowledge_subscriptions）、**标准动作库**（canonical_actions）、**增长分享系统**（growth_share_*）、**推送订阅**（push_subscriptions）、**用户行为追踪**（user_behavior_events）等
> - 2026-01-06：上线 **学员会员与权益体系**（student_memberships / quotas /
>   coupons /
>   membership_orders），新增教练钱包、流水、提现、拉新奖励、推广投稿等财务与增长表
> - 2026-01-04：新增
>   **student_video_collections**（学员视频收藏/重点视频库），聊天消息类型 支持
>   `video_reference`
> - 2025-12-29：执行集视频与计划实例等字段优化，新增学员自建动作与常用计划表
> - 2025-12-26：聊天系统重构、训练执行系统优化、排行榜系统上线
> - 根据数据库分析报告（2025-12-04），已删除6个冗余表
> - 当前保留 **75个表 + 3个视图 = 78个数据库对象**

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

### 用户与平台（9个）

- `users` - 统一用户表（auth）
- `user_profiles` - 学员个人档案表
- `admin_users` - 系统管理员账号表
- `shipping_info` - 快递信息表
- `social_friendships` ⭐ 新增 - 好友关系与请求
- `platform_settings` ⭐ 新增 - 平台全局配置
- `user_behavior_events` ⭐ 新增 - 用户行为事件追踪表
- `admin_trace_events` ⭐ 新增 - 管理员操作追踪表
- `push_subscriptions` ⭐ 新增 - 推送订阅表（Web Push）

### 教练与订阅/钱包（18个）

- `coaches` - 教练基本信息表
- `coach_subscriptions` - 教练订阅关系表
- `coach_contents` - 教练内容库（文章、视频）
- `coach_rulepacks` - 规则包（AI 生成计划，暂保留）
- `coach_actions` - 教练行为日志表
- `coach_plan_templates` - 核心模板库（教练设计的训练计划模板）
- `coach_plan_instances` - 教练计划实例表（从模板生成给学员）
- `coach_reviews` - 教练评价表
- `coach_applications` - 教练申请表
- `coach_pricing` - 教练收费套餐表
- `coach_wallets` ⭐ 新增 - 教练钱包
- `wallet_transactions` ⭐ 新增 - 教练钱包流水
- `payout_requests` ⭐ 新增 - 教练提现申请
- `alipay_accounts` ⭐ 新增 - 教练支付宝账号绑定表
- `alipay_withdrawals` ⭐ 新增 - 教练提现记录表
- `coach_questionnaires` - 教练专属问卷表
- `coach_posters` ⭐ 新增 - 教练海报/宣传素材表
- `canonical_actions` ⭐ 新增 - 标准动作库表（平台统一动作库）

### 训练与执行（15个）

- `training_plans` - 学员训练计划表
- `training_plan_details` - 核心计划明细表（每日/每周动作 JSONB）
- `training_sessions` - 训练会话表（计划中的一天）
- `training_records` - 训练执行记录表（旧版）
- `training_videos` - 训练视频表（完整训练）
- `set_videos` - 训练组视频表（旧版，逐步被替代）
- `plan_instance_executions` - 计划实例执行记录表（新版执行）
- `execution_set_videos` - 执行组视频表（新版）
- `personal_records_history` - 个人记录历史表
- `training_items` - 训练项目库
- `student_actions` - 学员个人动作库
- `student_plan_favorites` - 学员常用计划表
- `student_video_collections` ⭐ 新增 - 学员视频收藏/重点视频库
- `onboarding_questionnaires` - 新用户入职问卷表
- `questionnaire_responses` ⭐ 新增 - 问卷回答历史快照

### 会员 / 交易 / 增长（8个）

- `alipay_orders` - 支付订单记录表
- `student_memberships` ⭐ 新增 - 学员会员状态
- `student_quotas` ⭐ 新增 - 学员配额（AI 导入、存储）
- `student_coupons` ⭐ 新增 - 优惠券/礼品卡
- `student_membership_orders` ⭐ 新增 - 会员/增值包订单
- `referral_rewards` ⭐ 新增 - 拉新奖励记录
- `promotion_submissions` ⭐ 新增 - 推广投稿记录
- `cart_items` ⭐ 新增 - 用户购物车商品表

### 内容互动与消息（6个）

- `content_interactions` - 内容交互（点赞、收藏）
- `content_purchases` ⭐ 新增 - 内容购买记录表（单篇付费解锁）
- `chat_rooms` - 聊天室表（支持多成员）
- `chat_messages` - 聊天消息表（支持多媒体与 video_reference）
- `chat_room_unreads` - 聊天室未读消息表
- `student_comments` - 学员评论表

### 排行榜与专题活动（3个）

- `leaderboard_templates` - 排行榜模板表（通用）
- `leaderboard_entries` - 排行榜条目表（通用）
- `pullup_leaderboard` - 引体向上排行榜表（当前活动）

### 知识库与内容（5个）

- `knowledge_books` ⭐ 新增 - 知识书籍表（电子书/课程）
- `knowledge_videos` ⭐ 新增 - 知识视频表
- `knowledge_progress` ⭐ 新增 - 知识学习进度表
- `knowledge_subscriptions` ⭐ 新增 - 知识订阅关系表
- `feedbacks` ⭐ 新增 - 用户反馈表

### 增长与运营（3个）

- `growth_share_links` ⭐ 新增 - 增长分享链接表
- `growth_share_events` ⭐ 新增 - 增长分享事件表
- `feature_releases` ⭐ 新增 - 功能发布记录表

### 街健力量指数（4个）

- `streetlifting_formulas` ⭐ 新增 - 街健力量指数公式表
- `streetlifting_submissions` ⭐ 新增 - 街健力量指数提交表
- `streetlifting_stories` ⭐ 新增 - 街健力量指数故事表
- `streetlifting_locations` ⭐ 新增 - 街健力量指数位置表

### 社区共建（2个）

- `community_actions` ⭐ 新增 - 公共动作库（共建生态）
- `community_action_likes` ⭐ 新增 - 公共动作点赞关系表

### 其他（2个）

- `specialties` - 教练专业领域表
- `lifestyle_logs` - 学员生活日志表

**总计：75个表**（用户与平台9 + 教练18 + 训练15 + 会员交易8 + 内容互动6 +
排行榜3 + 知识库5 + 增长运营3 + 街健4 + 社区共建2 + 其他2 = 75）

---

## 行数快照（2026-01-30）

说明：以下为通过 MCP 从 Supabase 云端数据库实时获取的 **public schema** 各表行数快照。

| 表 | 行数 | RLS |
| --- | ---: | --- |
| `admin_trace_events` | 4416 | enabled |
| `admin_users` | 1 | disabled |
| `alipay_accounts` | 1 | disabled |
| `alipay_orders` | 141 | disabled |
| `alipay_withdrawals` | 0 | disabled |
| `canonical_actions` | 20 | disabled |
| `cart_items` | 9 | disabled |
| `chat_messages` | 736 | disabled |
| `chat_room_unreads` | 254 | disabled |
| `chat_rooms` | 127 | disabled |
| `coach_actions` | 92 | disabled |
| `coach_applications` | 11 | disabled |
| `coach_contents` | 9 | disabled |
| `coach_plan_instances` | 66 | disabled |
| `coach_plan_templates` | 23 | disabled |
| `coach_pricing` | 2 | disabled |
| `coach_posters` | 2 | disabled |
| `coach_questionnaires` | 7 | disabled |
| `coach_reviews` | 0 | disabled |
| `coach_rulepacks` | 0 | disabled |
| `coach_subscriptions` | 85 | disabled |
| `coach_wallets` | 1 | disabled |
| `coaches` | 13 | disabled |
| `community_action_likes` | 0 | disabled |
| `community_actions` | 2 | disabled |
| `content_interactions` | 11 | disabled |
| `content_purchases` | 0 | disabled |
| `execution_set_videos` | 7 | disabled |
| `feedbacks` | 2 | disabled |
| `feature_releases` | 1 | enabled |
| `growth_share_events` | 19 | disabled |
| `growth_share_links` | 110 | disabled |
| `knowledge_books` | 0 | disabled |
| `knowledge_progress` | 0 | disabled |
| `knowledge_subscriptions` | 0 | disabled |
| `knowledge_videos` | 0 | disabled |
| `leaderboard_entries` | 80 | disabled |
| `leaderboard_templates` | 3 | disabled |
| `lifestyle_logs` | 1 | disabled |
| `onboarding_questionnaires` | 0 | disabled |
| `payout_requests` | 0 | disabled |
| `personal_records_history` | 148 | disabled |
| `plan_instance_executions` | 216 | disabled |
| `platform_settings` | 1 | disabled |
| `promotion_submissions` | 0 | disabled |
| `pullup_leaderboard` | 68 | disabled |
| `push_subscriptions` | 2 | enabled |
| `questionnaire_responses` | 3 | disabled |
| `referral_rewards` | 3 | disabled |
| `set_videos` | 0 | disabled |
| `shipping_info` | 0 | disabled |
| `social_friendships` | 11 | disabled |
| `specialties` | 11 | disabled |
| `streetlifting_formulas` | 2 | disabled |
| `streetlifting_locations` | 217 | disabled |
| `streetlifting_stories` | 2 | disabled |
| `streetlifting_submissions` | 229 | disabled |
| `student_actions` | 147 | disabled |
| `student_comments` | 0 | disabled |
| `student_coupons` | 0 | disabled |
| `student_membership_orders` | 16 | disabled |
| `student_memberships` | 1 | disabled |
| `student_plan_favorites` | 12 | disabled |
| `student_quotas` | 71 | disabled |
| `student_video_collections` | 22 | disabled |
| `training_items` | 19 | disabled |
| `training_plan_details` | 0 | disabled |
| `training_plans` | 0 | disabled |
| `training_records` | 0 | disabled |
| `training_sessions` | 0 | disabled |
| `training_videos` | 27 | disabled |
| `user_behavior_events` | 749 | enabled |
| `user_profiles` | 467 | disabled |
| `users` | 472 | disabled |
| `wallet_transactions` | 0 | disabled |

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

- 行数：~472
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
| invitation_coach_id     | uuid        | YES  |                   | ⭐ **新增**：邀请教练ID（用于拉新奖励）   |
| wechat_openid           | text        | YES  |                   | ⭐ **新增**：微信OpenID（用于微信登录）   |

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

- 行数：~467
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
| search_id            | text        | YES  |                   | ⭐ **新增**：搜索ID（唯一标识，用于搜索）        |
| guides_completed     | jsonb       | YES  | '{}'              | ⭐ **新增**：已完成的新手引导（JSON格式）        |
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
| profile                | jsonb       | YES  |                   | ⭐ **新增**：教练扩展信息（JSON格式）           |
| payment_qr_codes       | jsonb       | YES  | '[]'               | ⭐ **新增**：收款二维码列表（支持多个）         |
| payment_mode           | varchar     | YES  |                   | ⭐ **新增**：收款模式（direct/platform）        |
| allow_personal_qrcode  | boolean     | YES  | true               | ⭐ **新增**：是否允许使用个人收款码             |
| invitation_code        | text        | YES  |                   | ⭐ **新增**：教练邀请码（用于拉新）             |
| invitation_mode         | text        | YES  |                   | ⭐ **新增**：邀请模式                             |
| created_at             | timestamptz | YES  | now()             |                                                 |
| updated_at             | timestamptz | YES  | now()             |                                                 |

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
| visibility       | text        | YES  | 'friends'         | ⭐ **新增**：分享可见性（private/friends/public） |
| share_token      | uuid        | YES  | gen_random_uuid() | ⭐ **新增**：分享令牌，用于生成分享链接           |

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
- 状态：❌ **已下线（当前数据库无此表）**
- 说明：历史设计为“仅存最大记录”，已被 `personal_records_history` 替代，本文保留仅作历史参考

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
- 状态：❌ **已下线（当前数据库无此表）**
- 注释：已由 `chat_rooms` / `chat_messages` / `chat_room_unreads` 替代，本文保留仅作历史参考

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

| 列名                 | 类型        | 可空 | 默认值            | 约束/备注                                                       |
| -------------------- | ----------- | ---- | ----------------- | --------------------------------------------------------------- |
| id                   | uuid        | NO   | gen_random_uuid() | 主键                                                            |
| student_id           | uuid        | NO   |                   | 外键 → users.id                                                 |
| coach_id             | uuid        | NO   |                   | 外键 → coaches.id (⚠️ 注意：不是 users.id)                      |
| tier                 | integer     | NO   |                   | ∈ {1, 2, 3}                                                     |
| status               | text        | YES  | 'active'          | ∈ {'active','inactive','waiting'}                               |
| start_date           | timestamptz | YES  | now()             |                                                                 |
| end_date             | timestamptz | YES  |                   |                                                                 |
| auto_renew           | boolean     | YES  | true              |                                                                 |
| monthly_price        | bigint      | NO   |                   | 月费（单位：分，整数）                                          |
| order_id             | uuid        | YES  |                   | 订单编号                                                        |
| subscribe_data       | jsonb       | YES  |                   | 订阅附带的一些基础信息                                          |
| has_remind_coach     | boolean     | YES  | false             | ⭐ **新增**：是否已提醒教练                                     |
| remind_coach_note    | text        | YES  |                   | ⭐ **新增**：提醒教练的备注信息                                 |
| product_id           | text        | YES  |                   | ⭐ **新增**：订阅的具体产品ID                                   |
| product_name         | text        | YES  |                   | ⭐ **新增**：订阅时的产品名称快照                               |
| product_tier         | text        | YES  |                   | ⭐ **新增**：订阅时的产品层级(basic/standard/vip)               |
| subscribed_weeks     | integer     | YES  | 4                 | ⭐ **新增**：订阅包含的总周数                                   |
| prior_training_weeks | integer     | YES  | 0                 | ⭐ **新增**：学员迁入平台前已跟随教练训练的周数，用于计算总时长 |
| payment_method       | text        | YES  |                   | ⭐ **新增**：支付方式（如 alipay/wechat/manual）                |
| payment_confirmed_by | text        | YES  |                   | ⭐ **新增**：支付确认人/渠道标识                                 |
| payment_confirmed_at | timestamptz | YES  |                   | ⭐ **新增**：支付确认时间                                       |
| coach_seen_at        | timestamptz | YES  |                   | ⭐ **新增**：教练已查看时间                                     |
| last_payment_order_id | text       | YES  |                   | ⭐ **新增**：最近一次支付订单ID（文本）                          |
| payment_data         | jsonb       | YES  | '{}'              | ⭐ **新增**：支付扩展信息                                       |
| created_at           | timestamptz | YES  | now()             |                                                                 |
| updated_at           | timestamptz | YES  | now()             |                                                                 |

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
- 说明：**核心模板库**，教练设计的可复用训练计划模板。采用模板-实例设计模式，教练可以创建一次模板，多次分配给不同学员。模板支持 AI 导入文本计划，自动识别动作、组数、次数、休息日等，极大提升教练效率。

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

**业务说明**

- **模板复用**：教练创建一次模板，可以分配给多个学员，避免重复设计
- **AI 导入**：支持复制粘贴文本格式的计划（如聊天记录、文档），AI 自动识别动作、组数、次数、休息日，一键生成结构化模板
- **强度设置**：支持固定重量、百分比（%1RM）或 RM 区间设置，学员端根据最新 1RM 数据自动计算当日训练重量
- **数据独立性**：模板修改不影响已生成的实例，实例修改不影响原模板

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

| 列名       | 类型        | 可空 | 默认值            | 约束/备注                         |
| ---------- | ----------- | ---- | ----------------- | --------------------------------- |
| id         | uuid        | NO   | gen_random_uuid() | 主键                              |
| coach_id   | uuid        | NO   |                   | 外键 → coaches.id，唯一           |
| pricings   | jsonb       | NO   | '[]'              | 定价信息（JSON格式）              |
| products   | jsonb       | YES  | '[]'              | ⭐ **新增**：产品信息（JSON格式） |
| created_at | timestamptz | NO   | now()             |                                   |
| updated_at | timestamptz | NO   | now()             |                                   |

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

- 行数：~12
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`coach_plan_template_id → coach_plan_templates.id`,
  `coach_subscription_id → coach_subscriptions.id`
- 说明：从模板生成给学员的计划实例。每个学员有独立的实例，可以基于学员情况定制调整。系统根据学员档案中的 1RM 数据，自动计算出每天、每组的具体重量（精确到 2.5kg 倍数）。

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
| source                 | text        | YES  | 'coach'                       | ⭐ **新增**：计划来源，'coach'=教练分配，'self'=学员自建              |
| type                   | text        | YES  |                               | 计划类型                                                              |
| tags                   | text[]      | YES  |                               | 标签                                                                  |
| suitable_for           | text        | YES  |                               | 适合人群                                                              |
| rest_days_count        | smallint    | YES  |                               | ⭐ **新增**：休息天数（从模板继承）                                  |
| training_days_count    | smallint    | YES  |                               | ⭐ **新增**：训练天数（从模板继承）                                   |
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
- `idx_coach_plan_instances_start_execution_day` (start_execution_day) -
  普通索引

**业务说明**

- **个性化定制**：从模板创建实例时，可以修改计划名称、训练天数、适合人群等，为学员量身定制
- **动态负荷计算**：系统根据学员档案中的 1RM 数据，自动计算计划中的百分比重量（如 80% 1RM），学员更新 1RM 后计划自动调整
- **中途迁入支持**：`start_execution_day` 字段支持老学员中途迁入平台，可以从计划的第 N 天开始执行
- **计划来源**：`source` 字段区分计划是教练分配（'coach'）还是学员自建（'self'）

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
- 说明：替代 `training_records`，记录新计划系统的训练执行。支持训练记录的分享功能，学员可以将训练成果分享给好友或公开。

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
| visibility        | text        | YES  | 'friends'         | ⭐ **新增**：分享可见性 ∈ {'private','friends','public'} |
| share_token       | uuid        | YES  | gen_random_uuid() | ⭐ **新增**：分享令牌，用于生成分享链接             |
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
| weight               | numeric     | YES  |                   | 实际训练重量（kg）                               |
| reps                 | integer     | YES  |                   | 实际完成次数                                     |
| load_formula         | varchar     | YES  |                   | ⭐ **新增**：计算公式，如 "60kg × 10次 @ RPE 8" |
| execution_id         | uuid        | YES  |                   | ⭐ **新增**：外键 → plan_instance_executions.id |
| execution_set_number | integer     | YES  |                   | ⭐ **新增**：执行组号                           |
| date_achieved        | date        | NO   |                   | 达成日期                                        |
| notes                | text        | YES  |                   | 备注                                            |
| video_url            | text        | YES  |                   | ⭐ **新增**：视频URL                            |
| is_verified          | boolean     | YES  | false             | ⭐ **新增**：是否已验证                         |
| is_auto_calculated   | boolean     | YES  | false             | ⭐ **新增**：是否系统自动计算的 e1RM            |
| estimated_from       | jsonb       | YES  |                   | ⭐ **新增**：估算来源数据（jsonb）              |
| e1rm                 | numeric     | YES  |                   | ⭐ **新增**：估算极限（e1RM）                   |
| source_type          | text        | YES  | 'coach'           | ⭐ **新增**：来源类型（coach/self）             |
| source_coach_id      | uuid        | YES  |                   | ⭐ **新增**：归属教练ID（自训为 NULL）          |
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
| video_url     | text        | YES  |                   | 视频URL                   |
| video_storage_bucket | text  | YES  |                   | 视频存储桶                |
| video_storage_path   | text  | YES  |                   | 视频存储路径              |
| needReview    | boolean     | YES  |                   | 是否需要审核              |
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

#### 43. student_actions（学员个人动作库表）⭐ 新增

- 行数：~11
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`user_id → users.id`
- 说明：学员个人动作库，用于存储学员自定义的动作

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

---

#### 44. student_plan_favorites（学员常用计划表）⭐ 新增

- 行数：~4
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`user_id → users.id`
- 说明：学员常用计划（可复用模板），用于存储学员保存的训练计划模板

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

---

#### 45. student_video_collections（学员视频收藏/重点库）⭐ 新增

- 行数：~9
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`user_id → users.id`, `training_video_id → training_videos.id`,
  `execution_set_video_id → execution_set_videos.id`
- 说明：集中管理学员重点视频，支持训练视频/执行组视频引用与外部链接

**字段要点**

- `source` (text, default 'manual')：来源类型（manual / progress_set /
  plan_execution / external_url / training_video）
- `description` (text)：视频描述（必填）
- `is_featured` (boolean)：是否精选
- `storage_path` / `storage_bucket`：存储路径与桶名（默认 videos）
- `processing_status`：默认 ready
- 软删除 `deleted_at`

**索引**

- `idx_student_video_collections_user_created_at` (user_id, created_at DESC)
- `idx_student_video_collections_user_featured` (user_id) where 未删除且精选
- `idx_student_video_collections_training_video`
- `idx_student_video_collections_execution_video`

---

#### 46. social_friendships（好友关系表）⭐ 新增

- 行数：~1
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`requester_id → users.id`, `addressee_id → users.id`
- 说明：管理好友请求/关系

**字段要点**

- `status` ∈ {pending, accepted, rejected, blocked}（默认 pending）
- `created_at` / `updated_at`

---

#### 47. platform_settings（平台配置表）⭐ 新增

- 行数：~1
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 说明：全局配置项存储

**字段要点**

- `key` (varchar, 唯一)；`value` (jsonb)；`description`

---

#### 48. questionnaire_responses（问卷回答快照表）⭐ 新增

- 行数：~3
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`student_id → users.id`, `coach_id → coaches.id` (可空),
  `questionnaire_id → coach_questionnaires.id` (可空),
  `plan_instance_id → coach_plan_instances.id` (可空)
- 说明：记录所有问卷回答历史

**字段要点**

- `questionnaire_version`：填写时版本
- `answers` (jsonb) 默认 {}
- `context` ∈ {initial, cycle_end, manual_update, coach_request}
- `created_at`

---

#### 49. student_memberships（学员会员状态表）⭐ 新增

- 行数：~1
- 状态：✅ 正常使用
- 主键：`user_id` (uuid)
- 外键：`user_id → users.id`
- 说明：平台会员状态，支持 free/basic/premium/trial

**字段要点**

- `tier`（枚举约束），`status` ∈ {active, expired}
- `start_date` / `end_date`
- `created_at` / `updated_at`

---

#### 50. student_quotas（学员配额表）⭐ 新增

- 行数：~1
- 状态：✅ 正常使用
- 主键：`user_id` (uuid)
- 外键：`user_id → users.id`
- 说明：存储 AI 导入余额、存储容量/使用量

**字段要点**

- `ai_import_balance` (int) 默认 0
- `storage_total_mb` / `storage_used_mb`
- `last_reset_date`：最近重置时间

---

#### 51. student_coupons（学员优惠券表）⭐ 新增

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`user_id → users.id`
- 说明：优惠券/礼品卡，支持满减或时长赠送

**字段要点**

- `type` ∈ {discount_cash, duration_gift}
- `value`，`condition_min_amount`
- `status` ∈ {unused, used, expired}
- `expires_at`，`used_at`

---

#### 52. student_membership_orders（会员订单表）⭐ 新增

- 行数：~3
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`user_id → users.id`, `coupon_id → student_coupons.id`
- 说明：会员/增值包订单

**字段要点**

- `product_key`，`amount`，`original_amount`
- `payment_method` ∈ {alipay, wechat}
- `status` ∈ {pending, paid, cancelled}
- `paid_at`

---

#### 53. coach_wallets（教练钱包表）⭐ 新增

- 行数：~0
- 状态：✅ 正常使用
- 主键：`coach_id` (uuid)
- 外键：`coach_id → coaches.id`
- 说明：教练收入与冻结金额

**字段要点**

- `balance`，`total_income`，`frozen_amount`
- `created_at` / `updated_at`

---

#### 54. wallet_transactions（钱包流水表）⭐ 新增

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`wallet_id → coach_wallets.coach_id`
- 说明：钱包流水，记录收入/提现/退款

**字段要点**

- `type` ∈ {income, withdrawal, refund}
- `amount`，`related_order_id`（泛型引用）
- `created_at`

---

#### 55. payout_requests（教练提现申请表）⭐ 新增

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`coach_id → coaches.id`
- 说明：教练提现申请与支付状态

**字段要点**

- `amount`，`alipay_account`，`real_name`
- `status` ∈ {pending, processing, paid, rejected}
- `paid_at`，`transaction_no`，`admin_note`

---

#### 56. referral_rewards（拉新奖励表）⭐ 新增

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`inviter_id → users.id`, `invitee_id → users.id`
- 说明：邀请奖励及发放状态

**字段要点**

- `status` ∈ {pending, completed}
- `reward_granted` (jsonb)
- `created_at` / `updated_at`

---

#### 57. promotion_submissions（推广投稿表）⭐ 新增

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`user_id → users.id`
- 说明：用户提交推广视频/内容，用于奖励

**字段要点**

- `platform`，`video_url`，`view_count`
- `status` ∈ {pending, approved, rejected}
- `admin_feedback`

---

#### 58. canonical_actions（标准动作库表）⭐ 新增

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id` (text)
- 说明：平台统一管理的标准动作库，用于动作名称标准化和AI识别。教练和学员都可以引用这些标准动作。

**字段说明**

| 列名       | 类型        | 可空 | 默认值 | 约束/备注                           |
| ---------- | ----------- | ---- | ------ | ----------------------------------- |
| id         | text        | NO   |        | 主键，动作唯一标识（如 "squat"）    |
| name       | text        | NO   |        | 动作标准名称（如 "深蹲"）            |
| aliases    | text[]      | YES  | '{}'   | 动作别名数组（如 ["蹲起", "下蹲"]） |
| category   | text        | YES  |        | 动作分类（如 "下肢", "上肢"）       |
| created_at | timestamptz | YES  | now()  |                                     |

**业务说明**

- 用于统一动作命名，避免同一动作有多种叫法
- AI 导入计划时，通过别名匹配识别动作
- 教练创建动作库时可以关联标准动作，便于搜索和推荐

---

#### 59. knowledge_books（知识书籍表）⭐ 新增

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 说明：知识库系统中的电子书/课程内容，支持付费订阅。教练可以发布知识内容，学员可以订阅学习。

**字段说明**

| 列名          | 类型        | 可空 | 默认值 | 约束/备注                                    |
| ------------- | ----------- | ---- | ------ | -------------------------------------------- |
| id            | uuid        | NO   |        | 主键                                         |
| title         | text        | NO   |        | 书籍/课程标题                                |
| author        | text        | YES  |        | 作者（教练ID或平台）                         |
| cover_image   | text        | YES  |        | 封面图片URL                                  |
| summary       | text        | YES  |        | 简介                                         |
| audio_url     | text        | YES  |        | 音频URL（支持音频课程）                       |
| content       | jsonb       | NO   |        | 内容结构（JSON格式，包含章节、视频等）       |
| is_free       | boolean     | YES  | false  | 是否免费                                     |
| is_published  | boolean     | YES  | false  | 是否已发布                                   |
| sort_order    | integer     | YES  | 0      | 排序顺序                                     |
| created_at    | timestamptz | YES  | now()  |                                              |
| updated_at    | timestamptz | YES  | now()  |                                              |

**业务说明**

- 支持教练发布知识内容，形成知识付费体系
- 内容可以是电子书、视频课程、音频课程等
- 学员订阅后可以学习，平台记录学习进度

---

#### 60. knowledge_videos（知识视频表）⭐ 新增

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 说明：知识库视频内容（可独立作为知识条目/素材）

**字段要点**

- `source` / `source_url`：来源信息（如平台/外部链接）
- `cover_image` / `summary` / `transcript`：封面、摘要、转写
- `content`：结构化内容（jsonb，可选）
- `duration_seconds`：时长（秒）
- `is_free` / `is_published` / `sort_order`：权限与发布/排序

---

#### 61. knowledge_progress（知识学习进度表）⭐ 新增

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`user_id → users.id`
- 说明：记录学员对任意知识内容（按 `content_type` + `content_id`）的学习进度

**字段要点**

- `content_type` / `content_id`：学习对象（类型与ID）
- `progress`：进度（0~1 或 0~100，按产品约定）
- `last_position`：上次学习位置（jsonb）
- `completed_at`：完成时间（可空）

---

#### 62. knowledge_subscriptions（知识订阅关系表）⭐ 新增

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`user_id → users.id`, `order_id → alipay_orders.id`
- 说明：知识订阅关系（面向用户的订阅/权益记录）

**字段要点**

- `plan`：订阅档位（如 basic）
- `status`：订阅状态（如 active）
- `started_at` / `expires_at`：生效/到期时间
- `ai_quota_used` / `ai_quota_reset_at`：配额使用与重置时间

---

#### 63. coach_posters（教练海报表）⭐ 新增

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`coach_id → coaches.id`
- 说明：教练的宣传海报/素材，用于推广和展示

**字段要点**

- `image_url`：海报图片URL
- `title`，`description`
- `is_active`：是否启用
- `sort_order`：排序

---

#### 64. growth_share_links（增长分享链接表）⭐ 新增

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`user_id → users.id`
- 说明：用户生成的分享链接，用于拉新和增长

**字段要点**

- `share_code`：分享码（唯一）
- `share_type`：分享类型（如 "invite", "content"）
- `expires_at`：过期时间
- `click_count`：点击次数

---

#### 65. growth_share_events（增长分享事件表）⭐ 新增

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`share_link_id → growth_share_links.id`, `user_id → users.id`
- 说明：记录分享链接的点击、注册等事件

**字段要点**

- `event_type` ∈ {click, register, subscribe}
- `event_data` (jsonb)：事件数据
- `created_at`：事件时间

---

#### 66. push_subscriptions（推送订阅表）⭐ 新增

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`user_id → users.id`
- 说明：Web Push 推送订阅，用于向用户发送浏览器推送通知

**字段要点**

- `endpoint`：推送端点URL
- `p256dh`，`auth`：加密密钥
- `device_info` (jsonb)：设备信息
- `is_active`：是否激活

---

#### 67. user_behavior_events（用户行为事件表）⭐ 新增

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`user_id → users.id`
- 说明：记录用户行为事件，用于数据分析和产品优化

**字段要点**

- `event_type`：事件类型（如 "page_view", "button_click"）
- `event_data` (jsonb)：事件数据
- `page_url`，`user_agent`
- `created_at`：事件时间

---

#### 68. admin_trace_events（管理员操作追踪表）⭐ 新增

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`admin_id → users.id`
- 说明：记录管理员的操作日志，用于审计和安全

**字段要点**

- `action_type`：操作类型
- `target_type`，`target_id`：操作目标
- `action_data` (jsonb)：操作数据
- `ip_address`：操作IP
- `created_at`：操作时间

---

#### 69. feature_releases（功能发布记录表）⭐ 新增

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 说明：记录平台功能发布历史，用于版本管理和用户通知

**字段要点**

- `version`：版本号
- `title`，`description`：功能描述
- `release_date`：发布日期
- `is_announced`：是否已公告

---

#### 70. feedbacks（用户反馈表）⭐ 新增

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`user_id → users.id`
- 说明：用户反馈和建议，用于产品改进

**字段要点**

- `feedback_type`：反馈类型（如 "bug", "suggestion"）
- `content`：反馈内容
- `status` ∈ {pending, reviewed, resolved}
- `admin_response`：管理员回复

---

#### 71. cart_items（用户购物车商品表）⭐ 新增

- 行数：~9
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`user_id → users.id`, `coach_id → coaches.id`
- 说明：用户购物车中的订阅商品快照（产品、价格、时长等）

**字段要点**

- `product_id` / `product_name` / `product_tier`：产品标识与档位
- `duration_months`：订阅时长（月）
- `price`：价格（数值）
- `coach_name`：冗余字段，便于展示

---

#### 72. alipay_accounts（教练支付宝账号绑定表）⭐ 新增

- 行数：~1
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`coach_id → coaches.id`
- 说明：教练绑定的支付宝收款账号信息（用于平台代收/提现）

**字段要点**

- `payee_account`：支付宝账号（手机号/邮箱/UID）
- `payee_type`：账号类型（如登录号/UID）
- `real_name`：真实姓名（部分类型必填）
- `verified`：是否已校验通过

---

#### 73. alipay_withdrawals（教练提现记录表）⭐ 新增

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`coach_id → coaches.id`, `confirmed_by_user_id → users.id`
- 说明：提现流水（支持人工转账流程与状态流转）

**字段要点**

- `amount` / `fee`：金额与手续费（单位：分）
- `status`：`pending|success|failed|cancelled`
- `out_biz_no`：提现业务单号（系统生成）
- `alipay_order_id`：管理员填写的人工转账订单号
- `alipay_response`：回执信息（jsonb）

---

#### 74. content_purchases（单篇内容购买记录表）⭐ 新增

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`content_id → coach_contents.id`, `user_id → users.id`, `order_id → alipay_orders.id`
- 说明：记录用户对 `coach_contents` 单篇付费解锁的购买关系

**字段要点**

- `status`：`pending|paid`（以及可能的失败/关闭状态，按业务扩展）
- `paid_at`：支付成功时间
- `updated_at`：状态变更时间

---

#### 75. streetlifting_formulas（街健力量指数公式表）⭐ 新增

- 行数：~2
- 状态：✅ 正常使用
- 主键：`id` (int)
- 说明：街健力量指数的系数配置（可按性别/动作类型扩展）

**字段要点**

- `gender`：`Male|Female`
- `coeff_a..coeff_f`：公式系数
- `total_submissions_used`：被用于拟合/统计的提交量

---

#### 76. streetlifting_submissions（街健力量指数提交表）⭐ 新增

- 行数：~229
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`user_id → users.id`（可空）
- 说明：用户公开提交的街健训练数据（用于计算指数/社区展示）

**字段要点**

- `bodyweight` / `added_weight` / `reps`：体重、外加重量、次数
- `exercise_type`：如 `weighted_pullup|weighted_dips`
- `form_quality`：动作质量分级
- `penalty_weight`：作弊/质量惩罚

---

#### 77. streetlifting_stories（街健力量指数故事/事件表）⭐ 新增

- 行数：~2
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 说明：街健活动故事/事件内容（可用于运营展示）

---

#### 78. streetlifting_locations（街健训练点位表）⭐ 新增

- 行数：~217
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 说明：训练点位置信息（公开社区数据）

**字段要点**

- `name` / `address` / `city` / `province`
- `latitude` / `longitude`
- `image_url` / `image_urls`

---

#### 79. community_actions（公共动作库：共建生态表）⭐ 新增

- 行数：~2
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`contributor_user_id → users.id`, `canonical_action_id → canonical_actions.id`
- 说明：平台公共动作资产（共建生态，阶段性能力：投稿/点赞）

**字段要点**

- `name` / `detail` / `positions` / `attrs`：动作信息
- `like_count`：点赞数（触发器/聚合维护）
- `enableAutoWeightCompute` / `includesBodyWeight`：训练计算相关开关

---

#### 80. community_action_likes（公共动作点赞关系表）⭐ 新增

- 行数：~0
- 状态：✅ 正常使用
- 主键：`id` (uuid)
- 外键：`action_id → community_actions.id`, `user_id → users.id`
- 说明：用户对公共动作的点赞关系（0/1）

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

**最新变更（2026-01-30）：**

1. ⭐ **新增/补齐表（10个）**：
   - 支付与结算：`alipay_accounts`, `alipay_withdrawals`, `cart_items`
   - 单篇付费：`content_purchases`
   - 街健力量指数：`streetlifting_formulas`, `streetlifting_submissions`, `streetlifting_stories`, `streetlifting_locations`
   - 社区共建：`community_actions`, `community_action_likes`
2. 📝 **字段对齐/补充**：
   - `coach_subscriptions`：补齐 `payment_*`、`coach_seen_at`、`payment_data` 等支付信息字段
   - `training_records`：补齐 `visibility`、`share_token`（分享能力）
   - `personal_records_history`：补齐 `e1rm`、`estimated_from`、`is_auto_calculated` 等字段
   - `leaderboard_templates`：补齐视频相关字段（`video_url` 等）
   - `knowledge_videos / knowledge_progress / knowledge_subscriptions`：按当前数据库结构修正文档描述
3. 📊 **数据库对象统计（当前）**：
   - **75 个表 + 3 个视图 = 78 个数据库对象**

**最新变更（2026-01-26）：**

1. ⭐ **知识库系统新增 4 表**：
   - `knowledge_books` - 知识书籍/课程表，支持教练发布知识内容
   - `knowledge_videos` - 知识视频表
   - `knowledge_progress` - 知识学习进度表
   - `knowledge_subscriptions` - 知识订阅关系表
   - 实现知识付费体系，教练可以发布电子书、视频课程等内容

2. ⭐ **标准动作库**：新增 `canonical_actions` 表，平台统一管理标准动作库，用于动作名称标准化和 AI 识别，避免同一动作有多种叫法。

3. ⭐ **增长与运营系统新增 3 表**：
   - `growth_share_links` - 增长分享链接表
   - `growth_share_events` - 增长分享事件表
   - `feature_releases` - 功能发布记录表
   - 支持分享拉新、事件追踪、版本管理

4. ⭐ **推送与追踪系统新增 3 表**：
   - `push_subscriptions` - Web Push 推送订阅表
   - `user_behavior_events` - 用户行为事件追踪表
   - `admin_trace_events` - 管理员操作追踪表
   - 支持浏览器推送通知、用户行为分析、管理员审计

5. ⭐ **其他新增表**：
   - `coach_posters` - 教练海报/宣传素材表
   - `feedbacks` - 用户反馈表

6. 📝 **字段更新**：
   - `plan_instance_executions` 新增 `visibility`（分享可见性）和 `share_token`（分享令牌），支持训练记录分享功能
   - `users` 新增 `invitation_coach_id`（邀请教练ID）和 `wechat_openid`（微信OpenID），支持拉新奖励和微信登录
   - `coaches` 新增 `invitation_code`（教练邀请码）和 `invitation_mode`（邀请模式），完善拉新体系
   - `coach_plan_instances` 新增 `rest_days_count` 和 `training_days_count`，从模板继承训练周期信息
   - `user_profiles` 新增 `guides_completed`（已完成的新手引导），用于引导系统

7. 📊 **数据库统计更新**：
   - 当前口径以“行数快照（2026-01-30）”为准：**75 个表 + 3 个视图 = 78 个数据库对象**

**最新变更（2026-01-06）：**

1. ⭐ **会员与权益体系新增 7 表**：`student_memberships`, `student_quotas`,
   `student_coupons`, `student_membership_orders`, `referral_rewards`,
   `promotion_submissions`，并引入社交邀请奖励、推广投稿。
2. ⭐ **教练钱包与结算**：新增 `coach_wallets`, `wallet_transactions`,
   `payout_requests` 支撑收入/提现流水。
3. ⭐ **社交/配置**：新增 `social_friendships`（好友关系）、
   `platform_settings`（全局配置）、`questionnaire_responses`（问卷回答历史）。
4. 📝 **字段更新**：
   - `chat_messages.message_type` 允许 `video_reference`，新增
     `content_metadata` 字段。
   - `user_profiles` 新增 `search_id` 唯一字段。
   - `coaches` 新增 `payment_qr_codes`(jsonb
     列表)、`payment_mode`、`allow_personal_qrcode` 用于多收款通道。
   - `coach_actions` 新增 `enableAutoWeightCompute`、`includesBodyWeight`。

**最新变更（2026-01-04）：**

1. ⭐ **新增表**：`student_video_collections`（学员重点视频/收藏库）。
2. 📝 **聊天类型扩展**：`chat_messages` 支持 `video_reference` 消息类型。

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

- ✅ **75个表**的结构说明（含知识库、标准动作库、增长运营、推送追踪、街健指数、共建生态等）
- ✅ **3个视图**的定义
- ✅ 主要索引与外键信息
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

5. 📊 **数据库对象统计**：40个表 + 3个视图 = 43个数据库对象

**最新变更（2025-12-29）：**

1. 📝 **字段新增**：
   - `coach_pricing.products` (jsonb) -
     产品信息（JSON格式），用于存储教练的产品配置
   - `coach_plan_templates.global_answers` (jsonb) - 全局选项问题的答案，格式:
     {"问题名": 选项索引}，用于AI计划匹配
   - `execution_set_videos.user_notes` (text) - 用户备注
   - `execution_set_videos.review_status` (text) - 审核状态，∈
     {'pending','reviewed','not_required'}
   - `execution_set_videos.requires_review` (boolean) - 是否需要审核
   - `execution_set_videos.exercise_name` (text) - 动作名称
   - `coach_plan_instances.source` (text) -
     计划来源，'coach'=教练分配，'self'=学员自建

2. ⭐ **新增表（2个）**：
   - `student_actions` - 学员个人动作库表，用于存储学员自定义的动作
   - `student_plan_favorites` -
     学员常用计划表，用于存储学员保存的训练计划模板（可复用）

3. 🔍 **索引新增**：
   - `coach_plan_instances` 表新增
     `idx_coach_plan_instances_start_execution_day` 索引
   - `execution_set_videos` 表新增 `idx_execution_set_videos_review_status`
     部分索引（用于优化待审核视频查询）
   - `shipping_info` 表新增多个索引（`idx_shipping_info_created_at`,
     `idx_shipping_info_status`, `idx_shipping_info_user_id`,
     `idx_shipping_info_user_prize`）

4. 📊 **数据统计更新**：
   - `user_profiles`: 95 → 108 行
   - `users`: 99 → 111 行
   - `coach_subscriptions`: 11 → 14 行
   - `chat_messages`: 26 → 31 行
   - `chat_rooms`: 5 → 6 行
   - `chat_room_unreads`: 10 → 12 行
   - `coach_plan_instances`: 1 → 8 → 12 行
   - `plan_instance_executions`: 8 → 9 行
   - `execution_set_videos`: 5 → 7 行
   - `coach_plan_templates`: 5 → 6 → 7 行
   - `leaderboard_entries`: 70 → 72 行
   - `coach_actions`: 4 → 12 行
   - `coach_contents`: 6 → 2 行
   - `student_actions`: 11 行（新增）
   - `student_plan_favorites`: 4 行（新增）

**下一步建议：**

1. ✅ 已为新增表添加必要的索引（大部分已完成）
2. ✅ 已为新增表添加外键约束（大部分已完成）
3. 清理冗余索引（部分表仍存在重复索引）
4. 统一外键引用（`auth.users` vs `public.users`）
5. 考虑清理 `training_videos.workout_log_id` 等已废弃字段
6. 考虑清理 `personal_records` 表（已被 `personal_records_history` 替代）
7. 考虑清理 `set_videos` 表（逐步被 `execution_set_videos` 替代）
8. 统一 `coach_subscriptions.status` 字段的值域定义
