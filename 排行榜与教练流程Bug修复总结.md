# 排行榜与教练流程 Bug 修复总结

> 修复日期：2025-12-26 涉及模块：排行榜系统、教练申请审批、角色切换

---

## 一、排行榜提交功能 Bug

### Bug 1: 提交成绩时报错 "multiple (or no) rows returned"

**问题描述**： 用户提交排行榜成绩时，系统报错导致提交失败。

**根本原因**： `create-entry` API 使用 `maybeSingle()`
查询用户的历史提交记录，但当用户有多条记录（如一条 pending、一条
rejected）时，该方法会抛出异常。

**解决方案**： 修改查询逻辑，添加 `order` 和 `limit` 确保只返回最新的一条记录：

```typescript
// 修改前
.maybeSingle();

// 修改后
.order("created_at", { ascending: false }).limit(1).maybeSingle();
```

**修改文件**：`src/app/api/ranking/create-entry/route.ts`

---

### Bug 2: 更新成绩时报错 "column updated_at does not exist"

**问题描述**： 更新已有的排行榜条目时，系统报错提示 `updated_at` 字段不存在。

**根本原因**： 代码尝试更新一个数据库表中不存在的 `updated_at` 字段。

**解决方案**： 从更新语句中移除该字段。

**修改文件**：`src/app/api/ranking/create-entry/route.ts`

---

### Bug 3: 必填字段没有视觉提示

**问题描述**： 用户在填写排行榜表单时，无法直观识别哪些字段是必填的。

**解决方案**： 在必填字段的标签后添加红色星号 `*` 作为视觉提示。

**修改文件**：`src/app/ranking/[id]/SubmissionDialog.tsx`

---

## 二、教练申请审批流程 Bug

### Bug 4: 审批通过后教练不出现在"发现教练"列表

**问题描述**： 管理员批准教练申请后，新教练未出现在公开的教练列表中。

**根本原因**：

1. 创建教练记录时未设置 `status: 'approved'`
2. 用户表的 `is_coach` 字段未更新为 `true`

**解决方案**： 在批准申请时同时更新两个地方：

```typescript
// 1. 创建教练记录时设置状态
await supabase.from("coaches").insert({
    ...coachData,
    status: "approved", // 添加此字段
});

// 2. 更新用户的教练标识
await supabase.from("users")
    .update({ is_coach: true })
    .eq("id", userId);
```

**修改文件**：`src/app/api/coach/update-coach-application/route.ts`

---

### Bug 5: 新教练无法进入教练端

**问题描述**： 审批通过的教练点击"切换到教练端"后，页面显示 404
错误，且导航栏仍显示学员端菜单。

**根本原因**：

1. 导航栏切换是基于 `session.user.primary_role` 字段判断的
2. 切换按钮只做页面跳转，未更新 `primary_role` 字段
3. Session 刷新逻辑未包含 `primary_role` 字段

**解决方案**：

1. **创建角色切换 API**：
   - 新建 `src/app/api/user/switch-role/route.ts`
   - 接收 `{ role: 'student' | 'coach' }` 参数
   - 更新用户的 `primary_role` 字段

2. **更新切换按钮逻辑**：
   - `NavigationCoach.tsx`："切换至学员端" 调用 API 后跳转
   - `NavigationStudent.tsx`："切换到教练端" 调用 API 后跳转
   - `CoachApplicationCard.tsx`："进入教练端" 同样调用 API

3. **更新 Session 刷新**：
   - 在 `route.ts` (auth) 中添加 `primary_role` 到刷新查询

**关键代码示例**：

```typescript
// NavigationStudent.tsx 中的切换逻辑
command: (async () => {
    const res = await fetch("/api/user/switch-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "coach" }),
    });
    if (res.ok) {
        window.location.href = "/dashboard";
    }
});
```

---

### Bug 6: 切换到学员端后头像标签仍显示"教练"

**问题描述**： 教练切换到学员端后，头像旁边的身份标签仍显示"教练"而非"学员"。

**根本原因**： 标签判断逻辑使用 `is_coach`（永久标识，表示"有教练资格"），而非
`primary_role`（当前所处模式）。

**解决方案**： 将判断条件从 `is_coach` 改为 `primary_role === 'coach'`：

```typescript
// 修改前
{
    session.user.is_coach ? "教练" : "学员";
}

// 修改后
{
    session.user.primary_role === "coach" ? "教练" : "学员";
}
```

**修改文件**：`src/components/NavigationStudent.tsx`

---

## 三、核心架构说明

### 导航切换机制

系统使用 `Navigation.tsx` 作为导航组件入口，根据用户角色动态渲染不同导航栏：

```typescript
// src/components/Navigation.tsx
if (session?.user?.is_admin) {
    return <NavigationAdmin />;
} else if (session?.user?.primary_role === "coach") {
    return <NavigationCoach />;
} else {
    return <NavigationStudent />;
}
```

### 关键字段说明

| 字段           | 表      | 含义                                                      |
| -------------- | ------- | --------------------------------------------------------- |
| `is_coach`     | users   | 用户是否拥有教练资格（永久标识）                          |
| `primary_role` | users   | 用户当前所处模式（'student' 或 'coach'）                  |
| `coach_status` | users   | 教练申请状态（'none', 'pending', 'approved', 'rejected'） |
| `status`       | coaches | 教练记录状态（需要为 'approved' 才会出现在列表）          |

### 路由说明

| 路径           | 用途                                 |
| -------------- | ------------------------------------ |
| `/dashboard/*` | 教练管理后台（我的学员、计划模板等） |
| `/coach/*`     | 学员端查看订阅和发现教练             |
| `/`            | 学员端首页                           |

---

## 四、修改文件清单

| 文件                                                      | 修改类型 | 说明                                |
| --------------------------------------------------------- | -------- | ----------------------------------- |
| `src/app/api/ranking/create-entry/route.ts`               | 修改     | 修复 maybeSingle 和 updated_at 问题 |
| `src/app/ranking/[id]/SubmissionDialog.tsx`               | 修改     | 添加必填字段红色星号                |
| `src/app/api/coach/update-coach-application/route.ts`     | 修改     | 修复审批时更新 is_coach             |
| `src/app/api/user/switch-role/route.ts`                   | 新建     | 角色切换 API                        |
| `src/components/NavigationCoach.tsx`                      | 修改     | 切换按钮调用 API                    |
| `src/components/NavigationStudent.tsx`                    | 修改     | 切换按钮调用 API + 标签修复         |
| `src/components/student/profile/CoachApplicationCard.tsx` | 修改     | 进入教练端调用 API                  |
| `src/components/student/StudentProfilePage.tsx`           | 修改     | 状态判断逻辑修复                    |
| `src/app/api/auth/[...nextauth]/route.ts`                 | 修改     | Session 刷新增加 primary_role       |
