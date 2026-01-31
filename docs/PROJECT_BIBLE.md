# CoachLink 项目全景图 (Project Bible)

> **目标**：让新加入的工程师在 1-2 天内掌握项目全貌，并能在 1 周内独立修改核心业务链路（订阅/计划/执行/算重量/视频/支付/通知）。  
> **阅读建议**：先通读“快速上手”，再按模块深入。本文是“总纲 + 目录索引 + 关键口径”，更细的实现细节会链接到对应专题文档。

---

## 快速上手（新同学必读 30-60 分钟）

### 你需要先搞懂的 3 件事
1. **我们卖的不是自然日**：订阅的核心扣减是 **训练日 credits**（B1 模型）。
2. **计划是“模板-实例”**：模板可复用，实例是发给学员执行的独立副本。
3. **强度与重量是系统竞争力**：1RM/RM/百分比 + 自重处理是产品护城河。

### 立刻把项目跑起来
- `npm run dev`
- 环境自检：`npm run check-env`
- 单测：`npm run test`
- E2E：`npm run test:e2e`

### 从哪里开始看文档（推荐路径）

- **按功能找资料**：`./FEATURES.md`（已完成/未完成清单 + 每项的需求/设计/分析/复盘入口）
- **理解业务全貌**：继续阅读本文件（Project Bible）

---

## 1. 业务灵魂（The Soul）

CoachLink 不是一个“训练记录 App”，而是一个 **“数字化教练办公室”**：
- **愿景**：把教练从 Excel / 微信聊天记录 / 重复解释中解放出来，让专业执教规模化。
- **核心痛点**：教练“带人多就带不精”，学员“执行不稳定 + 沟通低效”。
- **我们的护城河**：计划结构化（可复用）、训练执行结构化（可追踪）、负荷自动化（可自洽）。

> [!IMPORTANT]
> **创始人备注（请完善）**：用 5-10 句解释“为什么我们必须做这些功能”，尤其是：AI 导入、1RM 自动算重量、视频上下文、credits 订阅模型。

---

## 2. 技术栈与代码结构（Tech Stack & Layout）

- **前端/服务端渲染**：Next.js（App Router）
- **后端**：Supabase（PostgreSQL + Auth + Storage + Realtime）
- **样式/UI**：Tailwind CSS +（Shadcn/自研组件混用）
- **测试**：Vitest + Playwright

关键目录：
- `src/app/`：页面路由 + API Route（业务入口最多）
- `src/app/service/`：服务层（支付/订阅/会员等）
- `src/lib/`：可复用核心逻辑（如 credits 计算、推送等）
- `supabase/`：迁移脚本、策略、SQL 辅助
- `docs/`：设计文档库（本文件是总纲）

---

## 3. 领域模型总览（Domain Model Overview）

### 3.1 五个最核心概念（先背下来）
1. **User**：分为 Coach / Student（同一 user 也可能有多重身份）。
2. **CoachSubscription（订阅）**：教练与学员的契约（B1 credits 口径）。
3. **CoachPlanTemplate / CoachPlanInstance（模板/实例）**：模板可复用；实例发给学员执行。
4. **PlanInstanceExecution（执行记录）**：学员按 day_index 的真实执行（线上完成才会落库）。
5. **Membership / Quota（会员与配额）**：AI 导入次数、存储空间等权益系统。

### 3.2 数据库真相（务必看 Schema）
- Schema：`../supabase_schema.md`
- 类型定义（前端/服务端共用）：`src/types/database.types.ts`

> [!TIP]
> 读 Schema 的正确姿势：先定位表的“业务语义”，再看哪些 API route 在写这些表，最后再看前端怎么展示口径。

---

## 4. 核心业务模块（按“业务→数据→API→代码”拆解）

> 模块写作模板（每个模块都应补齐）：
> - **业务目标**：解决哪个真实痛点？
> - **核心口径**：字段语义/展示口径/结算口径分别是什么？
> - **状态机**：有哪些状态？如何流转？
> - **关键数据表**：主表与关键字段。
> - **关键 API/入口**：路由 + 服务层 + lib。
> - **边界场景**：断网/跳过/覆盖/迁移/续费/降级等。
> - **常见坑（Gotchas）**：写错会造成什么线上事故？

---

### 4.1 订阅与 Credits（B1：按训练日次数扣减）

**一句话总结**：对外卖“4 周/1 月”，对内扣减“训练日 credits”；订阅“开始”点不是付费，而是第一次训练执行。

#### 核心口径
- `coach_subscriptions.start_date`：**第一次训练 start 时写入**（付费不等于开始）。
- `coach_subscriptions.end_date`：在 B1 模型中是 **预计完成日（estimated completion date）**，主要用于 UI 展示，不是硬过期。
- “是否结束/到期”：由 **remainingCredits 是否为 0** 决定（而不是 end_date 倒计时）。

