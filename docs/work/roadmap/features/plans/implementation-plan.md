# 多周期计划管理系统 - 实现方案

> 基于 [需求文档](./requirements-multicycle.md),
> 本文档将需求拆分为可独立开发、测试和上线的阶段。

---

## 实施原则

1. **增量交付**：每个阶段完成后即可上线，提供可见价值。
2. **向后兼容**：新功能不破坏现有流程。
3. **可测试性**：每个阶段都有明确的验收标准。

---

## Phase 1: 核心状态机与历史查询 (Foundation)

**目标**：规范 `coach_plan_instances.status` 的使用，并提供基础的历史查询能力。

### 1.1 数据库改造

| 改动项                        | 类型      | 详情                                                              |
| ----------------------------- | --------- | ----------------------------------------------------------------- |
| `coach_plan_instances.status` | 规范化    | 确保只允许 `'active'`, `'completed'`, `'archived'`, `'scheduled'` |
| 添加 `CHECK` 约束             | Migration | 防止无效状态                                                      |

**Migration 脚本** (`20260106_plan_status_constraint.sql`)：

```sql
-- 1. 修正现有无效数据
UPDATE coach_plan_instances 
SET status = 'active' 
WHERE status IS NULL OR status NOT IN ('active', 'completed', 'archived', 'scheduled', 'draft', 'paused');

-- 2. 添加约束
ALTER TABLE coach_plan_instances 
ADD CONSTRAINT check_plan_status 
CHECK (status IN ('active', 'completed', 'archived', 'scheduled', 'draft', 'paused'));

-- 3. 确保同一学员只有一个 active 计划 (通过应用层逻辑保证，此处仅添加注释)
COMMENT ON COLUMN coach_plan_instances.status IS 
'计划状态: active(执行中,唯一), completed(已完成), archived(已归档), scheduled(待执行), draft(草稿), paused(暂停)';
```

### 1.2 后端 API

| API          | 方法 | 路径                                 | 职责                                                            |
| ------------ | ---- | ------------------------------------ | --------------------------------------------------------------- |
| 获取历史计划 | GET  | `/api/student/plan-lib/list-history` | 查询 `status IN ('completed', 'archived')`                      |
| 获取当前计划 | GET  | `/api/student/plan-lib/get-current`  | 查询 `status = 'active'`，自动触发 `scheduled` -> `active` 流转 |

**实现要点**：

- `list-history`: 返回
  `{id, name, source, start_date, end_date, status, completion_rate}`
- `get-current`: 若无 active 计划，返回
  `{ data: null, message: "暂无进行中的计划" }`

### 1.3 测试验收

| 测试项                             | 预期结果                            |
| ---------------------------------- | ----------------------------------- |
| 调用 `list-history`，有历史数据    | 返回 200，包含已完成/归档的计划列表 |
| 调用 `get-current`，有 active 计划 | 返回 200，包含当前计划详情          |
| 调用 `get-current`，无 active 计划 | 返回 200，`data: null`              |
| 数据库插入无效 status              | 报错，约束生效                      |

---

## Phase 2: 计划状态流转与归档 (Lifecycle)

**目标**：实现计划的自动归档和手动状态变更。

### 2.1 后端逻辑

| 场景       | 触发条件                     | 操作                                          |
| ---------- | ---------------------------- | --------------------------------------------- |
| 计划完成   | 最后一天训练提交             | `active` -> `completed`                       |
| 手动归档   | 学员/教练点击 [归档]         | `active` -> `archived`                        |
| 新计划激活 | 创建新 Instance 为 active 时 | 旧 active 计划 -> `archived` (或 `completed`) |

**核心 API**：

| API                   | 方法 | 路径                              | 职责                       |
| --------------------- | ---- | --------------------------------- | -------------------------- |
| 归档计划              | POST | `/api/plan-lib/archive-instance`  | 将指定计划设为 `archived`  |
| 完成计划              | POST | `/api/plan-lib/complete-instance` | 将指定计划设为 `completed` |
| 激活计划 (带冲突检测) | POST | `/api/plan-lib/activate-instance` | 归档旧计划，激活新计划     |

