# CoachLink 小程序 ↔ 网站同步调研报告

> 生成日期：2026-02-26  
> 目标：将小程序（coachlink-wechat-app）功能对齐到网站（coachlink）最新版本  
> 当前小程序分支：main

---

## 版本快照（调研基准）

> **重要**：本报告基于以下**具体提交版本**整理。后续网站会持续更新，重新调研时请先更新此表，再与当前版本做 diff 确认新增/变更项。

| 仓库 | 分支 | 提交哈希 | 提交时间 | 提交说明 |
|------|------|----------|----------|----------|
| **coachlink**（网站） | main | `00f9230f2c45497fa1b9eeee401c521be741b99c` | 2026-02-25 15:32:54 | fix: 学员端计划库创建/编辑页与学员导航更新 |
| **coachlink-wechat-app**（小程序） | main | `9c6030097ac79f04da02b5b8b7651076abf69a3e` | 2026-02-16 00:45:37 | feat:实现智能导入计划 |

**重新调研时更新步骤**：
1. 在 `coachlink` 目录执行 `git log -1 --format="%H | %ci | %s"`
2. 在 `coachlink-wechat-app` 目录执行同上
3. 更新上表，然后 `git diff <旧哈希>..<新哈希> --stat` 快速查看网站变更范围
4. 根据变更范围补充/修正本报告的页面对照和 API 对照

---

## 图例说明

| 符号 | 含义 |
|------|------|
| ✅ | 已实现，功能基本一致 |
| 🟡 | 已实现，但有较明显差距（逻辑缺失/细节不完整） |
| 🔴 | 网站有，小程序**完全缺失** |
| ➖ | 不适用或无需在小程序实现 |

---

## 一、页面对照清单

### 1.1 认证 / 入口类

| 功能 | 网站路由 | 小程序页面 | 状态 | 差距说明 |
|------|---------|-----------|------|---------|
| 登录 | `/login` | `pages/login/index` | ✅ | — |
| 注册 | `/register` | `pages/register/index` | ✅ | — |
| 微信授权回调 | `/wechat-auth/*` | `pages/wechat-auth/index` | ✅ | 小程序内逻辑不同，但已覆盖核心需求 |
| 新用户引导 | `/onboarding` | `pages/onboarding/index` | ✅ | — |
| 分享落地页 | `/s/[shareId]` | `pages/share/index` | ✅ | — |
| 关于 | `/about` | `pages/about/index` | ✅ | — |
| 免责声明 | `/disclaimer` | `pages/disclaimer/index` | ✅ | — |
| 服务条款 | `/terms` | `pages/terms/index` | ✅ | — |
| 联系 | `/contact` | `pages/contact/index` | ✅ | — |
| 反馈 | `/feedback` | `pages/feedback/index` | ✅ | — |
| 文档 | `/docs` | `pages/docs/index` | ✅ | — |

---

### 1.2 学员端 — 训练核心

| 功能 | 网站路由 | 小程序页面 | 状态 | 差距说明 |
|------|---------|-----------|------|---------|
| 今日训练 | `/today-training` | `pages/today-training/index` | 🟡 | 网站支持**多订阅切换**（可切换多个教练计划）、**补训提醒**（missingDays）、**计划完成弹窗**、`skip-day`；小程序仅单订阅+自建计划二选一，缺少上述三个特性 |
| 即兴训练 | `/impromptu-training` | ❌ 无 | 🔴 | 网站完整实现：从动作库选动作组合 → 开始执行 → 完成；API：`/api/impromptu/*`（start, list-actions, complete-set, add/delete extra, finish）|
| 训练执行 | `/training-execution/[instanceId]` | `pages/training-execution/index` | 🟡 | 小程序基础可用，但缺少：①`complete-item`（饮食/有氧/习惯非力量项目完成）②`skip-day`③临时增加动作/增加组（extra-content API）④分享训练成果（share-info/share-card-info）⑤执行状态恢复（check-today）⑥视频相关逻辑未抽取为统一 service |
| 教练端学员训练执行监看 | `/coach/plans/dashboard/[id]` | `pages/coach/plans/dashboard/[id]/index` | 🟡 | 小程序有基础实现；网站有 SetItem、ExerciseItem 复杂组件和实时进度显示，差距较大 |
| 当前计划概览 | `/coach/plans` | `pages/plan/current/index` | 🟡 | 小程序实现了当前计划，但路由结构与网站不同；逻辑基本覆盖 |

---

### 1.3 学员端 — 计划库 / 动作库

