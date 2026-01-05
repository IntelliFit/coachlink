# 通用计划体系扩展实现方案 (V2)

> **状态**: 待评审 **创建日期**: 2025-12-29 **已确认**:
> 饮食项存入动作库、时间为"建议"非强制

---

## 一、核心概念变更

### 1.1 从 "Action" 到 "Item" (分阶段实施)

为了快速上线并保持扩展性，我们将采用 **"Diet First"** 策略：

1. **Phase 1 (本阶段)**: 仅支持 `STRENGTH` (力量) 和 `DIET` (饮食)。
2. **Phase 2 (未来)**: 扩展支持 `CARDIO` (有氧) 和 `HABIT` (习惯)。

| 类型标识   | 阶段   | 含义     | 典型字段                 | 示例           |
| :--------- | :----- | :------- | :----------------------- | :------------- |
| `STRENGTH` | **V1** | 力量训练 | sets, reps, weight, rpe  | 深蹲 5x5       |
| `DIET`     | **V1** | 饮食项   | content, calories, image | 早餐: 燕麦鸡蛋 |
| `CARDIO`   | Future | 有氧运动 | distance, duration       | 跑步 5km       |
| `HABIT`    | Future | 习惯打卡 | duration, boolean        | 冥想 10min     |

### 1.2 "Diet First" 核心设计思路

- **保持架构先进性**: 依然采用 `modules`
  结构（见下文），因为这是支持“混合类型”的唯一正解。如果现在为了省事把饮食硬塞进旧结构，后续加有氧时必须重构，成本更高。
- **简化数据模型**: 饮食项不追求结构化营养素（碳水/蛋白/脂），初期通过 `content`
  (文本描述) + `images` (图片) 解决。
- **复用动作库**: 饮食项也存入
  `coach_actions`，`type='DIET'`。这样教练可以建立“标准早餐模版”。

### 1.2 从 "训练日" 到 "每日模块"

现有 `training_days` 是一个扁平的动作列表。
新结构是一个**模块化**的数组，每个模块包含一类项目：

```
旧: training_days = [ {action_sets: [...]} ]
新: training_days = [ {modules: [ {type, items} ]} ]
```

---

## 二、数据库设计 (核心改造)

### 2.1 改造 `coach_actions` 表

**目的**: 将其升级为多态项目库（存储力量动作 + 饮食项 + 习惯等）

```sql
-- 1. 新增 type 字段，区分项目类型
ALTER TABLE coach_actions ADD COLUMN type TEXT NOT NULL DEFAULT 'STRENGTH';

-- 2. 新增 item_schema JSONB，存储类型特定的默认参数配置
--    例如 CARDIO 类型可能有 { defaultDistance: 5, defaultUnit: 'km' }
ALTER TABLE coach_actions ADD COLUMN item_schema JSONB;

-- 3. 新增 suggested_time TEXT，存储建议执行时间 (如 '08:00')
ALTER TABLE coach_actions ADD COLUMN suggested_time TEXT;

-- 4. 视频表关联修复 (解决同动作多模块冲突)
ALTER TABLE execution_set_videos ADD COLUMN module_id UUID;
-- 建议: 创建新索引 (execution_id, module_id, action_id, set_number)

-- 5. (可选) 重命名表以更准确表达其含义
-- ALTER TABLE coach_actions RENAME TO coach_items; -- 考虑是否破坏性太大
```

**数据迁移**: 现有所有记录的 `type` 设为 `'STRENGTH'`。

### 2.2 改造 `training_days` JSON 结构

**现有结构** (在 `coach_plan_templates` 和 `coach_plan_instances`):

```json
[
  {
    "day_index": 1,
    "type": "training",
    "action_sets": [
      { "action_id": "uuid", "sets": 3, "reps": 10 }
    ]
  }
]
```

**新结构**:

```json
[
  {
    "day_index": 1,
    "type": "training", // 保留兼容
    "modules": [
      {
        "id": "mod-uuid-1",
        "type": "STRENGTH",
        "title": "力量训练",
        "order": 1,
        "items": [
          {
            "item_id": "uuid",
            "name": "深蹲",
            "sets": 5,
            "reps": 5,
            "weight": 100,
            "suggested_time": null // 可选建议时间
          }
        ]
      },
      {
        "id": "mod-uuid-2",
        "type": "DIET",
        "title": "饮食建议",
        "order": 2,
        "items": [
          {
            "item_id": "uuid-diet",
            "name": "早餐",
            "content": "燕麦+鸡蛋+牛奶",
            "suggested_time": "08:00"
          }
        ]
      },
      {
        "id": "mod-uuid-3",
        "type": "HABIT",
        "title": "习惯打卡",
        "order": 3,
        "items": [
          {
            "name": "喝水 2L",
            "target_duration": null,
            "suggested_time": null
          }
        ]
      }
    ]
  }
]
```

### 2.3 改造 `plan_instance_executions` 执行记录

**现有 `action_executions` JSONB**:

```json
[
  { "action_id": "uuid", "sets": [{executed_reps, executed_weight}] }
]
```

**新结构 (支持多类型)**:

```json
{
  "module_executions": [
    {
      "module_id": "mod-uuid-1",
      "type": "STRENGTH",
      "item_executions": [
        { "item_id": "uuid", "sets": [{...}] }
      ]
    },
    {
      "module_id": "mod-uuid-2",
      "type": "DIET",
      "item_executions": [
        { "item_id": "uuid-diet", "completed": true, "actual_content": "燕麦+香蕉", "photo_url": "..." }
      ]
    },
    {
      "module_id": "mod-uuid-3",
      "type": "HABIT",
      "item_executions": [
        { "name": "喝水 2L", "completed": true }
      ]
    }
  ]
}
```

### 2.4 同步改造 `student_actions` 表

学员动作库也需要支持多类型，与 `coach_actions` 保持一致：

```sql
ALTER TABLE student_actions ADD COLUMN type TEXT NOT NULL DEFAULT 'STRENGTH';
ALTER TABLE student_actions ADD COLUMN item_schema JSONB;
ALTER TABLE student_actions ADD COLUMN suggested_time TEXT;
```

---

## 三、API 改造

| 接口路径                            | 改动说明                                          |
| :---------------------------------- | :------------------------------------------------ |
| `POST /api/action-lib/add-action`   | 新增 `type`, `item_schema`, `suggested_time` 参数 |
| `GET /api/action-lib/list-actions`  | 支持 `?type=DIET` 过滤                            |
| `POST /api/plan-lib/add-template`   | 校验新 JSON 结构（包含 modules）                  |
| `PUT /api/plan-lib/update-template` | 同上                                              |
| `POST /api/execution/save-progress` | 支持新的 `module_executions` 结构                 |

---

## 四、前端改造

### 4.1 计划编辑器

- **添加模块**: 新增"添加板块"下拉，选择类型（力量/饮食/习惯/有氧）
- **模块内编辑**: 根据类型渲染不同表单
  - STRENGTH: 组数/次数/RPE
  - DIET: 文本描述 + 建议时间
  - HABIT: 名称 + 建议时长
- **排序**: 支持模块间和模块内项目拖拽排序

### 4.2 学员执行页

- **今日视图**: 按模块分组显示
- **打卡交互**:
  - STRENGTH: 输入重量/次数 (现有逻辑)
  - DIET: 打勾 + 可选上传照片
  - HABIT: 简单打勾 + 可选时长输入

---

## 五、兼容性与迁移

### 5.1 向后兼容

- 新结构中 `day.type` 保留 `"training"` / `"rest"` 与现有逻辑兼容
- 如果 `modules` 字段不存在，则回退到 `action_sets` 逻辑

### 5.2 数据迁移脚本

```sql
-- 将现有 action_sets 包装为 modules
UPDATE coach_plan_templates
SET training_days = (
  SELECT jsonb_agg(
    jsonb_set(day, '{modules}',
      jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid(),
          'type', 'STRENGTH',
          'title', '力量训练',
          'order', 1,
          'items', day->'action_sets'
        )
      )
    ) - 'action_sets'
  )
  FROM jsonb_array_elements(training_days) AS day
);
```

### 5.3 智能导入功能兼容性

