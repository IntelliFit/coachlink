# [需求] 多周期计划管理与续费逻辑改造方案

## 1. 背景与核心问题

目前系统采用"订阅（商业期限）"与"计划（内容交付）"强耦合的默认假设，但在实际业务中存在
mismatched 的情况：

1. **时长不匹配**：学员订阅 4 个月，但教练模版库仅有 2 个月的标准计划。
2. **续费衔接**：学员执行完 1 个月计划后续费，系统如何处理后续计划的生成与衔接。
3. **数据结构隐患**：若强行延长单一计划实例（Instance）到 50+ 周，会导致 JSONB
   数据过大，且无法体现"周期化训练（Periodization）"的阶段性目标。
4. **执行历史追溯**：无论是教练分配的还是学员自制的计划，一旦执行完毕，用户和教练都需要一个统一的地方回顾和分析历史数据。

---

## 2. 核心设计理念：多实例（Multi-Instance）模式

**核心原则：** 订阅（Subscription）是入场券，计划（Plan Instance）是演出场次。
**结论：** 严禁修改历史计划的 `training_days`
来"续命"。必须通过创建**新的计划实例**来覆盖新的订阅周期。

### 数据库模型调整（无需改表结构，仅规范字段用途）

基于现有 `coach_plan_instances` 表：

- **`status` 状态流转明确化**：
  - `active`: 当前正在执行的计划（**同一时间同一学员只能有一个 active 计划**）。
  - `completed`: 正常结束的计划（执行完最后一天）。
  - `archived`: 被中途废弃或被新计划覆盖的旧计划。
  - `scheduled`: (建议新增) 已分配但尚未开始的未来计划（用于队列机制）。

### 2.1 统一执行模型

无论是"教练指派"还是"学员自制"，最终的执行实体都统一存储在
`coach_plan_instances` 表中。

- **差异化标识**：
  - `source` 字段：`'coach'` (教练指派) vs `'student'` (学员自制/收藏)。
  - `coach_id`: 教练指派时为非空；学员自制时为 NULL。
  - `coach_subscription_id`: 教练指派时必须关联订阅；学员自制时为 NULL。

### 2.2 学员自制模版库 (`student_plan_favorites`)

学员不想每次都从零创建，因此需要一个"个人模版库"。

- 对应表：`student_plan_favorites` (已存在)。
- 作用：存储学员自己编排的常用计划模版（如"我的假期维持计划"、"出差徒手训练"）。
- **关键区分**：`student_plan_favorites`
  是**模版库**（可复用），`coach_plan_instances`
  是**执行实例**（一次性、有生命周期）。
- 流程：`Save as Favorite` -> `Create Instance from Favorite`。

---

## 3. 详细业务流程设计

### 场景一：订阅时长 > 计划时长（短计划长订阅）

**案例**：订阅 4 个月，分配了 2 个月的"基础力量模版"。

1. **初始分配**：
   - 教练从模版库选择一个 2 个月计划，生成 `Instance A`。
   - `start_date` = Today，`status` = `active`。

2. **自动监控与预警**：
   - 后端定时任务（Cron）或登录触发检查：
     - 若 `Instance A` 进度 > 90% 或 剩余天数 < 7天。
     - **触发系统通知（Notify Coach）**："学员 [Name]
       的计划即将结束，订阅有效期还剩 2 个月，请分配下一阶段计划。"

3. **衔接处理**：
   - **方案 A（人工指派）**：教练手动选择下一个模版并分配。
   - **方案 B（AI 自动生成，推荐）**：
     - 系统引导学员/教练更新问卷（参见场景四），然后点击 [AI 生成下一阶段]
       自动创建 `Instance B`。
   - `Instance A` -> `completed`，`Instance B` -> `active`。

---

### 场景二：计划执行完毕与续费（Renewal）

**案例**：学员 1 个月计划执行完毕，续费 2 个月。

1. **续费触发**：
   - 学员支付成功 -> 更新 `coach_subscriptions.end_date`。
   - **触发系统事件**：`SUBSCRIPTION_RENEWED`。

2. **智能处理策略**：
   - 系统给教练生成一条"待办任务"：学员已续费，请评估上个周期表现并分配新计划。
   - 教练可以：
     - 手动选择模版分配。
     - 引导学员更新问卷，然后用 AI 自动生成计划。
   - ~~（未来考虑）检查 `Template A` 是否配置了
     `next_phase_template_id`，若有，自动生成。~~（当前阶段不实现）

