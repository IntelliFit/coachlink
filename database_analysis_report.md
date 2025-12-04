# 数据库分析报告（截至 2025-12-04）

## 1️⃣ 当前保留的表（共 32 张）

| 序号 | 表名                          | 角色 / 说明                | 当前状态                | 备注                           |
| ---- | ----------------------------- | -------------------------- | ----------------------- | ------------------------------ |
| 1    | admin_users                   | 系统管理员账号             | ✅ 正常使用             | 用于后台管理                   |
| 2    | alipay_orders                 | 支付订单记录               | ✅ 正常使用             | 关联用户支付                   |
| 3    | coach_actions                 | 教练行为日志               | ✅ 正常使用             | 用于统计教练活跃度             |
| 4    | coach_contents                | 教练内容库（文章、视频）   | ✅ 正常使用             | 内容分发                       |
| 5    | coach_messages                | 教练与学员私信             | ✅ 正常使用             | 实时聊天                       |
| 6    | coach_plan_template_tags      | 模板标签                   | ✅ 正常使用             | 便于分类检索                   |
| 7    | coach_plan_templates          | **核心模板库**             | ✅ 正常使用             | 教练设计的可复用训练计划模板   |
| 8    | coach_pricing                 | 教练收费套餐               | ✅ 正常使用             | 计费模型                       |
| 9    | coach_questionnaires          | 教练专属问卷               | ✅ 正常使用             | 用于学员入门评估               |
| 10   | **coach_rulepacks**           | 规则包（AI 生成计划）      | ⚠️ 暂保留               | 未来将被教练端计划编辑取代     |
| 11   | coach_subscriptions           | 教练订阅关系               | ✅ 正常使用             | 关联学员与教练                 |
| 12   | coaches                       | 教练基本信息               | ✅ 正常使用             | 主键 `id`                      |
| 13   | coach_pending_reviews         | 待审教练内容               | ✅ 正常使用             | 内容审核队列                   |
| 14   | content_interactions          | 内容交互（点赞、收藏）     | ✅ 正常使用             | 统计交互数据                   |
| 15   | conversations                 | 课堂/群聊会话              | ✅ 正常使用             | 记录聊天历史                   |
| 16   | lifestyle_logs                | 学员生活日志               | ✅ 正常使用             | 记录作息、饮食等               |
| 17   | onboarding_questionnaires     | 新用户入职问卷             | ✅ 正常使用             | 初始信息收集                   |
| 18   | personal_records              | **已废弃**                 | ❌ 仅存最大记录，缺历史 | 建议用 `user_1rm_history` 替代 |
| 19   | pullup_leaderboard            | 当前活跃的引体向上排行榜   | ✅ 正常使用             | 学员提交记录                   |
| 20   | rankingboard_pullup_2025_9_10 | **历史归档**（2025‑09‑10） | ✅ 正常使用             | 仅作历史快照                   |
| 21   | set_videos                    | 训练组视频（每组）         | ✅ 正常使用             | 关联 `training_records`        |
| 22   | shipping_info                 | 物流信息                   | ✅ 正常使用             | 关联订单                       |
| 23   | specialties                   | 教练专业领域               | ✅ 正常使用             | 用于标签过滤                   |
| 24   | training_plan_details         | **核心计划明细**           | ✅ 正常使用             | 存储每日/每周动作 JSONB        |
| 25   | training_plans                | **学员训练计划**           | ✅ 正常使用             | 关联 `training_plan_details`   |
| 26   | training_records              | 训练执行记录（每次训练）   | ✅ 正常使用             | 记录实际完成情况               |
| 27   | training_sessions             | 训练会话（计划中的一天）   | ✅ 正常使用             | 关联 `training_plan_details`   |
| 28   | training_statistics           | 统计视图/聚合数据          | ✅ 正常使用             | 动态计算而非存储               |
| 29   | training_videos               | 训练视频（完整训练）       | ✅ 正常使用             | 关联 `training_records`        |
| 30   | user_profiles                 | 学员个人档案               | ✅ 正常使用             | 包含 `sport_cards` 等字段      |
| 31   | users                         | 统一用户表（auth）         | ✅ 正常使用             | 主键 `id`                      |
| 32   | user_video_timeline           | 学员视频时间线             | ✅ 正常使用             | 关联 `training_videos`         |

---

## 2️⃣ 已删除的冗余表（供参考）

