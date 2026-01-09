# 通用计划体系扩展实现方案 (V2 - Polymorphic)

> **状态**: 已确认 **更新日期**: 2026-01-07 **决策**: 放弃嵌套 Modules
> 结构，采用 **"扁平化多态列表 (Polymorphic Flat List)"**
> 方案，以最小化改动成本并最大化灵活性。

---

## 一、核心变更设计

### 1.1 从 "结构化分组" 到 "逻辑分组"

我们不再引入物理的 `Module` 嵌套层级，而是保持 `training_days` 为一个扁平的 Item
列表。 通过给 Item 增加 `group_title` 字段来实现视觉和逻辑上的分组。

**对比:**

- **Old**: `Top Level -> [Module A -> [Item 1, Item 2], Module B -> [Item 3]]`
- **New**: `Top Level -> [Item 1 (Group=A), Item 2 (Group=A), Item 3 (Group=B)]`

### 1.2 支持多种类型 (Polymorphic Items)

列表中的每一项 (Item) 现在可以是不同的类型：

- **STRENGTH** (默认): 传统的动作+组数+次数。
- **DIET**: 饮食建议，包含内容描述、热量、图片。
- **CARDIO**: 有氧训练，包含距离、时长、配速。
- **HABIT**: 习惯打卡，简单的完成状态或时长。

---

## 二、数据库设计 (扩展)

仅需在现有表上**新增列**，完全兼容旧数据。

### 2.1 `coach_actions` / `student_actions`

```sql
-- 区分动作类型
ALTER TABLE coach_actions ADD COLUMN type TEXT NOT NULL DEFAULT 'STRENGTH';

-- 存储类型特定的默认配置 (Schema)
-- e.g., DIET: { default_unit: 'kcal' }, CARDIO: { default_sport: 'running' }
ALTER TABLE coach_actions ADD COLUMN item_schema JSONB;

-- 建议执行时间 (e.g. '08:00', 'Morning')
ALTER TABLE coach_actions ADD COLUMN suggested_time TEXT;
```

### 2.2 `coach_plan_templates` (JSON字段定义)

`training_days` 内部的 `action_sets` (或称 `items`) 数组元素结构更新：

```typescript
{
  // --- 通用字段 ---
  "action_id": "uuid",       // 关联 coach_actions
  "group_title": "热身环节",  // [NEW] 逻辑分组标题
  "note": "注意动作标准",
  
  // --- 力量字段 (STRENGTH) ---
  "sets": 3,
  "reps": 10,
  "weight": 50,
  "intensity": "RPE 8",

  // --- 饮食字段 (DIET) ---
  // 当 type=DIET 时有效，且 sets/reps 为空或忽略
  "custom_data": {
    "content": "两片全麦面包 + 一个煎蛋",
    "calories": 350,
    "image_url": "..."
  },

  // --- 有氧字段 (CARDIO) ---
  "custom_data": {
    "distance": 5000, // meters
    "duration": 1800  // seconds
  }
}
```

---

## 三、前端交互设计

### 3.1 计划编辑器 (Coach Side)

1. **Add Menu**:
   - 点击添加按钮时，弹出下拉菜单选择类型: `Strength`, `Diet`, `Cardio`。
2. **Group Divider**:
   - 编辑器会自动检测列表中相邻 Item 的 `group_title`。
   - 如果发现变化，在两行之间渲染一个“分割线/标题栏”。
   - 支持直接在分割线上修改 `group_title`，这会批量更新该组下的所有 Item。
3. **Dynamic Form**:
   - 对于 `STRENGTH` 项，保留现有的“组/次/重”横排输入。
   - 对于 `DIET` 项，显示较大的文本域 (Textarea)
     用于输入食谱，以及图片上传控件。

### 3.2 学员执行页 (Student Side)

1. **Section List**:
   - 页面按 `group_title` 渲染为多个 Section (e.g., "早餐", "力量训练", "有氧").
2. **Interaction**:
   - `STRENGTH`: 维持现状，输入实际重量/次数。
   - `DIET`: 显示食谱内容 -> 提供 Checkbox 打卡 -> 提供 "上传餐食照片" 按钮。
   - `CARDIO`: 显示目标距离/时长 -> 提供实际数据的输入框。

---

## 四、实施计划

详见 `implementation_plan.md`。

1. **Database**: 执行 SQL Migration 添加字段。
2. **API**: 更新 `action-lib` 和 plan 保存逻辑，放宽校验。
3. **Frontend**: 改造编辑器和执行视图，支持 `group_title` 分组渲染和多态 Item
   渲染。
