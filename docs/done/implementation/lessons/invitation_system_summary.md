# 教练邀请码系统 - 需求与实现总结

## 一、需求描述

### 核心需求

教练担心学员在平台上看到其他教练后流失，希望：

1. **通过邀请码注册的学员**，在订阅期间只能看到邀请他们的教练，看不到其他教练
2. **教练可以选择模式**：
   - 专属模式（exclusive）：学员视野受限
   - 开放模式（open）：学员可以看到所有教练

### 业务逻辑

```
教练生成邀请码 → 学员通过链接注册 → 记录关联关系
                                    ↓
                    学员访问"发现教练"页面时
                                    ↓
                    检查：是否有邀请教练？教练是否是专属模式？
                                    ↓
                    是 → 只显示邀请教练（页面标题改为"我的专属教练"）
                    否 → 显示所有教练
```

### 当前问题

通过邀请码注册的学员，访问"发现教练"页面时**仍然可以看到所有教练**，专注模式过滤没有生效。

---

## 二、我做的改动

### 1. 数据库迁移

**文件**: `supabase/migrations/20260113_coach_invitation_system.sql`

```sql
-- coaches 表新增字段
ALTER TABLE coaches ADD COLUMN invitation_code VARCHAR(16) UNIQUE;
ALTER TABLE coaches ADD COLUMN invitation_mode VARCHAR(20) DEFAULT 'exclusive';

-- users 表新增字段
ALTER TABLE users ADD COLUMN referrer_coach_id UUID REFERENCES coaches(id);

-- 索引
CREATE INDEX idx_users_referrer_coach ON users(referrer_coach_id);
CREATE INDEX idx_coaches_invitation_code ON coaches(invitation_code);
```

**状态**: ✅ 已应用到 Supabase

---

### 2. 后端 API

#### 2.1 邀请码管理 API

**文件**: `src/app/api/coach/invitation-code/route.ts`

| 方法  | 功能                             |
| ----- | -------------------------------- |
| GET   | 获取教练的邀请码、模式、邀请链接 |
| POST  | 重新生成邀请码                   |
| PATCH | 切换邀请模式（exclusive/open）   |

#### 2.2 视野状态 API（关键）

**文件**: `src/app/api/student/visibility-status/route.ts`

```typescript
// 返回结构
{
  focusMode: boolean,      // 是否处于专注模式
  focusCoachId: string,    // 专注的教练ID
  focusCoachName: string,  // 专注的教练名称
  referrerCoachId: string, // 邀请教练ID
  referrerCoachName: string
}
```

**判断逻辑**:

1. 查询用户的 `referrer_coach_id`
2. 如果有邀请教练，查询该教练的 `invitation_mode`
3. 如果模式是 `exclusive`，则 `focusMode = true`

#### 2.3 注册 API 修改

**文件**: `src/app/api/auth/register/route.ts`

新增接收 `invitationCode` 参数，注册时：

```typescript
// 查找邀请码对应的教练
const { data: coach } = await supabase
    .from("coaches")
    .select("id")
    .eq("invitation_code", invitationCode)
    .eq("status", "active")
    .single();

// 创建用户时写入 referrer_coach_id
await supabase.from("users").insert({
    phone,
    password_hash,
    referrer_coach_id: coach?.id, // 关键
});
```

---

### 3. 前端改动

#### 3.1 教练邀请设置页面

**文件**: `src/app/coach/settings/invitation/page.tsx`

- 显示邀请码、邀请链接
- 复制按钮
- 重新生成按钮
- 专属/开放模式切换

#### 3.2 发现教练页面（核心过滤逻辑）

**文件**: `src/app/coach/discovery/page.tsx`

```typescript
// 获取视野状态
const [visibilityStatus, setVisibilityStatus] = useState(null);

useEffect(() => {
  fetch('/api/student/visibility-status')
    .then(res => res.json())
    .then(json => setVisibilityStatus(json.data));
}, []);

// 加载教练时判断
const loadCoaches = async () => {
  if (visibilityStatus?.focusMode && visibilityStatus?.focusCoachId) {
    // 专注模式：只加载一个教练
    const coach = await coachService.getCoach({ id: visibilityStatus.focusCoachId });
    setCoaches([coach]);
  } else {
    // 正常模式：加载所有
    const res = await coachService.getAllCoaches(...);
    setCoaches(res.coaches);
  }
};

// 渲染时根据 focusMode 显示不同UI
if (visibilityStatus?.focusMode) {
  return <专属教练页面 />;
} else {
  return <发现教练页面 />;
}
```

#### 3.3 导航菜单入口

**文件**: `src/components/NavigationCoach.tsx`

添加了"邀请学员"菜单项，指向 `/coach/settings/invitation`

---

## 三、可能的问题点

### 1. 视野状态 API 可能没有正确返回 focusMode

需要检查：

- 用户的 `referrer_coach_id` 是否正确写入了数据库
- 教练的 `invitation_mode` 字段值是否正确

**调试方法**:

```bash
# 在浏览器控制台执行
fetch('/api/student/visibility-status').then(r => r.json()).then(console.log)
```

### 2. 前端可能没有正确使用 visibilityStatus

- `visibilityLoading` 状态管理
- `loadCoaches` 依赖 `visibilityStatus` 的时机

### 3. 注册时可能没有正确传递 invitationCode

需要检查注册页面是否正确解析 URL 中的 `invite` 参数并传给 API。

---

## 四、相关文件清单

| 文件路径                                                   | 作用                           |
| ---------------------------------------------------------- | ------------------------------ |
| `supabase/migrations/20260113_coach_invitation_system.sql` | 数据库迁移                     |
| `src/app/api/coach/invitation-code/route.ts`               | 邀请码管理 API                 |
| `src/app/api/invitation/verify/route.ts`                   | 验证邀请码 API                 |
| `src/app/api/student/visibility-status/route.ts`           | 视野状态 API                   |
| `src/app/api/auth/register/route.ts`                       | 注册 API（修改）               |
| `src/app/api/auth/register/entity.ts`                      | 注册DTO（新增 invitationCode） |
| `src/app/coach/settings/invitation/page.tsx`               | 教练邀请设置页面               |
| `src/app/coach/discovery/page.tsx`                         | 发现教练页面（修改）           |
| `src/components/NavigationCoach.tsx`                       | 教练导航（新增菜单）           |

---

## 五、验证步骤

1. **检查数据库**：用户的 `referrer_coach_id` 是否有值
2. **检查 API**：调用 `/api/student/visibility-status` 返回什么
3. **检查前端**：`discovery/page.tsx` 中 `visibilityStatus` 的值
4. **检查注册流程**：注册页面是否传递了 `invitationCode`