**实现要点 (`activate-instance`)**:

```typescript
// 1. 检查当前是否有 active 计划
const { data: currentActive } = await supabase
    .from("coach_plan_instances")
    .select("id")
    .eq("student_id", studentId)
    .eq("status", "active")
    .single();

// 2. 若有，根据进度决定归档还是完成
if (currentActive) {
    const newStatus = calculateProgress(currentActive) >= 100
        ? "completed"
        : "archived";
    await supabase.from("coach_plan_instances").update({ status: newStatus })
        .eq("id", currentActive.id);
}

// 3. 激活新计划
await supabase.from("coach_plan_instances").update({
    status: "active",
    start_date: new Date(),
}).eq("id", newInstanceId);
```

### 2.2 测试验收

| 测试项                                       | 预期结果                      |
| -------------------------------------------- | ----------------------------- |
| 调用 `archive-instance`                      | 计划状态变为 `archived`       |
| 调用 `complete-instance`                     | 计划状态变为 `completed`      |
| 调用 `activate-instance`，当前有 active 计划 | 旧计划归档，新计划变为 active |
| 调用 `activate-instance`，当前无 active 计划 | 新计划直接变为 active         |
| 同一学员同时存在两个 active 计划             | 不可能，API 保证唯一性        |

---

## Phase 3: 学员端历史页面 (Student UI)

**目标**：学员可以查看自己的历史计划和执行记录。

### 3.1 前端页面

| 页面         | 路由                 | 功能                                    |
| ------------ | -------------------- | --------------------------------------- |
| 历史计划列表 | `/plan-history`      | 展示所有 `completed` 和 `archived` 计划 |
| 计划执行详情 | `/plan-history/[id]` | 展示该计划下所有执行记录                |

### 3.2 UI 组件

- **HistoryPlanCard**: 展示计划卡片（名称、来源、周期、完成率）
- **ExecutionTimeline**: 按日期展示每天的训练执行情况
- **EmptyState**: 无历史数据时的空状态

### 3.3 测试验收

| 测试项               | 预期结果                           |
| -------------------- | ---------------------------------- |
| 进入历史页面，有数据 | 展示计划卡片列表                   |
| 进入历史页面，无数据 | 展示"暂无历史计划"空状态           |
| 点击某个计划卡片     | 跳转到执行详情页，展示天维度的记录 |
| 执行详情页有视频     | 视频可播放                         |

---

## Phase 4: 教练端历史视图 (Coach UI)

**目标**：教练可以查看学员的所有历史计划。

### 4.1 后端 API

| API          | 方法 | 路径                                          | 职责                       |
| ------------ | ---- | --------------------------------------------- | -------------------------- |
| 学员计划历史 | GET  | `/api/coach/student/[studentId]/plan-history` | 获取指定学员的所有历史计划 |

**权限校验**：必须是该学员的订阅教练。

### 4.2 前端改造

| 改动点             | 详情                                             |
| ------------------ | ------------------------------------------------ |
| 学员详情页新增 Tab | [计划历史] Tab                                   |
| 计划历史组件       | 复用学员端的 HistoryPlanCard，增加 [来源] 筛选器 |

### 4.3 测试验收

| 测试项                   | 预期结果                           |
| ------------------------ | ---------------------------------- |
| 教练查看自己学员的历史   | 正常展示                           |
| 教练查看非自己学员的历史 | 返回 403 Forbidden                 |
| 筛选 [我分配的]          | 只展示 `source = 'coach'` 的计划   |
| 筛选 [学员自制]          | 只展示 `source = 'student'` 的计划 |

---

## Phase 5: 问卷版本化与回答记录 (Questionnaire)

**目标**：支持教练问卷的版本控制和学员回答的历史快照。

### 5.1 数据库改造

**Migration 脚本** (`20260107_questionnaire_versioning.sql`)：

