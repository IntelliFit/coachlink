# 智健联盟数据库结构文档

## 概述

本文档详细描述了智健联盟（健身训练平台）的数据库结构。该数据库使用 PostgreSQL，包含9个主要表，支持用户管理、教练系统、训练计划、引体向上排行榜、视频提交、抽奖系统等功能。

## 数据库表结构

### 1. users（用户表）

**表描述：** 系统核心用户表，存储用户基本认证信息

**表配置：**
- RLS（行级安全）：禁用
- 存储大小：112 kB
- 活跃记录：71条

**字段详情：**

| 字段名 | 数据类型 | 约束 | 默认值 | 描述 |
|--------|----------|------|--------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | gen_random_uuid() | 用户唯一标识 |
| phone | text | UNIQUE, NOT NULL | - | 用户手机号（登录凭证） |
| password_hash | text | NOT NULL | - | 密码哈希值 |
| has_drawn | boolean | - | false | 是否已参与抽奖 |
| created_at | timestamptz | - | now() | 创建时间 |
| updated_at | timestamptz | - | now() | 更新时间 |
| last_login_at | timestamptz | - | - | 最后登录时间 |
| subscription_level | text | CHECK约束 | 'basic' | 订阅级别（basic/advanced/premium） |
| subscription_expires_at | timestamptz | - | - | 订阅到期时间 |
| is_admin | boolean | - | false | 是否为管理员 |
| admin_role | text | - | - | 管理员角色 |
| admin_permissions | text[] | - | - | 管理员权限数组 |

**外键关系：**
- 被 user_profiles.user_id 引用
- 被 shipping_info.user_id 引用
- 被 pullup_leaderboard.submitted_by 引用
- 被 pullup_leaderboard.reviewed_by 引用
- 被 admin_users.user_id 引用
- 被 admin_users.created_by 引用

### 2. user_profiles（用户资料表）

**表描述：** 存储用户详细个人信息和健身相关数据

**表配置：**
- RLS（行级安全）：启用
- 存储大小：128 kB
- 活跃记录：71条

**字段详情：**

| 字段名 | 数据类型 | 约束 | 默认值 | 描述 |
|--------|----------|------|--------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | gen_random_uuid() | 资料唯一标识 |
| user_id | uuid | UNIQUE, FOREIGN KEY | - | 关联用户ID |
| full_name | text | - | - | 用户全名 |
| nickname | text | - | - | 用户昵称 |
| avatar_url | text | - | - | 头像URL |
| gender | text | CHECK约束 | - | 性别（male/female/other） |
| birth_date | date | - | - | 出生日期 |
| height | integer | - | - | 身高（厘米） |
| weight | integer | - | - | 体重（公斤） |
| fitness_goal | text | - | - | 健身目标 |
| fitness_level | text | CHECK约束 | - | 健身水平（beginner/intermediate/advanced） |
| bio | text | - | - | 个人简介 |
| phone | text | - | - | 联系电话 |
| address | text | - | - | 地址信息 |
| created_at | timestamptz | - | now() | 创建时间 |
| updated_at | timestamptz | - | now() | 更新时间 |

**外键关系：**
- user_id → users.id

### 3. coaches（教练表）

**表描述：** 存储平台教练信息和认证状态

**表配置：**
- RLS（行级安全）：启用
- 存储大小：32 kB
- 活跃记录：4条

**字段详情：**

| 字段名 | 数据类型 | 约束 | 默认值 | 描述 |
|--------|----------|------|--------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | gen_random_uuid() | 教练唯一标识 |
| user_id | uuid | FOREIGN KEY | - | 关联用户ID |
| specialties | text[] | - | - | 专业领域数组 |
| certifications | text[] | - | - | 认证证书数组 |
| experience_years | integer | - | - | 从业年限 |
| hourly_rate | decimal | - | - | 小时费率 |
| bio | text | - | - | 教练简介 |
| status | text | CHECK约束 | 'pending' | 状态（pending/approved/rejected） |
| created_at | timestamptz | - | now() | 创建时间 |
| updated_at | timestamptz | - | now() | 更新时间 |

### 4. training_plans（训练计划表）

**表描述：** 存储用户的个性化训练计划

**表配置：**
- RLS（行级安全）：启用
- 存储大小：32 kB
- 活跃记录：4条

**字段详情：**

