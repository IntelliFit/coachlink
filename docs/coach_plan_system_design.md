# 教练计划系统设计文档

## 概述

教练计划系统采用**模板-实例（Template-Instance）**设计模式，由三个核心表组成，实现了训练计划的可复用性和个性化定制。

**核心设计理念：**
- 📚 **模板库**：教练创建可复用的训练计划模板
- 🏷️ **标签系统**：通过标签对模板进行分类和检索
- 📋 **计划实例**：从模板生成给具体学员的个性化训练计划

---

## 表结构详解

### 1️⃣ coach_plan_templates（教练计划模板表）

**用途：** 教练创建的**可复用训练计划模板**

**核心字段：**

```sql
CREATE TABLE coach_plan_templates (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id            uuid NOT NULL,              -- 所属教练
    name                text NOT NULL,              -- 模板名称
    description         text,                       -- 模板描述
    type                text NOT NULL,              -- 计划类型（如 'strength', 'endurance'）
    
    -- 训练周期配置
    training_days       jsonb[] NOT NULL,           -- ⭐ 核心字段：训练天数详情
    training_days_count smallint,                   -- 训练天数（type='training'）
    rest_days_count     smallint,                   -- 休息天数（type='rest'）
    
    -- 分类和适用性
    tags                text[],                     -- 标签数组（如 ['力量训练', '耐力训练']）
    suitable_for        text,                       -- 适合人群（如 '中级学员'）
    
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);
```

**training_days 字段结构（JSONB 数组）：**

```json
[
  {
    "day_index": 1,
    "type": "training",           // 'training' 或 'rest'
    "note": "注意事项",
    "action_sets": [              // 动作组列表
      {
        "action_id": "uuid",      // 动作ID（来自 coach_actions）
        "set_name": "组名",
        "sets": 3,                // 组数
        "reps": 10,               // 次数
        "rest_seconds": 60,       // 组间休息时间（秒）
        "intensity": null         // 强度（可选）
      }
    ]
  },
  {
    "day_index": 2,
    "type": "rest",               // 休息日
    "note": null,
    "action_sets": []
  }
]
```

**实际数据示例：**

```json
{
  "id": "a9380a15-1203-45ed-8cd6-159c8a310170",
  "coach_id": "f9eac5b1-45f9-4479-9ab8-8223a5db8835",
  "name": "测试训练计划",
  "description": "测试训练计划",
  "type": "strength",
  "training_days_count": 2,
  "rest_days_count": 12,
  "tags": ["力量训练", "耐力训练"],
  "suitable_for": "中级学员"
}
```

**使用场景：**
1. 教练在「计划库」中创建模板
2. 模板可以被多次使用，分配给不同学员
3. 修改模板不影响已生成的实例

---

### 2️⃣ coach_plan_template_tags（模板标签表）

**用途：** 统一管理训练计划的标签分类

**核心字段：**

```sql
CREATE TABLE coach_plan_template_tags (
    id          integer PRIMARY KEY,           -- 自增主键
    name        varchar NOT NULL UNIQUE,       -- 标签名称（唯一）
    description text,                          -- 标签描述
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);
```

**设计特点：**
- ✅ **统一标签**：避免标签命名不一致（如"力量训练"和"力量"）
- ✅ **便于检索**：前端可以展示所有可用标签供选择
- ✅ **标签复用**：多个模板可以共享相同的标签

**常见标签示例：**
```json
[
  { "id": 1, "name": "力量训练", "description": "增强肌肉力量" },
  { "id": 2, "name": "耐力训练", "description": "提升心肺耐力" },
  { "id": 3, "name": "减脂", "description": "燃烧脂肪，降低体脂率" },
  { "id": 4, "name": "增肌", "description": "增加肌肉量" },
  { "id": 5, "name": "功能性训练", "description": "提升日常生活运动能力" }
]
```

**使用场景：**
1. 管理员或教练预先定义标签
2. 教练创建模板时从标签列表中选择
3. 学员筛选计划时通过标签过滤

**注意：** 当前 `coach_plan_templates.tags` 是 `text[]` 数组，存储标签名称而非ID。未来可以优化为关联表设计。

---

### 3️⃣ coach_plan_instances（教练计划实例表）

**用途：** 从模板生成的**学员专属训练计划实例**

**核心字段：**