```sql
-- 1. 问卷版本化
ALTER TABLE coach_questionnaires ADD COLUMN version integer DEFAULT 1;
ALTER TABLE coach_questionnaires ADD COLUMN is_active boolean DEFAULT true;

-- 2. 创建问卷回答表
CREATE TABLE questionnaire_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES users(id),
  coach_id uuid REFERENCES coaches(id),
  questionnaire_id uuid REFERENCES coach_questionnaires(id),
  questionnaire_version integer,
  answers jsonb NOT NULL,
  context text, -- 'initial', 'cycle_end', 'manual_update'
  plan_instance_id uuid REFERENCES coach_plan_instances(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_questionnaire_responses_student ON questionnaire_responses(student_id);
CREATE INDEX idx_questionnaire_responses_coach ON questionnaire_responses(coach_id);
```

### 5.2 后端 API

| API          | 方法 | 路径                         | 职责                                   |
| ------------ | ---- | ---------------------------- | -------------------------------------- |
| 提交问卷回答 | POST | `/api/questionnaire/submit`  | 创建 response 记录，更新 user_profiles |
| 获取历史回答 | GET  | `/api/questionnaire/history` | 获取学员的所有历史回答                 |

### 5.3 测试验收

| 测试项           | 预期结果                                         |
| ---------------- | ------------------------------------------------ |
| 提交问卷回答     | `questionnaire_responses` 新增记录               |
| 再次提交问卷回答 | 新增另一条记录（不覆盖）                         |
| 获取历史回答     | 返回所有历史记录，按时间倒序                     |
| 教练更新问卷     | 旧版本 `is_active = false`，新版本 `version + 1` |

---

## Phase 6: 计划完成弹窗与 AI 生成 (Completion Flow)

**目标**：当计划完成时，引导用户更新档案并生成下一阶段计划。

### 6.1 前端流程

1. 用户完成最后一天训练。
2. 检测计划完成，弹出 **CompletionModal**。
3. 用户选择 [去更新档案] -> 跳转问卷页 -> 提交 -> [生成下一阶段计划]。
4. 调用 AI 生成 API -> 预览新计划 -> 确认激活。

### 6.2 后端 API

| API                 | 方法 | 路径                                | 职责                         |
| ------------------- | ---- | ----------------------------------- | ---------------------------- |
| AI 生成下一阶段计划 | POST | `/api/plan-lib/generate-next-phase` | 基于历史数据和新问卷生成计划 |

**Prompt 上下文**:

- 上一个计划的完成率
- 负荷进步数据 (PRs)
- 最新问卷回答
- 用户明确的新目标

### 6.3 测试验收

| 测试项                        | 预期结果                        |
| ----------------------------- | ------------------------------- |
| 完成最后一天训练              | 弹出完成弹窗                    |
| 点击 [去更新档案]             | 跳转问卷页                      |
| 提交问卷后点击 [生成下一阶段] | AI 生成新计划并展示预览         |
| 确认激活新计划                | 旧计划 completed，新计划 active |

---

## 开发优先级与时间估算

| Phase   | 优先级 | 预估工时 | 依赖       |
| ------- | ------ | -------- | ---------- |
| Phase 1 | P0     | 1天      | 无         |
| Phase 2 | P0     | 1天      | Phase 1    |
| Phase 3 | P1     | 2天      | Phase 1, 2 |
| Phase 4 | P1     | 1天      | Phase 1, 2 |
| Phase 5 | P2     | 2天      | 无         |
| Phase 6 | P2     | 3天      | Phase 5    |

**总计**: 约 10 个工作日（2周）

---

## 风险与缓解

| 风险                   | 影响               | 缓解措施             |
| ---------------------- | ------------------ | -------------------- |
| 历史数据 status 不规范 | Migration 可能失败 | 先备份，逐步修正     |
| 同时两个 active 计划   | 数据一致性问题     | API 层强制唯一性检查 |
| AI 生成质量不稳定      | 用户体验差         | 增加人工编辑步骤     |
