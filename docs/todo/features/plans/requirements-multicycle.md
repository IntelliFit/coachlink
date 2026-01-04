# [需求] 多周期计划管理与续费逻辑改造方案

## 1. 背景与核心问题

目前系统采用“订阅（商业期限）”与“计划（内容交付）”强耦合的默认假设，但在实际业务中存在
mismatched 的情况：

1. **时长不匹配**：学员订阅 4 个月，但教练模版库仅有 2 个月的标准计划。
2. **续费衔接**：学员执行完 1 个月计划后续费，系统如何处理后续计划的生成与衔接。
3. **数据结构隐患**：若强行延长单一计划实例（Instance）到 50+ 周，会导致 JSONB
   数据过大，且无法体现“周期化训练（Periodization）”的阶段性目标。

## 2. 核心设计理念：多实例（Multi-Instance）模式

**核心原则：** 订阅（Subscription）是入场券，计划（Plan Instance）是演出场次。
**结论：** 严禁修改历史计划的 `training_days`
来“续命”。必须通过创建**新的计划实例**来覆盖新的订阅周期。

### 数据库模型调整（无需改表结构，仅规范字段用途）

基于现有 `coach_plan_instances` 表：

- **`status` 状态流转明确化**：
  - `active`: 当前正在执行的计划（**同一时间同一学员只能有一个 active 计划**）。
  - `completed`: 正常结束的计划。
  - `archived`: 被中途废弃或被新计划覆盖的旧计划。
  - `scheduled`: (建议新增) 已分配但尚未开始的未来计划（用于队列机制）。

### 2.1 统一执行模型

无论是“教练指派”还是“学员自制”，最终的执行实体都统一存储在
`coach_plan_instances` 表中。

- **差异化标识**：
  - `source` 字段：`'coach'` (教练指派) vs `'student'` (学员自制/收藏)。
  - `coach_id`: 教练指派时为非空；学员自制时为 NULL。
  - `coach_subscription_id`: 教练指派时必须关联订阅；学员自制时为 NULL。

### 2.2 学员自制模版库 (`student_plan_favorites`)

学员不想每次都从零创建，因此需要一个“个人模版库”。

- 对应表：`student_plan_favorites` (已存在)。
- 作用：存储学员自己编排的常用计划（如“我的假期维持计划”、“出差徒手训练”）。
- 流程：`Save as Favorite` -> `Create Instance from Favorite`.

### 2.3 自主训练模式 (Self-Service)

学员可以独立于教练，创建、执行和管理自己的训练计划。这些计划同样以
`coach_plan_instances` 的形式存在，但通过 `source='student'` 标识。

## 3. 详细业务流程设计

### 场景一：订阅时长 > 计划时长（短计划长订阅）

**案例**：订阅 4 个月，分配了 2 个月的“基础力量模版”。

1. **初始分配**：
   - 创建 `Instance A` (2个月)。
   - `start_date` = Today。
   - `status` = `active`。

2. **自动监控与预警**：
   - 后端定时任务（Cron）或登录触发检查：
     - 若 `Instance A` 进度 > 90% 或 剩余天数 < 7天。
     - **触发系统通知（Notify Coach）**：“学员 [Name]
       的计划即将结束，订阅有效期还剩 2 个月，请分配下一阶段计划。”

3. **衔接处理（队列机制）**：
   - 教练收到通知后，分配 `Template B` (进阶计划)。
   - 创建 `Instance B`：
     - `start_date` = `Instance A.end_date + 1 day`。
     - `status` = `scheduled` (待执行)。
   - **前端展示**：学员端可以看到“当前计划（Instance A）”和“下阶段预告（Instance
     B）”。

### 场景二：计划执行完毕与续费（Renewal）

**案例**：学员 1 个月计划执行完毕，续费 2 个月。

1. **续费触发**：
   - 学员支付成功 -> 更新 `coach_subscriptions.end_date`。
   - **触发系统事件**：`SUBSCRIPTION_RENEWED`。