```sql
CREATE TABLE coach_plan_instances (
    id                      uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    
    -- 关联关系
    coach_plan_template_id  uuid REFERENCES coach_plan_templates(id),  -- 来源模板
    coach_subscription_id   uuid REFERENCES coach_subscriptions(id),   -- 关联订阅
    student_id              uuid,                                      -- 学员ID
    coach_id                uuid,                                      -- 教练ID
    
    -- 实例信息
    name                    varchar NOT NULL,        -- 实例名称（可修改）
    description             text,                    -- 实例描述（可修改）
    training_days           jsonb NOT NULL,          -- ⭐ 训练天数（从模板复制，可修改）
    
    -- 执行状态
    status                  varchar DEFAULT 'active', -- draft/active/paused/completed/archived
    start_date              date,                     -- 开始日期
    end_date                date,                     -- 结束日期
    
    -- 继承自模板（可修改）
    type                    text,
    tags                    text[],
    suitable_for            text,
    
    created_at              timestamptz DEFAULT CURRENT_TIMESTAMP,
    updated_at              timestamptz DEFAULT CURRENT_TIMESTAMP
);
```

**training_days 字段结构（与模板相同，但可独立修改）：**

```json
[
  {
    "day_index": 1,
    "type": "training",
    "note": "第一天：上肢力量",
    "action_sets": [
      {
        "action_id": "8ba5218c-6b3e-47c0-a7b6-4354076de03c",
        "set_name": "热身组",
        "sets": 3,
        "reps": 10,
        "rest_seconds": 60,
        "intensity": null
      }
    ]
  }
]
```

**实际数据示例：**

```json
{
  "id": "da3e1f04-a97b-410f-9d24-b7ee0a0cca22",
  "coach_plan_template_id": "a9380a15-1203-45ed-8cd6-159c8a310170",
  "student_id": "05f52245-50fc-443f-8bca-e1a8aabbc6d3",
  "coach_id": "87eec87c-aa2f-46bb-8208-4b54e261e492",
  "coach_subscription_id": "4342b4a5-d3c3-44a2-a2d9-19359b834216",
  "name": "锦恢的训练计划",
  "description": "测试内容 ing",
  "status": "active",
  "type": "strength",
  "tags": ["力量训练", "耐力训练"],
  "suitable_for": "高级学员"
}
```

**状态流转：**
```
draft（草稿） → active（进行中） → paused（暂停） → completed（已完成）
                                    ↓
                                archived（已归档）
```

---

## 三表关系图

```
┌─────────────────────────────┐
│ coach_plan_template_tags    │
│ (标签表)                     │
│ - id (PK)                   │
│ - name (UNIQUE)             │
│ - description               │
└─────────────────────────────┘
          ↓ (tags 数组引用)
          
┌─────────────────────────────┐
│ coach_plan_templates        │
│ (模板表)                     │
│ - id (PK)                   │
│ - coach_id                  │
│ - name                      │
│ - training_days (jsonb[])   │ ←─────── 📚 可复用模板
│ - tags (text[])             │
│ - suitable_for              │
└─────────────────────────────┘
          ↓ (1:N 关系)
          │ FK: coach_plan_template_id
          
┌─────────────────────────────┐
│ coach_plan_instances        │
│ (实例表)                     │
│ - id (PK)                   │
│ - coach_plan_template_id    │ ←─────── 可选：可以从模板创建
│ - coach_subscription_id     │ ←─────── 必须：关联订阅
│ - student_id                │
│ - coach_id                  │
│ - training_days (jsonb)     │ ←─────── 📋 独立副本，可修改
│ - status                    │
└─────────────────────────────┘
          ↓ (执行层)
          
┌─────────────────────────────┐
│ training_records            │
│ (训练执行记录)               │
│ - user_id                   │
│ - plan_id                   │
│ - exercises (jsonb)         │
└─────────────────────────────┘
```

---

## 工作流程详解

### 阶段 1：教练创建模板

```
教练端 → 计划库 → 创建新模板
         ↓
1. 填写基本信息（名称、描述、类型）
2. 选择标签（从 coach_plan_template_tags）
3. 设置适合人群
4. 设计训练天数：
   - 每天设置为「训练」或「休息」
   - 为训练日添加动作组
   - 设置组数、次数、休息时间
         ↓
保存到 coach_plan_templates
```

**API：** `POST /api/plan-lib/add-template`

