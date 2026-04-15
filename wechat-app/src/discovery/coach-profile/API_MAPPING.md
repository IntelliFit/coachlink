# 教练详情页 - 接口清单与字段映射

与 PC 端 `coachlink/src/app/coach/profile/[id]` 对齐。

## 接口清单

| 接口 | 方法 | 请求参数 | 响应 | 说明 |
|-----|------|----------|------|------|
| `/api/coach/get-coach` | POST | `{ id: string }` | `{ coach: CoachRow }` | 教练基本信息 |
| `/api/coach/get-aggregated-info` | POST | `{ coachId: string }` | `{ coach, contentCount, studentCount, reviewCount, averageRating, specialties }` | 聚合信息 |
| `/api/subscription/coach-subscriptions` | POST | `{ studentId: string, onlyActive?: boolean }` | `{ subscriptions: QueryCoachSubscription[] }` | 当前用户订阅列表（用于判断是否已订阅该教练） |
| `/api/coach/get-pricing` | POST | `{ coachId: string }` | `{ products?: Product[] }` | 教练定价/套餐 |
| `/api/coach/get-contents` | POST | `{ coachId, limit, offset }` | `{ contents: CoachContentRow[], total }` | 教练内容列表 |
| `/api/coach/get-questionnaires` | POST | `{ coachId?: string }` | `{ questionnaires?: any[] }` | 问卷配置（查看问卷/提交用） |
| `/api/subscription/update-subscription` | POST | `{ id, subscribe_data }` | 更新结果 | 问卷提交 |

**可选（PC 有、小程序可延后）：**
- 联系教练：`/api/chat/get-chatroom` POST `{ members: [userId, coachUserId] }` → 需登录 + 聊天能力
- 学员评价：`/api/user/get-student-comments` 或等价接口 → 评价列表

## 字段映射（教练基本信息）

| 字段 | 来源 | 说明 |
|-----|------|------|
| id, name, avatar_url, bio, title | coaches 表 | 基础展示 |
| specialties | get-aggregated-info 或 coaches.specialties | 擅长领域 |
| years_experience | coaches | 从业经验 |
| profile | coaches.profile (JSON) | 教学理念、成就、证书、案例、联系方式、社交链接 |
| is_featured | coaches | 是否精选 |

## 页面状态（与 PC 一致）

- coach: 教练基本信息
- aggregatedInfo: 聚合信息（内容数/学员数/评分/专长）
- userSubscription: 当前用户对该教练的订阅（若有）
- mySubscriptions: 当前用户全部订阅（用于已订阅时展示状态）
- products: 定价套餐列表
- contents: 内容列表（分页）
- loading / error / empty：统一处理
