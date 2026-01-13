# 配额系统修复与邀请增长功能实现总结

> **日期**: 2026-01-13  
> **模块**: 配额管理、邀请系统、增长拉新  
> **状态**: ✅ 已完成

---

## 1. 需求概述

本次迭代主要解决以下问题：

### 1.1 核心 Bug 修复
- **视频上传失败**：学员在"今日训练"页面执行计划时，上传组视频偶发 HTTP 500 错误，有时显示"没有配额信息"
- **进步足迹重复**：突破组在个人档案"进步足迹"页面重复显示两遍

### 1.2 配额体系优化
- **免费用户配额不合理**：免费用户配额为 0，导致无法正常使用功能
- **配额默认值调整**：免费用户应默认拥有 **50MB 存储空间** 和 **每月 2 次 AI 智能导入**

### 1.3 邀请增长系统
- **邀请机制完善**：原有邀请链接只有生成功能，缺少归因、落库、发奖闭环
- **奖励机制调整**：奖励应从"3 天会员"改为**配额奖励**（AI 导入次数 + 存储空间）
- **新增分享卡片拉新**：训练分享图上的二维码扫码注册 → 双方获得配额奖励（+2 AI、+100MB），每日上限 10 次

---

## 2. 技术实现细节

### 2.1 视频上传失败修复

#### 问题定位
- **根因 1**：`POST /api/execution/upload-set-video` 使用匿名 Supabase 客户端 (`supabase`) 上传到 Storage，被 RLS 策略拦截
- **根因 2**：部分用户缺少 `student_quotas` 记录，导致查询返回空，触发"没有配额信息"错误

#### 解决方案

**文件**: `src/app/api/execution/upload-set-video/route.ts`

```typescript
// 改用 serviceRoleSupabase 进行服务端操作
const { error: uploadError } = await serviceRoleSupabase.storage
    .from("videos")
    .upload(filePath, uint8Array, {
        contentType: file.type,
        upsert: false,
    });
```

**文件**: `src/lib/membershipLimit.ts`

- 实现 `student_quotas` 表的**懒初始化**：如果记录不存在，根据用户会员档位自动创建默认配额
- 修复历史数据：对于 `storage_total_mb` 为 0 或 NULL 的记录，自动补齐为档位默认值

```typescript
// 懒初始化逻辑
if (!quota) {
    const { data: membership } = await supabase
        .from("student_memberships")
        .select("tier")
        .eq("user_id", userId)
        .maybeSingle();
    const tier = (membership?.tier || "free") as keyof typeof MEMBER_BENEFITS;
    const benefits = MEMBER_BENEFITS[tier] || MEMBER_BENEFITS.free;
    
    // 创建默认配额记录
    const initRow = {
        user_id: userId,
        ai_import_balance: benefits.ai_limit_monthly,
        storage_total_mb: benefits.storage_mb,
        storage_used_mb: 0,
        last_reset_date: new Date().toISOString(),
    };
    await supabase.from("student_quotas").insert(initRow);
}
```

### 2.2 进步足迹重复修复

#### 问题定位
同一组训练可能同时触发**自动 e1RM PR** 和**手动突破 PR**，导致 `personal_records_history` 表出现重复记录。

#### 解决方案

**文件**: `src/app/api/execution/create-pr/route.ts`

实现"先查后插"逻辑：如果同一天、同一 execution/action/set 已存在 PR，则更新而非插入。

```typescript
// 检查是否存在相同 PR
const { data: existingPR } = await supabase
    .from("personal_records_history")
    .select("id, e1rm")
    .eq("user_id", userId)
    .eq("execution_id", executionId)
    .eq("action_id", actionId)
    .eq("execution_set_number", setNumber)
    .eq("date_achieved", new Date().toISOString().split("T")[0])
    .maybeSingle();

if (existingPR) {
    // 更新现有记录
    await supabase
        .from("personal_records_history")
        .update({ weight, reps, e1rm, ... })
        .eq("id", existingPR.id);
} else {
    // 插入新记录
    await supabase
        .from("personal_records_history")
        .insert({ user_id: userId, ... });
}
```

