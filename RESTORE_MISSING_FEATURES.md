# 缺失功能恢复计划

> 项目迁移后缺失功能的详细分析和修复方案 创建日期：2025-12-07
> 更新日期：2025-12-07 (根据原型设计更新)

---

## 📋 问题概述

项目整体迁移后，以下功能模块缺失或未正确接入主路由：

1. **学员端教练申请功能** - 组件存在但路由缺失
2. **管理员后台** - 组件存在但未接入路由系统
   - 教练申请审核
   - 排行榜成绩审核

---

## 🔍 详细分析

### 1. 现有但未使用的组件

| 组件文件                    | 路径                              | 功能描述                             | 状态        |
| --------------------------- | --------------------------------- | ------------------------------------ | ----------- |
| `AdminDashboard.tsx`        | `src/components/admin/`           | 管理员仪表盘，包含统计数据和功能入口 | ✅ 组件完整 |
| `AdminReviewPage.tsx`       | `src/components/admin/`           | 排行榜成绩审核（引体向上挑战）       | ✅ 组件完整 |
| `AdminPullupRecordForm.tsx` | `src/components/admin/`           | 管理员编辑/添加引体排行榜记录        | ✅ 组件完整 |
| `CoachApplicationCard.tsx`  | `src/components/student/profile/` | 教练申请状态卡片                     | ✅ 组件完整 |

### 2. 原型设计参考

| 原型文件                  | 路径                       | 功能描述               |
| ------------------------- | -------------------------- | ---------------------- |
| `coach-application.html`  | `ui-prototype-pc/student/` | 学员端教练申请表单页面 |
| `coach-applications.html` | `ui-prototype-pc/admin/`   | 管理员教练申请审核页面 |
| `review.html`             | `ui-prototype-pc/admin/`   | 排行榜成绩审核页面     |

### 3. 缺失的路由页面

| 路由路径                    | 被引用位置               | 预期功能         | 优先级 |
| --------------------------- | ------------------------ | ---------------- | ------ |
| `/apply`                    | `Navigation.tsx:186`     | 教练申请表单页面 | 🔴 高  |
| `/apply/status`             | `Navigation.tsx:170`     | 查看申请状态     | 🔴 高  |
| `/apply/edit`               | `Navigation.tsx:178,182` | 修改被驳回的申请 | 🟡 中  |
| `/admin`                    | -                        | 管理员后台主页   | 🔴 高  |
| `/admin/coach-review`       | `AdminDashboard.tsx:149` | 教练申请审核     | 🔴 高  |
| `/admin/leaderboard-review` | `AdminDashboard.tsx:180` | 排行榜成绩审核   | 🟡 中  |

### 4. 缺失的功能集成

| 位置                     | 缺失内容                      | 影响                             |
| ------------------------ | ----------------------------- | -------------------------------- |
| `StudentProfilePage.tsx` | 未引入 `CoachApplicationCard` | 学员无法在档案页看到教练申请入口 |
| `Navigation.tsx`         | 管理员用户无后台入口          | 管理员无法访问后台功能           |

---

## 📐 原型设计规范（来自 ui-prototype-pc）

### 教练申请表单字段（学员端）

根据 `ui-prototype-pc/student/coach-application.html`：

| 字段名            | 字段 ID           | 类型                | 必填 | 说明                           |
| ----------------- | ----------------- | ------------------- | ---- | ------------------------------ |
| 真实姓名/品牌名   | `realName`        | text                | ✅   | -                              |
| 头像链接          | `avatarUrl`       | url                 | ❌   | 可选，https://                 |
| 一句话简介        | `tagline`         | text                | ✅   | 如：国家级运动员 \| 力量举教练 |
| 专长标签          | `specialties`     | text (逗号分隔)     | ✅   | 如：力量训练, 减脂, 动作纠正   |
| 教学年限          | `experienceYears` | number              | ❌   | 年                             |
| 核心服务权益      | `services`        | text                | ❌   | 如：AI计划 + 每周动作点评      |
| 自我介绍/教学理念 | `bio`             | textarea            | ✅   | 多行文本                       |
| 代表案例/成功故事 | `cases`           | textarea            | ❌   | 多行文本                       |
| 资质/证书         | `certificates`    | textarea (每行一条) | ❌   | 支持链接或文字                 |
| 其他荣誉成就      | `achievements`    | textarea            | ❌   | 可选                           |

