# 小程序功能同步优先级计划

> 基于 `SYNC_RESEARCH.md` 调研结果整理  
> 更新日期：2026-02-26  
> 原则：**Service 先行 → 页面逻辑 → UI 细节**；先主链路，再扩展功能

---

## 版本快照（计划基准）

> **重要**：本计划与 `SYNC_RESEARCH.md` 共享同一版本基准。网站或小程序任一仓库更新后，需先确认基准是否仍有效，再决定是否重新做调研与任务拆分。

| 仓库 | 分支 | 提交哈希 | 提交时间 | 提交说明 |
|------|------|----------|----------|----------|
| **coachlink**（网站） | main | `00f9230f2c45497fa1b9eeee401c521be741b99c` | 2026-02-25 15:32:54 | fix: 学员端计划库创建/编辑页与学员导航更新 |
| **wechat-app**（小程序） | main | `9c6030097ac79f04da02b5b8b7651076abf69a3e` | 2026-02-16 00:45:37 | feat:实现智能导入计划 |

**后续同步迭代时**：
1. 若**网站**有新提交：参考 `SYNC_RESEARCH.md` 的「重新调研步骤」，更新调研 → 视变更补充新任务到本计划
2. 若**小程序**有提交：任务完成时在 `TASK_BOARD.md`（如有）打勾并填完成时间；本计划版本基准可不变
3. 若两端均有较大变更：建议重新执行一次完整调研，并更新本计划中的任务列表

---

## 优先级说明

| 级别 | 标准 |
|------|------|
| **P0** | 影响用户每天核心使用（训练记录）；不做则体验有明显残缺 |
| **P1** | 高频使用但非每日必须；缺失会让用户明显感知功能不完整 |
| **P2** | 中频使用；提升体验但不影响基本流程 |
| **P3** | 低频 / 高复杂度；有则更好，暂时缺失影响有限 |

---

## P0 — 训练核心链路（优先完成）

> 目标：让用户可以在小程序里完成一次**完整训练**（开始 → 记录每组 → 完成），且能正确处理非力量项目、休息日、断网恢复等场景。

---

### T01 · 重构 executionService（Service 层基础）

**背景**：`start` / `complete-set` / `finish` / `upload-set-video` / `add-set-video-link` 这五个调用目前都 inline 散落在 `training-execution/index.tsx` 里。后续 T02~T04 都依赖这个 Service 统一管理。

**要做什么**：

1. 在 `src/services/executionService.ts` 补充以下方法（对照网站 `service/executionService.ts`）：
   - `startExecution(instanceId, dayIndex)` → `POST /api/execution/start`
   - `completeSet(executionId, actionId, setNumber, data)` → `POST /api/execution/complete-set`
   - `completeItem(executionId, itemId, data)` → `POST /api/execution/complete-item`
   - `finishTraining(executionId)` → `POST /api/execution/finish`
   - `getExecution(executionId)` → `POST /api/execution/get`
   - `checkToday(instanceId)` → `POST /api/execution/check-today`
   - `skipDay(instanceId, dayIndex)` → `POST /api/execution/skip-day`
   - `uploadSetVideo(file, executionId, actionId, setNumber)` → `POST /api/execution/upload-set-video`
   - `addSetVideoLink(data)` → `POST /api/execution/add-set-video-link`
   - `calculateE1RM(weight, reps, formula)` → `POST /api/execution/calculate-e1rm`

2. 将 `training-execution/index.tsx` 中所有 inline `request(...)` 调用替换为上述 service 方法。

**涉及文件**：`src/services/executionService.ts`、`src/pages/training-execution/index.tsx`

---

### T02 · 训练执行 — 支持非力量项目完成（complete-item）

**背景**：网站训练计划中包含「饮食建议」「有氧运动」「习惯打卡」三类非力量项目，完成逻辑与力量组（complete-set）不同，调用 `complete-item` 接口。小程序训练执行页目前只处理力量组。

**要做什么**：

1. 在训练执行页根据 item 类型（`itemType`）区分渲染：
   - `STRENGTH`：现有组记录 UI（重量/次数/RPE）
   - `DIET`：打卡按钮 + 备注
   - `CARDIO`：完成时长/距离 + 打卡按钮
   - `HABIT`：勾选打卡按钮
2. 完成非力量项目时调用 `executionService.completeItem(...)` 而非 `completeSet`。
3. 参考网站 `app/dashboard/plan-lib/components/` 下的 `DietItemForm`、`CardioItemForm`、`HabitItemForm` 了解字段定义。

**涉及文件**：`src/pages/training-execution/index.tsx`、`src/services/executionService.ts`

---

### T03 · 训练执行 — 休息日跳过 + 今日状态恢复（skip-day / check-today）

**背景**：用户可能中途关闭小程序再回来，需要恢复当前执行状态；也需要能跳过当天训练（标记为休息日）。

**要做什么**：

1. 训练执行页进入时，先调用 `executionService.checkToday(instanceId)` 判断今日是否已有进行中的执行记录，若有则恢复继续（而非重新开始）。
2. 在训练执行页添加「跳过今日」按钮，调用 `executionService.skipDay(instanceId, dayIndex)`，成功后返回今日训练页。
3. 今日训练页也需要响应跳过后的状态刷新。