2. **智能处理策略（二选一）**：
   - **策略 A（人工主导，推荐私教）**：
     - 系统给教练生成一条“待办任务”：学员已续费，请评估上个周期表现并分配新计划。
     - 教练查看 `Instance A` 的完成率和 PR 数据，决定是重复
       `Template A`（未达标）还是 进阶到 `Template B`。
   - **策略 B（自动衔接，推荐标准化服务）**：
     - 检查 `Template A` 是否配置了 `next_phase_template_id`。
     - 若有，自动生成 `Instance B` 并激活。

3. **数据存档**：
   - `Instance A` 的状态自动变为 `completed`。
   - 前端“历史计划”页面可查看 `Instance A` 的完整记录。

### 场景三：学员自主制定与切换 (Self-Service)

**案例**：学员暂停了私教课，或者想在私教计划外执行一个自己的“假期特训”。

1. **创建模版 (可选)**：
   - 学员在“我的计划库”中创建一个新计划“三亚度假徒手训练”。
   - 保存到 `student_plan_favorites`。

2. **开启计划 (Activation)**：
   - 学员点击 [开始执行]。
   - **冲突检测**：系统检测到当前有 `active` 的教练计划 `Instance A`。
   - **弹窗提示**：“开启新计划将归档当前正在进行的计划，是否继续？”
   - **确认后**：
     - `Instance A` -> `archived` (或 `completed`，视进度而定)。
     - 创建 `Instance B` (Source='student', Name='三亚度假徒手训练') ->
       `active`。

3. **执行与记录**：
   - 首页“今日训练”自动渲染 `Instance B` 的内容。
   - 所有训练记录 (`plan_instance_executions`) 正常关联到 `Instance B`。

4. **恢复教练计划**：
   - 度假结束，学员想回到教练计划。
   - 需联系教练重新分配（或从历史归档中“恢复/Clone”一个新的 Instance）。
   - **注意**：通常建议由教练重新评估后下发新计划，而不是简单恢复旧计划。

## 4. 功能模块改造需求

### A. 后端 API 改造

#### 1. 计划获取接口 (`GET /api/student/plan/current`)

- **逻辑变更**：
  - 不再只按 ID 获取，而是获取 `student_id` 下 `status = 'active'` 的实例。
  - 若存在 `status = 'scheduled'` 且 `start_date <= Today`
    的计划，自动将旧计划设为 `completed`，新计划设为
    `active`（懒加载触发状态流转）。
- **前端适配**：
  - 返回单一 Instance 对象。
  - 若无 Active 计划，返回空状态提示“等待教练分配”。

#### 2. 计划历史接口 (`GET /api/student/plan/history`)

- **逻辑**：查询所有 `status IN ('completed', 'archived')` 的记录。
- **展示**：列表展示（名称、周期、完成率）。

#### 3. 教练端仪表盘 (`Dashboard`)

- **新增模块**：“需关注学员”
  - 规则：`Current Plan Risk`
  - 条件：计划剩余 < 1周 且 订阅剩余 > 1周。
  - 操作：快捷按钮 [分配下一阶段]。

### B. 数据库字段规范

- 确保 `coach_plan_instances` 表正确使用 `start_date` 和 `end_date`。
- `training_days` JSONB 数组中必须包含 `day_index`，用于计算相对时间。
- **注意**：前端展示“最近一月”逻辑由前端根据 `current_day_index` 进行 slice
  渲染，后端依然返回完整的 active instance JSON（除非过大，后续考虑分页加载）。

## 5. 迁移与兼容性

- **存量数据处理**：
  - 扫描现有所有 `training_plans` (旧表) 数据，如果我们在用新表，确保老用户的
    Plan 被迁移为一个 `active` 的 `coach_plan_instances`。
- **并行期**：
  - 确保 App 端升级前，API 能同时兼容（或者强制更新）。

## 6. 开发任务清单 (To-Do)

- [ ] 后端：实现 `Subscription` 续费触发通知逻辑。
- [ ] 后端：实现“计划自动归档”逻辑（基于日期的状态流转）。
- [ ] 前端（学员）：重构首页，支持根据 Status 获取计划，并增加“历史计划”入口。
- [ ] 前端（教练）：学员详情页增加“计划历史”时间轴视图。
- [ ] 文档：更新 API 文档中的 Status 定义。