3. **数据存档**：
   - `Instance A` 的状态自动变为 `completed`。
   - 前端"历史计划"页面可查看 `Instance A` 的完整记录。

---

### 场景三：学员自主计划管理 (Self-Service)

**核心概念**：学员可以拥有多个自制的**模版**
(Favorites)，但同一时间只能有一个**正在执行的实例** (Active Instance)。

#### 3.1 创建与管理模版 (Template Management)

1. 学员在"我的计划库"创建多个计划模版：
   - "三亚度假徒手训练" (7天)
   - "出差酒店训练" (5天)
   - "减脂冲刺" (14天)
2. 这些模版保存在 `student_plan_favorites`，可随时编辑、复用。

#### 3.2 开启计划 (Activation)

1. 学员选择一个模版，点击 [开始执行]。
2. **冲突检测**：系统检测当前是否有 `active` 的计划。
   - **若有冲突**（无论是教练计划还是自己的另一个计划）：
     - **弹窗提示**："开启新计划将归档当前正在进行的计划，是否继续？"
     - **确认后**：旧计划 -> `archived`，新计划 -> `active`。
   - **若无冲突**：直接创建新实例，`status` = `active`。
3. 创建 `Instance X`：`source = 'student'`，`coach_id = NULL`。

#### 3.3 执行完成与衔接

1. 学员完成当前自制计划的最后一天。
2. **状态变更**：`Instance X` -> `completed`。
3. **弹窗引导**：
   - "计划已完成！您可以：[开始新计划] / [更新档案并生成 AI 计划] /
     [查看执行记录]"
4. **开启下一个计划**：
   - 学员可以从自己的模版库中再次选择一个（可以是同一个模版的新实例，也可以是另一个模版）。
   - 重复 3.2 的激活流程。

---

### 场景四：周期结束与智能续航 (Cycle Completion & AI Regeneration)

**案例**：学员完成了为期 8
周的"减脂一期"计划，身体指标（体重、体脂率）发生了显著变化，需要基于新状态生成下一阶段计划。

1. **周期结算 (Completion)**：
   - 当 `active` 计划的最后一天训练被标记为完成时。
   - **前端弹窗**："恭喜完成本周期训练！您的身体可能已经发生变化，建议更新档案以获取更精准的下一阶段建议。"
   - **选项**：[去更新档案] / [沿用旧档案] / [稍后再说]。

2. **问卷重测 (Re-assessment)**：
   - 学员进入"个人档案更新"或"阶段性问卷"页面。
   - 重点更新：体重、BMI、最大力量数据 (PRs)、当前痛点、新阶段目标（如减脂 ->
     增肌）。
   - **保存数据**：更新 `user_profiles`，并（建议）保存一份历史快照到
     `assessment_history`。

3. **AI 智能生成 (AI Regeneration)**：
   - 学员点击 [生成下一阶段计划]。
   - **Prompt 构建**：
     - 输入：旧计划执行情况（完成率、负荷提升）、新问卷数据、用户反馈。
     - 上下文：系统提示 AI "用户刚完成减脂周期，体重下降
       5kg，现在希望能增加肌肉线条"。
   - **生成结果**：AI 生成 `Instance B`（例如"塑形强化-第1阶段"）。
   - **预览与激活**：学员预览无误后，点击激活，`Instance B` 变为
     `active`，`Instance A` -> `completed`。

4. **自主循环 (Loop)**：
   - 系统支持"执行 -> 评估 -> 调整 -> 执行"的无限闭环。

---

### 场景五：教练问卷与档案更新机制 (Coach Questionnaire & Profile Update)

> **重要澄清**：本节讨论的"问卷"不是指用户刚注册时填写的**系统入门问卷**
> (`onboarding_questionnaires`)，而是指**教练为学员定制设计的评估问卷**
> (`coach_questionnaires`)。

#### 5.1 问卷体系区分

| 类型             | 数据库表                                 | 填写时机                             | 用途                                     |
| ---------------- | ---------------------------------------- | ------------------------------------ | ---------------------------------------- |
| **系统入门问卷** | `onboarding_questionnaires`              | 用户首次注册后                       | 收集基础信息，用于平台推荐教练           |
| **教练专属问卷** | `coach_questionnaires`                   | 学员订阅教练后/周期开始前/周期结束后 | 教练个性化评估，用于AI生成或手动定制计划 |
| **问卷回答记录** | `questionnaire_responses` (**建议新增**) | 每次学员填写问卷时                   | 保留历史快照，用于对比分析               |

