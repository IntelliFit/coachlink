# main vs all-pages-migration-basic-complete 分支详细对比报告

生成日期：2026-02-25

---

## 版本快照（对比基准）

> **重要**：本报告对比的是小程序两个分支在以下**具体提交**时的差异。后续若任一分支有新提交，对比结果可能失效，需重新执行 diff。

| 分支 | 提交哈希 | 提交时间 | 提交说明 |
|------|----------|----------|----------|
| **main** | `9c6030097ac79f04da02b5b8b7651076abf69a3e` | 2026-02-16 00:45:37 | feat:实现智能导入计划 |
| **all-pages-migration-basic-complete** | `9e6118b77fc72ce910f0cdfc514198535defc364` | 2026-02-15 05:08:15 | feat(miniprogram): 完成核心业务闭环迁移与文档更新 |

**重新对比时**：
1. 在 `coachlink-wechat-app` 执行 `git log main -1 --format="%H | %ci | %s"` 和 `git log all-pages-migration-basic-complete -1 --format="%H | %ci | %s"`
2. 更新上表
3. 执行 `git diff main..all-pages-migration-basic-complete --stat` 查看当前差异概况

---

## 一、总体概览

| 维度 | main | all-pages-migration-basic-complete |
|------|------|------------------------------------|
| 差异提交数 | - | 1 个 |
| 变更文件数 | - | 228 个 |
| 代码行变化 | - | +9,529 / -8,757 (净增 ~772) |
| 架构取向 | 功能完整、多入口 | 统一 dashboard、网页兜底 |

---

## 二、分模块详细对比

### 2.1 学员端首页 / 今日训练

| 项目 | main | all-pages-migration-basic-complete |
|------|------|------------------------------------|
| **今日训练** `today-training` | ✅ 完整实现 (~450 行) | ❌ **已删除** |
| **当前计划** `plan/current` | ✅ 完整实现 (~389 行) | ❌ **已删除** |
| 功能说明 | 今日训练卡片、教练/自建计划切换、TodayTrainingCard、RestDayCard、BrowseSection、快捷入口 | 无对应页面 |
| 入口逻辑 | index → today-training，BottomNav「今日训练」指向 today-training | 需确认替代入口（可能为 coach/plans 或 dashboard） |

**结论**：**main 更完整**。feature 分支移除了学员端核心的「今日训练」和「当前计划」页面，学员端首页能力明显削弱。

---

### 2.2 Dashboard 模块

| 项目 | main | all-pages-migration-basic-complete |
|------|------|------------------------------------|
| **dashboard 目录** | ❌ 不存在 | ✅ **全新** (~25+ 子页面) |
| 页面结构 | - | 多为约 20 行的 RouteAliasPage 重定向 |
| 实际业务页 | - | `dashboard/chat`、`dashboard/knowledge/*` |

**dashboard 子页面实现情况**：

| 子模块 | 实现程度 | 说明 |
|--------|----------|------|
| `dashboard/index` | 重定向 | 20 行，跳转到 coach/overview |
| `dashboard/chat` | ✅ 完整 | ~223 行，会话列表 + 聊天同屏 |
| `dashboard/knowledge` | ✅ 完整 | 有统计、菜单、列表、详情 |
| `dashboard/knowledge/books` | ✅ 完整 | 列表、搜索、跳转详情 |
| `dashboard/knowledge/articles` | ✅ 完整 | 列表 + 详情 |
| `dashboard/action-lib` | 重定向 | 20 行 |
| `dashboard/content` | 重定向 | 20 行 |
| 其他 action-lib、plan-lib、students 等 | 重定向 | 多为 20 行跳转 |

**结论**：main 无 dashboard；feature 新增 dashboard，其中 **chat** 与 **knowledge** 系列为真实实现，其余多为路由别名。

---

### 2.3 知识库 (Knowledge)