```typescript
// 请求数据
{
  "name": "力量增肌计划",
  "description": "为中级学员设计的4周力量增肌计划",
  "tags": ["力量训练", "增肌"],
  "suitableFor": "中级学员",
  "trainingDays": [
    {
      "day_index": 1,
      "type": "training",
      "note": "上肢推",
      "action_sets": [
        {
          "action_id": "xxx",
          "sets": 4,
          "reps": 8,
          "rest_seconds": 90
        }
      ]
    },
    // ... 更多天
  ]
}
```

---

### 阶段 2：从模板创建实例

```
教练端 → 学员管理 → 选择学员 → 创建训练计划
         ↓
1. 选择现有模板（可选）
2. 复制模板的 training_days 到实例
3. 可以修改：
   - 计划名称（个性化，如"张三的增肌计划"）
   - 训练天数（增删改动作）
   - 适合人群、标签
4. 设置开始/结束日期
5. 关联订阅（coach_subscription_id）
         ↓
保存到 coach_plan_instances
```

**API：** `POST /api/plan-lib/create-instance`

```typescript
// 请求数据
{
  "templateId": "a9380a15-1203-45ed-8cd6-159c8a310170",  // 可选
  "subscriptionId": "4342b4a5-d3c3-44a2-a2d9-19359b834216",
  "name": "锦恢的训练计划",
  "description": "根据锦恢的情况定制",
  "trainingDays": [
    // 从模板复制，可以修改
  ],
  "startDate": "2025-12-05",
  "status": "active"
}
```

---

### 阶段 3：学员执行训练

```
学员端 → 我的训练计划 → 查看今日训练
         ↓
1. 从 coach_plan_instances 获取计划
2. 根据 start_date 和 day_index 计算今日训练
3. 展示今日的 action_sets
4. 学员完成训练后记录到 training_records
         ↓
训练完成，生成训练记录
```

---

## 核心设计优势

### ✅ 1. 模板复用

**场景：** 教练为10个学员创建相似的训练计划

**传统方式（无模板）：**
- ❌ 需要为每个学员重新设计计划
- ❌ 修改计划需要逐个更新
- ❌ 无法积累和分享优质计划

**模板方式：**
- ✅ 创建1个模板，生成10个实例
- ✅ 每个实例可以独立调整
- ✅ 模板可以持续优化和复用

---

### ✅ 2. 数据独立性

**关键设计：** `coach_plan_instances.training_days` 是模板的**深拷贝**

```
模板修改 ❌ 不影响 → 已生成的实例
实例修改 ❌ 不影响 → 原模板
```

**好处：**
- 教练可以放心优化模板，不影响进行中的训练
- 为学员定制化调整计划，不影响模板
- 历史数据完整保留

---

### ✅ 3. 灵活性

**支持三种创建方式：**

1. **从模板创建** - 复制模板的 `training_days`
   ```typescript
   templateId: "xxx"  // 指定模板ID
   ```

2. **空白创建** - 从零开始设计
   ```typescript
   templateId: null,
   trainingDays: []  // 手动设计
   ```

3. **混合方式** - 基于模板修改
   ```typescript
   templateId: "xxx",
   trainingDays: [...] // 修改后的数据
   ```

---

## 标签系统设计

### 标签的两种存储方式

**方式 1：当前实现（简单）**
```sql
-- coach_plan_templates.tags 存储标签名称
tags: ["力量训练", "耐力训练"]
```

**优点：**
- ✅ 实现简单，查询方便
- ✅ 无需 JOIN 查询

**缺点：**
- ❌ 可能出现标签不一致（如"力量训练" vs "力量"）
- ❌ 修改标签名称需要更新所有记录

**方式 2：规范化设计（未来优化）**
```sql
-- 创建关联表
CREATE TABLE coach_plan_template_tag_relations (
    template_id uuid REFERENCES coach_plan_templates(id),
    tag_id      integer REFERENCES coach_plan_template_tags(id),
    PRIMARY KEY (template_id, tag_id)
);
```

**优点：**
- ✅ 标签统一管理
- ✅ 修改标签名称只需更新一处

**缺点：**
- ❌ 需要额外的 JOIN 查询

---

## 数据流转全流程

### 完整流程图