#### 5.2 教练问卷结构 (`coach_questionnaires`)

目前结构：

```sql
CREATE TABLE coach_questionnaires (
  id uuid PRIMARY KEY,
  coach_id uuid NOT NULL,      -- 教练ID
  questions jsonb NOT NULL,    -- 问题列表（教练设计）
  created_at, updated_at
);
```

**问题**：当前设计是"一个教练一份问卷"，直接修改会覆盖旧版本。

**建议改造**：增加版本控制字段。

```sql
ALTER TABLE coach_questionnaires ADD COLUMN version integer DEFAULT 1;
ALTER TABLE coach_questionnaires ADD COLUMN is_active boolean DEFAULT true;
-- 每次教练修改问卷时，旧版本 is_active = false，创建新版本
```

#### 5.3 问卷回答记录 (`questionnaire_responses`，新增)

**目的**：每次学员填写问卷，无论是首次还是周期性重测，都需要保留一份历史快照。

**建议表结构**：

```sql
CREATE TABLE questionnaire_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES users(id),
  coach_id uuid REFERENCES coaches(id),            -- 可为空（若是系统问卷）
  questionnaire_id uuid REFERENCES coach_questionnaires(id),
  questionnaire_version integer,                   -- 快照：填写时的问卷版本
  answers jsonb NOT NULL,                          -- 学员的回答
  context text,                                    -- 填写场景（如 'initial', 'cycle_end', 'manual_update'）
  plan_instance_id uuid,                           -- 可选：关联到某个计划周期
  created_at timestamptz DEFAULT now()
);
```

**核心价值**：

- **历史对比**：教练可以对比学员"订阅时"和"第一周期结束时"的问答差异。
- **AI上下文**：AI生成计划时可以参考历史问答的变化趋势。
- **审计追溯**：记录学员健康档案的完整变更历史。

#### 5.4 问卷更新流程

**触发场景**：

1. **周期结束时**：计划完成弹窗 -> [去更新档案] -> 填写问卷。
2. **学员主动更新**：个人中心 -> 我的档案 -> [更新健康数据]。
3. **教练发起**：教练端学员详情 -> [发送问卷] -> 学员收到通知填写。

**流程**：

```
学员进入问卷页面
    ↓
系统加载 coach_questionnaires (该教练最新版本)
    ↓
学员填写并提交
    ↓
后端操作：
  1. 将答案写入 questionnaire_responses（历史快照）
  2. 更新 user_profiles 中的对应字段（如体重、目标等）
  3. 可选：触发 AI 生成计划的建议
    ↓
前端返回确认 + [生成下一阶段计划] 入口
```

#### 5.5 历史问卷是否需要保留？

**结论：是的，必须保留。**

| 保留对象                                 | 方式                               | 原因                                                   |
| ---------------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| **问卷模版** (`coach_questionnaires`)    | 版本化，旧版本 `is_active = false` | 教练可能会调整问题，但历史回答需要对应到当时的问题版本 |
| **学员回答** (`questionnaire_responses`) | 每次填写都插入新记录               | 用于周期对比、AI上下文、审计                           |

**示例**：

```
2024-01 学员订阅，首次填写问卷 v1 -> Response #1 (体重 80kg, 目标: 减脂)
2024-03 第一周期结束，重新填写问卷 v1 -> Response #2 (体重 75kg, 目标: 增肌)
2024-04 教练更新问卷增加新问题 -> 问卷变为 v2
2024-05 第二周期结束，填写问卷 v2 -> Response #3 (体重 76kg, 新增：训练频率 5次/周)
```

**教练端可视化**：学员详情 -> [档案历史] -> 时间轴展示所有
Response，并高亮显示变化字段。

## 4. 执行历史与记录 (Execution History)

这是本次设计的关键新增模块，用于解决"计划执行完去哪里看"的问题。

### 4.1 数据模型回顾

- **计划实例** (`coach_plan_instances`)：每个 Instance
  代表一个完整的执行周期，有独立的 `id`、`status`、`start_date`、`end_date`。
- **执行记录** (`plan_instance_executions`)：每天的训练完成情况，关联到
  `instance_id`。