| 功能 | 网站路由 | 小程序页面 | 状态 | 差距说明 |
|------|---------|-----------|------|---------|
| 学员计划库列表 | `/me/plan-lib` | `pages/me/plan-lib/index` | 🟡 | 小程序有列表与删除；网站有**智能导入**（SmartImportDialog）、**一键应用**、**1RM配置**（OneRMConfigPanel） |
| 学员计划库 - 创建 | `/me/plan-lib/create` | `pages/me/plan-lib/create/index` | 🟡 | 小程序为占位页，提示去网页端；网站有完整表单 |
| 学员计划库 - 编辑 | `/me/plan-lib/edit/[id]` | `pages/me/plan-lib/edit/index` | 🟡 | 同上，小程序为占位 |
| 训练历史列表 | `/me/plan-history` | `pages/me/plan-history/index` | ✅ | 基本一致 |
| 训练历史详情 | `/me/plan-history/[id]` | `pages/me/plan-history/detail/index` | 🟡 | 小程序缺少**月历视图**（`/api/training-history/calendar`）和**月份分享**（`/api/training-history/month-share`）|
| 训练历史（日历） | `/me/training-history` | ❌ 无 | 🔴 | 网站有专门的训练日历页面（按月查看完成记录）；API：`/api/training-history/calendar`、`/api/training-history/day` |
| 学员动作库 | `/me/action-lib` | `pages/action-lib/index` | 🟡 | 小程序有列表；网站有**动作合并**（merge-actions）、**批量更新1RM**（batch-update-1rm）、**动作引用查询**（action-references）、**从公开库同步/发布** |
| 动作详情 | — | `pages/action-detail/index` | ➖ | 小程序独有的动作详情页，网站以 Dialog 形式实现 |
| 从教练复制动作 | — | `pages/copy-from-coach/index` | ➖ | 小程序独有入口 |
| 动作编辑 | — | `pages/action-edit/index` | 🟡 | 待确认逻辑与网站 `ActionEditDialog` 是否对齐 |
| 公开动作库 | `/toolbox`（含入口）等 | `pages/actions/index` | 🔴 | 网站有完整公开动作库：浏览、点赞、贡献编辑、审核（`/api/public-action-lib/*`）；小程序无对应 |
| 计划库 AI 能力 | `/me/plan-lib`（内嵌） | ❌ 无 | 🔴 | 网站有：① AI 从档案自动生成计划草稿（`generate-ai-draft-from-profile`）② 解析模板文本（`parse-template`/`parse-actions`）③ 批量创建 AI 实例（`bulk-create-ai-instances`）④ 智能导入（smart-import）|
| 生成计划（AI） | `/generate-plan` | `pages/generate-plan/index` | 🟡 | 小程序有完整 AssessmentForm 和 waiting 流程；网站相同；但小程序缺少 AI 自动刷新/进度轮询的完整错误处理 |

---

### 1.4 学员端 — 会员 / 支付 / 购物

| 功能 | 网站路由 | 小程序页面 | 状态 | 差距说明 |
|------|---------|-----------|------|---------|
| 我的会员 | `/me/membership` | `pages/me/membership/index` | ✅ | 基本一致 |
| 会员订阅 | `/me/membership`（内嵌支付） | `pages/me/membership/subscribe/index` | 🟡 | 小程序提示去网页端；网站有完整支付流程 |
| 邀请好友 | `/me/membership/referral` | `pages/me/membership/referral/index` | ✅ | 基本一致 |
| 会员配额 | `/me/membership`（调用 API） | `pages/me/membership/index`（调用 API） | 🟡 | 小程序缺少 `/api/membership/get-quota` 配额查询 |
| 购物车 | `/me/cart` | `pages/me/cart/index` | 🟡 | 小程序有基础展示；网站支付逻辑更完整 |
| 购买记录 | `/me/purchase-history` | `pages/me/purchase-history/index` | ✅ | 基本一致 |
| 支付（支付宝） | `/payment/[id]` | `pages/payment/webview` + `payment/wechat` | 🟡 | 小程序有支付宝复制链接 + 微信支付占位；网站支付链路完整（alipay create/notify/query/return/refund）|
| 支付等待页 | — | `pages/payment-waiting/index` | ➖ | 小程序独有流程 |

---

### 1.5 学员端 — 社交 / 消息

