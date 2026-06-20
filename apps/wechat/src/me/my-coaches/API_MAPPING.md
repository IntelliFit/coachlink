# 我的教练 - 接口清单与字段映射

与网页端 `coachlink/src/app/coach/subscription`、`CoachList`、`MyCoachesList` 对齐。

## 接口清单

| 接口 | 方法 | 说明 | 网页端调用 |
|-----|------|------|------------|
| `/api/subscription/coach-subscriptions` | POST | 获取当前用户的教练订阅列表 | `subscriptionService.getCoachSubscriptions({ studentId: session.user.id })` |
| `/api/coach/get-aggregated-info` | POST | 获取教练聚合信息（内容数、学员数、评分、专长） | `coachService.getAggregatedInfo({ coachId })` |

### 1) coach-subscriptions

- **请求体**: `{ studentId: string }`（可选 `coachId`, `onlyActive`）
- **响应体**: `{ subscriptions: QueryCoachSubscription[] }`
- **鉴权**: 需登录（Bearer token），后端用 studentId 或 session 识别用户

### 2) get-aggregated-info

- **请求体**: `{ coachId: string }`
- **响应体**: `{ coach, contentCount, studentCount, reviewCount, averageRating, specialties: string[] }`

---

## 字段映射

### QueryCoachSubscription（订阅列表项）

| 字段 | 来源 | 说明 |
|-----|------|------|
| id | coach_subscriptions.id | 订阅记录 id |
| coach_id | coach_subscriptions.coach_id | 教练 id |
| student_id | coach_subscriptions.student_id | 学员 id |
| status | coach_subscriptions.status | active / inactive / waiting 等 |
| start_date | coach_subscriptions.start_date | 开始日期（ISO 字符串） |
| end_date | coach_subscriptions.end_date | 结束日期（ISO 字符串） |
| tier | coach_subscriptions.tier | 套餐档位 1/2/3 |
| subscribed_weeks | coach_subscriptions.subscribed_weeks | 订阅周数（可选） |
| has_plan_instance | 后端计算 | 是否已分配计划实例 |
| coach | 关联 coaches 表 | 教练信息（见下表） |

### CoachRow（教练信息，即 coach 字段）

| 字段 | 来源 | 说明 |
|-----|------|------|
| id | coaches.id | 教练 id |
| name | coaches.name | 姓名 |
| avatar_url | coaches.avatar_url | 头像 URL |
| bio | coaches.bio | 简介 |
| title | coaches.title | 称号（如「专业认证教练」） |
| specialties | coaches.specialties | 专长标签数组 |

### GetAggregatedInfoResponseDto（聚合信息，用于卡片指标）

| 字段 | 说明 |
|-----|------|
| contentCount | 内容数 |
| studentCount | 学员数 |
| averageRating | 平均评分 |
| specialties | 专长列表（优先于 coach.specialties 展示） |

### 状态展示（与网页 CoachList STATUS_THEME 一致）

- active → 已激活 / 剩余 N 天
- preparing → 制定中（active 但 has_plan_instance=false）
- not_started → 未开始（有计划未开始）
- expired → 已过期
- expiring → 即将到期（7 天内）
- waiting → 待确认
- inactive → 待支付

---

## 交互与 TODO

- **查看详情**：网页端 `/coach/profile/:id`，小程序待实现（当前 toast「功能开发中」）。
- **续费**：网页端 `/coach/profile/:id?renew=true`，小程序待实现。
- **咨询**：网页端占位逻辑，小程序待实现。
- **解绑**：网页端未在「我的教练」列表提供解绑入口，小程序不实现。