| 项目 | main | all-pages-migration-basic-complete |
|------|------|------------------------------------|
| `knowledge/index` | ✅ 入口页 | ✅ 修改（-43 行，简化） |
| `knowledge/book-detail` | ✅ 独立书籍详情 (~186 行) | ❌ **已删除** |
| `dashboard/knowledge/*` | - | ✅ 全新 (20+ 子页) |

**main 知识库**：
- `knowledge/index` 作为入口
- `knowledge/book-detail` 独立书籍详情页

**feature 知识库**：
- 删除 `book-detail`，改为 `dashboard/knowledge/books/[id]`
- 新增：ai、articles、body-map、books、nodes、pillars、scenarios、videos、search、subscribe、my
- `dashboard/knowledge/index`：统计卡片、菜单、与 `knowledgeService` 集成
- 使用 `knowledgeService` 扩展能力（+137 行）

**结论**：**feature 更完整**。结构更清晰，子模块更多，与知识服务集成更好；main 的 book-detail 被合并进新结构。

---

### 2.4 聊天 (Messages / Chat)

| 项目 | main | all-pages-migration-basic-complete |
|------|------|------------------------------------|
| `messages/index` | ✅ 会话列表 | ✅ 增强（+114 行） |
| `messages/chat` | ✅ 单会话聊天页 (~342 行) | ❌ **已删除** |
| `dashboard/chat` | - | ✅ 新建 (~223 行) |

**main**：
- 两页流程：messages 列表 → messages/chat 单聊
- 支持：文字、图片、乐观更新、下拉加载更多、scrollIntoView、时间格式化
- 图片上传：`Taro.chooseImage` + `uploadFile`
- `chatService`：对象式 API，`listMessages({ roomId, limit, beforeId })`，`sendMessage({ roomId, messageType, content, mediaUrl })`

**feature**：
- 单页：`dashboard/chat` 左侧列表 + 右侧聊天
- 支持：文字，**无图片发送**
- 无乐观更新、无下拉加载更多
- 轮询间隔 6 秒
- `chatService`：类式 API，`listChatrooms(page, limit)`，`sendTextMessage(roomId, content)`
- `MessageItem` 字段精简（如移除 `fileName`、`fileSize`、`duration`）

**结论**：**main 聊天功能更完整**。图片、乐观更新、加载更多等均在 main 中实现；feature 侧重统一入口和简化 API，但能力降级。

---

### 2.5 支付 (Payment)

| 项目 | main | all-pages-migration-basic-complete |
|------|------|------------------------------------|
| `PaymentChoiceModal` | ✅ (~198 行) | ❌ **已删除** |
| `paymentService` | ✅ (~92 行) | ❌ **已删除** |
| `payment/wechat` | ✅ 占位页 | ❌ 删除 |
| `payment/webview` | ✅ | ❌ 删除 |
| `payment-waiting` | ✅ 等待页 | ❌ 删除 |
| `payment/index` | - | ✅ 新建 (~32 行) |
| `paymentFallback` | - | ✅ 新建 (~80 行) |

**main**：
- `PaymentChoiceModal`：选择微信/支付宝，调用 `createAlipayOrder` 获取链接并复制
- 支持 `createParams`，复制后跳转 `payment-waiting`
- `buildPaymentStartUrl`、`buildAlipayUrl` 等工具
- `paymentService`：`createAlipayOrder` 等

**feature**：
- 移除全部支付 UI 与 service
- `payment/index`：统一「前往网页端」说明
- `paymentFallback`：`showWebFallback`、`showPaymentFallback` 复制链接到剪贴板
- coach-profile 订阅：不再弹出 PaymentChoiceModal，改为 `showWebFallback`

**结论**：**main 支付链路更完整**。在小程序内至少有「选支付方式 → 复制链接 → 等待页」流程；feature 完全依赖网页支付，前端更简洁但能力更弱。

---

### 2.6 教练主页 (Coach Profile)