| 功能 | 网站路由 | 小程序页面 | 状态 | 差距说明 |
|------|---------|-----------|------|---------|
| 我的好友 | `/friends` | `pages/friends/index` | ✅ | 基本一致 |
| 好友动态 | `/friends/activity` | `pages/friends/activity/index` | ✅ | 基本一致 |
| 消息中心（列表） | `/messages` | `pages/messages/index` | ✅ | 基本一致 |
| 单人聊天 | `/messages`（内嵌流式聊天） | `pages/messages/chat/index` | 🟡 | 小程序：支持图片上传、加载更多、滚动定位，已较完整；网站有流式 AI 对话（`/api/chat/unified-stream`）、视频列表（`/api/chat/list-student-videos`）；差距：流式 AI 消息、视频查看 |
| 用户公开主页 | `/user/[userId]` | `pages/user/index` | 🟡 | 基础信息展示已有；网站有训练统计卡片、好友关系操作 |

---

### 1.6 学员端 — 个人 / 设置

| 功能 | 网站路由 | 小程序页面 | 状态 | 差距说明 |
|------|---------|-----------|------|---------|
| 个人档案 | （内嵌在 `/me`）| `pages/profile/index` + `pages/profile/detail/index` | 🟡 | 小程序有完整档案展示（4个Tab）；但缺少 E1RM 图表、视频 PR 播放、分享功能 |
| 档案编辑 | `/me/settings`（部分） | `pages/profile/edit/index` | 🟡 | 小程序有基础编辑；网站包含更多字段和验证 |
| 账户设置 | `/me/settings` | `pages/me/settings/index` | ✅ | 基本一致（改密、解绑、退出）|
| 工具箱 | `/me/toolbox` | `pages/me/toolbox/index` | ✅ | 基本一致 |
| 学员统计（`get-student-stats`） | 内嵌各页面 | 部分页面调用 | 🟡 | `/api/user/get-student-stats` 小程序需确认是否统一调用 |

---

### 1.7 发现 / 市场 / 教练主页

| 功能 | 网站路由 | 小程序页面 | 状态 | 差距说明 |
|------|---------|-----------|------|---------|
| 发现 / 市场 | `/market` | `pages/market/index` + `pages/discovery/index` | 🟡 | 小程序拆成两个页面；功能基本覆盖 |
| 教练主页 | `/coach/profile/[id]` 等 | `pages/coach-profile/index` | 🟡 | 小程序有基础信息+订阅；网站有**订阅续费**（renew）、**待支付订阅状态合并**、订阅支付选择弹窗（PaymentChoiceModal）|
| 我的教练 | — | `pages/my-coaches/index` | ➖ | 小程序独有入口 |
| 教练申请 | `/onboarding`（引导入口） | `pages/coach/application/index` | ✅ | 流程覆盖 |

---

### 1.8 教练端 Dashboard

| 功能 | 网站路由 | 小程序页面 | 状态 | 差距说明 |
|------|---------|-----------|------|---------|
| 教练概览 | `/dashboard/overview` | `pages/coach/overview/index` | 🟡 | 小程序有数据卡片；网站有更多 KPI 和操作入口 |
| 学员管理列表 | `/dashboard/students` | `pages/coach/students/index` | 🟡 | 小程序有列表；网站有**待支付确认弹窗**（PaymentConfirmationDialog）、**批量操作** |
| 学员详情 | `/dashboard/students`（侧边滑出） | `pages/coach/students/detail/index` | 🟡 | 小程序仅显示名称+档位；网站有完整学员信息、操作记录 |
| 教练为学员分配计划 | `/dashboard/students/plan/[id]` | `pages/coach/students/plan/index` | 🟡 | 小程序有基础；网站有**学员反馈面板**（StudentFeedbackPanel）、**1RM配置面板**（CoachOneRMConfigPanel） |
| 教练计划库 | `/dashboard/plan-lib` | `pages/coach/plan-lib/index` | 🟡 | 小程序有列表；网站有**模板卡片**、**批量操作**（BatchActionsDialog）、**周历排程**（WeekCalendar）|
| 教练计划库 - 创建 | `/dashboard/plan-lib/create` | `pages/coach/plan-lib/create/index` | 🟡 | 小程序有基础表单；网站有完整的 ActionSetForm（含训练、饮食、有氧、习惯四类）、DietItemForm、CardioItemForm、HabitItemForm |
| 教练计划库 - 编辑 | `/dashboard/plan-lib/edit/[id]` | `pages/coach/plan-lib/edit/index` | 🟡 | 同上 |
| 教练动作库 | `/dashboard/action-lib` | `pages/coach/action-lib/index` | 🟡 | 小程序有列表；网站有视频上传、动作合并、引用查询 |
| 教练动作库 - 编辑 | `/dashboard/action-lib`（Dialog） | `pages/coach/action-lib/edit/index` | 🟡 | 待逻辑对齐 |
| 教练内容管理 | `/dashboard/content` | `pages/coach/content/index` + `edit` | 🟡 | 小程序有列表+基础编辑；网站有 ContentEditor（富文本 Tiptap） |
| 教练视频 | `/dashboard/videos` | `pages/coach/videos/index` | 🟡 | 小程序有列表；网站有上传、审核接口 |
| 视频审核 | — | `pages/coach/videos/review/index` | ➖ | 小程序独有功能入口 |
| 问卷管理 | `/dashboard/questionnaire` | `pages/coach/questionnaire/index` + `edit` | 🟡 | 小程序有列表；网站有**完整问卷流程**（QuestionnaireFlow）、发布、设为默认、复制等操作 |
| 定价管理 | `/coach/settings/payment`（部分） | `pages/coach/pricing/index` + `edit` | 🟡 | 小程序有定价列表/编辑；网站整合在设置模块 |
| 钱包 | `/dashboard/wallet` | `pages/coach/wallet/index` | 🟡 | 小程序有余额展示；网站有**提现申请**（alipay withdraw）、**绑定支付宝**（wallet/alipay/bind）|
| 钱包 - 绑定支付宝 | `/dashboard/wallet/bind` | `pages/coach/wallet/bind/index` | 🟡 | 小程序有基础绑定页 |
| 钱包 - 订单详情 | `/dashboard/wallet/order/[orderId]` | `pages/coach/wallet/order/index` | 🟡 | 小程序有基础 |
| 收入详情 | `/dashboard/revenue` | `pages/coach/revenue/index` | 🟡 | 小程序有基础列表 |
| 教练个人设置 | `/coach/settings/*` | `pages/coach/settings/*` | 🟡 | 小程序有 invitation/payment/security 三个子页面，与网站基本对齐，细节待核 |
| 教练我的主页 | `/dashboard/my-profile` | `pages/coach/my-profile/index` | 🟡 | 小程序有基础；网站有海报生成（poster/trigger、status）|
| 学员反馈查看 | — | — | 🔴 | 网站 `/api/coach/get-student-feedbacks` 有反馈聚合；小程序无对应入口 |