### 申请状态流程

```
draft (草稿) → pending (审核中) → approved (已通过) / rejected (已拒绝)
                                    ↓           ↓
                              进入教练端     修改后重新提交
```

**状态对应的 UI 显示**:

- `draft`: 草稿未提交 (黄色徽章)
- `pending`: 审核中 (黄色徽章)
- `approved`: 审核通过 (绿色徽章)
- `rejected`: 审核未通过 (红色徽章)

**申请步骤指示器**:

1. 填写资料 (FileText 图标)
2. 等待审核 (Clock3 图标)
3. 成为教练 (Medal 图标)

### 管理员审核页面设计

根据 `ui-prototype-pc/admin/coach-applications.html`：

**功能**:

- 状态筛选下拉框（全部/待审核/已通过/已拒绝/草稿）
- 申请列表统计
- 申请卡片展示：
  - 申请人头像、姓名
  - 提交时间
  - 状态徽章
  - 四个字段网格显示：一句话简介、专长标签、教学年限、核心服务权益
  - 详细内容区：自我介绍、代表案例、资质证书、其他成就
  - 操作按钮：通过/拒绝（仅 pending 状态显示）
  - 拒绝时需填写理由

---

## 🛠️ 修复方案

### 阶段一：学员端教练申请功能

#### 1.1 添加申请卡片到档案页

**文件**: `src/components/student/StudentProfilePage.tsx`

**修改内容**:

```tsx
// 在 imports 中添加
import { CoachApplicationCard } from "./profile/CoachApplicationCard";

// 在 PersonalInfoSection 前添加
<CoachApplicationCard
    status={data.coachApplicationStatus}
    rejectionReason={data.rejectionReason}
/>;
```

#### 1.2 创建教练申请路由页面

**需创建的文件**:

1. `src/app/apply/page.tsx` - 教练申请表单
   - 使用上述表单字段
   - 支持保存草稿和提交审核
   - 状态步骤指示器

2. `src/app/apply/status/page.tsx` - 申请状态查看
   - 显示当前状态和步骤
   - 审核通过后显示"进入教练端"按钮

3. `src/app/apply/edit/page.tsx` - 申请编辑
   - 供被驳回的申请修改后重新提交

---

### 阶段二：管理员后台功能

#### 2.1 创建管理员后台主页

**文件**: `src/app/admin/page.tsx`

**说明**: 包装现有的 `AdminDashboard` 组件，添加权限验证

#### 2.2 创建教练审核页面

**文件**: `src/app/admin/coach-review/page.tsx`

**功能**:

- 列出待审核的教练申请
- 状态筛选
- 批准/拒绝操作（拒绝需填理由）
- 参考原型：`ui-prototype-pc/admin/coach-applications.html`

#### 2.3 创建排行榜审核页面

**文件**: `src/app/admin/leaderboard-review/page.tsx`

**说明**: 包装现有的 `AdminReviewPage` 组件

#### 2.4 添加管理后台入口

**文件**: `src/components/Navigation.tsx`

**修改位置**: `userMenuItems` 中为管理员添加入口

```tsx
// 在 userMenuItems 的适当位置添加
if (session?.user?.role === "admin") {
    items.push(
        {
            label: "管理后台",
            icon: "pi pi-shield",
            command: () => router.push("/admin"),
        },
        { separator: true },
    );
}
```

---

## ❓ 待确认问题

### 1. 后端 API 情况（高优先级）

**问题**: 是否有现成的教练申请相关 API？

**需检查**:

- [ ] `POST /api/coach/apply` - 提交/保存申请
- [ ] `GET /api/coach/application/status` - 查询申请状态
- [ ] `GET /api/admin/coach-applications` - 获取待审核列表
- [ ] `POST /api/admin/review-coach` - 审核申请（批准/拒绝）

**如果不存在**: 需要创建完整的后端 API

### 2. 数据库表结构（高优先级）

**问题**: 是否有 `coach_applications` 表？

**需要的字段**:

```sql
coach_applications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    status VARCHAR(20), -- draft/pending/approved/rejected
    form_data JSONB, -- 存储所有申请表单字段
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
```

### 3. 管理员权限判断（中优先级）

**问题**: 如何判断用户是否为管理员？

**选项**:

- 方案 A: `session.user.role === 'admin'`
- 方案 B: 查询 `admin_users` 表
- 方案 C: 其他方式

**当前发现**: 代码中发现 `admin_users` 表存在（`types/database.types.ts`）

### 4. 原型中的 MockData 服务（参考）

原型使用的服务接口（需在 Next.js 中实现对应 API）:

- `CoachApplicationService.getAll()` - 获取所有申请
- `CoachApplicationService.getByUserId(userId)` - 获取用户申请
- `CoachApplicationService.saveDraft(userId, formData)` - 保存草稿
- `CoachApplicationService.submit(userId, formData)` - 提交申请
- `CoachApplicationService.withdraw(appId)` - 撤回申请
- `CoachApplicationService.approve(appId, reviewer)` - 批准申请
- `CoachApplicationService.reject(appId, reviewer, reason)` - 拒绝申请

---

## 📝 实施步骤建议

### Step 1: 确认问题（预计 30 分钟）

1. 回答上述"待确认问题"
2. 检查数据库表结构和 API 实现情况
3. 确定优先级（哪些功能最紧急）

### Step 2: 快速恢复核心功能（预计 2-3 小时）

**Phase 1 - 管理员后台**（更容易，因为组件已存在）

1. 创建 `/admin/page.tsx`（包装 AdminDashboard）
2. 创建 `/admin/leaderboard-review/page.tsx`（包装 AdminReviewPage）
3. 在 Navigation 中添加管理后台入口

**Phase 2 - 教练申请（学员端）**

1. 在 `StudentProfilePage` 中添加 `CoachApplicationCard`
2. 创建 `/apply/status/page.tsx`（简单状态显示）

### Step 3: 完整实现（预计 4-6 小时）

1. 创建教练申请表单页面 `/apply/page.tsx`
2. 创建教练申请编辑页面 `/apply/edit/page.tsx`
3. 创建教练审核页面 `/admin/coach-review/page.tsx`
4. 实现/完善相关 API（如果不存在）

### Step 4: 测试验证（预计 1-2 小时）

1. 测试学员申请流程
2. 测试管理员审核流程
3. 测试排行榜审核功能

---

## 📌 注意事项

1. **权限控制**: 所有管理员页面都需要添加服务端权限验证
2. **数据一致性**: 确保 `session.user.coach_status` 与数据库状态一致
3. **用户体验**: 审核操作需要确认弹窗，防止误操作
4. **通知机制**: 审核结果需要通知申请人（站内信/邮件）

---

## 🔗 相关文档

- 需求文档: `ui-prototypes-phone/需求文档详细版.md`
  - 排行榜功能: 第 638-719 行
  - 管理员后台: 第 720-799 行
- PC 原型设计: `ui-prototype-pc/`
  - 学员申请表单: `student/coach-application.html`
  - 管理员审核: `admin/coach-applications.html`
  - 排行榜审核: `admin/review.html`

---

## ✅ 下一步行动

1. **立即行动**: 回答"待确认问题"部分的所有问题
2. **准备工作**: 检查数据库和 API 实现情况
3. **开始实施**: 按照实施步骤逐步恢复功能

---

_最后更新: 2025-12-07_