| 项目 | main | all-pages-migration-basic-complete |
|------|------|------------------------------------|
| 行数 | ~278 行（含订阅逻辑） | 大幅精简 |
| 订阅流程 | 选套餐 → PaymentChoiceModal → 复制链接 → payment-waiting | 直接 `showWebFallback` 复制链接 |
| 续费 | 支持 renew 模式、`scrollIntoView` | 不支持 |
| 待支付订阅 | 合并到产品列表展示 | 移除 |
| service | `createSubscription` 等 | 移除 `createSubscription` |

**结论**：**main 教练主页订阅能力更强**。feature 简化了订阅与支付，全部导向网页，交互与功能均降级。

---

### 2.7 智能生成计划 (Generate Plan)

| 项目 | main | all-pages-migration-basic-complete |
|------|------|------------------------------------|
| 主流程 | 选择领域 → AssessmentForm → waiting | 直接提示「请到网页端」 |
| `AssessmentForm` | ✅ (~322 行) | ❌ 删除 |
| `assessment.scss` | ✅ (~148 行) | ❌ 删除 |
| `waiting` 页面 | ✅ (~101 行) | 大幅简化 |
| `index` | 领域选择 + 表单 | 仅说明卡片 + 返回按钮 |

**main**：完整问卷、评估、等待流程。

**feature**：仅占位说明，无实际生成逻辑。

**结论**：**main 明显更完整**。feature 将该功能完全迁移到网页端。

---

### 2.8 学员计划库 (me/plan-lib)

| 项目 | main | all-pages-migration-basic-complete |
|------|------|------------------------------------|
| `create` | 占位（约 35 行） | ✅ **扩展** (+285 行) |
| `edit` | 占位（约 35 行） | ✅ **扩展** (+320 行) |
| `edit/[id]` | - | ✅ 新增重定向 |
| 样式 | 简单 | `create` +203 行、`edit` +217 行 SCSS |

**main**：create/edit 均为占位，指向网页。

**feature**：create/edit 有完整表单和样式，可在小程序内创建、编辑计划。

**结论**：**feature 更完整**。计划创建与编辑在小程序端有真实实现。

---

### 2.9 训练历史 (me/plan-history)

| 项目 | main | all-pages-migration-basic-complete |
|------|------|------------------------------------|
| `detail` | 基础实现 | ✅ 增强 (+172 行 diff，含样式) |
| `[id]` | - | ✅ 新增重定向 |

**结论**：**feature 略优**。detail 页更完善，并增加 `[id]` 路由。

---

### 2.10 街力指数 (Streetlifting Index)

| 项目 | main | all-pages-migration-basic-complete |
|------|------|------------------------------------|
| `streetliftingIndexService` | ✅ (~183 行) | ❌ **删除** |
| `streetliftingCalc` | ✅ (~228 行) | ❌ **删除** |
| calculator 页面 | ✅ (~529 行) | 大幅精简 |
| data 页面 | ✅ (~463 行) | 大幅精简 |
| locations 页面 | ✅ (~328 行) | 大幅精简 |

**main**：完整计算逻辑、数据展示、地点列表。

**feature**：移除 service 与工具函数，页面逻辑大量削减。

**结论**：**main 明显更完整**。feature 该模块能力严重收缩。

---

### 2.11 内容详情 (Content Detail)

| 项目 | main | all-pages-migration-basic-complete |
|------|------|------------------------------------|
| `content-detail` | ✅ 独立页 (~168 行 + 样式) | ❌ **删除** |
| 替代 | - | 可能由 `dashboard/content` 或 `coach/content/[id]` 承接 |

**结论**：**main 有独立内容详情**；feature 删除后需确认新入口是否覆盖原能力。

---

### 2.12 Admin 模块

| 项目 | main | all-pages-migration-basic-complete |
|------|------|------------------------------------|
| Admin 页面 | 无（或未在 app.config 中） | ✅ 新增 10+ 页 |
| 实现 | - | 多为重定向（约 20 行） |

**结论**：**feature 有 admin 入口**，但多数为占位/重定向，实际功能有限。