---

### 1.9 知识库

| 功能 | 网站路由 | 小程序页面 | 状态 | 差距说明 |
|------|---------|-----------|------|---------|
| 知识库入口 | `/dashboard/knowledge` | `pages/knowledge/index` | 🟡 | 小程序仅展示书籍+文章列表；网站有知识树（tree）、场景（scenarios）、节点（nodes）、支柱（pillars）、身体地图（body-map）|
| 书籍详情 | `/dashboard/knowledge/nodes/*` 等 | `pages/knowledge/book-detail/index` | 🟡 | 小程序有独立书籍详情；网站知识树更复杂 |
| 知识搜索 | `/dashboard/knowledge/search` | ❌ 无 | 🔴 | 网站有 `/api/knowledge/search`；小程序无搜索入口 |
| 知识 AI 问答 | `/dashboard/knowledge`（内嵌） | ❌ 无 | 🔴 | 网站有 `/api/knowledge/ai/ask`；小程序无 |
| 知识场景 | `/dashboard/knowledge/scenarios/[slug]` | ❌ 无 | 🔴 | 小程序无 |
| 文章 | `/articles` + `/articles/[slug]` | ❌ 无单独页面 | 🔴 | 小程序 knowledge 页面展示文章列表，但无独立文章详情页；网站有 ArticlePurchaseSection（付费文章）|

---

### 1.10 街头力量指数

| 功能 | 网站路由 | 小程序页面 | 状态 | 差距说明 |
|------|---------|-----------|------|---------|
| 指数首页 | `/streetlifting-index` | `pages/streetlifting-index/index` | ✅ | — |
| 计算器 | `/streetlifting-index/calculator` | `pages/streetlifting-index/calculator/index` | ✅ | 已有完整 `streetliftingCalc.ts` 工具 |
| 数据榜 | `/streetlifting-index/data` | `pages/streetlifting-index/data/index` | ✅ | — |
| 地点 | `/streetlifting-index/locations` | `pages/streetlifting-index/locations/index` | ✅ | — |
| 理念 | `/streetlifting-index/methodology` | `pages/streetlifting-index/methodology/index` | ✅ | — |
| 故事 | `/streetlifting-index/stories` | `pages/streetlifting-index/stories/index` | ✅ | — |
| 提交成绩 | `/streetlifting-index/submit` | `pages/streetlifting-index/submit/index` | ✅ | — |
| 提交成功 | `/streetlifting-index/submit/success` | `pages/streetlifting-index/submit/success/index` | ✅ | — |

---

### 1.11 排行榜 / 工具箱 / 其他