**涉及文件**：`src/pages/training-execution/index.tsx`、`src/pages/today-training/index.tsx`

---

### T04 · 训练执行 — 临时增加动作 / 增加组（extra-content）

**背景**：网站支持在训练执行过程中临时添加额外动作或额外组数，对应 `extra-content` 系列 API。这是用户自定义训练强度的重要能力。

**要做什么**：

1. 在 `executionService` 补充四个方法：
   - `addExtraExercise(executionId, actionId, params)`
   - `deleteExtraExercise(executionId, actionId)`
   - `addExtraSet(executionId, actionId, setData)`
   - `deleteExtraSet(executionId, actionId, setNumber)`
2. 在训练执行页每个动作卡片底部添加「+ 额外组」按钮，弹出重量/次数输入后调用 `addExtraSet`。
3. 在动作列表底部添加「+ 临时动作」入口，跳转动作选择后调用 `addExtraExercise`。

**涉及文件**：`src/services/executionService.ts`、`src/pages/training-execution/index.tsx`

---

### T05 · 今日训练 — 多订阅切换

**背景**：网站今日训练支持用户同时订阅多个教练，顶部有 Tab 切换。小程序目前只支持单一教练订阅 + 自建计划的二选一。

**要做什么**：

1. 调用 `/api/subscription/list-subscriptions` 获取所有进行中的教练订阅。
2. 若订阅数 > 1，在今日训练页顶部显示横向滚动的订阅切换 Tab。
3. 每个订阅独立缓存对应的计划实例和当前进度数据。
4. 参考网站 `today-training/page.tsx` 中 `coachSubscriptions` / `activeCoachSubscriptionId` / `coachPlanDataBySubId` 的状态管理逻辑。

**涉及文件**：`src/pages/today-training/index.tsx`、`src/services/subscriptionService.ts`

---

### T06 · 今日训练 — 补训提醒（missingDays）+ 计划完成弹窗

**背景**：网站会检测用户有未完成的历史训练日（missingDays），提示补训；以及当整个计划周期完成时弹出完成弹窗。

**要做什么**：

1. 今日训练页加载时，检查 `get-today-training-instance` 返回的 `missingDays` 字段，若非空则在页面顶部展示「有 N 天未完成的训练，是否补训？」提示条，点击可跳转到对应日期执行。
2. 训练完成（finish API 返回）后，若后端返回 `planCompleted: true`，弹出计划完成弹窗，展示完成率和鼓励语。

**涉及文件**：`src/pages/today-training/index.tsx`

---

## P1 — 高频功能补齐

---

### T07 · 新增即兴训练页面（全新功能）

**背景**：网站有「即兴训练」功能，用户可以不依赖计划，临时从动作库挑选动作组合直接开始训练，对应独立的 `/api/impromptu/*` 系列接口。小程序完全没有。

**要做什么**：

1. 新建 `src/services/impromptuService.ts`，封装以下方法：
   - `start(items)` → `POST /api/impromptu/start`（传入临时动作列表）
   - `get(impromptuId)` → `POST /api/impromptu/get`
   - `listActions()` → `POST /api/impromptu/list-actions`（获取可选动作列表）
   - `completeSet(impromptuId, actionId, setNumber, data)` → `POST /api/impromptu/complete-set`
   - `finish(impromptuId)` → `POST /api/impromptu/finish`
   - `addExtraExercise / addExtraSet / deleteExtraExercise / deleteExtraSet`（同 execution 的 extra-content）

2. 新建页面 `src/pages/impromptu-training/index.tsx`，流程：
   - 第一步：从学员动作库选择动作，设置组数/次数参数（参考网站 `ImpromptuTrainingPage` + `ActionSetForm`）
   - 第二步：点击「开始训练」调用 `impromptuService.start()`，跳转执行页
   - 执行页复用 `training-execution/index.tsx` 的组件结构，但数据来源改为 `impromptuService`

3. 在 `app.config.ts` 注册路由 `pages/impromptu-training/index`。
4. 在今日训练页增加「即兴训练」入口按钮。

**涉及文件**：新增 `src/services/impromptuService.ts`、新增 `src/pages/impromptu-training/index.tsx`、`src/pages/today-training/index.tsx`、`src/app.config.ts`

---

### T08 · 新增训练历史日历页

**背景**：网站 `/me/training-history` 有按月查看训练完成记录的日历视图，可以点击某天查看当天训练详情。小程序缺少这个页面。

**要做什么**：

1. 新建 `src/services/trainingHistoryService.ts`，封装：
   - `getCalendar(year, month)` → `POST /api/training-history/calendar`（返回当月每天完成状态）
   - `getDayDetail(date)` → `POST /api/training-history/day`（返回某天训练记录）
   - `getMonthShare(year, month)` → `POST /api/training-history/month-share`（生成月份分享数据）