---

### 2.13 Services / Utils 层

| 文件 | main | feature | 说明 |
|------|------|---------|------|
| `authService` | 完整 | 精简 (-41 行)，有 `.bak` | feature 简化 |
| `chatService` | 对象式，支持图片等 | 类式，仅文字 | main 更完整 |
| `paymentService` | ✅ 完整 | ❌ 删除 | main 更完整 |
| `streetliftingIndexService` | ✅ 完整 | ❌ 删除 | main 更完整 |
| `subscriptionService` | 完整 | 精简 (-23 行) | main 更完整 |
| `coachService` | 独立 + coach/coachService | 合并调整 | 结构变化 |
| `knowledgeService` | 基础 | 扩展 (+137 行) | feature 更强 |
| `trainingService` | 基础 | 调整 (+70 行) | feature 增强 |
| `apiFallback` | - | ✅ 新增 | feature 新增 |
| `paymentFallback` | - | ✅ 新增 | feature 新增 |
| `knowledgeTracker` | - | ✅ 新增 | feature 新增 |
| `streetliftingCalc` | ✅ 完整 | ❌ 删除 | main 更完整 |

**结论**：支付、街力、订阅等 **main 更完整**；知识库、训练、fallback 工具 **feature 更丰富**。

---

## 三、路由与入口差异

### main 核心路由
- 学员首页：`today-training` → `plan/current`
- 聊天：`messages` → `messages/chat`
- 知识库：`knowledge` → `knowledge/book-detail`
- 支付：`payment/wechat`、`payment/webview`、`payment-waiting`
- 街力：`streetlifting-index/*`
- 生成计划：`generate-plan` → `waiting`

### feature 核心路由
- 学员首页：today-training、plan/current 已删除
- 聊天：`dashboard/chat`（单页列表+聊天）
- 知识库：`dashboard/knowledge/*`
- 支付：`payment/index`（统一网页兜底）
- 街力：保留入口但逻辑大幅简化
- 生成计划：占位说明
- 新增：`dashboard/*`、`admin/*`、`articles`、`docs`、`public/training` 等

---

## 四、综合评估表

| 模块 | 更完整分支 | 说明 |
|------|------------|------|
| 今日训练 / 当前计划 | **main** | feature 删除核心学员首页 |
| Dashboard | **feature** | main 无此概念 |
| 知识库 | **feature** | 结构更全、子模块更多 |
| 聊天 | **main** | 图片、乐观更新、加载更多等 |
| 支付 | **main** | 有完整小程序内流程 |
| 教练主页订阅 | **main** | 续费、待支付合并等 |
| 智能生成计划 | **main** | feature 仅占位 |
| 学员计划库 create/edit | **feature** | 有完整原生实现 |
| 训练历史详情 | **feature** | 更完善 |
| 街力指数 | **main** | feature 大幅削弱 |
| 内容详情 | **main** | feature 删除独立页 |
| Services 整体 | 混合 | 支付/街力 main 好，知识/训练 feature 好 |

---

## 五、合并建议

### 功能取舍
1. **建议保留 main**：今日训练、当前计划、支付链路、教练主页订阅、智能生成计划、街力指数、聊天图片与高级特性。
2. **建议引入 feature**：dashboard 结构、知识库重组、me/plan-lib create/edit 原生实现、paymentFallback 等工具。

### 风险
- feature 删除 today-training、plan/current 会显著影响学员端体验。
- 支付完全依赖网页需与产品策略一致。
- chatService API 变更需前后端兼容。

### 推荐策略
- 采用 **选择性合并**：引入 feature 的 dashboard、知识库、plan-lib create/edit、fallback 工具，同时保留 main 的今日训练、支付、聊天高级能力、街力指数。
- 合并前需明确：学员首页的最终形态（today-training vs dashboard 等），以及支付、街力等功能的产品定位。

---

*报告基于 git diff 与代码抽样分析生成。*