| 功能 | 网站路由 | 小程序页面 | 状态 | 差距说明 |
|------|---------|-----------|------|---------|
| 排行榜 | `/ranking` | `pages/ranking/index` + `ranking/detail/index` | ✅ | 小程序多了 detail 子页 |
| 工具箱 | `/toolbox` | `pages/toolbox/index` + `toolbox/webview/index` | ✅ | 基本一致 |
| 全局搜索 | `/search` | ❌ 无 | 🔴 | 网站有 `/api/user/search` 搜索用户；小程序无全局搜索 |
| 公开训练页 | `/public/training/[token]` | ❌ 无 | 🔴 | 网站有无需登录的训练分享页 |
| 教练主页（公开） | `/coach/profile/[id]` | `pages/coach/profile/[id]/index` | ✅ | — |
| 管理员面板 | `/admin/*` | ❌ 无 | ➖ | 不需要在小程序实现 |

---

## 二、API 调用对照清单

### 2.1 执行层（Execution）

| API 路径 | 网站使用 | 小程序使用 | 状态 |
|----------|---------|-----------|------|
| `/api/execution/start` | ✅ | ✅（inline in training-execution page） | 🟡 未抽取为 service |
| `/api/execution/complete-set` | ✅ | ✅（inline） | 🟡 未抽取为 service |
| `/api/execution/complete-item` | ✅（饮食/有氧/习惯） | ❌ | 🔴 |
| `/api/execution/finish` | ✅ | ✅（inline） | 🟡 未抽取为 service |
| `/api/execution/get` | ✅ | ❌ | 🔴 |
| `/api/execution/check-today` | ✅ | ❌ | 🔴 |
| `/api/execution/skip-day` | ✅ | ❌ | 🔴 |
| `/api/execution/get-next-training-day` | ✅ | ✅（trainingService） | ✅ |
| `/api/execution/get-pr-records` | ✅ | ✅（executionService） | ✅ |
| `/api/execution/create-pr` | ✅ | ❌ | 🔴 |
| `/api/execution/delete-pr-record` | ✅ | ❌ | 🔴 |
| `/api/execution/upload-set-video` | ✅ | ✅（inline） | 🟡 未抽取为 service |
| `/api/execution/add-set-video-link` | ✅ | ✅（inline） | 🟡 未抽取为 service |
| `/api/execution/calculate-e1rm` | ✅ | ❌ | 🔴 |
| `/api/execution/share-info` | ✅ | ❌ | 🔴 |
| `/api/execution/share-card-info` | ✅ | ❌ | 🔴 |
| `/api/execution/submit-feedback` | ✅ | ❌ | 🔴 |
| `/api/execution/extra-content/add-extra-exercise` | ✅ | ❌ | 🔴 |
| `/api/execution/extra-content/add-extra-set` | ✅ | ❌ | 🔴 |
| `/api/execution/extra-content/delete-extra-exercise` | ✅ | ❌ | 🔴 |
| `/api/execution/extra-content/delete-extra-set` | ✅ | ❌ | 🔴 |

### 2.2 即兴训练（Impromptu）

| API 路径 | 网站使用 | 小程序使用 | 状态 |
|----------|---------|-----------|------|
| `/api/impromptu/start` | ✅ | ❌ | 🔴 |
| `/api/impromptu/list-actions` | ✅ | ❌ | 🔴 |
| `/api/impromptu/get` | ✅ | ❌ | 🔴 |
| `/api/impromptu/complete-set` | ✅ | ❌ | 🔴 |
| `/api/impromptu/finish` | ✅ | ❌ | 🔴 |
| `/api/impromptu/extra-content/*` | ✅ | ❌ | 🔴 |

### 2.3 计划库（Plan Lib）

| API 路径 | 网站使用 | 小程序使用 | 状态 |
|----------|---------|-----------|------|
| `/api/plan-lib/get-instance` | ✅ | ✅（trainingService） | ✅ |
| `/api/plan-lib/get-today-training-instance` | ✅ | 部分 | 🟡 |
| `/api/plan-lib/create-instance` | ✅ | ❌ | 🔴 |
| `/api/plan-lib/update-instance` | ✅ | ❌ | 🔴 |
| `/api/plan-lib/activate-instance` | ✅ | ❌ | 🔴 |
| `/api/plan-lib/activate-pending-plans` | ✅ | ❌ | 🔴 |
| `/api/plan-lib/create-ai-instance` | ✅ | ❌ | 🔴 |
| `/api/plan-lib/bulk-create-ai-instances` | ✅ | ❌ | 🔴 |
| `/api/plan-lib/parse-template` | ✅ | ❌ | 🔴 |
| `/api/plan-lib/parse-actions` | ✅ | ❌ | 🔴 |
| `/api/plan-lib/smart-import/*` | ✅ | ❌ | 🔴 |
| `/api/plan-lib/batch-operation` | ✅ | ❌ | 🔴 |
| `/api/plan-lib/batch-operation-context-preview` | ✅ | ❌ | 🔴 |
| `/api/plan-lib/confirm-batch-actions` | ✅ | ❌ | 🔴 |
| `/api/plan-lib/batch-create-actions` | ✅ | ❌ | 🔴 |
| `/api/plan-lib/update-template` | ✅ | 部分 | 🟡 |
| `/api/student/plan-lib/generate-ai-draft-from-profile` | ✅ | ❌ | 🔴 |
| `/api/student/plan-lib/parse-template` | ✅ | ❌ | 🔴 |
| `/api/student/plan-lib/parse-actions` | ✅ | ❌ | 🔴 |