```
┌─────────────────────────────────────────────────────────────┐
│ 第一步：教练创建模板（可复用）                                │
└─────────────────────────────────────────────────────────────┘
                         ↓
        ┌────────────────────────────────┐
        │ coach_plan_templates           │
        │ id: template-001               │
        │ name: "4周力量增肌计划"        │
        │ training_days: [               │
        │   {day_index: 1, type: training, action_sets: [...]} │
        │   {day_index: 2, type: rest}   │
        │   ...                          │
        │ ]                              │
        └────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 第二步：为学员A创建实例（基于模板，可修改）                   │
└─────────────────────────────────────────────────────────────┘
                         ↓
        ┌────────────────────────────────┐
        │ coach_plan_instances           │
        │ id: instance-001               │
        │ coach_plan_template_id: template-001  │ ← 引用模板
        │ student_id: 学员A              │
        │ name: "张三的增肌计划"         │
        │ training_days: [               │ ← 深拷贝，可独立修改
        │   {day_index: 1, type: training, action_sets: [...]} │
        │   {day_index: 2, type: rest}   │
        │ ]                              │
        │ status: active                 │
        └────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 第三步：学员执行训练                                          │
└─────────────────────────────────────────────────────────────┘
                         ↓
        ┌────────────────────────────────┐
        │ training_records               │
        │ id: record-001                 │
        │ user_id: 学员A                 │
        │ plan_id: instance-001          │ ← 关联实例
        │ training_date: 2025-12-05      │
        │ exercises: [...]               │ ← 记录实际执行
        │ status: completed              │
        └────────────────────────────────┘
                         ↓
        ┌────────────────────────────────┐
        │ set_videos                     │
        │ training_record_id: record-001 │
        │ video_url: xxx                 │
        └────────────────────────────────┘
```

---

## 关键设计决策

### 1. 为什么需要模板表？

**问题：** 没有模板时，教练需要为每个学员重新设计计划

**解决方案：**
- 📚 创建模板库，积累优质训练计划
- 🔄 一次设计，多次使用
- 📈 随时间优化和迭代模板

---

### 2. 为什么需要实例表？

**问题：** 直接使用模板会导致：
- ❌ 无法为学员定制化调整
- ❌ 学员的进度无法独立跟踪
- ❌ 修改模板会影响所有学员

**解决方案：**
- 📋 每个学员有独立的实例
- ✏️ 可以基于学员情况调整
- 🔒 实例与模板解耦

---

### 3. 为什么 training_days 使用 JSONB？

**优点：**
- ✅ **灵活性**：可以存储任意结构的训练数据
- ✅ **完整性**：包含动作、组数、次数、休息时间等所有信息
- ✅ **扩展性**：未来可以添加新字段而不修改表结构
- ✅ **查询能力**：PostgreSQL 的 JSONB 支持高效查询和索引

**缺点：**
- ❌ 复杂查询需要使用 JSONB 操作符
- ❌ 数据验证需要在应用层完成

**为什么不用关联表？**
```sql
-- 如果用关联表设计：
CREATE TABLE template_day_details (
    id           uuid PRIMARY KEY,
    template_id  uuid REFERENCES coach_plan_templates(id),
    day_index    integer,
    type         text
);

CREATE TABLE template_day_action_sets (
    id           uuid PRIMARY KEY,
    day_id       uuid REFERENCES template_day_details(id),
    action_id    uuid,
    sets         integer,
    reps         integer
);
```

**问题：**
- ❌ 需要多次 JOIN 查询，性能较差
- ❌ 从模板创建实例时需要复制多个表
- ❌ 结构过于复杂，维护成本高

---

## 常见使用场景

### 场景 1：教练创建模板库

```typescript
// 1. 创建标签（如果不存在）
await supabase.from('coach_plan_template_tags').insert([
  { name: '力量训练' },
  { name: '增肌' }
]);

// 2. 创建模板
await supabase.from('coach_plan_templates').insert({
  coach_id: 'coach-001',
  name: '4周力量增肌计划',
  type: 'strength',
  tags: ['力量训练', '增肌'],
  suitable_for: '中级学员',
  training_days: [
    { day_index: 1, type: 'training', action_sets: [...] },
    { day_index: 2, type: 'rest', action_sets: [] },
    // ...
  ]
});
```

---

### 场景 2：为学员分配训练计划