### 2.3 免费用户配额默认值统一

#### 实现位置
- `src/lib/membershipLimit.ts` - 配额检查与消费逻辑
- `src/app/api/membership/get-quota/route.ts` - 配额查询 API

#### 关键改动
- **免费用户默认配额**：50MB 存储 + 2 次 AI 导入/月
- **自动初始化**：新用户首次使用配额相关功能时自动创建记录
- **历史数据修复**：对现有 0 配额用户自动补齐

### 2.4 邀请链接闭环实现

#### 数据库结构
- `referral_rewards` 表：记录邀请关系与奖励发放
  - `inviter_id`: 邀请人
  - `invitee_id`: 被邀请人
  - `reward_granted`: JSON 字段，记录奖励内容（`{ ai_import: 2, storage_mb: 50 }`）
  - `source_type`: 来源类型（`direct_invite` / `share_card`）

#### 实现文件
- `src/app/api/auth/register/route.ts` - 注册时处理 `ref` 参数并发放奖励
- `src/app/register/page.tsx` - 注册页读取 URL 中的 `ref` 参数
- `src/app/api/membership/referral/stats/route.ts` - 邀请统计 API
- `src/app/me/membership/referral/page.tsx` - 邀请页展示真实数据

#### 奖励规则
- **双方奖励**：邀请人和被邀请人都获得配额
- **奖励内容**：+2 AI 导入次数 + 50MB 存储空间（后续调整为 +100MB）

---

## 3. 分享卡片二维码拉新功能

### 3.1 功能设计

#### 用户流程
1. 学员完成训练 → 生成分享卡片（含二维码）
2. 分享到朋友圈/微信群 → 他人扫码
3. 扫码打开 `/s/<shareId>` → 自动跳转注册页
4. 新用户注册成功 → **双方获得奖励**（+2 AI、+100MB）

#### 归因规则
- **入口形态**：二维码（嵌入分享图）
- **归因窗口**：24 小时（通过 `expires_at` + cookie/localStorage 实现）
- **奖励触发**：注册成功即奖励
- **奖励对象**：双方都奖励
- **每日上限**：每个分享者每日最多 10 次奖励（`share_card` 渠道）

### 3.2 数据库设计

#### 新增表结构

**`growth_share_links`** - 分享链接记录
```sql
CREATE TABLE growth_share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_user_id UUID NOT NULL REFERENCES users(id),
    execution_id UUID REFERENCES executions(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL, -- 24h 后过期
    meta JSONB DEFAULT '{}'::jsonb
);
```

**`growth_share_events`** - 分享事件追踪
```sql
CREATE TABLE growth_share_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id UUID NOT NULL REFERENCES growth_share_links(id),
    event_type TEXT NOT NULL, -- 'visit' | 'register_success'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    meta JSONB DEFAULT '{}'::jsonb -- 可记录 invitee_id, UA 等
);
```

**迁移文件**: `supabase/migrations/20260113_add_growth_share_tracking.sql`

### 3.3 前端实现

#### 分享卡片二维码生成

**文件**: `src/components/share/ShareCardGenerator.tsx`

- 在生成分享卡片时调用 `POST /api/growth/share/create` 创建 `shareId`
- 二维码内容从训练明细页改为拉新落地页：`/s/<shareId>`
- 如果创建失败（数据库未迁移），自动回退到旧的训练明细链接

**文件**: `src/components/share/TemplateDataFlow.tsx` / `TemplateMinimalist.tsx` / `TemplateCalendar.tsx`

- 三个模板组件统一使用 `acquisitionUrl`（即 `/s/<shareId>`）作为二维码内容

#### 拉新落地页

**文件**: `src/app/s/[shareId]/page.tsx`