2. 新建页面 `src/pages/me/training-history/index.tsx`：
   - 月份切换控件（上一月/下一月）
   - 日历网格，每天标记已训练/未训练/休息
   - 点击某天展开当天训练摘要
   - 右上角「分享本月战绩」按钮，调用 `getMonthShare` 后生成分享图或展示统计数据

3. 在 `app.config.ts` 注册，并在训练历史列表页（`me/plan-history/index`）顶部添加「日历」入口。

**涉及文件**：新增 `src/services/trainingHistoryService.ts`、新增 `src/pages/me/training-history/index.tsx`、`src/pages/me/plan-history/index.tsx`、`src/app.config.ts`

---

### T09 · 教练主页 — 订阅续费 + 待支付状态

**背景**：网站教练主页支持订阅到期后续费（调用 `renew-subscription`），以及合并展示「待支付」状态的订阅。小程序目前只支持首次订阅。

**要做什么**：

1. 在 `src/services/subscriptionService.ts` 添加 `renewSubscription(subscriptionId, params)` → `POST /api/subscription/renew-subscription`。
2. 在教练主页 `coach-profile/index.tsx` 中：
   - 检查现有订阅状态，若状态为 `expired` 或 `near_expiry`，显示「续费」按钮而非「订阅」按钮
   - 若有 `pending_payment` 状态的订阅，在顶部展示「您有待支付的订阅」提示，点击可复制支付链接
3. 续费流程同新订阅：复制支付宝链接 → 跳转 payment-waiting 页。

**涉及文件**：`src/services/subscriptionService.ts`、`src/pages/coach-profile/index.tsx`

---

### T10 · 学员档案 — PR 管理（创建 / 删除）

**背景**：网站中用户可以手动在档案里创建 PR 记录（不依赖训练执行自动生成），也可以删除错误记录。小程序档案页只能查看 PR 不能操作。

**要做什么**：

1. 在 `executionService` 中补充（T01 中已规划但这里是档案页的调用）：
   - `createPR(data)` → `POST /api/execution/create-pr`
   - `deletePRRecord(prId)` → `POST /api/execution/delete-pr-record`
2. 在档案页 `profile/detail/index.tsx` 的「进步足迹」Tab：
   - 每条 PR 记录右侧添加删除按钮，调用 `deletePRRecord`
   - 顶部添加「+ 手动记录 PR」按钮，弹出表单（动作名/重量/次数/日期/备注），调用 `createPR`

**涉及文件**：`src/services/executionService.ts`、`src/pages/profile/detail/index.tsx`

---

### T11 · 知识库 — 搜索功能

**背景**：网站知识库有全文搜索，可以搜索书籍/文章/节点内容。

**要做什么**：

1. 在 `src/services/knowledgeService.ts` 补充 `search(keyword)` → `GET /api/knowledge/search?q=xxx`。
2. 在知识库首页 `knowledge/index.tsx` 顶部添加搜索栏，输入后展示搜索结果列表（书籍和文章混合），点击跳转对应详情。

**涉及文件**：`src/services/knowledgeService.ts`、`src/pages/knowledge/index.tsx`

---

### T12 · 新增文章详情页

**背景**：小程序知识库展示了文章列表，但点击后无处跳转（缺少详情页）。

**要做什么**：

1. 新建 `src/pages/articles/detail/index.tsx`：
   - 接收 `articleId` 参数，调用 `/api/public/articles/get` 获取文章内容
   - 渲染文章标题、封面图、正文（Markdown 转文本/简单样式）
   - 如果是付费文章，展示购买提示（引导去网页端购买）
2. 在知识库首页文章列表点击时跳转到此页。
3. 在 `app.config.ts` 注册 `pages/articles/detail/index`。

**涉及文件**：新增 `src/pages/articles/detail/index.tsx`、`src/pages/knowledge/index.tsx`、`src/app.config.ts`

---

### T13 · 教练学员详情页 — 完善学员信息展示

**背景**：小程序 `coach/students/detail` 目前只显示学员名称和档位（约 45 行），网站有完整的学员信息、操作记录、训练进度。

**要做什么**：

1. 完善 `coach/students/detail/index.tsx`，参考网站 `dashboard/students/plan/[id]/page.tsx`，展示：
   - 学员基本信息（头像/昵称/健身目标/等级）
   - 当前计划名称和完成进度
   - 最近训练记录（时间线）
   - 教练评语列表（调用 `/api/subscription/get-coach-reviews` 的教练侧写法）
2. 新增「给学员写评语」按钮（调用 `/api/execution/submit-feedback`），教练可以给学员留反馈。
3. 在 `coachService` 中补充 `getStudentFeedbacks(studentId)` → `/api/coach/get-student-feedbacks`。

**涉及文件**：`src/pages/coach/students/detail/index.tsx`、`src/services/coach/coachService.ts`

---

### T14 · 教练为学员分配计划 — 补充 1RM 配置面板

**背景**：网站在教练为学员分配计划页面有 `CoachOneRMConfigPanel`，可以查看和设置学员各动作的 1RM 数据。小程序当前版本缺失这部分。

**要做什么**：