### 2.4 动作库（Action Lib）

| API 路径 | 网站使用 | 小程序使用 | 状态 |
|----------|---------|-----------|------|
| `/api/action-lib/add-action` | ✅ | 部分 | 🟡 |
| `/api/action-lib/update-action` | ✅ | 部分 | 🟡 |
| `/api/action-lib/delete-action` | ✅ | 部分 | 🟡 |
| `/api/action-lib/merge-actions` | ✅ | ❌ | 🔴 |
| `/api/action-lib/action-references` | ✅ | ❌ | 🔴 |
| `/api/action-lib/upload-demo-video` | ✅ | ❌ | 🔴 |
| `/api/student/action-lib/add-action` | ✅ | 部分 | 🟡 |
| `/api/student/action-lib/update-action` | ✅ | 部分 | 🟡 |
| `/api/student/action-lib/delete-action` | ✅ | ❌ | 🔴 |
| `/api/student/action-lib/batch-create` | ✅ | ❌ | 🔴 |
| `/api/student/action-lib/batch-update-1rm` | ✅ | ❌ | 🔴 |
| `/api/student/action-lib/merge-actions` | ✅ | ❌ | 🔴 |
| `/api/student/action-lib/bootstrap-from-profile` | ✅ | ❌ | 🔴 |
| `/api/public-action-lib/*` | ✅ | ❌ | 🔴 |

### 2.5 知识库（Knowledge）

| API 路径 | 网站使用 | 小程序使用 | 状态 |
|----------|---------|-----------|------|
| `/api/knowledge/list-books` | ✅ | ✅（knowledgeService） | ✅ |
| `/api/knowledge/tree` | ✅ | ❌ | 🔴 |
| `/api/knowledge/search` | ✅ | ❌ | 🔴 |
| `/api/knowledge/nodes` | ✅ | ❌ | 🔴 |
| `/api/knowledge/nodes/[id]` | ✅ | ❌ | 🔴 |
| `/api/knowledge/scenarios` | ✅ | ❌ | 🔴 |
| `/api/knowledge/ai/ask` | ✅ | ❌ | 🔴 |
| `/api/knowledge/list-coach-contents` | ✅ | ✅（knowledgeService） | ✅ |

### 2.6 训练历史（Training History）

| API 路径 | 网站使用 | 小程序使用 | 状态 |
|----------|---------|-----------|------|
| `/api/training-history/calendar` | ✅ | ❌ | 🔴 |
| `/api/training-history/day` | ✅ | ❌ | 🔴 |
| `/api/training-history/month-share` | ✅ | ❌ | 🔴 |
| `/api/training/save-1rm-record` | ✅ | ❌ | 🔴 |

### 2.7 学员 / 订阅 / 会员

| API 路径 | 网站使用 | 小程序使用 | 状态 |
|----------|---------|-----------|------|
| `/api/student/get-stats` | ✅ | ❌ | 🔴 |
| `/api/student/get-e1rm-history` | ✅ | 部分（studentService） | 🟡 |
| `/api/student/get-current-1rm` | ✅ | 部分 | 🟡 |
| `/api/student/get-available-actions` | ✅ | ❌ | 🔴 |
| `/api/student/visibility-status` | ✅ | ❌ | 🔴 |
| `/api/user/get-student-stats` | ✅ | 部分 | 🟡 |
| `/api/user/get-student-profile` | ✅ | ✅（studentService） | ✅ |
| `/api/user/friends/*` | ✅ | ✅ | ✅ |
| `/api/user/search` | ✅ | ❌ | 🔴 |
| `/api/user/update-personal-records` | ✅ | ❌ | 🔴 |
| `/api/user/submit-video-url` | ✅ | ❌ | 🔴 |
| `/api/user/bind-contact` / `unbind-contact` | ✅ | ❌ | 🔴 |
| `/api/subscription/create-subscription` | ✅ | ✅（subscriptionService） | ✅ |
| `/api/subscription/renew-subscription` | ✅ | ❌ | 🔴 |
| `/api/subscription/update-questionnaire` | ✅ | ❌ | 🔴 |
| `/api/subscription/get-coach-reviews` | ✅ | ✅（subscriptionService） | ✅ |
| `/api/membership/get-quota` | ✅ | ❌ | 🔴 |
| `/api/membership/create-order` | ✅ | ❌ | 🔴 |