| 字段名 | 数据类型 | 约束 | 默认值 | 描述 |
|--------|----------|------|--------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | gen_random_uuid() | 计划唯一标识 |
| user_id | uuid | FOREIGN KEY | - | 关联用户ID |
| coach_id | uuid | FOREIGN KEY | - | 关联教练ID |
| title | text | NOT NULL | - | 计划标题 |
| description | text | - | - | 计划描述 |
| difficulty_level | text | CHECK约束 | - | 难度级别（beginner/intermediate/advanced） |
| duration_weeks | integer | - | - | 持续周数 |
| exercises | jsonb | - | - | 练习内容（JSON格式） |
| status | text | CHECK约束 | 'active' | 状态（active/completed/paused） |
| created_at | timestamptz | - | now() | 创建时间 |
| updated_at | timestamptz | - | now() | 更新时间 |

### 5. exercises（练习表）

**表描述：** 存储系统中的各种健身练习

**表配置：**
- RLS（行级安全）：启用
- 存储大小：32 kB
- 活跃记录：少量

**字段详情：**

| 字段名 | 数据类型 | 约束 | 默认值 | 描述 |
|--------|----------|------|--------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | gen_random_uuid() | 练习唯一标识 |
| name | text | NOT NULL | - | 练习名称 |
| description | text | - | - | 练习描述 |
| muscle_groups | text[] | - | - | 目标肌肉群 |
| equipment_needed | text[] | - | - | 所需器材 |
| difficulty_level | text | CHECK约束 | - | 难度级别 |
| instructions | text | - | - | 动作指导 |
| video_url | text | - | - | 示范视频URL |
| created_at | timestamptz | - | now() | 创建时间 |
| updated_at | timestamptz | - | now() | 更新时间 |

### 6. pullup_leaderboard（引体向上排行榜）

**表描述：** 存储用户引体向上成绩和排行榜数据

**表配置：**
- RLS（行级安全）：启用
- 存储大小：32 kB
- 活跃记录：少量

**字段详情：**

| 字段名 | 数据类型 | 约束 | 默认值 | 描述 |
|--------|----------|------|--------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | gen_random_uuid() | 记录唯一标识 |
| user_name | text | NOT NULL | - | 用户姓名 |
| phone | text | NOT NULL | - | 用户手机号 |
| pullup_count | integer | NOT NULL | - | 引体向上次数 |
| video_url | text | - | - | 视频证明URL |
| status | text | CHECK约束 | 'pending' | 审核状态（pending/approved/rejected） |
| submitted_by | uuid | FOREIGN KEY | - | 提交者ID |
| reviewed_by | uuid | FOREIGN KEY | - | 审核者ID |
| review_notes | text | - | - | 审核备注 |
| created_at | timestamptz | - | now() | 创建时间 |
| updated_at | timestamptz | - | now() | 更新时间 |

**外键关系：**
- submitted_by → users.id
- reviewed_by → users.id

### 7. video_submissions（视频提交表）

**表描述：** 存储用户提交的训练视频

**表配置：**
- RLS（行级安全）：启用
- 存储大小：32 kB
- 活跃记录：少量

**字段详情：**

| 字段名 | 数据类型 | 约束 | 默认值 | 描述 |
|--------|----------|------|--------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | gen_random_uuid() | 视频唯一标识 |
| user_id | uuid | FOREIGN KEY | - | 关联用户ID |
| title | text | NOT NULL | - | 视频标题 |
| description | text | - | - | 视频描述 |
| video_url | text | NOT NULL | - | 视频URL |
| thumbnail_url | text | - | - | 缩略图URL |
| duration | integer | - | - | 视频时长（秒） |
| exercise_type | text | - | - | 练习类型 |
| status | text | CHECK约束 | 'pending' | 审核状态 |
| coach_feedback | text | - | - | 教练反馈 |
| created_at | timestamptz | - | now() | 创建时间 |
| updated_at | timestamptz | - | now() | 更新时间 |

### 8. shipping_info（快递信息表）

**表描述：** 存储中奖用户的快递地址等信息

**表配置：**
- RLS（行级安全）：启用
- 存储大小：48 kB
- 活跃记录：0条

**字段详情：**

| 字段名 | 数据类型 | 约束 | 默认值 | 描述 |
|--------|----------|------|--------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | gen_random_uuid() | 快递信息唯一标识 |
| user_id | uuid | FOREIGN KEY, NOT NULL | - | 用户ID |
| prize_id | text | NOT NULL | - | 奖品ID |
| recipient_name | text | NOT NULL | - | 收件人姓名 |
| phone | text | NOT NULL | - | 收件人手机号 |
| address | text | NOT NULL | - | 详细地址 |
| notes | text | - | '' | 备注信息 |
| status | text | CHECK约束 | 'pending' | 快递状态（pending/processing/shipped/delivered） |
| tracking_number | text | - | - | 物流单号 |
| created_at | timestamptz | - | now() | 创建时间 |
| updated_at | timestamptz | - | now() | 更新时间 |

**外键关系：**
- user_id → users.id

