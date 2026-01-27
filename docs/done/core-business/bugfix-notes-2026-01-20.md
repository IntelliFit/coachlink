# Bugfix Notes (2026-01-20)

本文档记录近期线上/本地复现到的 **2 个高优先级 bug**，包含：现象、根因、影响范围、修复方案、验证方式与防回归建议。

---

## Bug 1：教练端“学员计划编辑页”显示的执行次数/加入天数异常

### 现象（Symptoms）

在教练端学员计划编辑页面（`/dashboard/students/plan/[subscriptionId]`）：

- 页面右上角/“学员执行情况”卡片显示：**“已完成 2 次训练”**（或其他非 0 值）
  - 即使该计划“看起来是刚创建的”，也可能出现非 0 的完成次数
- 点击“学员详细档案”弹窗：
  - **“已加入 88 Days”**（或一个明显不合理的大数）
  - 与“订阅开始日期”/学员端认知不一致

### 业务期望（Expected）

- **新建阶段计划**应从 0 开始计数（除非明确选择“保留旧计划执行记录”的覆盖模式）
- “已加入/已开始”应与业务语义一致：
  - 在 B1（训练日 credits）模型中，订阅 start_date 在“首次开始训练”时才设置
  - end_date 是“预计完成日”（UI 友好展示），不应作为“加入时长”计算依据

### 根因（Root Cause）

该异常来自 **两类问题叠加**：

#### 1) “覆盖旧计划”与“新建阶段”语义未区分，导致旧执行记录被当作新计划执行记录

教练端从模板导入时，历史上存在“直接 update 当前实例”的路径：

- 当订阅下已经存在一份 active 计划实例时，如果导入/保存走的是 `update-instance`，那么：
  - 实例 ID 不变
  - `plan_instance_executions`（执行记录）当然也不会清空
  - UI 统计的“已完成 X 次训练”就会显示旧实例累计值（对用户而言会误以为是新计划的执行次数）

为避免这一语义混淆，本次修复增加了 **导入模式选择**：

- **新建阶段（推荐）**：归档旧计划实例 → 新建新实例（执行次数从 0 开始）
- **覆盖当前**：更新当前实例（保留旧执行记录，因此完成次数不会清零）

相关文件：

- `src/app/dashboard/students/plan/[id]/page.tsx`（新增导入方式弹窗与保存逻辑分支）
- `src/app/api/plan-lib/create-instance/route.ts`（新建实例时归档旧 active/paused 实例）
- `src/app/api/plan-lib/get-instance/route.ts`（按订阅取“当前计划”时仅取 active/paused）

#### 2) “已加入 Days”计算使用了错误语义（abs(start_date - end_date)）

旧实现按如下方式计算天数：

- `days = ceil(abs(end_date - start_date))`

这会产生两类不合理：

- end_date 在 B1 模型中是“预计完成日”，并非“加入/开始的时间终点”
- 一旦 end_date 早于 start_date（或为空/被回写），`abs` 会把方向错误吞掉，变成一个看似“很大”的天数

修复后：

- 文案改为 **“已开始”**
- 计算改为：
  - 若 `start_date` 为空：显示 0（表示“未开始训练”）
  - 否则：`days = ceil(max(0, now - start_date))`

相关文件：

- `src/app/dashboard/students/plan/[id]/components/StudentProfilePanel.tsx`

### 修复摘要（Fix Summary）

- **前端**：
  - 导入模板时新增“覆盖/新建阶段”选择
  - 执行次数展示改为只统计 `status === "completed"` 的执行（避免 in_progress 被误算）
  - “已加入”改为“已开始”，并按 start_date → now 计算
- **后端**：
  - `create-instance` 创建新实例时归档同订阅下旧 active/paused 实例，保证“当前计划”唯一
  - `get-instance` 取订阅实例时只取 active/paused，避免拿到历史实例造成 UI 混乱

### 如何验证（Verification）