1. 在 `coachService` 补充：
   - `getStudentActions(studentId)` → `POST /api/coach/get-student-actions`
   - `batchUpdateStudent1RM(studentId, updates)` → `POST /api/coach/batch-update-student-1rm`
2. 在 `coach/students/plan/index.tsx` 底部添加可折叠的「学员 1RM 配置」面板：
   - 列出学员动作库中的力量动作
   - 支持逐项修改 1RM 数值并保存

**涉及文件**：`src/services/coach/coachService.ts`、`src/pages/coach/students/plan/index.tsx`

---

### T15 · 生成计划 — AI 进度轮询和错误处理补齐

**背景**：小程序已有 `generate-plan` 流程，但 `waiting/index.tsx` 中 AI 生成进度的轮询、超时处理、失败重试逻辑可能不完整。

**要做什么**：

1. 对照网站 `generate-plan` 的 waiting 页面，补充：
   - 轮询间隔：每 3 秒请求一次状态，最长等待 3 分钟
   - 超时处理：超时后展示「生成超时，请重试」并提供返回按钮
   - 失败处理：若 API 返回 failed 状态，显示具体错误原因
   - 成功后：自动跳转到今日训练页（而非停留在等待页）

**涉及文件**：`src/pages/generate-plan/waiting/index.tsx`

---

## P2 — 完整性提升

---

### T16 · 学员计划库 — 原生创建/编辑表单（替换占位页）

**背景**：当前 `me/plan-lib/create` 和 `me/plan-lib/edit` 都是占位页，提示用户去网页端。应当实现原生表单。

**要做什么**：

1. 在 `src/services/studentPlanLibService.ts`（新建）或 trainingService 中封装：
   - `createTemplate(data)` → `/api/plan-lib/create-instance`
   - `updateTemplate(templateId, data)` → `/api/plan-lib/update-template`
2. 改写 `me/plan-lib/create/index.tsx`，实现：
   - 计划名称/描述/天数基本信息表单
   - 每天训练内容配置（动作选择 + 组数/次数）
   - 支持训练/休息日标记
3. 改写 `me/plan-lib/edit/index.tsx`，加载已有计划数据后允许修改。
4. 注意：复杂的四类 ItemType（饮食/有氧/习惯）表单可以第一版只支持力量训练，后续迭代补充。

**涉及文件**：新增 `src/services/studentPlanLibService.ts`、`src/pages/me/plan-lib/create/index.tsx`、`src/pages/me/plan-lib/edit/index.tsx`

---

### T17 · 学员计划库 — 一键应用 + 1RM 配置

**背景**：网站计划库列表页有「应用」按钮（调用 `activate-instance`）以及 `OneRMConfigPanel` 用于在应用前设置各动作 1RM。

**要做什么**：

1. 在 `studentPlanLibService` 或 `trainingService` 补充 `activateInstance(templateId)` → `/api/plan-lib/activate-instance`。
2. 在 `me/plan-lib/index.tsx` 每个计划卡片添加「应用此计划」按钮，点击后：
   - 弹出简单确认对话框
   - 调用 `activateInstance`，成功后提示并刷新列表
3. （可选）在应用前提示用户配置 1RM，参考 `OneRMConfigPanel` 逻辑。

**涉及文件**：`src/services/studentPlanLibService.ts`（或 trainingService）、`src/pages/me/plan-lib/index.tsx`

---

### T18 · 学员动作库 — 完善操作（合并/引用查询/批量1RM）

**背景**：网站动作库有合并重复动作、查看动作被哪些计划引用、批量更新 1RM 的功能。

**要做什么**：

1. 在 `src/services/studentActionLibService.ts` 补充：
   - `mergeActions(sourceId, targetId)` → `/api/student/action-lib/merge-actions`
   - `getActionReferences(actionId)` → `/api/student/action-lib/action-references`
   - `batchUpdate1RM(updates)` → `/api/student/action-lib/batch-update-1rm`
   - `deleteAction(actionId)` → `/api/student/action-lib/delete-action`
   - `batchCreate(actions)` → `/api/student/action-lib/batch-create`
2. 在动作库列表页（`action-lib/index.tsx`）：
   - 动作卡片长按或右滑显示「合并」「删除」按钮
   - 顶部「批量更新 1RM」入口（进入后列表式录入各动作 1RM）

**涉及文件**：`src/services/studentActionLibService.ts`、`src/pages/action-lib/index.tsx`

---

### T19 · 动作编辑 — 对齐网站 ActionEditDialog 逻辑

**背景**：小程序有 `pages/action-edit/index.tsx`，但字段和验证规则是否与网站 `ActionEditDialog` 完全一致待确认。

**要做什么**：

1. 对照网站 `app/dashboard/action-lib/ActionEditDialog.tsx`，核查以下字段是否完整：
   - 动作名称、肌肉部位、器械类型、动作类型
   - 视频演示链接（upload-demo-video 接口）
   - 训练提示/注意事项
2. 补充缺失字段的表单项和保存逻辑。
3. 补充 `uploadDemoVideo` 方法到 `studentActionLibService`（调用 `/api/action-lib/upload-demo-video`）。

