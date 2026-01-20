# CoachLink 业务逻辑总览（B1：按训练日 credits 消耗）

> 目标读者：新加入的工程师 / 需要排查线上异常的同事  
> 目标：把“学员订阅教练→拿到计划→执行→延期/离线→续费→线下迁移”等真实场景与系统当前实现逐条对齐，明确**字段语义**、**数据流**、**状态/口径**以及**潜在风险点**。

本文描述的是当前代码仓库中 **B1 方案**（训练日 credits 消耗模型）的实现现状。

---

## 1. 核心业务结论（给产品/研发对齐用）

### 1.1 我们到底“卖的是什么”？

- 对外口径：**4 周训练计划 / 1 个月**  
- 对内扣减：**训练日次数（training-day credits）**  

因此订阅的“到期/结束”不是按自然日倒计时，而是按“训练日 credits 被消耗完”为止。

### 1.2 订阅什么时候算“开始”？

- **订阅创建时不算开始**（学员付费≠开始训练）
- **学员第一次真正开始训练**时才开始：在 `POST /api/execution/start` 首次执行时写入 `coach_subscriptions.start_date`

### 1.3 UI 为什么还显示“剩余 X 天”？

为了用户友好：我们内部用 credits 扣减，但 UI 用“预计还需自然日”展示。

- DB 中 `coach_subscriptions.end_date` 被重新定义为：**预计完成日（estimated completion date）**
- 预计完成日来自：remainingCredits + 计划节奏（每周训练次数）的估算

### 1.4 逐周解锁是否依赖学员训练？

不依赖。逐周解锁使用 `start_execution_day` 对齐“计划进度起点”，与是否训练无关（按计划结构解锁）。

### 1.5 线下迁移怎么处理？

使用 `coach_plan_instances.start_execution_day` 表示“学员已经线下完成到哪里”，并且：

- **不插入假 execution**（不污染执行表）
- **credits 扣减会把 start_execution_day 之前的训练日视为已消耗**（线下也算训练次数）

---

## 2. 关键数据结构与字段语义

### 2.1 `coach_subscriptions`（订阅）

关键字段：

- `id`: 订阅 ID
- `student_id`: 学员 user_id
- `coach_id`: 教练 coaches.id
- `status`: 当前业务里主要用 `active/cancelled`（注意 DB 有约束，部分枚举不可随意写）
- `subscribed_weeks`: 对外“周数”口径，用于换算 credits 范围
- `start_date`: **订阅开始日**（第一次训练 start 时写入；未训练时为 null）
- `end_date`: **预计完成日**（用于 UI“剩余X天”的估算显示；不是硬到期）
- `subscribe_data`: 问卷/需求数据（含训练频率等）

重要语义：

- `start_date=null`：表示“已订阅，但学员尚未开始训练”（未开始）
- `end_date`：仅展示用途（estimated），不能用它做硬“过期”判断；“完成/到期”应由 credits 是否耗尽决定（UI 可用 end_date≈now 进行展示）

相关入口：

- 创建订阅：`src/app/api/subscription/create-subscription/route.ts`（start_date 初始化为 null）
- 订阅开始：`src/app/api/execution/start/route.ts`（首次 start 写 start_date）
- 订阅估算刷新：`src/app/api/execution/finish/route.ts`、`src/app/api/subscription/check-subscription/route.ts`、`src/app/api/subscription/coach-subscriptions/route.ts`

### 2.2 `coach_plan_instances`（计划实例）

关键字段：

- `id`: 计划实例 ID
- `coach_subscription_id`: 关联订阅（教练计划）
- `student_id`: 学员 user_id
- `status`: `active/paused/completed/archived/...`
- `training_days`: 计划内容（按 dayIndex 组织）
- `start_execution_day`: **学员执行起点 dayIndex**
  - `1` 表示从第 1 天开始
  - `>1` 表示迁移：学员线下已完成前面的天数，线上从该天开始

重要语义：

- `start_execution_day` 是“进度起点”，同时影响：
  - 逐周解锁（从该点对齐）
  - next training day 计算（之前可视作已完成/跳过）
  - B1 credits 消耗（当前实现：起点前训练日会被计入 usedCredits）

关于“当前计划”的唯一性：

- 系统目标：一个订阅同一时间只有一个“当前计划”（active/paused）
- 当前实现：`create-instance` 会自动把同订阅下旧的 active/paused 归档为 archived，确保当前唯一
  - 相关：`src/app/api/plan-lib/create-instance/route.ts`

### 2.3 `plan_instance_executions`（执行记录）

关键字段（最重要的两个）：