#### Credits 计算规则（必须一致）
- **totalCredits**：在 subscribed_weeks 的窗口内，统计计划中 `type=training` 的天数数量。
- **usedCredits**：`plan_instance_executions.status=completed` 的训练日（按 `day_index` 去重）。
- **线下迁移**：`start_execution_day > 1` 时，窗口内 `< start_execution_day` 的训练日也计入 usedCredits（不插入假 execution）。

#### 关键入口（代码指针）
- Credits 逻辑：`src/lib/subscriptionCredits.test.ts`（强建议把这里当作“可执行规格”）
- 刷新预计完成日：`src/app/api/execution/updateEstimatedEndDate.ts`
- 订阅列表/展示：`src/app/api/subscription/coach-subscriptions/route.ts`
- 订阅检查/过期刷新：
  - `src/app/api/subscription/check-subscription/route.ts`
  - `src/app/api/subscription/check-expired-subscriptions/route.ts`

#### 必读专题
- `./done/core-business/business-logic-b1-subscription-plan-execution.md`

---

### 4.2 计划系统（模板-实例、阶段切换、覆盖语义）

**一句话总结**：模板负责复用，实例负责执行；“新建阶段”与“覆盖当前”是两种完全不同的语义，必须让教练显式选择。

#### 关键数据表与字段语义
- `coach_plan_templates.training_days`：模板的计划结构（可复用）。
- `coach_plan_instances.training_days`：实例的计划结构（模板深拷贝，可独立修改）。
- `coach_plan_instances.status`：`draft/active/paused/completed/archived`。
- `coach_plan_instances.start_execution_day`：**执行起点 dayIndex**（支持线下迁移/从中间开始）。

#### 状态/语义（产品必须讲清楚）
- **新建阶段（推荐）**：归档旧实例 → 新建实例 → 执行次数从 0 开始。
- **覆盖当前（高风险）**：更新当前实例 → 保留旧执行记录 → 统计口径不清会引发误解。

#### 必读专题
- 计划系统设计：`./done/core-business/coach_plan_system_design.md`
- 典型线上坑复盘（覆盖 vs 新建阶段 & 口径修复）：`./done/core-business/bugfix-notes-2026-01-20.md`

---

### 4.3 执行系统（Execution：训练日、组、视频、进度）

**一句话总结**：execution 是学员“真实完成”的证据；它驱动 nextDayIndex、credits 扣减、视频待点评列表等。

#### 关键口径与一致性要求
- execution 必须绑定计划实例的正确外键：**`instance_id`**（历史 bug 曾误用 `plan_instance_id`）。
- credits 统计只认 `status=completed`（`in_progress` 不应计入已完成）。
- 覆盖计划会改变 dayIndex 的语义内容：统计仍按 dayIndex 对齐，可能产生“进度错位感”。

#### 关键入口（代码指针）
- 开始训练：`src/app/api/execution/start/route.ts`
- 完成训练：`src/app/api/execution/finish/route.ts`
- 跳过某天：`src/app/api/execution/skip-day/route.ts`
- 完成单组/动作：
  - `src/app/api/execution/complete-set/route.ts`
  - `src/app/api/execution/complete-item/route.ts`
- 上传组视频：`src/app/api/execution/upload-set-video/route.ts`
- 取今日训练实例：`src/app/api/plan-lib/get-today-training-instance/route.ts`
- 取实例并计算 nextDayIndex：`src/app/api/plan-lib/get-instance/route.ts`

#### 必读专题
- 关键 bug：字段误用导致“今日训练停留第 1 天”：`./done/core-business/bugfix-notes-2026-01-20.md`

---

### 4.4 自动算重量（1RM / RM / 百分比 + 自重处理）

**一句话总结**：RM 模式会把“自重动作”纳入总负荷计算并进行抵扣；百分比模式默认 1RM 已是外部负重能力。

#### 两种计算模式
- **RM 模式**：推荐重量 \(L_r = (1RM + \alpha W) / \lambda(r) - \alpha W\)
  - \(\alpha=1\)：包含自重的动作（深蹲/引体/俯卧撑/平板支撑等）
  - \(\alpha=0\)：不含自重（器械/杠铃常规）
- **百分比模式**：`推荐重量 = 1RM × 百分比`（当前实现不抵扣自重）

#### 关键入口（代码指针）
- 计算引擎：`src/lib/rmCaculator.ts`
- 表单实时计算：`src/app/dashboard/plan-lib/components/ActionSetForm.tsx`
- AI 计划匹配：`src/app/api/plan-lib/create-ai-instance/match.ts`

#### 必读专题
- `./done/core-business/auto_weight_calculation.md`

---

### 4.5 问卷系统（字段口径与默认问卷一致性）

**一句话总结**：问卷存在历史字段与新字段重复（`is_active` vs `status`，`is_default` vs `default_questionnaire_id`），必须统一口径，否则数据会不一致。