- **关键改动**：从服务端 302 重定向改为**前端落地页**，避免微信环境丢失 query/cookie
- 页面加载时：
  1. 使用 `useParams()` 获取 `shareId`（避免 Next.js 16 的 Promise params 问题）
  2. 写入 `localStorage.share_id`（持久化兜底）
  3. 写入 `document.cookie`（`share_attribution`，24h）
  4. 调用 `POST /api/growth/share/track` 记录 `visit` 事件
  5. 跳转到 `/register?share=<shareId>`

### 3.4 后端实现

#### 创建分享链接 API

**文件**: `src/app/api/growth/share/create/route.ts`

- 创建 `growth_share_links` 记录
- 返回 `shareId` 和 `acquisitionUrl`（`/s/<shareId>`）

#### 事件追踪 API

**文件**: `src/app/api/growth/share/track/route.ts`

- 记录 `growth_share_events` 事件（`visit` / `register_success`）
- 支持记录元数据（UA、invitee_id 等）

#### 注册奖励发放

**文件**: `src/app/api/auth/register/route.ts`

注册成功后的奖励逻辑：

1. **优先处理 `shareId`**（分享卡片拉新）
   - 验证 `shareId` 有效性（存在、未过期、creator 不是自己）
   - 检查每日上限（该 inviter 今日 `share_card` 奖励次数 < 10）
   - 检查是否已领取（同一 invitee 只能领取一次）

2. **兜底处理 `ref`**（直接邀请链接）
   - 兼容原有的邀请链接机制

3. **发放奖励**
   - 双方 `student_quotas` 更新：
     - `ai_import_balance += 2`
     - `storage_total_mb += 100`
   - 记录 `referral_rewards`：
     - `source_type: 'share_card'`
     - `reward_granted: { ai_import: 2, storage_mb: 100 }`

**文件**: `src/app/register/page.tsx`

- 读取 URL 参数 `share` 和 cookie `share_attribution`
- 写入 `localStorage.share_id` 作为兜底
- 注册提交时优先使用 query 参数，其次使用 localStorage

---

## 4. 关键难点与解决方案

### 4.1 微信环境丢失 URL 参数/ Cookie

#### 问题现象
- 扫码打开 `/s/<shareId>` 后，最终注册页 URL 变成 `/register`（没有 `?share=`）
- 注册请求中缺少 `shareId`，导致无法归因发奖
- `growth_share_events` 和 `referral_rewards` 均为空

#### 解决方案

**核心思路**：不再依赖服务端 302 重定向，改用前端落地页 + 多重兜底

1. **前端落地页**（`/s/[shareId]/page.tsx`）
   - 使用 `useParams()` 获取路由参数（避免 Next.js 16 Promise params 问题）
   - 写入 `localStorage` + `cookie` 双重持久化
   - 调用 track API 记录 visit（使用 `await` 确保写入成功）

2. **注册页兜底读取**
   - 优先读取 URL query `share`
   - 其次读取 `localStorage.share_id`
   - 最后读取 cookie `share_attribution`

3. **事件写入改为 await**
   - `/s/[shareId]/page.tsx` 中 track API 调用改为 `await`，避免重定向时丢失写入

### 4.2 Next.js 16 动态路由 params 是 Promise

#### 问题现象
微信内置浏览器报错：
```
A param property was accessed directly with 'params.shareId'. 
'params' is a Promise and must be unwrapped with 'React.use()' 
before accessing its properties.
```

#### 解决方案
使用 `useParams()` hook 替代 props 中的 `params`：

```typescript
// ❌ 错误写法
export default function ShareLandingPage({ params }: { params: { shareId: string } }) {
    const shareId = params.shareId; // 报错
}

// ✅ 正确写法
export default function ShareLandingPage() {
    const params = useParams();
    const shareId = params.shareId as string;
}
```

---

## 5. 验收结果

### 5.1 数据库验证

**`growth_share_events` 表成功写入**：
```json
[
  {
    "id": "0f169979-1533-4aa1-b880-412cb2a2e445",
    "share_id": "694b40a0-93e7-4d57-a0ba-cd797f256809",
    "event_type": "visit",
    "created_at": "2026-01-13 00:36:19.061996+00"
  },
  {
    "id": "3448e907-3e16-4930-bc8a-73f87454f010",
    "share_id": "694b40a0-93e7-4d57-a0ba-cd797f256809",
    "event_type": "register_success",
    "created_at": "2026-01-13 00:36:41.999416+00",
    "meta": {
      "invitee_id": "8283eaa6-bb04-40e0-b456-686236c85511"
    }
  }
]
```