**涉及文件**：`src/pages/action-edit/index.tsx`、`src/services/studentActionLibService.ts`

---

### T20 · 个人档案 — E1RM 图表 + 视频 PR

**背景**：网站档案页有 E1RM 历史折线图，以及可以播放训练视频的 PR 记录。

**要做什么**：

1. 在档案详情页「进步足迹」Tab 添加 E1RM 趋势图：
   - 调用 `studentService.getE1RMHistory(actionId)` → `/api/student/get-e1rm-history`
   - 用简单折线图（Taro 内置 Canvas 或 echarts-for-taro）展示某个动作的 E1RM 历史曲线
   - 动作选择器：下拉选择查看哪个动作的趋势
2. PR 记录中如有 `video_url` 字段，展示「观看视频」按钮，调用 `Taro.previewMedia`。

**涉及文件**：`src/pages/profile/detail/index.tsx`、`src/services/studentService.ts`

---

### T21 · 用户公开主页 — 训练统计 + 好友操作

**背景**：网站 `/user/[userId]` 展示对方的训练统计数据和好友关系按钮，小程序只有基础信息。

**要做什么**：

1. 在用户公开主页 `pages/user/index.tsx` 补充：
   - 调用 `/api/user/get-student-stats` 展示总训练次数、连续训练天数等统计卡片
   - 调用好友 API（`/api/user/friends` 状态判断）展示「加好友」/「已是好友」/「待确认」按钮

**涉及文件**：`src/pages/user/index.tsx`

---

### T22 · 会员页 — 配额展示

**背景**：网站会员页展示 AI 导入次数剩余、云存储空间用量等配额信息，调用 `/api/membership/get-quota`。

**要做什么**：

1. 在 `me/membership/index.tsx` 调用 `GET /api/membership/get-quota`，在页面上展示：
   - AI 导入剩余次数（已用 / 总配额）
   - 云存储使用量（若有）
   - 配额不足时展示升级会员提示

**涉及文件**：`src/pages/me/membership/index.tsx`

---

### T23 · 聊天 — mark-as-read + 视频列表

**背景**：聊天页面进入后应标记消息已读；教练和学员在聊天时还可以互相查看上传的训练视频。

**要做什么**：

1. 在 `chatService` 补充 `markAsRead(roomId)` → `POST /api/chat/mark-as-read`，在聊天页 `useDidShow` 时调用。
2. 在聊天页工具栏添加「视频」按钮，调用 `GET /api/chat/list-student-videos?roomId=xxx` 展示已上传视频列表，支持点击预览。

**涉及文件**：`src/services/chatService.ts`、`src/pages/messages/chat/index.tsx`

---

### T24 · 教练问卷 — 完整管理流程

**背景**：网站问卷管理有发布、设为默认、复制等操作（对应 `publish-questionnaire`、`set-default-questionnaire`、`duplicate-questionnaire`）；小程序当前只有列表。

**要做什么**：

1. 在 `coach/coachService.ts` 补充：
   - `publishQuestionnaire(questionnaireId)` → `POST /api/coach/publish-questionnaire`
   - `setDefaultQuestionnaire(questionnaireId)` → `POST /api/coach/set-default-questionnaire`
   - `duplicateQuestionnaire(questionnaireId)` → `POST /api/coach/duplicate-questionnaire`
2. 在问卷列表 `coach/questionnaire/index.tsx` 每条问卷的操作菜单中添加「发布」「设为默认」「复制」按钮。

**涉及文件**：`src/services/coach/coachService.ts`、`src/pages/coach/questionnaire/index.tsx`

---

### T25 · 教练计划库 — 批量操作 + 周历排程

**背景**：网站教练计划库有批量对计划内动作做操作（BatchActionsDialog）和按周查看排程的 WeekCalendar。

**要做什么**：

1. 在教练计划库列表 `coach/plan-lib/index.tsx` 添加长按多选功能，支持批量删除/复制。
2. 在计划编辑/详情页添加「周历预览」功能，以横向日历展示各天的训练安排（纯前端渲染，无需新 API）。

**涉及文件**：`src/pages/coach/plan-lib/index.tsx`、`src/pages/coach/plan-lib/edit/index.tsx`

---

### T26 · 教练计划库创建/编辑 — 四类训练项目支持

**背景**：教练计划中除力量训练外还可以设置饮食/有氧/习惯类项目，对应网站的 `DietItemForm`、`CardioItemForm`、`HabitItemForm`。

**要做什么**：

1. 在教练计划库创建/编辑页 `coach/plan-lib/create` 和 `edit` 的动作添加流程中：
   - 添加 ItemType 选择器（力量/饮食/有氧/习惯）
   - 根据类型展示对应参数表单：
     - 力量：动作选择 + 组数/次数/强度/休息
     - 饮食：描述 + 热量/蛋白质等
     - 有氧：类型 + 时长/距离
     - 习惯：描述 + 打卡类型
2. 保存时按 ItemType 组装正确的 `params` 字段。

