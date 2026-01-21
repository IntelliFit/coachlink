# 训练执行系统自洽规范 v1（允许跳过 + 未开始不显示日期）

- **版本**：v1
- **状态**：已拍板（产品口径）
- **适用端**：学员端（`/today-training`、`/training-execution/[instanceId]`、学员“当前计划”视图）；教练端可参考但不强制
- **目标**：保证学员端看到的所有信息**自洽**，避免“计划日期 vs 实际执行日期”混用造成的矛盾感

---

## 一、拍板结论（必须遵守）

- **拍板 1：允许跳过训练日**
  - 学员可以在未完成某些训练日的情况下继续后续训练日。
  - 系统应提供“补漏/补确认/标记跳过”的闭环，但**不应该**把用户强制拉回到过去。

- **拍板 2：未开始的训练日不显示日期**
  - 仅对“已开始/已完成”的训练日显示真实日期（来源于时间戳）。
  - 未开始训练日不展示“计划日期/预计日期”，避免与真实执行冲突。

---

## 二、范围与非目标

### 2.1 范围
- **训练进度推荐**（推荐练哪一天）
- **训练日状态展示**（未开始/进行中/已完成/已跳过/已放弃）
- **迁移学员（线下导入）**的展示规则
- **拖延/缺口（漏确认/跳过）**的解释与统计口径（可选展示）

### 2.2 非目标（本规范不要求）
- 不要求“严格按日历计划推进”（即不要求每天对应固定的计划日期）
- 不要求对“未开始训练日”展示任何日期承诺

---

## 三、术语与核心概念（统一命名）

### 3.1 计划域（Plan）
- **计划实例（Instance）**：`coach_plan_instances`
- **训练日（Training Day）**：`training_days` JSONB 中 `type='training'` 的 dayIndex
- **休息日（Rest Day）**：`training_days` JSONB 中 `type='rest'` 的 dayIndex
- **dayIndex**：计划内的第几天（1-based，包含休息日）

### 3.2 执行域（Execution）
- **执行记录（Execution）**：`plan_instance_executions`
- **执行状态（ExecutionStatus）**：
  - `in_progress`：已开始未完成
  - `completed`：已完成
  - `abandoned`：放弃（不计为完成）
  - （可扩展）`skipped`：跳过（建议新增语义；如果暂时复用 `abandoned`，必须在 UI 文案区分“放弃 vs 跳过”）

### 3.3 自洽展示域（Student-facing）
> 学员端只暴露“事实”和“推荐”，不暴露会产生争议的“承诺型计划日期”。

- **recommendedDayIndex**：系统主推荐训练日（**进度指针**）
- **missingDays**：小于 recommendedDayIndex 且尚未完成的训练日集合（**补漏集合**）
- **actualStartedAt / actualCompletedAt**：真实开始/完成时间（来自 execution）
- **迁移前训练日（offline days）**：`dayIndex < start_execution_day`（线下已完成/导入完成）

---

## 四、数据模型（事实来源）

### 4.1 `coach_plan_instances`（计划实例）
关键字段（与学员端自洽相关）：
- `id`
- `training_days`（JSONB：包含 dayIndex、type、actionSets 等）
- `start_execution_day`（迁移起点；`< start_execution_day` 视为线下已完成）
- `status`（active/paused/archived 等）

> 备注：`start_date` 在当前系统中可能是“计划日历/解锁用锚点”，**不等价于**“学员真实开始执行时间”。本规范下，学员端不再将其作为“事实日期”展示来源。

### 4.2 `plan_instance_executions`（执行记录）
关键字段：
- `instance_id`
- `day_index`
- `status`
- `started_at`
- `completed_at`
- `action_executions`（动作/组执行详情）

### 4.3 派生结构（服务端或前端可派生）
- `executionsByDayIndex[dayIndex]`：同一 dayIndex 可能存在多条记录时，**选取 started_at 最新的一条**作为该 dayIndex 的代表记录（用于 UI 状态）。
- `completionDates[dayIndex]`：对 completed 的记录，选取 completed_at 最新的一条作为“完成时间”。

---

## 五、核心规则（必须一致）

## 5.1 训练日分类与可参与集合
- 只把 `training_days` 中 `type='training'` 且 `dayIndex >= start_execution_day` 的 dayIndex 作为“平台内需完成的训练日集合”（记为 `TrainableDays`）。
- `dayIndex < start_execution_day`：
  - **学员端视为线下已完成**
  - 不要求存在 execution 记录

## 5.2 recommendedDayIndex（主推荐训练日）——允许跳过口径

### 5.2.1 完成集合
- `CompletedDays = { dayIndex ∈ TrainableDays | executions(dayIndex).status == 'completed' }`

### 5.2.2 计算推荐
> 推荐不使用“最早未完成”，而使用“最大已完成 + 1”，避免被漏确认卡死。

1. 若 `CompletedDays` 为空：`recommendedDayIndex = start_execution_day`。
2. 否则：令 `maxCompleted = max(CompletedDays)`，则：
   - `candidate = next training day after maxCompleted`（在 `TrainableDays` 序列中取下一个）
   - 若 candidate 存在：`recommendedDayIndex = candidate`
   - 若 candidate 不存在（已完成最后一个训练日）：`recommendedDayIndex = first training day`（或进入“计划完成”流程）

### 5.2.3 missingDays（补漏集合）
- `missingDays = { dayIndex ∈ TrainableDays | dayIndex < recommendedDayIndex AND dayIndex ∉ CompletedDays }`

> 语义：这些天在进度上“已经跨过了”，但事实层面仍未完成，需要提示用户“补确认/标记跳过”。

## 5.3 日期展示规则（未开始不显示日期）