1) 订阅下已有旧计划且旧计划有执行记录：
   - 导入模板，选择 **“新建阶段”**
   - 预期：新计划执行次数从 0 开始（教练端计划页不再显示旧的“已完成 X 次”）
2) 导入模板，选择 **“覆盖当前”**
   - 预期：执行次数保留（符合覆盖语义）
3) 打开“学员详细档案”：
   - 若订阅 `start_date=null`：显示 “已开始 0 Days”
   - 若订阅已开始：显示合理的已开始天数（随自然日增长）

---

## Bug 2：学员端“今日训练”停留在第 1 天 / 进度与实际执行不一致

### 现象（Symptoms）

学员端 `/today-training` 页面：

- 学员实际已经执行到第 17 天（教练端能看到对应执行记录）
- 但学员端“今日训练”仍显示 **第 1 天**
- 甚至呈现“好像一直在跳动/不稳定”的感觉

### 根因（Root Cause）

`/today-training` 的主数据来源是 `plan-lib/get-instance` 返回的派生字段（`nextDayIndex` / `completedDays` / `completionDates` 等）。

而 `get-instance` 内部查询执行记录时 **用了错误的过滤字段**：

- 错误：`plan_instance_executions.eq("plan_instance_id", instance.id)`
- 正确：`plan_instance_executions.eq("instance_id", instance.id)`

导致：

- 查询永远取不到该计划实例的执行记录（返回空）
- `completedDays` 为空 → `nextDayIndex` 回退到 `start_execution_day`（通常是 1）
- 页面因此长期显示第 1 天（与真实执行进度不一致）

同时还发现一个同类问题：

- `activate-instance` 中统计执行记录也使用了 `plan_instance_id`（同样应为 `instance_id`）

### 修复摘要（Fix Summary）

- 修复 `get-instance`：
  - 改为 `eq("instance_id", instance.id)`
  - 增加容错：若“带关系的 select（action_executions/sets/videos）”在某些环境失败，则 fallback 到简单字段 select，确保 `nextDayIndex` 仍可正确计算
- 修复 `activate-instance`：
  - 统计执行记录字段改为 `instance_id`

相关文件：

- `src/app/api/plan-lib/get-instance/route.ts`
- `src/app/api/plan-lib/activate-instance/route.ts`
-（消费端逻辑依赖方）`src/app/today-training/page.tsx`

### 如何验证（Verification）

1) 对一个已存在执行记录的计划实例（例如 day_index 已到 17）：
   - 学员刷新 `/today-training`
   - 预期：`todayDayIndex` 会跳到正确的 `nextDayIndex`（不再固定第 1 天）
2) 在网络面板中查看 `POST /api/plan-lib/get-instance`：
   - 预期返回包含正确的 `completedDays`、`completionDates`、`nextDayIndex`

---

## 防回归建议（Prevention）

### 1) 统一字段命名与查询约束

本次出现的核心问题是 **同一张表字段存在混用**：

- `plan_instance_executions` 正确外键是 `instance_id`
- 错误代码使用了 `plan_instance_id`

建议：

- 在 `sql/check_type_column.sql` 或类似工具脚本中增加 schema 校验（本仓库已有类似脚本）
- 对关键表字段写一个最小的 API 集成测试（mock supabase 也可）：
  - 断言 `get-instance` 必须用 `instance_id` 过滤

### 2) 明确“新建阶段” vs “覆盖当前”的产品语义

只要允许覆盖旧实例，就必然存在“执行次数是否清零”的差异；UI 必须显式告知并让教练选择。

---

## 本次相关改动文件清单（便于 code review）

- `src/app/api/plan-lib/get-instance/route.ts`
- `src/app/api/plan-lib/activate-instance/route.ts`
- `src/app/api/plan-lib/create-instance/route.ts`
- `src/app/dashboard/students/plan/[id]/page.tsx`
- `src/app/dashboard/students/plan/[id]/components/StudentPlanExecutionView.tsx`
- `src/app/dashboard/students/plan/[id]/components/StudentProfilePanel.tsx`