```typescript
// 1. 获取模板
const { data: template } = await supabase
  .from('coach_plan_templates')
  .select('*')
  .eq('id', 'template-001')
  .single();

// 2. 创建实例（深拷贝 training_days）
const { data: instance } = await supabase
  .from('coach_plan_instances')
  .insert({
    coach_plan_template_id: template.id,
    coach_subscription_id: 'subscription-001',
    student_id: 'student-001',
    coach_id: 'coach-001',
    name: `${studentName}的训练计划`,
    training_days: template.training_days,  // 深拷贝
    status: 'active',
    start_date: '2025-12-05'
  });
```

---

### 场景 3：学员查看今日训练

```typescript
// 1. 获取学员的计划实例
const { data: instance } = await supabase
  .from('coach_plan_instances')
  .select('*')
  .eq('student_id', 'student-001')
  .eq('status', 'active')
  .single();

// 2. 计算今日是第几天
const startDate = new Date(instance.start_date);
const today = new Date();
const daysPassed = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
const currentDayIndex = (daysPassed % instance.training_days.length) + 1;

// 3. 获取今日训练内容
const todayTraining = instance.training_days.find(
  day => day.day_index === currentDayIndex
);

// 4. 展示给学员
if (todayTraining.type === 'training') {
  // 展示动作列表
  todayTraining.action_sets.forEach(set => {
    console.log(`${set.set_name}: ${set.sets}组 x ${set.reps}次`);
  });
} else {
  console.log('今天是休息日');
}
```

---

### 场景 4：教练调整学员计划

```typescript
// 1. 获取实例
const { data: instance } = await supabase
  .from('coach_plan_instances')
  .select('*')
  .eq('id', 'instance-001')
  .single();

// 2. 修改 training_days
const updatedDays = instance.training_days.map(day => {
  if (day.day_index === 3) {
    // 为第3天增加一个动作
    return {
      ...day,
      action_sets: [
        ...day.action_sets,
        { action_id: 'new-action', sets: 3, reps: 12, rest_seconds: 60 }
      ]
    };
  }
  return day;
});

// 3. 更新实例
await supabase
  .from('coach_plan_instances')
  .update({ 
    training_days: updatedDays,
    updated_at: new Date().toISOString()
  })
  .eq('id', 'instance-001');
```

**重要：** 这个修改**不会影响**原模板，也不会影响其他学员的实例。

---

## 表关系总结

### 外键关系

```
coach_plan_templates
    ├─ coach_id (无 FK，需添加 → coaches.id)
    └─ 被引用：coach_plan_instances.coach_plan_template_id

coach_plan_template_tags
    └─ 被引用：coach_plan_templates.tags (text[] 软引用)

coach_plan_instances
    ├─ coach_plan_template_id → coach_plan_templates.id ✅
    ├─ coach_subscription_id → coach_subscriptions.id ✅
    ├─ student_id (无 FK，需添加 → users.id)
    └─ coach_id (无 FK，需添加 → coaches.id)
```

---

## 查询示例

### 查询 1：获取教练的所有模板

```sql
SELECT 
    t.*,
    array_length(t.training_days, 1) as total_days
FROM coach_plan_templates t
WHERE t.coach_id = 'coach-001'
ORDER BY t.created_at DESC;
```

---

### 查询 2：获取学员的当前训练计划

```sql
SELECT 
    i.*,
    c.name as coach_name,
    t.name as template_name
FROM coach_plan_instances i
LEFT JOIN coaches c ON i.coach_id = c.id
LEFT JOIN coach_plan_templates t ON i.coach_plan_template_id = t.id
WHERE i.student_id = 'student-001'
    AND i.status = 'active';
```

---

### 查询 3：按标签筛选模板

```sql
SELECT *
FROM coach_plan_templates
WHERE tags @> ARRAY['力量训练']  -- 包含"力量训练"标签
    AND suitable_for = '中级学员';
```

---

### 查询 4：统计模板使用情况

```sql
SELECT 
    t.id,
    t.name,
    COUNT(i.id) as instance_count,
    COUNT(DISTINCT i.student_id) as student_count
FROM coach_plan_templates t
LEFT JOIN coach_plan_instances i ON t.id = i.coach_plan_template_id
WHERE t.coach_id = 'coach-001'
GROUP BY t.id, t.name
ORDER BY instance_count DESC;
```

---

## 数据一致性建议

### 当前缺失的约束