**涉及文件**：`src/pages/coach/plan-lib/create/index.tsx`、`src/pages/coach/plan-lib/edit/index.tsx`

---

### T27 · 教练学员管理 — 待支付确认弹窗

**背景**：网站学员列表右上角有「待支付确认」入口，教练可以看到哪些学员订单待确认并手动确认。

**要做什么**：

1. 在 `coachService` 补充：
   - `getPaymentWaitingStudents()` → `GET /api/coach/get-payment-waiting-students`
   - `getPaymentConfirmationHistory()` → `GET /api/coach/get-payment-confirmation-history`
2. 在学员列表页 `coach/students/index.tsx` 右上角添加「待确认」角标按钮，点击展示底部弹层列表，列出待支付订单，支持确认操作。

**涉及文件**：`src/services/coach/coachService.ts`、`src/pages/coach/students/index.tsx`

---

### T28 · 教练钱包 — 完善提现流程

**背景**：网站钱包支持提现到支付宝（`wallet/alipay/withdraw`）；小程序目前只展示余额。

**要做什么**：

1. 在 `coachService` 补充：
   - `requestWithdraw(amount)` → `POST /api/coach/wallet/alipay/withdraw`
   - `cancelWithdraw(withdrawId)` → `POST /api/coach/wallet/alipay/withdraw/cancel`
2. 在钱包页 `coach/wallet/index.tsx` 添加「申请提现」按钮，点击后弹出金额输入框，确认后调用 `requestWithdraw`，展示提现状态。

**涉及文件**：`src/services/coach/coachService.ts`、`src/pages/coach/wallet/index.tsx`

---

### T29 · 训练执行 — 完成后分享训练成果

**背景**：网站训练完成后可以生成分享卡片，展示本次训练数据（组数/完成率/PR 等）。

**要做什么**：

1. 在 `executionService` 补充 `getShareCardInfo(executionId)` → `POST /api/execution/share-card-info`。
2. 在训练执行完成弹窗中添加「分享」按钮，调用 `getShareCardInfo` 获取分享数据，用 `Taro.showShareMenu` + 自定义 Canvas 生成分享图。

**涉及文件**：`src/services/executionService.ts`、`src/pages/training-execution/index.tsx`

---

### T30 · 教练学员反馈聚合视图（新入口）

**背景**：网站有教练专属的学员反馈汇总视图，调用 `/api/coach/get-student-feedbacks`。小程序完全没有。

**要做什么**：

1. 在 `coachService` 补充 `getStudentFeedbacks(params)` → `POST /api/coach/get-student-feedbacks`。
2. 在教练概览或学员列表页增加「学员反馈」入口，新建简单页面展示所有学员的最新反馈列表（时间线形式）。
3. 在 `app.config.ts` 注册路由 `pages/coach/students/feedbacks/index`。

**涉及文件**：`src/services/coach/coachService.ts`、新增 `src/pages/coach/students/feedbacks/index.tsx`、`src/app.config.ts`

---

### T31 · 档案编辑 — 补充字段和验证

**背景**：小程序档案编辑页字段可能不完整，需与网站 `me/settings/page.tsx` 对齐。

**要做什么**：

1. 对照网站档案编辑字段，检查并补充：
   - 完整的健身目标字段（多选）
   - 训练水平（初级/中级/高级）
   - 生活作息（睡眠/工作类型等）
   - 各运动项目的当前成绩（深蹲/卧推/硬拉等，传入 `update-personal-records`）
2. 添加表单验证（数字范围、必填项）。

**涉及文件**：`src/pages/profile/edit/index.tsx`

---

## P3 — 低频 / 高复杂度

> 以下功能暂时影响较小，可以在 P0~P2 完成后再推进。

---

### T32 · 公开动作库（浏览 / 点赞 / 贡献）

**背景**：网站有社区共建的公开动作库，用户可以浏览、点赞、提交编辑、同步到自己动作库。

**要做什么**：

1. 新建 `src/services/publicActionLibService.ts`，封装 `/api/public-action-lib/*` 系列接口。
2. 新建 `src/pages/actions/public/index.tsx`，展示公开动作列表（分页、搜索）。
3. 动作详情页支持：点赞（`toggle-like`）、「加入我的库」（`add-to-my-lib`）、「同步更新」（`sync-to-my-lib`）。
4. 暂不需要实现贡献编辑和审核流程（太复杂，适合网页端）。

**涉及文件**：新增 `src/services/publicActionLibService.ts`、新增 `src/pages/actions/public/index.tsx`

---

### T33 · 知识库 — AI 问答

**背景**：网站知识库内嵌 AI 问答，用户可以针对知识内容提问，后端调用 LLM 回答。

**要做什么**：

1. 在 `knowledgeService` 补充 `askAI(question)` → `POST /api/knowledge/ai/ask`。
2. 在知识库页面底部添加浮动「AI 问一问」入口，点击弹出聊天框，支持单轮问答（非流式）。

**涉及文件**：`src/services/knowledgeService.ts`、`src/pages/knowledge/index.tsx`

---

### T34 · 知识树 / 场景 / 节点