- `instance_id`: 所属计划实例（**注意不是 plan_instance_id**）
- `day_index`: 对应计划中的 dayIndex（第几天）
- `status`: `in_progress/completed/abandoned/...`
- `started_at/completed_at`: 开始/完成时间

重要语义：

- 一条 execution ≈ 学员对某个计划实例的某个 dayIndex 的一次执行（可有多次尝试，取最近一次）
- credits 扣减只计入 `status=completed`（再叠加线下迁移扣减逻辑）

---

## 3. B1：训练日 credits 的计算方式（当前实现）

逻辑集中在：`src/lib/subscriptionCredits.ts`

### 3.1 credits 的“总量”怎么算？（totalCredits）

1) 将 `subscribed_weeks` 换算为计划天数窗口：

- window = \([1, subscribedWeeks*7]\)  
- 再用 plan 最大 dayIndex 截断（计划不足 N 周时）

2) 在这个 window 中统计 `training_days` 里 `type=training` 的天数，得到 `totalCredits`

> 注意：这使得 “4 周”不等于“28 次”，而等于“4 周窗口内的训练日数量”（例如每周 3 练 ⇒ 12 credits）。

### 3.2 credits 的“已用量”怎么算？（usedCredits）

1) 从 `plan_instance_executions` 中统计：

- `status === "completed"` 的记录
- `day_index` 落在 credits window 的训练日集合内
- **按 day_index 去重**

2) 线下迁移扣减（已实现）：

- 若 `start_execution_day > 1`：把 credits window 内所有 `dayIndex < start_execution_day` 的训练日直接计入 usedCredits
- 目的：线下已完成也要扣次数
- 特点：不插入假 execution，不污染执行表

### 3.3 UI 的“剩余 X 天”怎么来的？

逻辑：`estimateRemainingDays()`：

- plannedCreditsPerWeek = totalCredits / subscribedWeeks
- remainingDays ≈ remainingCredits / plannedCreditsPerWeek * 7
- fallback：无法推算时默认 3 次/周

然后把 `end_date = today + remainingDays`

---

## 4. 用户旅程与系统如何处理（按真实场景拆解）

### 场景 A：学员付费订阅 → 但几天后才开始训练

**期望**：有效期从“开始训练”算，不是从付费算。

实现：

- 创建订阅时 `start_date=null`
- 在学员第一次 `POST /api/execution/start` 时：如果订阅 start_date 为空，则写入 start_date = now
- 这意味着：没开始训练之前，订阅不会进入“消耗期”

风险点：

- 如果学员永远不开始训练，订阅会一直处于“未开始”，需要业务上定义是否允许（当前允许）

### 场景 B：学员正常线上执行（按计划进行）

关键流程：

1) 今日训练页加载：`/today-training`
   - 先取订阅列表：`/api/subscription/coach-subscriptions`
   - 再取计划实例：`/api/plan-lib/get-instance`
   - `get-instance` 会根据 execution 计算出 `nextDayIndex/completedDays/completionDates`

2) 学员开始训练：`POST /api/execution/start`
   - 若该 dayIndex 已有 in_progress execution，复用并同步母版计划
   - 若没有，创建新的 execution（status=in_progress）
   - 若订阅 start_date 为空：写 start_date = now（订阅开始）

3) 学员完成训练：`POST /api/execution/finish`
   - 将 execution 置为 completed，并异步刷新订阅 end_date（预计完成日）

### 场景 C：学员中断/延迟（几天不练）

**B1 的关键效果**：

- 没练 ≠ 消耗
- credits 不变
- end_date 作为“预计完成日”会随着训练推进动态变化（finish/check-expired 时更新）

用户体验：

- UI 看到“剩余 X 天”可能不会每天自然递减，而是随着训练完成而更新（符合“卖次数更人性化”）

### 场景 D：学员线下练了几天，再回到线上继续（迁移线下）

操作：教练导入计划时设置 “从第 W 周第 D 天开始” ⇒ `start_execution_day = (W-1)*7 + D`

系统效果：

- 今日训练/解锁计算会把 start_execution_day 之前当作“已完成/跳过”
- credits used 会把 start_execution_day 之前的训练日计入已消耗（线下也算次数）
- 不插入 execution 记录（执行表仍然只记录线上真实完成）

你需要明确的业务口径：

- “线下完成”是否需要展示在执行记录里？
  - 当前：不展示（因为没有真实 execution）
  - 若要展示：应新增“线下完成标记表”或“迁移记录表”，而不是插入假 completed execution

### 场景 E：教练给学员换计划（覆盖 vs 新建阶段）