```sql
-- 1. 添加外键约束
ALTER TABLE coach_plan_templates
    ADD CONSTRAINT fk_coach_plan_templates_coach_id 
    FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE;

ALTER TABLE coach_plan_instances
    ADD CONSTRAINT fk_coach_plan_instances_student_id 
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE coach_plan_instances
    ADD CONSTRAINT fk_coach_plan_instances_coach_id 
    FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE;

-- 2. 添加索引
CREATE INDEX idx_coach_plan_templates_coach_id ON coach_plan_templates(coach_id);
CREATE INDEX idx_coach_plan_templates_type ON coach_plan_templates(type);

CREATE INDEX idx_coach_plan_instances_student_id ON coach_plan_instances(student_id);
CREATE INDEX idx_coach_plan_instances_coach_id ON coach_plan_instances(coach_id);
CREATE INDEX idx_coach_plan_instances_status ON coach_plan_instances(status);
CREATE INDEX idx_coach_plan_instances_subscription_id ON coach_plan_instances(coach_subscription_id);

-- 3. 添加唯一约束（避免重复）
CREATE UNIQUE INDEX unique_active_plan_per_subscription 
    ON coach_plan_instances(coach_subscription_id) 
    WHERE status = 'active';
```

---

## 与旧系统的对比

### 旧系统：training_plans + training_plan_details

```
training_plans (学员计划)
    ↓
training_plan_details (计划详情)
```

**问题：**
- ❌ 每次都要为学员设计新计划
- ❌ 无法复用优质计划
- ❌ 教练的经验无法积累

---

### 新系统：coach_plan_templates + coach_plan_instances

```
coach_plan_templates (教练模板库)
    ↓
coach_plan_instances (学员实例)
    ↓
training_records (执行记录)
```

**优势：**
- ✅ 模板可复用
- ✅ 实例可定制
- ✅ 数据独立，互不影响

---

## 未来优化方向

### 1. 版本控制

为模板添加版本管理：

```sql
ALTER TABLE coach_plan_templates
    ADD COLUMN version integer DEFAULT 1;

-- 创建版本历史表
CREATE TABLE coach_plan_template_versions (
    id           uuid PRIMARY KEY,
    template_id  uuid REFERENCES coach_plan_templates(id),
    version      integer,
    training_days jsonb,
    created_at   timestamptz DEFAULT now()
);
```

---

### 2. 智能推荐

基于学员特征推荐模板：

```sql
-- 根据学员档案推荐
SELECT t.*
FROM coach_plan_templates t
JOIN user_profiles p ON p.user_id = 'student-001'
WHERE t.suitable_for = p.fitness_level
    AND t.tags && p.fitness_goal  -- 标签匹配
ORDER BY t.rating DESC;
```

---

### 3. 模板评分系统

```sql
ALTER TABLE coach_plan_templates
    ADD COLUMN rating numeric DEFAULT 0,
    ADD COLUMN usage_count integer DEFAULT 0,
    ADD COLUMN success_rate numeric DEFAULT 0;

-- 基于实例的完成情况更新模板评分
UPDATE coach_plan_templates t
SET 
    rating = (
        SELECT AVG(
            CASE 
                WHEN i.status = 'completed' THEN 5
                WHEN i.status = 'active' THEN 3
                ELSE 1
            END
        )
        FROM coach_plan_instances i
        WHERE i.coach_plan_template_id = t.id
    );
```

---

## 总结

### 核心概念

| 表名 | 角色 | 数据特点 | 修改影响 |
|------|------|----------|----------|
| `coach_plan_templates` | 📚 **模板库** | 可复用、通用 | 不影响已生成的实例 |
| `coach_plan_template_tags` | 🏷️ **标签库** | 统一管理 | 便于分类检索 |
| `coach_plan_instances` | 📋 **学员计划** | 个性化、独立 | 只影响该学员 |

### 关键设计原则

1. **模板-实例分离**：模板可复用，实例可定制
2. **数据独立性**：实例是模板的深拷贝，互不影响
3. **JSONB 存储**：灵活存储复杂的训练天数数据
4. **关联订阅**：通过 `coach_subscription_id` 将计划与付费关联

### 典型工作流

```
教练创建模板 → 从模板生成实例 → 学员执行训练 → 记录到 training_records
     ↓              ↓                  ↓
  可复用         可修改             可追踪
```

这个设计实现了**效率**（模板复用）和**灵活性**（实例定制）的完美平衡！🎯