**背景**：网站知识库有完整的知识树结构（nodes/pillars/scenarios/body-map），比书籍+文章列表更系统。

**要做什么**：

1. 在 `knowledgeService` 补充：`getTree()`、`getNode(id)`、`getScenarios()`、`getScenario(slug)`。
2. 知识库首页增加「知识树」Tab，以树形/卡片展示知识体系结构，点击进入节点详情。
3. 节点详情页展示节点内容，关联书籍/文章。

**涉及文件**：`src/services/knowledgeService.ts`、`src/pages/knowledge/index.tsx`、新增节点详情页

---

### T35 · 教练海报生成

**背景**：网站教练主页有生成推广海报的功能（调用 `poster/trigger` + 轮询 `poster/status`）。

**要做什么**：

1. 在 `coachService` 补充 `triggerPoster()` 和 `getPosterStatus()` 两个方法。
2. 在教练我的主页 `coach/my-profile/index.tsx` 添加「生成推广海报」按钮，触发后轮询状态，完成后展示海报图片并支持保存到相册。

**涉及文件**：`src/services/coach/coachService.ts`、`src/pages/coach/my-profile/index.tsx`

---

### T36 · AI 聊天流式消息

**背景**：网站聊天支持 AI 助手流式回复（`/api/chat/unified-stream`），逐字输出。

**要做什么**：

1. 在 `chatService` 添加 `streamMessage(roomId, content, onChunk)` 方法，使用微信小程序的 `Taro.request` 的 `enableChunked` 选项或 EventSource 实现流式读取。
2. 聊天页面支持 AI 消息的打字机效果展示。
3. 注意：微信小程序的流式请求有一定限制，需测试兼容性。

**涉及文件**：`src/services/chatService.ts`、`src/pages/messages/chat/index.tsx`

---

### T37 · 教练广播消息

**背景**：网站教练可以向所有学员发送广播消息，调用 `/api/coach/broadcast-message`。

**要做什么**：

1. 在 `coachService` 补充 `broadcastMessage(content)` → `POST /api/coach/broadcast-message`。
2. 在教练学员管理页 `coach/students/index.tsx` 右上角添加「广播」按钮，弹出输入框后发送。

**涉及文件**：`src/services/coach/coachService.ts`、`src/pages/coach/students/index.tsx`

---

### T38 · 公开训练分享页（无需登录可查看）

**背景**：网站有 `/public/training/[token]` 页面，分享给未登录用户也可查看某次训练详情。

**要做什么**：

1. 新建 `src/pages/public/training/index.tsx`，接收 `token` 参数，无需登录，调用公开接口展示训练数据。
2. 在 `app.config.ts` 注册，并在训练执行完成后的分享流程中生成带 token 的分享链接。

**涉及文件**：新增 `src/pages/public/training/index.tsx`、`src/app.config.ts`

---

### T39 · 计划库 AI 智能生成能力（parse-template / smart-import）

**背景**：网站计划库有 AI 解析自然语言文本生成计划（`parse-template/parse-actions`）和智能导入（`smart-import`）功能。

**要做什么**：

1. 在 `studentPlanLibService` 补充 `parseTemplate(text)` 和 `parseActions(text)` 方法。
2. 在学员计划库创建页添加「AI 解析文本生成」入口：粘贴文本，调用 `parseTemplate` 后预览 AI 解析的计划结构，确认后创建。

**涉及文件**：`src/services/studentPlanLibService.ts`、`src/pages/me/plan-lib/create/index.tsx`

---

### T40 · 教练广播、订阅问卷更新等补充 API

以下 API 目前小程序未对接，可在对应页面优化时一并补充：

| API | 调用位置 | 操作 |
|-----|---------|------|
| `/api/subscription/update-questionnaire` | 教练主页/学员订阅流程 | 添加到 `subscriptionService` |
| `/api/student/visibility-status` | 学员档案或设置页 | 添加到 `studentService` |
| `/api/user/bind-contact` / `unbind-contact` | 账户设置页 | 添加到账户设置逻辑 |
| `/api/user/update-personal-records` | 档案编辑页 | 添加到 `studentService` |
| `/api/user/submit-video-url` | 档案/设置页 | 添加到 `studentService` |
| `/api/training/save-1rm-record` | 训练执行完成后 | 添加到 `executionService` |

---

## Service 层新建/完善汇总

| Service 文件 | 操作 | 对应任务 | 优先级 |
|-------------|------|---------|--------|
| `services/executionService.ts` | **全面重写**（从 1 个方法扩展到 15+ 个） | T01 | P0 |
| `services/impromptuService.ts` | **新建** | T07 | P1 |
| `services/trainingHistoryService.ts` | **新建** | T08 | P1 |
| `services/subscriptionService.ts` | 补充 `renewSubscription` | T09 | P1 |
| `services/studentPlanLibService.ts` | **新建**（create/update/activate/parse） | T16~T39 | P2~P3 |
| `services/studentActionLibService.ts` | 补充 merge/references/batch-1rm/delete | T18 | P2 |
| `services/trainingService.ts` | 补充 activate-instance 等 | T17 | P2 |
| `services/chatService.ts` | 补充 markAsRead、list-student-videos | T23 | P2 |
| `services/coach/coachService.ts` | 补充 feedbacks/student-actions/broadcast/poster 等 | T13~T37 | P2~P3 |
| `services/publicActionLibService.ts` | **新建** | T32 | P3 |
| `services/knowledgeService.ts` | 补充 search/tree/nodes/scenarios/ai-ask | T11~T34 | P1~P3 |