教练端导入模板时，当前实现会弹窗选择：

1) **新建阶段（推荐）**
   - 旧实例归档（archived）
   - 新建实例（instance_id 变化）
   - 学员进度从新实例起算（不会与旧执行混淆）

2) **覆盖当前（overwrite）**
   - 更新同一个 instance 的 training_days（instance_id 不变）
   - 执行记录不删除，仍挂在该 instance_id 下
   - nextDayIndex 会按“新计划的 dayIndex 结构”重算

风险点（overwrite 的天然风险）：

- execution 的完成是按 day_index 对齐，而不是按“动作内容对齐”
- 如果覆盖后 dayIndex 的训练/休息分布变化很大，学员会出现“进度跳快/跳慢”的观感

工程建议：

- 产品上建议优先用“新建阶段”替代覆盖
- 若必须覆盖：建议限制覆盖必须保持 dayIndex 结构一致（例如不允许改变训练日位置）

### 场景 F：续费（renew）

当前实现：续费只增加 `subscribed_weeks`，不直接写 end_date。

- end_date 由 credits 模型自动重新估算
- 估算会在：finish、check-expired、coach-subscriptions 等触发点更新

风险点：

- 若续费发生后没有触发任何更新入口，end_date 可能暂时保持旧值
  - 可通过定时 `check-expired` 或用户进入页面时刷新解决（当前已有 check-expired 逻辑）

---

## 5. 关键 API 一览（按职责）

### 订阅相关

- `POST /api/subscription/create-subscription`
  - 创建订阅，`start_date=null`
- `POST /api/subscription/coach-subscriptions`
  - 返回订阅列表 +（B1）估算 end_date + 是否已分配计划（has_plan_instance）
- `PUT /api/subscription/check-subscription?action=check-expired`
  - 批量刷新 end_date，若 credits 耗尽则把 end_date 置为 now（用于 UI 展示“到期/结束”）
- `POST /api/subscription/renew-subscription`
  - 只更新 subscribed_weeks（不直接改 end_date）

### 计划相关

- `POST /api/plan-lib/create-instance`
  - 创建计划实例
  - 当前实现：会归档同订阅下旧 active/paused 实例，保证“当前计划唯一”
- `POST /api/plan-lib/update-instance`
  - 更新现有实例（覆盖模式）
- `POST /api/plan-lib/get-instance`
  - 返回实例 + actions + executions（并计算 nextDayIndex/completedDays 等）

### 执行相关

- `POST /api/execution/start`
  - 开始/恢复一次训练
  - 首次训练时写订阅 start_date
- `POST /api/execution/finish`
  - 完成训练（execution status=completed）
  - 异步刷新订阅 end_date（预计完成日）
- `GET /api/execution/get-next-training-day`
  - legacy fallback：计算 nextDayIndex

---

## 6. 已知高风险点与排查建议

### 6.1 字段命名混用风险（已踩坑）

`plan_instance_executions` 表正确字段是 `instance_id`，历史上出现过代码误用 `plan_instance_id`，导致：

- 今日训练永远停留第 1 天（拿不到 completed executions）
- 计划切换/归档时误判执行数量

建议：

- 重要查询统一封装或做最小集成测试断言

### 6.2 overwrite 覆盖计划导致“进度错位”风险

如上所述：execution 绑定 day_index，覆盖会改变 day_index 的语义内容。

建议：

- 尽量新建阶段，不覆盖
- 或对覆盖加约束：不能改变训练日分布/总天数结构

### 6.3 end_date 的语义变更风险

在 B1 模型中：end_date 是 estimated completion，不是硬到期。

建议：

- 前端不要把 end_date 当作“真实过期时间”做严肃业务判断（只用于展示）
- “是否结束”由 credits 是否耗尽决定（或用 end_date≈now 的展示性判断）

---

## 7. 最小回归用例清单（上线前/每次大改建议跑）

1) 新订阅 start_date=null，未开始状态展示正确（制定中/未开始）
2) 学员第一次 start 后 start_date 写入
3) 完成一次训练后 end_date 会刷新（剩余天数变化）
4) 迁移：设置 start_execution_day=8 后
   - nextDayIndex 从 8 起算
   - credits used 会包含第 1 周训练日
5) 覆盖 vs 新建阶段：
   - 新建阶段后执行次数清零（新实例）
   - 覆盖后执行次数保留（同实例）
6) 今日训练页：已执行到第 N 天时，todayDayIndex 正确指向下一训练日（不回到第 1 天）

---

## 8. 相关文档

- Bug 修复复盘（2026-01-20）：`documents/bugfix-notes-2026-01-20.md`