### 5.3.1 学员端可显示的日期（事实日期）
- `completed`：显示 `completed_at`（本地时区归一到日期即可）
- `in_progress`：显示 `started_at`
- 未开始（无 execution）：**不显示日期**

### 5.3.2 禁止规则（避免矛盾）
- 禁止在学员端把 `instance.start_date + (dayIndex-1)` 当成事实日期展示。
- 禁止对未开始训练日显示任何“预计日期/计划日期”。

---

## 六、迁移学员（线下导入）规则（你最关心的）

### 6.1 基本原则
- `dayIndex < start_execution_day`：显示为 **“线下已完成（迁移）”**
- 不显示完成日期（除非产品明确希望“线下日期”可追溯，并且后端提供可信数据；否则一律不显示）

### 6.2 迁移锚点（可选派生，用于统计而非强制展示）
为计算“拖延/缺口”等统计，可定义：
- `migrationAnchorDate`：平台上 start_execution_day 对应的“首个有效执行日期”
  - 若存在该 dayIndex 的 execution：取其 `started_at`（或 `completed_at`，二选一但必须一致）归零点后的日期
  - 若不存在：取“导入当天”（实例创建日/教练确认日等产品定义）

> 本规范下，**学员端未开始不显示日期**，因此 migrationAnchorDate 主要用于统计与解释，而不是 UI 强展示。

---

## 七、漏确认/跳过的交互闭环（必须有，否则允许跳过会造成数据永远不闭合）

### 7.1 漏确认的定义（事实）
当满足以下任意条件，可判定“可能漏确认”：
- 某训练日存在 execution，且动作/组实际已全部完成，但 execution 仍停留在 `in_progress`
- 或者用户声称“我练完了但没点完成”

### 7.2 建议的闭环（产品/工程实现参考）
- 在 `missingDays` 存在时，提供入口：
  - **补确认完成**（将对应 execution 标记为 completed，或新建一条“补确认”记录）
  - **标记跳过**（将该 dayIndex 记录为 skipped/abandoned，并在 UI 文案标记“已跳过”）
- 对“长时间 in_progress”弹提醒（你们已实现提醒思路）：提供“一键确认完成/继续训练/稍后提醒”。

> 注意：如果“跳过”不计入完成，则 recommendedDayIndex 的算法仍然可推进（因为推荐来自 maxCompleted+1），但 missingDays 会持续存在；因此跳过必须有明确状态，否则 UI 反复提示。

---

## 八、拖延与缺口统计（可选展示，但口径要统一）

在本规范下，“拖延”是统计概念，不用于改写推荐。

### 8.1 per-day 拖延
若定义了 `migrationAnchorDate`，则对已完成训练日可计算：
- `plannedDate(dayIndex) = migrationAnchorDate + (dayIndex - start_execution_day)`（仅用于对照）
- `actualDoneDate(dayIndex) = date(completed_at)`
- `delayDays = actualDoneDate - plannedDate`

### 8.2 汇总指标（建议）
- `totalDelayDays`：所有已完成训练日 delayDays 的和（可截断负值为 0）
- `maxDelayDays`：最大 delayDays
- `streakBreaks`：两次相邻已完成训练日之间实际日期差 > 1 的次数（反映断更）

> 这些指标可用于教练端“健康度/粘性”分析；学员端谨慎展示（避免羞辱感）。

---

## 九、页面级展示规范（学员端必须一致）

### 9.1 今日训练（`/today-training`）
必须展示：
- 推荐训练日：`recommendedDayIndex`
- 推荐日状态：来自 `executionsByDayIndex[recommendedDayIndex].status`（若无则为“未开始”）
- 若存在 `missingDays`：用轻量提示条说明“你有 X 天未确认/未完成，可补确认或跳过”（不把用户强制拉回）

禁止展示：
- 未开始训练日的日期
- 计划日历日期（start_date 映射）

### 9.2 训练执行页（`/training-execution/[instanceId]?dayIndex=...`）
必须展示：
- 当前 dayIndex 的动作与进度（action_executions/sets）
- 若存在上一次长时间 `in_progress`：提醒并提供一键完成/继续

完成判定建议（事实一致性）：
- 当所有动作/组完成时，允许系统自动把 execution 标为 completed（减少“忘点完成”）

### 9.3 学员“当前计划”视图（学员侧）
必须展示：
- 每个训练日的状态（未开始/进行中/已完成/已跳过/线下已完成）
- 对已完成/进行中的训练日显示真实日期（completed_at/started_at）
- 对未开始训练日不显示日期

禁止展示：
- 用 start_date 计算出来的“计划日期”当作事实日期

---

## 十、工程检查清单（上线前逐条对照）

- **统一进度口径**：所有学员端页面主推荐都使用 `recommendedDayIndex`（maxCompleted+1），而不是“最早未完成”。
- **统一日期口径**：
  - completed → completed_at
  - in_progress → started_at
  - 未开始 → 不显示日期
- **迁移口径一致**：`dayIndex < start_execution_day` 一律显示“线下已完成（迁移）”，不显示日期。
- **重复执行记录处理一致**：同 dayIndex 多条 execution 时，UI 使用 started_at 最新的一条作为代表。
- **跳过闭环存在**：存在 missingDays 时必须能“补确认/跳过”，否则允许跳过会永久积压。

---

## 附录 A：以 Zhaoccy 为例的“自洽解释模板”

> 当用户问“为什么今天显示第12天，但我看到第10天刚完成？”时，按以下模板解释即可：

- **推荐训练日**：第12天（因为这是当前进度指针推荐的下一天）
- **第10天完成日**：显示 1/20，因为这是第10天的实际完成时间（completed_at）
- **第12天目前进行中**：显示“开始于 1/19”，因为这是 started_at
- **未开始的第13/14天**：不显示日期（避免误解为承诺）

