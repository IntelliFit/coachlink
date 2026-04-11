# P0 迁移功能验证指南

> 小程序与网站功能迁移 — P0 级（T01–T06）验证：前端交互与后端逻辑需与网站对齐  
> 更新日期：2026-02-27

---

## 一、前置条件

### 1.1 后端与 API 环境

| 项目 | 说明 |
|------|------|
| **共用后端** | 小程序与网站必须指向**同一套 coachlink 后端 API**（Next.js 项目） |
| **API 地址** | 小程序 `config/dev.ts` 中 `TARO_APP_API_URL` 默认指向本机 `http://<局域网IP>:3000` 或 `http://127.0.0.1:3000` |
| **启动后端** | 在 `coachlink` 目录执行 `pnpm dev`，确保 API 服务运行在 3000 端口 |

### 1.2 数据准备

为充分验证，建议准备以下测试数据：

| 场景 | 数据要求 |
|------|----------|
| **多订阅切换 (T05)** | 同一学员订阅 **2 个及以上** 教练，且每位教练都有已激活的计划 |
| **missingDays (T06)** | 有「未确认/未完成」的训练日（例如：昨天开始训练但未完成或未跳过，今天再进入今日训练） |
| **计划完成弹窗 (T06)** | 计划所有训练日已完成，且 `instance.status === 'active'`（由 loadData 内逻辑自动检测并调用 complete-instance） |

---

## 二、API 对照（与网站一致）

以下为本次涉及的主要 API，确保小程序调用格式与网站一致：

| API | 方法 | 小程序调用 | 网站对照 | 请求体 |
|-----|------|-----------|----------|--------|
| `/api/plan-lib/get-instance` | POST | `trainingService.getInstance()` | `planLibService.getInstance()` | `{ subscriptionId }` 或 `{ fetchSelf: true }` 或 `{ id: instanceId }` |
| `/api/plan-lib/complete-instance` | POST | `request({ url, method, data })` | `fetch('/api/plan-lib/complete-instance')` | `{ instanceId: string }` |
| `/api/execution/skip-day` | POST | `executionService.skipDay()` | `fetch('/api/execution/skip-day')` | `{ instanceId: string, dayIndex: number }` |

**注意**：训练执行页跳转时传入的 `instanceId` 为**计划实例 id**（`coach_plan_instances.id`），不是订阅 id。小程序已改为 `getInstance({ id: instanceId })` 与网站对齐。

---

## 三、逐功能验证步骤

### 3.1 T05：多订阅切换

**验证目标**：订阅 ≥2 个教练时，顶部显示 Tab，切换后教练卡片与计划内容正确刷新。

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 用同一学员账号订阅 2 个教练，并为每个教练创建/激活计划 | 今日训练页可加载 |
| 2 | 进入今日训练页 | 顶部出现横向滚动的教练 Tab（如「教练A」「教练B」） |
| 3 | 点击不同 Tab | 教练卡片头像、姓名、计划内容随 Tab 切换 |
| 4 | 切换 Tab 后点击「开始训练」 | 进入对应教练计划的训练执行页 |

**网络验证**：切 Tab 时无新请求（数据已预加载）；切 Tab 后刷新或二次进入时，`get-instance` 应按 `subscriptionId` 分别请求。

---

### 3.2 T06：missingDays 补训提示

**验证目标**：存在未完成历史训练日时，显示补训条，支持「去补练」和「跳过」。

**制造 missingDays 的方式**（任选其一）：

- 方式 A：昨天开始某天训练但未完成、未跳过，今天再进今日训练
- 方式 B：在数据库中构造：`plan_instance_executions` 中某天 `status` 为 `in_progress` 且未 `completed`，且 `get-instance` 返回的 `recommendedDayIndex` 已大于该天
- 方式 C：使用网站或小程序，先跳过若干天，再手动在 DB 中清除对应 `plan_instance_executions` 记录，使 `get-instance` 计算出 `missingDays`

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 进入今日训练页（存在 missingDays） | 计划区域上方出现黄色提示条：「你有 N 天训练日未确认/未完成」 |
| 2 | 点击「去补练 第X天」 | 跳转到训练执行页，`dayIndex` 为 X |
| 3 | 在训练执行页完成或跳过该天 | 返回今日训练后，missingDays 减少或消失 |
| 4 | 点击「跳过」 | 调用 `skip-day`，Toast「已跳过」，今日训练数据刷新，该天从 missingDays 中移除 |

