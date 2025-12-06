# 缺失功能恢复计划

> 项目迁移后缺失功能的详细分析和修复方案 创建日期：2025-12-07

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

### 2. 缺失的路由页面

| 路由路径                    | 被引用位置               | 预期功能         | 优先级 |
| --------------------------- | ------------------------ | ---------------- | ------ |
| `/apply`                    | `Navigation.tsx:186`     | 教练申请表单页面 | 🔴 高  |
| `/apply/status`             | `Navigation.tsx:170`     | 查看申请状态     | 🔴 高  |
| `/apply/edit`               | `Navigation.tsx:178,182` | 修改被驳回的申请 | 🟡 中  |
| `/admin`                    | -                        | 管理员后台主页   | 🔴 高  |
| `/admin/coach-review`       | `AdminDashboard.tsx:149` | 教练申请审核     | 🔴 高  |
| `/admin/leaderboard-review` | `AdminDashboard.tsx:180` | 排行榜成绩审核   | 🟡 中  |

### 3. 缺失的功能集成

| 位置                     | 缺失内容                      | 影响                             |
| ------------------------ | ----------------------------- | -------------------------------- |
| `StudentProfilePage.tsx` | 未引入 `CoachApplicationCard` | 学员无法在档案页看到教练申请入口 |
| `Navigation.tsx`         | 管理员用户无后台入口          | 管理员无法访问后台功能           |

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
2. `src/app/apply/status/page.tsx` - 申请状态查看
3. `src/app/apply/edit/page.tsx` - 申请编辑

---

### 阶段二：管理员后台功能

#### 2.1 创建管理员后台主页

**文件**: `src/app/admin/page.tsx`

**说明**: 包装现有的 `AdminDashboard` 组件，添加权限验证

#### 2.2 创建教练审核页面

**文件**: `src/app/admin/coach-review/page.tsx`

**说明**: 列出待审核的教练申请，提供批准/拒绝操作

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

### 1. 教练申请表单字段（高优先级）

**问题**: 教练申请需要提交哪些信息？

**需确认**:

- [ ] 基本信息：姓名、简介、联系方式
- [ ] 资质证明：证书照片/文件上传
- [ ] 教学经验：文字描述
- [ ] 专长领域：标签选择（力量举、增肌、减脂等）
- [ ] 其他自定义字段

**参考**: 需求文档第 769-780 行（教练入驻审核）

### 2. 后端 API 情况（高优先级）

**问题**: 是否有现成的教练申请相关 API？

**需检查**:

- [ ] `/api/coach/apply` - 提交申请
- [ ] `/api/coach/application/status` - 查询申请状态
- [ ] `/api/admin/coach-applications` - 获取待审核列表
- [ ] `/api/admin/review-coach` - 审核申请（批准/拒绝）

**如果不存在**: 需要创建完整的后端 API

### 3. 管理员权限判断（中优先级）

**问题**: 如何判断用户是否为管理员？

**选项**:

- 方案 A: `session.user.role === 'admin'`
- 方案 B: 查询 `admin_users` 表
- 方案 C: 其他方式

**当前发现**: 代码中发现 `admin_users` 表存在（`types/database.types.ts`）

### 4. 教练申请数据表结构（中优先级）

**问题**: 是否有 `coach_applications` 表？

**需确认字段**:

- 申请人 ID
- 申请状态（pending/approved/rejected）
- 申请内容（JSON 或分字段）
- 审核人 ID
- 拒绝理由
- 时间戳

### 5. 排行榜审核已实现情况（低优先级）

**问题**: `AdminReviewPage` 组件是否已完全实现？

**需检查**:

- [ ] 是否只支持引体向上排行榜？
- [ ] 是否需要扩展为通用审核页面？
- [ ] API 是否已实现？

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
- 管理员后台需求: 第 720-799 行
- 教练入驻审核: 第 767-780 行
- 教练申请流程: Navigation.tsx 中已有路由引用

---

## ✅ 下一步行动

1. **立即行动**: 回答"待确认问题"部分的所有问题
2. **准备工作**: 检查数据库和 API 实现情况
3. **开始实施**: 按照实施步骤逐步恢复功能

---

_最后更新: 2025-12-07_