### 2.8 教练端

| API 路径 | 网站使用 | 小程序使用 | 状态 |
|----------|---------|-----------|------|
| `/api/coach/get-overview-data` | ✅ | ✅（coachService） | ✅ |
| `/api/coach/list-students` | ✅ | ✅（coachService） | ✅ |
| `/api/coach/get-student` | ✅ | ✅（coachService） | ✅ |
| `/api/coach/get-student-feedbacks` | ✅ | ❌ | 🔴 |
| `/api/coach/get-student-actions` | ✅ | ❌ | 🔴 |
| `/api/coach/batch-update-student-1rm` | ✅ | ❌ | 🔴 |
| `/api/coach/broadcast-message` | ✅ | ❌ | 🔴 |
| `/api/coach/poster/*` | ✅ | ❌ | 🔴 |
| `/api/coach/update-coach-profile` | ✅ | 部分 | 🟡 |
| `/api/coach/update-content` / `publish-content` | ✅ | 部分 | 🟡 |
| `/api/coach/get-questionnaires` 等 | ✅ | ✅（coach/coachService） | 🟡 |
| `/api/coach/video/review` | ✅ | 部分 | 🟡 |
| `/api/coach/wallet` 相关 | ✅ | ✅（coach/coachService） | 🟡 |

### 2.9 聊天

| API 路径 | 网站使用 | 小程序使用 | 状态 |
|----------|---------|-----------|------|
| `/api/chat/list-messages` | ✅ | ✅（chatService） | ✅ |
| `/api/chat/send-message` | ✅ | ✅（chatService） | ✅ |
| `/api/chat/mark-as-read` | ✅ | 部分 | 🟡 |
| `/api/chat/unified-stream` | ✅ (AI 流式) | ❌ | 🔴 |
| `/api/chat/list-student-videos` | ✅ | ❌ | 🔴 |
| `/api/upload/chat-image` | ✅ | ✅（inline） | 🟡 |

---

## 三、Service 层对照

| Service | 网站文件 | 小程序文件 | 状态 | 差距说明 |
|---------|---------|-----------|------|---------|
| executionService | `service/executionService.ts`（完整，20+ 方法） | `services/executionService.ts`（仅 getPRRecords） | 🔴 严重缺失 | start/complete/finish/create-pr 等关键方法均 inline 在页面里，需抽取统一 |
| trainingService | `service/planLibService.ts` | `services/trainingService.ts`（基础） | 🟡 | 小程序缺少 create/update instance、activate 等 |
| impromptuTrainingService | `service/impromptuTrainingService.ts` | ❌ 无 | 🔴 | 完全缺失 |
| planLibService（学员） | `service/studentPlanLibService.ts` | 无独立文件（inline） | 🟡 | |
| studentActionLibService | `service/studentActionLibService.ts` | `services/studentActionLibService.ts` | 🟡 | 小程序版方法不全 |
| authService | `service/authService.ts` | `services/authService.ts` | ✅ | 基本对齐 |
| subscriptionService | `service/subscriptionService.ts` | `services/subscriptionService.ts` | 🟡 | renew 等缺失 |
| coachService | `service/coachService.ts` | `services/coach/coachService.ts` | 🟡 | 部分方法缺失 |
| planLibService（教练） | `service/planLibService.ts` | `services/coach/planLibService.ts` | 🟡 | |
| actionLibService（教练） | `service/actionLibService.ts` | `services/coach/actionLibService.ts` | 🟡 | |
| knowledgeService | — | `services/knowledgeService.ts` | 🟡 | 小程序已有但 API 覆盖不全 |
| chatService | `（内嵌）` | `services/chatService.ts` | 🟡 | 缺少 AI 流式消息 |
| streetliftingIndexService | `service/streetliftingIndexService.ts` | `services/streetliftingIndexService.ts` | ✅ | 基本一致 |
| rankingService | — | `services/rankingService.ts` | ➖ | 小程序独有 |
| trainingHistoryService | `service/trainingHistoryService.ts` | ❌ 无 | 🔴 | |
| publicActionLibService | `service/publicActionLibService.ts` | ❌ 无 | 🔴 | |
| feedbackService | `service/feedbackService.ts` | ❌ 无 | 🔴 | |
| videoService | `service/videoService.ts` | ❌ 无 | 🔴 | 部分功能 inline |