### 9. admin_users（管理员用户表）

**表描述：** 存储管理员用户的详细信息和权限

**表配置：**
- RLS（行级安全）：启用
- 存储大小：32 kB
- 活跃记录：少量

**字段详情：**

| 字段名 | 数据类型 | 约束 | 默认值 | 描述 |
|--------|----------|------|--------|---------|
| id | uuid | PRIMARY KEY, NOT NULL | gen_random_uuid() | 管理员记录唯一标识 |
| user_id | uuid | FOREIGN KEY | - | 关联用户ID |
| role | text | NOT NULL | - | 管理员角色 |
| permissions | text[] | - | - | 权限列表 |
| created_by | uuid | FOREIGN KEY | - | 创建者ID |
| created_at | timestamptz | - | now() | 创建时间 |
| updated_at | timestamptz | - | now() | 更新时间 |

**外键关系：**
- user_id → users.id
- created_by → users.id

## 数据库关系图

```
users (核心用户表)
├── user_profiles (1:1) - 用户详细资料
├── shipping_info (1:N) - 快递信息
├── pullup_leaderboard (1:N) - 引体向上记录
│   ├── submitted_by → users.id
│   └── reviewed_by → users.id
├── admin_users (1:N) - 管理员信息
│   ├── user_id → users.id
│   └── created_by → users.id
├── coaches (1:1) - 教练信息
├── training_plans (1:N) - 训练计划
└── video_submissions (1:N) - 视频提交
```

## 数据库迁移历史

系统包含以下迁移记录：

1. `20250102000000_add_shipping_info` - 添加快递信息表
2. `20250702180600_super_frost` - 系统基础结构
3. `20250702190915_fancy_torch` - 功能扩展
4. `20250702191806_lingering_ember` - 数据结构优化
5. `20250702195408_velvet_summit` - 权限系统
6. `20250704182226_nameless_wind` - 用户系统完善
7. `20250704191925_crystal_sound` - 教练系统
8. `20250704205453_crystal_cave` - 训练计划系统
9. `20250704214441_turquoise_spring` - 排行榜系统
10. `20250705133525_icy_frost` - 最新功能更新

## 安全特性

### 行级安全（RLS）

以下表启用了RLS：
- `user_profiles` - 用户只能访问自己的资料
- `shipping_info` - 用户只能访问自己的快递信息
- `coaches` - 教练信息访问控制
- `training_plans` - 训练计划访问控制
- `exercises` - 练习信息访问控制
- `pullup_leaderboard` - 排行榜数据访问控制
- `video_submissions` - 视频提交访问控制
- `admin_users` - 管理员信息访问控制

### 数据约束

1. **枚举约束：**
   - 性别：male, female, other
   - 健身水平：beginner, intermediate, advanced
   - 订阅级别：basic, advanced, premium
   - 教练状态：pending, approved, rejected
   - 训练计划状态：active, completed, paused
   - 审核状态：pending, approved, rejected
   - 快递状态：pending, processing, shipped, delivered

2. **唯一性约束：**
   - 用户手机号唯一
   - 用户资料与用户一对一关系

3. **外键约束：**
   - 确保数据引用完整性
   - 级联删除和更新策略

## 性能优化

### 索引策略

1. **主键索引：** 所有表都有UUID主键索引
2. **唯一索引：** 用户手机号、用户资料关联等
3. **外键索引：** 自动为外键创建索引
4. **查询优化索引：** 根据业务查询模式优化

### 存储统计

- **总存储使用：** 约 400+ kB
- **最大表：** user_profiles (128 kB)
- **活跃数据：** 主要集中在用户相关表
- **数据增长：** 随用户注册和活动增长

## 业务功能支持

### 1. 用户管理系统
- 手机号注册登录
- 用户资料管理
- 订阅级别管理
- 管理员权限控制

### 2. 教练系统
- 教练认证申请
- 专业领域管理
- 费率设置
- 状态审核

### 3. 训练系统
- 个性化训练计划
- 练习库管理
- 难度分级
- 进度跟踪

### 4. 社区功能
- 引体向上排行榜
- 视频分享
- 教练反馈
- 成绩审核

### 5. 抽奖系统
- 用户抽奖状态
- 中奖快递信息
- 物流跟踪
- 状态管理

## 扩展建议

### 短期优化
1. 添加更多业务索引
2. 实现数据归档策略
3. 优化查询性能
4. 增强数据验证

### 长期规划
1. 考虑分表分库策略
2. 实现读写分离
3. 添加缓存层
4. 数据分析和报表功能

---

*文档生成时间：2025年1月*
*数据库版本：PostgreSQL with Supabase*
*最后更新：基于当前数据库结构分析*