**受影响的功能**:

- `/api/plan-lib/parse-template` (教练端)
- `/api/student/plan-lib/parse-template` (学员端)

**当前输出结构**:

```json
{
  "trainingDays": [
    {
      "weekIndex": 1,
      "dayOfWeek": 1,
      "type": "training",
      "actions": [{ "actionId": "uuid", "sets": 4, "reps": 8 }]
    }
  ]
}
```

**新结构要求**:

```json
{
  "trainingDays": [
    {
      "day_index": 1,
      "type": "training",
      "modules": [
        { "type": "STRENGTH", "items": [{...}] }
      ]
    }
  ]
}
```

**兼容策略**:

#### 阶段 1：适配层 (Adapter) - 低风险

在 API 返回前，将 Gemini 输出的旧格式自动转换为新格式：

```typescript
// parse-template/route.ts 中添加适配逻辑
function adaptToModulesFormat(parsedResult) {
  return {
    weeks: parsedResult.weeks,
    trainingDays: parsedResult.trainingDays.map((day) => ({
      day_index: day.dayOfWeek,
      type: day.type,
      modules: day.type === "rest" ? [] : [{
        id: crypto.randomUUID(),
        type: "STRENGTH",
        title: "力量训练",
        order: 1,
        items: day.actions.map((action) => ({
          item_id: action.actionId,
          sets: action.sets,
          reps: action.reps,
          restSeconds: action.restSeconds,
          intensityConfig: action.intensityConfig,
          note: action.note,
        })),
      }],
    })),
  };
}
```

#### 阶段 2：Prompt 升级 (未来) - 支持多类型导入

当需要支持导入饮食/有氧计划时，更新 Gemini Prompt：

```
新增识别规则：
- 「早餐」「午餐」「晚餐」→ type: DIET
- 「跑步」「游泳」「骑行」+ 距离/时间 → type: CARDIO
- 「冥想」「拉伸」「冷水浴」→ type: HABIT
```

**改造顺序**:

1. ✅ 先实现适配层，确保现有力量计划导入功能正常
2. ⏳ 后续根据需求升级 Prompt 支持多类型

## 六、完整影响范围分析

### 6.1 API 层改动清单

#### 计划模板 API

| 接口                                 | 当前功能 | 改动内容           | 优先级 |
| :----------------------------------- | :------- | :----------------- | :----- |
| `POST /api/plan-lib/create-template` | 创建模板 | 支持 modules 结构  | P0     |
| `PUT /api/plan-lib/update-template`  | 更新模板 | 支持 modules 结构  | P0     |
| `GET /api/plan-lib/get-template`     | 获取模板 | 返回值兼容新旧结构 | P0     |
| `POST /api/plan-lib/copy-template`   | 复制模板 | 深拷贝 modules     | P1     |
| `GET /api/plan-lib/list-templates`   | 模板列表 | 无需改动           | -      |

#### 计划实例 API

| 接口                                    | 改动内容                | 优先级 |
| :-------------------------------------- | :---------------------- | :----- |
| `POST /api/plan-lib/create-instance`    | 从 modules 生成实例     | P0     |
| `PUT /api/plan-lib/update-instance`     | 更新实例 modules        | P0     |
| `GET /api/plan-lib/get-instance`        | 返回值兼容              | P0     |
| `GET /api/plan-lib/get-with-executions` | 解析 modules + 执行记录 | P0     |

#### AI 计划生成 API (高风险)

| 接口                                    | 改动内容                    | 优先级 |
| :-------------------------------------- | :-------------------------- | :----- |
| `POST /api/plan-lib/create-ai-instance` | 模板匹配后填充 modules      | P0     |
| `match.ts` (fillTemplate)               | 遍历 modules.items 计算 1RM | P0     |

#### 训练执行 API

| 接口                                       | 改动内容                | 优先级 |
| :----------------------------------------- | :---------------------- | :----- |
| `POST /api/execution/start`                | 从 modules 提取当日动作 | P0     |
| `PUT /api/execution/complete-set`          | 记录 module_id          | P1     |
| `GET /api/execution/get`                   | 返回 module_executions  | P0     |
| `GET /api/execution/get-next-training-day` | 解析 modules 找下一天   | P0     |
| `PUT /api/execution/finish`                | 计算 modules 完成率     | P1     |