---

## 待确认的模糊点（动手前需先调研）

- [ ] **`coach/plans/dashboard/[id]`**：小程序当前实现深度如何？是否有实时执行进度？→ 决定 T14 的工作量
- [ ] **`action-edit/index.tsx`**：字段是否已与网站对齐？→ 决定 T19 的工作量
- [ ] **`me/plan-lib/index.tsx`**：应用计划按钮当前是否已调用 `activate-instance`？→ 决定 T17 是否需要做
- [ ] **分支 `all-pages-migration-basic-complete`** 中 plan-lib create/edit 的完整实现能否合并到 main？→ 可能省去 T16 的大部分工作
- [ ] **今日训练 `activate-pending-plans` 时机**：目前是否已在正确时机触发？→ 影响 T06
- [ ] **聊天轮询间隔**：当前 inline 实现的轮询是否已足够？→ 决定 T23 是否需要重构

---

## 模糊点回答（当前可执行结论）

> 说明：网站和小程序共用同一套后端，核心业务逻辑应尽量一致。以下给出的是“现在就能执行”的结论与动作，后续只做校验和微调。

### Q1 · `coach/plans/dashboard/[id]` 是否需要补齐到网站深度？

- **结论**：需要补齐，按 T14 执行，不再等待。
- **理由**：这是教练查看学员训练进展的核心入口，网站有更完整的执行进度、反馈和 1RM 相关能力；小程序当前版本明显偏轻量。
- **执行动作**：
  1. 先补 API：`/api/coach/get-student-actions`、`/api/coach/batch-update-student-1rm`、`/api/coach/get-student-feedbacks`
  2. 再补页面：在 `pages/coach/students/plan/index` 增加学员反馈和 1RM 配置面板

### Q2 · `action-edit/index.tsx` 字段要不要和网站完全一致？

- **结论**：要一致（字段语义和校验一致），UI 可做小程序化。
- **理由**：同后端时，字段定义不一致会导致数据质量和兼容性问题（例如动作分类、视频字段、注意事项等）。
- **执行动作**：
  1. 以网站 `ActionEditDialog` 作为字段基准
  2. 在小程序补齐缺失字段和验证规则
  3. 仅保留 UI 样式差异，不保留业务字段差异

### Q3 · `me/plan-lib/index` 是否已调用 `activate-instance`，如果没调怎么办？

- **结论**：按“未完成”处理，直接纳入 T17 实施。
- **理由**：当前主线目标是减少不确定性；先做显式接入最稳，完成后再通过日志/接口回包验证。
- **执行动作**：
  1. 在 service 中补 `activateInstance(templateId)`（`/api/plan-lib/activate-instance`）
  2. 在计划卡片加“应用”按钮并触发该 API
  3. 成功后刷新当前计划状态

### Q4 · `all-pages-migration-basic-complete` 怎么局部合并？

- **结论**：采用“按路径迁移”，不做整分支 merge。
- **理由**：整分支 merge 会把主链路降级改动（today-training/payment/chat）一起带入，风险高。
- **执行动作**：
  1. 在 `main` 上，用 `git checkout all-pages-migration-basic-complete -- <path>` 只拿目标页面（优先 `me/plan-lib/create`、`me/plan-lib/edit`）
  2. 每迁移一个页面块就编译和回归
  3. 单独提交，保持小步可回滚

### Q5 · 今日训练 `activate-pending-plans` 时机是否要对齐网站？

- **结论**：要对齐，先按“首次进入 + 训练完成后”两次触发策略落地。
- **理由**：该能力属于状态流转关键点，过多触发会浪费请求，漏触发会导致计划状态异常。
- **执行动作**：
  1. 将触发点收敛为：页面首次进入、`finish` 成功后
  2. 加一次性保护（防重复调用）
  3. 记录调用日志，后续再做精细优化

### Q6 · 聊天轮询间隔要不要现在重构？

- **结论**：先不大改架构，先上“动态轮询”小改版。
- **理由**：当前功能可用，优先保证消息及时与资源平衡；流式/长连接属于后续优化项。
- **执行动作**：
  1. 前台活跃会话：2-3 秒轮询
  2. 页面空闲：5-6 秒轮询
  3. 页面隐藏/后台：暂停轮询；回到前台立即拉取一次

---

## 这 6 个点对应的执行决议

- 直接开做：**Q1、Q2、Q3、Q5**
- 用局部迁移策略做：**Q4**
- 先小改再观察：**Q6**

> 以上决议可作为当前迭代默认执行标准，无需再卡在“是否要做”的讨论，直接进入任务开发。