---

## 四、功能优先级排序（建议）

### P0 — 核心训练体验，影响日常使用

| # | 任务 | 涉及文件 |
|---|------|---------|
| 1 | 将执行 API 抽取为完整的 `executionService`（start/complete/finish 等） | `src/services/executionService.ts` |
| 2 | 训练执行页补齐 `complete-item`（饮食/有氧/习惯支持） | `training-execution/index.tsx` |
| 3 | 训练执行页补齐 `skip-day` / `check-today` | `training-execution/index.tsx` |
| 4 | 训练执行页补齐临时增加动作/组（extra-content） | `training-execution/index.tsx` |
| 5 | 今日训练页支持多订阅切换 | `today-training/index.tsx` |
| 6 | 今日训练页补充补训提醒（missingDays） | `today-training/index.tsx` |

### P1 — 功能完整性，较高频使用

| # | 任务 | 涉及文件 |
|---|------|---------|
| 7 | 实现即兴训练页面（新增页） | 新增 `pages/impromptu-training/index` |
| 8 | 训练历史补充月历视图（training-history calendar） | 新增 `pages/me/training-history/index` |
| 9 | 教练主页支持订阅续费（renew） | `coach-profile/index.tsx` + `subscriptionService` |
| 10 | 学员 PR 管理：create-pr / delete-pr | `executionService` + 档案页 |
| 11 | 知识库补充搜索功能 | `pages/knowledge/index.tsx` 新增搜索 |
| 12 | 教练学员详情页完善（信息、反馈、1RM 操作） | `coach/students/detail` |

### P2 — 完整性提升，使用频率中等

| # | 任务 | 涉及文件 |
|---|------|---------|
| 13 | 学员计划库 create/edit 实现原生表单（非占位） | `me/plan-lib/create` + `edit` |
| 14 | 训练执行分享卡片（share-info/share-card-info） | `executionService` + 执行页 |
| 15 | 动作库合并、引用查询 | `studentActionLibService` |
| 16 | 教练问卷完整流程（发布/设默认/复制） | `coach/questionnaire` |
| 17 | 聊天补充 mark-as-read | `chatService` |
| 18 | 教练学员反馈聚合视图 | 新增 `coach/students/feedbacks` |
| 19 | 文章详情页 | 新增 `pages/articles/[id]` |

### P3 — 边界功能或较低频

| # | 任务 | 涉及文件 |
|---|------|---------|
| 20 | 公开动作库（浏览/点赞/贡献） | 新增 `pages/actions/public` |
| 21 | 知识 AI 问答 | `pages/knowledge` |
| 22 | 教练海报生成 | `coach/my-profile` |
| 23 | AI 聊天流式消息 | `chatService` + 聊天页 |
| 24 | 教练广播消息 | `coach/students` |
| 25 | 会员配额展示（get-quota） | `me/membership` |
| 26 | 全局用户搜索 | 新增搜索入口 |

---

## 五、实现策略原则

1. **API 层可复用**：两端共用同一后端，无需改 API，只需在小程序端补调用。  
2. **Service 先行**：每个模块先完善/新增对应 Service，再更新页面逻辑，避免 inline 调用散乱。  
3. **保持 UI 语言一致**：小程序用 `rpx`/Taro 组件，不照搬网站 PrimeReact 组件，但保持业务逻辑对齐。  
4. **占位页改写优先**：对当前为"提示去网页端"占位的页面（如 me/plan-lib/create），优先改成真实实现。  
5. **向后兼容**：修改 Service 时保留原有方法签名，新增方法不破坏已有调用。

---

## 六、待进一步调研的模糊点

- [ ] `pages/coach/plans/dashboard/[id]` 小程序实现深度（是否有实时进度？）  
- [ ] `pages/action-edit` 与网站 `ActionEditDialog` 的字段和逻辑是否对齐  
- [ ] `pages/me/plan-lib/index` 应用计划的逻辑（`activate-instance` API 是否已调用）  
- [ ] 分支 `all-pages-migration-basic-complete` 中 plan-lib create/edit 完整实现是否可合并到 main  
- [ ] 小程序聊天页的轮询间隔是否需要优化（当前 inline 实现）  
- [ ] 今日训练中 `activate-pending-plans` 时机是否正确触发  
