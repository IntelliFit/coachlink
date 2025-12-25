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

### Bug 9: 教练修改昵称后"发现教练"页不更新

**问题描述**：教练在个人中心修改昵称后，"发现教练"列表及教练详情页显示的仍是旧名字。

**根本原因**：数据冗余设计。`coaches` 表独立存储了 `name` 字段，而
`update-profile` 接口此前仅更新了 `user_profiles` 表的 `nickname`，未同步更新
`coaches` 表。

**解决方案**：在 `update-profile`
接口中增加同步逻辑：如果当前用户是教练，则在更新个人档案时同步更新
`coaches.name`。

**修改文件**：`src/app/api/user/update-profile/route.ts`

---

### Bug 10: 管理员确认支付无效

**问题描述**：管理员在支付管理页面点击"确认支付"后，订阅状态没有变为
`active`，且无错误提示。

**根本原因**：权限检查逻辑漏洞。管理员如果标记了 `is_coach=true` 但数据库
`coaches` 表中没有对应记录（尚未完成教练入驻），API 在查询 `coach_id`
时会报错并中断执行。

**解决方案**：重构 `update-subscription` 权限检查逻辑。管理员身份直接绕过
`coach_id` 查询和归属权验证，允许操作任意订阅。

**修改文件**：`src/app/api/subscription/update-subscription/route.ts`

---

### Bug 11: 模板全局问题选项不保存

**问题描述**：教练在模板编辑页面勾选全局问题选项（如"什么水平"）后保存，重新打开发现勾选状态消失。

**根本原因**：前端有 `globalAnswers` 状态存储用户选择，但保存时没有发送给
API，API 也没有存储到数据库。数据库缺少 `global_answers` 字段。

**解决方案**：

1. 数据库添加 `global_answers` (JSONB) 字段
2. API 接收并保存 `globalAnswers`
3. 前端加载和保存 `globalAnswers`
4. 移除模板卡片中已废弃的 `suitableFor` 显示

**修改文件**：

- `sql/20251226_add_global_answers_to_templates.sql`
- `src/types/database.types.ts`
- `src/app/api/plan-lib/update-template/entity.ts`
- `src/app/api/plan-lib/update-template/route.ts`
- `src/app/api/plan-lib/list-templates/entity.ts`
- `src/app/api/plan-lib/list-templates/route.ts`
- `src/app/dashboard/plan-lib/edit/[id]/page.tsx`
- `src/app/dashboard/plan-lib/components/TemplateCard.tsx`

---

### Bug 7: 教练身份冲突导致无法访问学员计划

**问题描述**： 用户在申请/成为教练后，自己作为学员订阅的训练计划无法访问，API
报错 403 (Forbidden)。

**根本原因**： API 权限检查逻辑使用了排他性的
`if (is_coach) { ... } else { ... }`
判断。当用户拥有教练身份时，系统只验证其作为教练的权限（即该计划是否为其创建），而忽略了该用户可能同时也是学员。

**解决方案**：
将权限检查修改为包容性逻辑：优先验证教练权限，如果不匹配，再继续验证学员权限。

**修改文件**：

- `src/app/api/plan-lib/get-instance/route.ts`
- `src/app/api/plan-lib/get-with-executions/route.ts`

---

## 三、首页与 UX 优化

### Bug 8: 首页按钮点击无效

**问题描述**： 首页的"立即开始训练"和"入驻成为教练"按钮没有点击事件。

**解决方案**：

1. **立即开始训练**：增加智能跳转逻辑，已登录跳转至
   `/today-training`，未登录跳转至 `/login`。
2. **入驻成为教练**：跳转至 `/coach/application`。
3. **入驻流程引导**：在教练申请页增加登录拦截，未登录用户自动重定向至登录页并显示提示信息。

**修改文件**：

- `src/app/page.tsx`
- `src/app/coach/application/page.tsx`

---

## 四、核心架构说明

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

| 文件                                                      | 修改类型 | 说明                                 |
| --------------------------------------------------------- | -------- | ------------------------------------ |
| `src/app/api/ranking/create-entry/route.ts`               | 修改     | 修复 maybeSingle 和 updated_at 问题  |
| `src/app/ranking/[id]/SubmissionDialog.tsx`               | 修改     | 添加必填字段红色星号                 |
| `src/app/api/coach/update-coach-application/route.ts`     | 修改     | 修复审批时更新 is_coach              |
| `src/app/api/user/switch-role/route.ts`                   | 新建     | 角色切换 API                         |
| `src/components/NavigationCoach.tsx`                      | 修改     | 切换按钮调用 API                     |
| `src/components/NavigationStudent.tsx`                    | 修改     | 切换按钮调用 API + 标签修复          |
| `src/components/student/profile/CoachApplicationCard.tsx` | 修改     | 进入教练端调用 API                   |
| `src/components/student/StudentProfilePage.tsx`           | 修改     | 状态判断逻辑修复                     |
| `src/app/api/auth/[...nextauth]/route.ts`                 | 修改     | Session 刷新增加 primary_role        |
| `src/app/api/plan-lib/get-instance/route.ts`              | 修改     | 修复双重身份权限检查逻辑             |
| `src/app/api/plan-lib/get-with-executions/route.ts`       | 修改     | 修复双重身份订阅查询逻辑             |
| `src/app/page.tsx`                                        | 修改     | 首页按钮跳转与智能状态判断           |
| `src/app/coach/application/page.tsx`                      | 修改     | 增加申请页登录重定向                 |
| `src/app/api/user/update-profile/route.ts`                | 修改     | 增加教练名称同步逻辑                 |
| `src/app/api/subscription/update-subscription/route.ts`   | 修改     | 修复管理员确认支付时的权限检查错误   |
| `sql/20251226_add_global_answers_to_templates.sql`        | 新建     | 添加 global_answers 字段迁移         |
| `src/types/database.types.ts`                             | 修改     | 添加 global_answers 类型             |
| `src/app/api/plan-lib/update-template/entity.ts`          | 修改     | 添加 globalAnswers 参数              |
| `src/app/api/plan-lib/update-template/route.ts`           | 修改     | 保存 globalAnswers 到数据库          |
| `src/app/api/plan-lib/list-templates/entity.ts`           | 修改     | 返回 globalAnswers 字段              |
| `src/app/api/plan-lib/list-templates/route.ts`            | 修改     | 查询并返回 global_answers            |
| `src/app/dashboard/plan-lib/edit/[id]/page.tsx`           | 修改     | 加载和保存 globalAnswers             |
| `src/app/dashboard/plan-lib/components/TemplateCard.tsx`  | 修改     | 显示全局问题，移除废弃的 suitableFor |