**验证要点**：
- ✅ 同一个 `share_id` 出现了 `visit` 和 `register_success` 两条事件
- ✅ `register_success` 事件中记录了 `invitee_id`
- ✅ 说明**二维码落地归因 → 注册发奖链路已完全跑通**

### 5.2 功能验证清单

- ✅ 视频上传不再报错，配额检查正常
- ✅ 进步足迹不再重复显示
- ✅ 免费用户默认配额为 50MB + 2 次 AI
- ✅ 邀请链接注册双方获得配额奖励
- ✅ 分享卡片二维码扫码注册双方获得配额奖励
- ✅ 桌面微信/手机微信扫码都能正常归因
- ✅ 每日上限 10 次限制生效

---

## 6. 相关文件清单

### 6.1 数据库迁移
- `supabase/migrations/20260113_add_growth_share_tracking.sql`

### 6.2 后端 API
- `src/app/api/execution/upload-set-video/route.ts` - 视频上传修复
- `src/app/api/execution/create-pr/route.ts` - PR 去重
- `src/app/api/membership/get-quota/route.ts` - 配额查询（懒初始化）
- `src/app/api/auth/register/route.ts` - 注册奖励发放
- `src/app/api/membership/referral/stats/route.ts` - 邀请统计
- `src/app/api/growth/share/create/route.ts` - 创建分享链接
- `src/app/api/growth/share/track/route.ts` - 事件追踪

### 6.3 前端页面
- `src/app/register/page.tsx` - 注册页（读取 share/ref 参数）
- `src/app/s/[shareId]/page.tsx` - 拉新落地页
- `src/app/me/membership/referral/page.tsx` - 邀请页

### 6.4 前端组件
- `src/components/share/ShareCardGenerator.tsx` - 分享卡片生成器
- `src/components/share/TemplateDataFlow.tsx` - 数据流模板
- `src/components/share/TemplateMinimalist.tsx` - 极简模板
- `src/components/share/TemplateCalendar.tsx` - 日历模板

### 6.5 核心工具库
- `src/lib/membershipLimit.ts` - 配额检查与消费（懒初始化 + 修复逻辑）
- `src/app/service/growthService.ts` - 增长服务客户端

---

## 7. 经验总结

### 7.1 微信环境特殊性
- **不要依赖服务端重定向**：微信内置浏览器可能丢失 query/cookie
- **多重兜底机制**：localStorage + cookie + URL query，确保归因不丢失
- **前端落地页更可靠**：在客户端完成持久化后再跳转

### 7.2 Next.js 16 动态路由
- **使用 `useParams()` hook**：避免 Promise params 问题
- **类型安全**：使用 `as string` 断言，配合运行时校验

### 7.3 配额系统设计
- **懒初始化**：首次使用时自动创建，避免空记录导致错误
- **历史数据修复**：对异常数据（0/NULL）自动补齐，保证系统健壮性

### 7.4 增长系统设计
- **事件追踪先行**：先记录事件，再处理业务逻辑，确保可追溯
- **归因窗口设计**：24h 窗口 + 过期检查，平衡用户体验与防刷
- **每日上限**：防止恶意刷量，保护平台资源

---

## 8. 后续优化建议

1. **反作弊机制**：增加 IP 限制、设备指纹等，防止同一人多次注册
2. **奖励通知**：注册成功后给双方发送通知（站内信/推送）
3. **数据看板**：为运营提供分享转化率、拉新 ROI 等数据
4. **A/B 测试**：测试不同奖励额度对转化率的影响
5. **分享卡片优化**：支持自定义文案、背景等，提升分享意愿

---

**文档版本**: v1.0  
**最后更新**: 2026-01-13