- **视频记录** (`execution_set_videos`)：每组的视频，关联到 `execution_id`。

### 4.2 学员端：历史计划页面 (`/student/plan-history`)

**入口**：首页/个人中心的 [我的训练历史] 按钮。

**展示内容**：

- **列表视图**：按时间倒序展示所有 `status IN ('completed', 'archived')`
  的计划。
- **卡片信息**：
  - 计划名称
  - 来源标识：[教练指派] / [我的计划]
  - 执行周期：2024/01/01 - 2024/02/28
  - 完成度：85%
  - PR 突破数：3
- **点击进入详情**：
  - 展示该计划下所有 `plan_instance_executions` 记录。
  - 按周/天回顾每日训练内容和完成情况。
  - 查看视频回放。

### 4.3 教练端：学员计划历史 (`/coach/student/[id]/plan-history`)

**入口**：学员详情页的 [计划历史] Tab。

**展示内容**：

- **时间轴视图**：展示该学员所有历史计划（包括教练分配的和学员自制的）。
- **筛选器**：[全部] / [我分配的] / [学员自制]。
- **分析功能**：
  - 周期对比：减脂一期 vs 减脂二期 的效果对比。
  - PR 趋势曲线：跨越多个周期的力量进步。

### 4.4 教练端仪表盘：历史计划概览

**模块**："学员执行记录"

- 最近完成计划的学员列表。
- 快捷操作：[查看详情] / [分配下一阶段]。

---

## 5. 功能模块改造需求

### A. 后端 API 改造

#### 1. 获取当前计划 (`GET /api/student/plan/current`)

- **逻辑变更**：
  - 查询 `student_id` 下 `status = 'active'` 的唯一实例。
  - 若存在 `status = 'scheduled'` 且 `start_date <= Today`
    的计划，自动将旧计划设为 `completed`，新计划设为
    `active`（懒加载触发状态流转）。
- **返回**：
  - 单一 Instance 对象。
  - 若无 Active 计划，返回空状态 + 提示信息。

#### 2. 获取计划历史 (`GET /api/student/plan/history`)

- **逻辑**：查询所有 `status IN ('completed', 'archived')` 的记录。
- **参数**：`source` (可选，筛选 `coach` / `student`)。
- **返回**：列表（名称、周期、完成率、来源）。

#### 3. 获取执行详情 (`GET /api/student/plan/[instanceId]/executions`)

- **逻辑**：获取指定计划下所有 `plan_instance_executions`。
- **返回**：按日期排序的执行记录列表，包含动作完成情况和视频链接。

#### 4. 教练端学员计划历史 (`GET /api/coach/student/[studentId]/plan-history`)

- **逻辑**：获取指定学员的所有历史计划。
- **权限**：必须是该学员的订阅教练。

### B. 前端页面改造

#### 学员端

- [ ] 首页增加 [我的训练历史] 入口。
- [ ] 计划历史列表页 (`/student/plan-history`)。
- [ ] 计划执行详情页 (`/student/plan/[id]/executions`)。

#### 教练端

- [ ] 学员详情页增加 [计划历史] Tab。
- [ ] 仪表盘增加 "最近完成计划" 模块。

---

## 6. 迁移与兼容性

- **存量数据处理**：
  - 扫描现有所有 `training_plans` (旧表) 数据，如果我们在用新表，确保老用户的
    Plan 被迁移为一个 `active` 的 `coach_plan_instances`。
- **并行期**：
  - 确保 App 端升级前，API 能同时兼容（或者强制更新）。

---

## 7. 开发任务清单 (To-Do)

### 后端

- [ ] API：实现 `GET /api/student/plan/history`。
- [ ] API：实现 `GET /api/student/plan/[id]/executions`。
- [ ] API：实现 `GET /api/coach/student/[id]/plan-history`。
- [ ] 逻辑：`Subscription` 续费触发通知。
- [ ] 逻辑：计划完成时触发存档。

### 前端（学员）

- [ ] 页面：训练历史列表页。
- [ ] 页面：计划执行详情页。
- [ ] 组件：计划完成弹窗（引导更新问卷/开始新计划）。

### 前端（教练）

- [ ] 组件：学员详情页"计划历史" Tab。
- [ ] 组件：仪表盘"最近完成计划"模块。

### 文档

- [ ] 更新 API 文档中的 Status 定义。
- [ ] 补充 `source` 字段的用途说明。