**网络验证**：

```
POST /api/execution/skip-day
Body: { "instanceId": "<计划实例id>", "dayIndex": <数字> }
响应: { "success": true, "data": { "instanceId", "dayIndex" } }
```

---

### 3.3 T06：计划完成弹窗

**验证目标**：计划全部训练日完成后，自动调用 `complete-instance` 并弹出完成弹窗。

**制造条件**：计划所有训练日已 `completed` 或 `abandoned`，且 `instance.status === 'active'`。

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 完成计划最后一天训练（或通过数据构造） | 今日训练页 loadData 检测到 `completedCount >= totalCount` |
| 2 | 自动触发 | 调用 `POST /api/plan-lib/complete-instance`，弹出「恭喜完成训练计划！」弹窗 |
| 3 | 点击「查看执行记录」 | 关闭弹窗，跳转 `/pages/me/plan-history/index` |
| 4 | 再次进入时点击「稍后再说」 | 关闭弹窗，执行 `loadData()` 刷新 |

**网络验证**：

```
POST /api/plan-lib/complete-instance
Body: { "instanceId": "<计划实例id>" }
响应: { "success": true, "data": { "success": true, "instance": {...} } }
```

---

## 四、与网站对照检查清单

建议在**网站**和**小程序**中做同流程对比：

| 检查项 | 网站 | 小程序 |
|--------|------|--------|
| 多订阅时是否有教练 Tab | `/today-training` 有「已订阅教练」切换区 | 今日训练页有 `.coach-tabs` 横向 Tab |
| missingDays 提示文案 | 「你有 N 天训练日未确认/未完成…」 | 一致 |
| 补练跳转 | `router.push(\`/training-execution/${instance.id}?dayIndex=${di}\`)` | `Taro.navigateTo({ url: \`...?instanceId=...&dayIndex=${di}\` })` |
| 跳过逻辑 | 调用 `/api/execution/skip-day`，刷新 loadData | 调用 `executionService.skipDay`，执行 loadData |
| 计划完成弹窗 | `PlanCompletionModal`，含「更新问卷」「生成下一阶段」「查看记录」等 | 简化版：「查看执行记录」「稍后再说」 |

---

## 五、常见问题排查

| 现象 | 可能原因 | 排查方向 |
|------|----------|----------|
| 多订阅 Tab 不显示 | `coachSubscriptions.length <= 1` | 确认账号订阅了 ≥2 个教练 |
| missingDays 始终为空 | 后端 `get-instance` 未返回 `missingDays` | 检查 API 响应是否包含 `recommendedDayIndex`、`missingDays` 等派生字段 |
| 「去补练」跳转后报错 | 计划实例 id 与订阅 id 混淆 | 已修复：training-execution 使用 `getInstance({ id: instanceId })` |
| 计划完成弹窗不出现 | `complete-instance` 未成功或判断逻辑未命中 | 在 loadData 中加 `console.log` 确认 `completedCount`、`totalCount`、`handleCompletePlan` 是否被调用 |
| skip-day 返回 400 | `dayIndex` 非训练日或小于 `start_execution_day` | 确认跳过的是训练日（非休息日），且 ≥ 起始执行日 |

---

## 六、建议的验证顺序

1. **先确保后端可用**：在 `coachlink` 中 `pnpm dev`，用网站完成一次完整训练流程。
2. **小程序连同一后端**：`TARO_APP_API_URL` 指向该后端，登录同一学员账号。
3. **按 T05 → T06 顺序**：先验证多订阅 Tab，再验证 missingDays 与完成弹窗。
4. **对比网络请求**：用微信开发者工具 Network 或 Charles 抓包，对照网站相同操作下的请求 URL、Body、响应格式。
