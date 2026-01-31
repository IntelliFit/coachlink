# AI 配额与视频存储功能实现问题记录

本文档记录了在实现学员会员权益系统（AI
配额消耗、视频存储配额）过程中遇到的问题及解决方案。

---

## 1. AI 配额消耗功能

### 1.1 功能需求

- 学员使用"智能导入"功能时，应扣除 AI 配额
- 配额耗尽时应阻止操作并提示用户升级

### 1.2 错误定位

**初始错误**：在错误的 API 路由中实现了配额扣除。

| 错误位置                                        | 正确位置                               |
| ----------------------------------------------- | -------------------------------------- |
| `/api/training/generate-ai-plan` (自建，后删除) | `/api/student/plan-lib/parse-template` |

**原因**：未充分了解现有代码架构，错误地创建了新的 AI 生成接口。

### 1.3 解决方案

在正确的学员端 API `src/app/api/student/plan-lib/parse-template/route.ts`
中调用：

```typescript
const { checkAndConsumeAiQuota } = await import("@/lib/membershipLimit");
const quotaResult = await checkAndConsumeAiQuota(userId, 1);
if (!quotaResult.success) {
    return NextResponse.json({ success: false, message: quotaResult.message }, {
        status: 403,
    });
}
```

---

## 2. 视频存储配额功能

### 2.1 功能需求

- 上传视频前检查剩余存储空间
- 上传成功后累加已用空间

### 2.2 遇到的问题及解决

#### 问题 A：RLS 权限导致更新失败（静默失败）

**现象**：代码执行无报错，但数据库 `storage_used_mb` 字段未更新。

**原因**：`membershipLimit.ts` 使用了匿名客户端 (`supabase`)，受 RLS
策略限制无法更新 `student_quotas` 表。

**解决方案**：

```typescript
// 修改前
import supabase from "./supabaseClient";

// 修改后
import { serviceRoleSupabase as supabase } from "./supabaseClient";
```

同样修改了 `/api/membership/get-quota/route.ts`。

---

#### 问题 B：整数类型字段无法存储小数

**现象**：

```
[Storage] Failed to increment usage for user xxx
{ code: '22P02', message: 'invalid input syntax for type integer: "4.9522600173950195"' }
```

**原因**：数据库 `storage_used_mb` 字段类型为 `INTEGER`，无法存储小数。

**解决方案**：

1. **代码层临时修复**：四舍五入到两位小数
   ```typescript
   const newUsage = Math.round((quota.storage_used_mb + fileSizeMB) * 100) /
       100;
   ```

2. **数据库永久修复**：执行迁移脚本 `20260106_fix_storage_column_type.sql`
   ```sql
   ALTER TABLE student_quotas
   ALTER COLUMN storage_used_mb TYPE NUMERIC(10, 2);
   ```

---

#### 问题 C：Request body object should not be disturbed or locked

**现象**：上传视频时 API 返回 500 错误。

**原因**：代码中使用了 `req.clone().formData()`，在 Next.js App Router
中会导致请求体被锁定。

**解决方案**：

```typescript
// 修改前
const formData = await req.clone().formData();

// 修改后
const formData = await req.formData();
```

**注意**：修改后需要**重启开发服务器**（Ctrl+C 后重新
`npm run dev`），否则热更新缓存可能导致旧代码仍在执行。

---

## 3. 涉及的文件修改

| 文件路径                                                   | 修改内容                                            |
| ---------------------------------------------------------- | --------------------------------------------------- |
| `src/lib/membershipLimit.ts`                               | 使用 serviceRole 客户端、添加详细日志、修复小数计算 |
| `src/app/api/membership/get-quota/route.ts`                | 使用 serviceRole 客户端                             |
| `src/app/api/user/upload-video/route.ts`                   | 移除 `req.clone()`、添加存储检查和累加              |
| `src/app/api/training/upload-set-video/route.ts`           | 添加存储检查和累加                                  |
| `src/app/api/student/plan-lib/parse-template/route.ts`     | 添加 AI 配额检查和扣除                              |
| `src/components/video/VideoUploader.tsx`                   | 添加 `submitDisabled` 属性支持                      |
| `supabase/migrations/20260106_fix_storage_column_type.sql` | 修改字段类型为 NUMERIC                              |

---

## 4. 经验教训

1. **先理解现有架构**：修改功能前应先了解现有代码流程，避免在错误位置实现
2. **注意 RLS 权限**：后端涉及跨表更新时，优先使用 `serviceRoleSupabase`
3. **数据库类型匹配**：存储 MB 等可能含小数的值时，使用 `NUMERIC` 而非 `INTEGER`
4. **Next.js Request 处理**：App Router 中不要 clone 请求体
5. **重启开发服务器**：遇到诡异的缓存问题时，先尝试重启

---

_文档创建时间：2026-01-06_