#### 关键口径
- `is_active` 与 `status`：功能重复，建议逐步统一到 `status`。
- `is_default` 与 `coaches.profile.default_questionnaire_id`：可能不同步，存在一致性风险。

#### 关键入口（代码指针）
- 列表/读取/更新：
  - `src/app/api/coach/list-questionnaires/route.ts`
  - `src/app/api/coach/get-questionnaires/route.ts`
  - `src/app/api/coach/update-questionnaires/route.ts`
  - `src/app/api/coach/publish-questionnaire/route.ts`
- 设置默认：`src/app/api/coach/set-default-questionnaire/route.ts`（需要重点关注同步问题）

#### 必读专题
- `./done/core-business/questionnaire_fields_analysis.md`

---

### 4.6 会员权益与配额（AI 次数 / 存储空间 / 懒重置）

**一句话总结**：会员权益通过配置中心定义，配额采用“懒重置”策略：用户使用时检查是否跨月并重置。

#### 核心设计
- 配置中心：`MEMBER_BENEFITS`（free/basic/premium）
- 配额表：`student_quotas`（关注 `ai_import_balance`、`storage_total_mb`、`storage_used_mb`、`last_reset_date`）
- **懒重置**：只在用户使用权益时检查 `last_reset_date` 是否跨月并重置配额。
- 降级处理：不删历史文件，禁止新增上传直到用量低于配额（软限制）。

#### 关键入口（代码指针）
- 会员服务：`src/app/service/studentMembershipService.ts`

#### 必读专题
- `./done/system-design/membership_entitlements_system.md`
-（成本与配额相关）`./done/implementation/lessons/storage_cost_analysis.md`

---

### 4.7 系统通知（Web Push）

**一句话总结**：Web Push = Service Worker + Push Subscription + 服务端 `web-push` 发送；iOS 需要用户手势触发授权，且 iOS 16.4+ 支持。

#### 关键入口（代码指针）
- SW：`public/sw.js`
- 注册与订阅：`src/lib/swRegistration.ts`
- 服务端发送：`src/lib/pushNotify.ts`
- 订阅写库：`src/app/api/push/subscribe/route.ts`

#### 必读专题
- `./done/system-design/push-notifications.md`

---

### 4.8 支付与订单（支付宝 + 教练收款码）

> 这一块业务通常“看似简单，实际高风险”（回调幂等、订单状态机、对账）。建议新同学先只做需求最小闭环，避免改坏结算链路。

#### 关键入口（代码指针）
- 支付宝 API routes：
  - `src/app/api/payment/alipay/create/route.ts`
  - `src/app/api/payment/alipay/query/route.ts`
  - `src/app/api/payment/alipay/notify/route.ts`（异步回调）
  - `src/app/api/payment/alipay/return/route.ts`（同步跳转）
- 支付相关函数：`src/functions/*alipay*/`
- 支付服务层：`src/app/service/alipayService.ts`
- 会员下单：`src/app/api/membership/create-order/route.ts`
- 前端支付 UI：`src/components/payment/paymentDialog.tsx`

---

## 5. 常见深坑（Gotchas，新人最容易踩）

1. **end_date 不是硬到期**：B1 模型下它是“预计完成日”，只能用于展示。
2. **execution 外键一定是 instance_id**：误用会导致进度永远回到第 1 天。
3. **覆盖计划会导致 dayIndex 语义变化**：统计仍按 dayIndex 对齐，容易出现“执行次数没清零/进度错位”。
4. **问卷默认字段可能不同步**：`set-default-questionnaire` 需要关注同步策略。
5. **Push 权限必须用户手势触发**（iOS 尤其严格）。

---

## 6. 必读子文档（专题索引）

### 核心业务逻辑（新人必读）
- B1 订阅模型（商业逻辑核心）：`./done/core-business/business-logic-b1-subscription-plan-execution.md`
- 训练执行系统规范：`./done/core-business/training-execution-self-consistent-spec-v1.md`
- 计划系统设计：`./done/core-business/coach_plan_system_design.md`
- 自动算重量：`./done/core-business/auto_weight_calculation.md`
- 问卷字段口径：`./done/core-business/questionnaire_fields_analysis.md`
- Bug 修复记录：`./done/core-business/bugfix-notes-2026-01-20.md`

### 系统设计
- 会员权益与配额：`./done/system-design/membership_entitlements_system.md`
- Web Push：`./done/system-design/push-notifications.md`

### 产品文档
- 产品演示（理解功能全貌）：`./done/product/给刘三乐演示用法.md`

### 测试
- 测试快速指南：`./done/testing/测试快速指南.md`
- 测试策略深度解析：`./done/testing/测试策略深度解析.md`
- 测试分析与改进方案：`./done/testing/测试分析与改进方案.md`
-（示例测试流）饮食支持测试流程：`./done/testing/diet_support_test_flow.md`

---

> **结语**：CoachLink 的难点不在 UI，而在“业务口径的一致性”。写代码前先对齐口径，写完代码后用测试与文档固化口径。