- `exercises`（已删除，因 `video_submissions` 依赖已清理）
- `video_submissions`（已删除，功能被 `training_videos` 替代）
- `training_exercises`、`training_sessions`（已合并至新结构）
- `training_progress`（未使用，统计改为动态视图）
- `training_reminders`（未使用，已删除）
- `workout_logs`（功能已合并至 `training_records`）

---

## 3️⃣ 核心问题回顾 & 未来改进方向

### 3.1 训练计划体系

- **现状**：学员端通过 `coach_rulepacks` 生成计划，导致 **计划来源不统一**，且
  `training_plan_details` 缺少动作视频、执行细节。
- **目标**：
  1. **教练端** 完全负责计划设计（`coach_plan_templates` + 新增
     `coach_exercises`）。
  2. **学员计划** 采用快照表
     `student_training_plans`、`student_plan_days`、`student_plan_exercises`，保存生成时的完整动作信息（包括
     `demo_video_url`、`execution_details`）。
  3. 逐步淘汰 `coach_rulepacks`，保留仅作 **AI 生成备选**（未来可在规则包上叠加
     AI），但不再作为学员生成入口。

### 3.2 个人记录（PR）

- **现状**：`personal_records` 只能保存单条最大记录，无法追踪历史。
- **改进**：创建 `user_1rm_history`（历史 1RM 表），并在 UI
  中绘制进步曲线。`personal_records` 将在后期迁移或直接删除。

### 3.3 排行榜

- `pullup_leaderboard` 为 **实时排行榜**，`rankingboard_pullup_2025_9_10` 为
  **历史归档**（每个挑战期结束后快照）。保留两者有助于 **历史回顾** 与
  **实时竞技**。

### 3.4 外键一致性

- 多个表仍引用 `auth.users`（如 `personal_records`），应统一为 `public.users`。
- 已在报告中列出需要统一的外键列表，后续迁移脚本可一次性完成。

---

## 4️⃣ 下一步行动计划（建议时间线）

| 阶段             | 目标                    | 关键任务                                                                                                                                                                                                                                  | 负责人          |
| ---------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| **P0（立即）**   | 完成核心表结构迁移      | 1. 创建 `coach_exercises`、`student_training_plans`、`student_plan_days`、`student_plan_exercises` <br>2. 将现有 `training_plan_details` 数据迁移至新快照表（保留视频、执行细节） <br>3. 删除 `coach_rulepacks` 相关 API（保留 fallback） | 后端团队        |
| **P1（1‑2 周）** | 替换 `personal_records` | 1. 创建 `user_1rm_history` <br>2. 编写迁移脚本将历史 PR 数据 <br>3. 更新前端进步曲线组件                                                                                                                                                  | 前端 & 数据团队 |
| **P2（2‑3 周）** | 完善排行榜              | 1. 在 UI 中区分实时 vs 历史榜单 <br>2. 为每个挑战期自动生成归档表（如 `rankingboard_pullup_2025_9_10`）                                                                                                                                   | 产品 & 后端     |
| **P3（3‑4 周）** | 外键统一 & 索引清理     | 1. 将所有 `auth.users` 外键改为 `public.users` <br>2. 删除冗余索引（`users.phone`、`user_profiles` 等）                                                                                                                                   | DBA             |

---

## 5️⃣ 关键风险 & 规避措施

| 风险                                | 说明                                                        | 规避措施                                                             |
| ----------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| 数据迁移期间计划丢失                | 迁移 `training_plan_details` 时若字段不匹配可能导致数据缺失 | 先在测试库完成全量迁移，验证后再在生产库执行，并保留原表备份 48h     |
| 外键统一导致级联删除错误            | 将 `auth.users` 改为 `public.users` 时可能触发级联删除      | 使用 `ON UPDATE CASCADE` 并先关闭外键约束，迁移完成后再启用          |
| 前端依赖 `coach_rulepacks` 仍在运行 | 部分旧页面仍调用该 API                                      | 在前端加入 `if (!RULEPACKS) return fallback`，并在部署前关闭对应路由 |

---

## 6️⃣ 小结

- 当前保留 **32 张** 表，已明确划分 **核心**、**已废弃**、**历史归档** 三类。
- 计划在 **教练端** 完全掌控训练计划设计，**学员端** 只负责使用快照计划。
- `coach_rulepacks` 暂时保留，后期可在 AI 生成方案中重新利用。
- 关键迁移工作已列出，建议按 **P0‑P3** 阶段逐步推进，确保业务不中断。

---

> **此报告已保存至**
> `C:\Users\29454\.gemini\antigravity\brain\df96f214-5034-42d7-96f4-f4ecfe89d2bb\database_analysis_report.md`