#### 学员端 API

| 接口                                        | 改动内容          | 优先级 |
| :------------------------------------------ | :---------------- | :----- |
| `POST /api/student/plan-lib/save-favorite`  | 存储 modules 结构 | P1     |
| `POST /api/student/plan-lib/apply-favorite` | 应用 modules      | P1     |
| `POST /api/student/plan-lib/parse-template` | 适配层（已设计）  | P1     |

### 6.2 前端组件改动清单

| 组件                               | 功能             | 改动内容                 | 优先级 |
| :--------------------------------- | :--------------- | :----------------------- | :----- |
| `StudentPlanExecutionView.tsx`     | 学员执行视图     | 渲染 modules 分组        | P0     |
| `training-execution/[id]/page.tsx` | 训练执行页       | 核心改动，支持多类型打卡 | P0     |
| `today-training/page.tsx`          | 今日训练         | 解析 modules 显示        | P0     |
| `me/plan-lib/create/page.tsx`      | 学员创建计划     | 编辑器支持 modules       | P1     |
| `me/plan-lib/edit/[id]/page.tsx`   | 学员编辑计划     | 同上                     | P1     |
| `dashboard/students/plan/[id]`     | 教练查看学员计划 | 展示 modules             | P1     |
| `ExecutionDetails.tsx`             | 执行详情         | 解析 module_executions   | P1     |
| `StudentSmartImportDialog.tsx`     | 智能导入对话框   | 适配层处理               | P1     |

### 6.3 TypeScript 类型更新

```typescript
// types/plan.ts (新增或更新)

type ItemType = "STRENGTH" | "CARDIO" | "DIET" | "HABIT";

interface PlanModule {
  id: string;
  type: ItemType;
  title: string;
  order: number;
  items: PlanItem[];
}

interface PlanItem {
  item_id?: string;
  name: string;
  // STRENGTH
  sets?: number;
  reps?: number;
  weight?: number;
  intensityConfig?: IntensityConfig;
  // CARDIO
  distance?: number;
  duration?: number;
  pace?: string;
  // DIET
  content?: string;
  calories?: number;
  // HABIT
  target_duration?: number;
  // Common
  suggested_time?: string;
  note?: string;
}

interface TrainingDay {
  day_index: number;
  type: "training" | "rest";
  note?: string;
  modules: PlanModule[]; // 新结构
  action_sets?: ActionSet[]; // 旧结构（兼容）
}
```

### 6.4 核心业务逻辑改动 (高风险)

| 功能             | 文件               | 改动说明                                          |
| :--------------- | :----------------- | :------------------------------------------------ |
| **模板填充算法** | `match.ts`         | 需要遍历 `modules[].items[]` 而非 `action_sets[]` |
| **1RM 计算**     | `match.ts`         | 从 item 中获取 intensityConfig                    |
| **训练进度统计** | `execution/`       | 统计所有 modules 的 items 完成情况                |
| **视频关联**     | `execution-videos` | 需要存储 module_id + item_id                      |

---

## 七、实施阶段规划

### Phase 1: 基础设施 (1-2天)

- [ ] 数据库 ALTER TABLE 新增字段
- [ ] TypeScript 类型定义
- [ ] 数据迁移脚本（action_sets → modules）

### Phase 2: API 层 (3-4天)

- [ ] 模板 CRUD API 改造
- [ ] 实例 CRUD API 改造
- [ ] 执行 API 改造
- [ ] 智能导入适配层

### Phase 3: 前端 (3-4天)

- [ ] 计划编辑器 ModuleEditor 组件
- [ ] 训练执行页多类型渲染
- [ ] 学员端计划库适配

### Phase 4: 验证 (1-2天)

- [ ] 端到端测试
- [ ] 数据迁移验证

---

## 八、已确认事项

- [x] 饮食项是否存库 → **是，存入 coach_actions**
- [x] 时间是否强制 → **否，仅为建议时间 suggested_time**
- [x] 智能导入兼容 → **使用适配层包装**
