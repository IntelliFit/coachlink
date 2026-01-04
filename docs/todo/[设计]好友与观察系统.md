# [设计] 好友与观察系统

> **Phase 2 of Social Features MVP**\
> 优先级: P1 | 预计工时: ~14h\
> 依赖: Phase 1 分享卡片系统 ✅ 已完成

---

## 1. 功能概述

### 1.1 核心目标

为学员端提供轻量级社交功能，让用户可以：

1. **添加好友** - 通过精确搜索昵称或用户 ID 添加好友
2. **查看好友动态** - 看到好友最近的训练完成记录
3. **访问好友主页** - 查看好友的训练日历和历史记录（只读）

### 1.2 设计原则

| 原则         | 说明                                          |
| ------------ | --------------------------------------------- |
| **精确搜索** | 不支持模糊搜索，防止骚扰，需输入完整昵称或 ID |
| **双向确认** | 好友关系需要双方同意                          |
| **隐私优先** | 默认只有好友可见训练记录，可设置为公开        |
| **轻量互动** | MVP 阶段不做评论，仅支持"查看"                |

---

## 2. 数据库设计

### 2.1 新增表: `social_friendships`

用于存储好友关系和请求状态。

```sql
-- 好友关系表
CREATE TABLE IF NOT EXISTS public.social_friendships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 请求发起方
    requester_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- 请求接收方
    addressee_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- 关系状态
    -- 'pending': 待确认
    -- 'accepted': 已接受（双向好友）
    -- 'rejected': 已拒绝
    -- 'blocked': 已拉黑（addressee 拉黑 requester）
    status text NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
    
    -- 时间戳
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- 防止重复请求
    UNIQUE(requester_id, addressee_id),
    
    -- 防止自己加自己
    CHECK (requester_id != addressee_id)
);

-- 索引优化
CREATE INDEX idx_friendships_requester ON social_friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON social_friendships(addressee_id);
CREATE INDEX idx_friendships_status ON social_friendships(status);

-- 复合索引：按状态查好友
CREATE INDEX idx_friendships_requester_status ON social_friendships(requester_id, status);
CREATE INDEX idx_friendships_addressee_status ON social_friendships(addressee_id, status);

-- 触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_friendships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_friendships_updated_at
    BEFORE UPDATE ON social_friendships
    FOR EACH ROW
    EXECUTE FUNCTION update_friendships_updated_at();
```

### 2.2 修改表: `user_profiles`

添加用户搜索 ID（可选，供精确搜索使用）。

```sql
-- 用户可设置一个唯一的搜索 ID（类似微信号）
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS search_id text UNIQUE;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_search_id ON user_profiles(search_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_nickname ON user_profiles(nickname);
```

---

## 3. API 设计

### 3.1 好友搜索

#### `GET /api/user/search`

精确搜索用户（按昵称或搜索 ID）。

**请求参数:**

```typescript
interface SearchUserRequest {
    query: string; // 搜索词（昵称或 search_id）
    exact?: boolean; // 是否精确匹配（默认 true）
}
```

**响应:**

```typescript
interface SearchUserResponse {
    success: boolean;
    data?: {
        id: string;
        nickname: string;
        avatarUrl: string;
        // 不返回敏感信息
    }[];
    message?: string;
}
```

**业务逻辑:**

1. 精确匹配 `nickname` 或 `search_id`
2. 不返回自己
3. 不返回被拉黑的用户
4. 最多返回 10 条结果

---

### 3.2 发送好友请求

#### `POST /api/user/friends/request`

向指定用户发送好友请求。

**请求体:**

```typescript
interface FriendRequestDto {
    targetUserId: string; // 目标用户 ID
    message?: string; // 可选的请求消息（预留）
}
```

**响应:**

```typescript
interface FriendRequestResponse {
    success: boolean;
    data?: {
        friendshipId: string;
        status: "pending" | "already_friends" | "already_requested";
    };
    message?: string;
}
```

**业务逻辑:**

1. 检查目标用户是否存在
2. 检查是否已经是好友 → 返回 `already_friends`
3. 检查是否已有待处理请求 → 返回 `already_requested`
4. 检查对方是否有发给自己的请求 → 如有，直接接受变成好友
5. 检查是否被对方拉黑 → 返回错误
6. 创建 pending 请求

---

### 3.3 获取好友列表

#### `GET /api/user/friends`

获取当前用户的所有好友（已接受状态）。

**响应:**

```typescript
interface FriendsListResponse {
    success: boolean;
    data?: {
        friends: {
            userId: string;
            nickname: string;
            avatarUrl: string;
            friendsSince: string; // ISO 时间
            lastActiveAt?: string; // 最后活跃（预留）
        }[];
        total: number;
    };
}
```

**业务逻辑:**

1. 查询 `status = 'accepted'` 的记录
2. 合并 requester 和 addressee 两个方向
3. 关联 `user_profiles` 获取头像和昵称
4. 按 `updated_at` 倒序（最近互动的在前）

---

### 3.4 获取待处理请求

#### `GET /api/user/friends/pending`

获取收到的待处理好友请求。

**响应:**

```typescript
interface PendingRequestsResponse {
    success: boolean;
    data?: {
        requests: {
            friendshipId: string;
            requester: {
                userId: string;
                nickname: string;
                avatarUrl: string;
            };
            createdAt: string;
            message?: string;
        }[];
        total: number;
    };
}
```

---

### 3.5 响应好友请求

#### `POST /api/user/friends/respond`

接受或拒绝好友请求。

**请求体:**

```typescript
interface RespondRequestDto {
    friendshipId: string;
    action: "accept" | "reject" | "block";
}
```

**响应:**

```typescript
interface RespondRequestResponse {
    success: boolean;
    data?: {
        newStatus: string;
    };
    message?: string;
}
```

---

### 3.6 删除好友

#### `DELETE /api/user/friends/[friendId]`

删除好友关系。

**业务逻辑:**

1. 查找好友关系记录
2. 验证权限（双方都可删除）
3. 硬删除记录（允许将来重新添加）

---

### 3.7 获取好友动态

#### `GET /api/user/friends/activity`

获取好友最近的训练完成记录。

**请求参数:**

```typescript
interface ActivityRequest {
    limit?: number; // 默认 20
    cursor?: string; // 分页游标
}
```

**响应:**

```typescript
interface ActivityResponse {
    success: boolean;
    data?: {
        activities: {
            id: string;
            user: {
                userId: string;
                nickname: string;
                avatarUrl: string;
            };
            execution: {
                executionId: string;
                planName: string;
                dayIndex: number;
                totalVolume: number;
                durationMinutes: number;
                completedAt: string;
            };
        }[];
        nextCursor?: string;
    };
}
```

**业务逻辑:**

1. 获取当前用户的所有好友 ID
2. 查询这些好友的 `plan_instance_executions` (status = 'completed')
3. 按 `completed_at` 倒序
4. 只返回 `visibility` != 'private' 的记录

---

### 3.8 获取好友训练记录

#### `GET /api/user/friends/[friendId]/records`

获取指定好友的训练记录列表。

**请求参数:**

```typescript
interface FriendRecordsRequest {
    limit?: number;
    offset?: number;
}
```

**响应:**

```typescript
interface FriendRecordsResponse {
    success: boolean;
    data?: {
        user: {
            userId: string;
            nickname: string;
            avatarUrl: string;
        };
        records: {
            executionId: string;
            planName: string;
            dayIndex: number;
            totalVolume: number;
            durationMinutes: number;
            completedAt: string;
            shareToken?: string; // 可查看详情
        }[];
        total: number;
    };
}
```

**业务逻辑:**

1. 验证双方是好友关系
2. 查询对方的训练记录
3. 只返回 `visibility` in ('friends', 'public') 的记录

---

## 4. 前端页面设计

### 4.1 好友管理页 `/friends`

**入口:** 我的 → 我的好友

**页面结构:**

```
┌─────────────────────────────────────┐
│  [搜索栏] 输入昵称或ID搜索好友        │
├─────────────────────────────────────┤
│  [Tab: 好友列表 | 待处理(3)]          │
├─────────────────────────────────────┤
│                                     │
│  好友卡片 1                          │
│  ┌────┐ 张三                        │
│  │头像│ 最近训练: 2小时前            │
│  └────┘ [查看主页] [删除]            │
│                                     │
│  好友卡片 2                          │
│  ...                                │
│                                     │
└─────────────────────────────────────┘
```

**交互:**

- 搜索框输入 → 实时搜索（debounce 300ms）
- 搜索结果点击 → 发送好友请求
- 待处理 Tab → 显示收到的请求，可接受/拒绝
- 好友卡片点击 → 跳转好友主页

---

### 4.2 好友动态页 `/friends/activity`

**入口:** 底部导航 → 动态

**页面结构:**

```
┌─────────────────────────────────────┐
│  好友动态                            │
├─────────────────────────────────────┤
│                                     │
│  ┌────┐ 张三 完成了训练              │
│  │头像│ 深蹲力量周期 Day 3           │
│  └────┘ 45分钟 · 总容量 8,200kg      │
│         30分钟前                     │
│         ─────────────────────       │
│                                     │
│  ┌────┐ 李四 完成了训练              │
│  │头像│ 新手增肌计划 Day 12          │
│  └────┘ 38分钟 · 总容量 5,600kg      │
│         2小时前                      │
│         ─────────────────────       │
│                                     │
│  [加载更多...]                       │
│                                     │
└─────────────────────────────────────┘
```

**交互:**

- 下拉刷新
- 点击动态卡片 → 查看训练详情（复用公开分享页）
- 点击头像 → 跳转好友主页

---

### 4.3 好友主页 `/user/[userId]`

**入口:** 好友列表 / 好友动态

**页面结构:**

```
┌─────────────────────────────────────┐
│  ← 返回                              │
├─────────────────────────────────────┤
│         ┌────────┐                  │
│         │  头像  │                  │
│         └────────┘                  │
│           张三                       │
│      已成为好友 128 天               │
├─────────────────────────────────────┤
│  本月训练日历                        │
│  ┌─┬─┬─┬─┬─┬─┬─┐                   │
│  │一│二│三│四│五│六│日│              │
│  ├─┼─┼─┼─┼─┼─┼─┤                   │
│  │  │●│  │●│●│  │  │              │
│  │●│  │●│●│  │  │  │              │
│  │  │  │●│  │  │  │  │              │
│  └─┴─┴─┴─┴─┴─┴─┘                   │
│  本月训练 12 天                      │
├─────────────────────────────────────┤
│  最近训练                            │
│                                     │
│  深蹲力量周期 Day 3                  │
│  今天 · 45分钟 · 8,200kg            │
│                                     │
│  深蹲力量周期 Day 2                  │
│  昨天 · 40分钟 · 7,800kg            │
│                                     │
└─────────────────────────────────────┘
```

**交互:**

- 点击训练记录 → 查看详情
- 如果不是好友 → 显示"添加好友"按钮

---

## 5. 组件设计

### 5.1 新增组件

| 组件名              | 路径                                          | 功能                         |
| ------------------- | --------------------------------------------- | ---------------------------- |
| `FriendCard`        | `src/components/social/FriendCard.tsx`        | 好友卡片（头像、昵称、操作） |
| `FriendRequestCard` | `src/components/social/FriendRequestCard.tsx` | 好友请求卡片                 |
| `ActivityCard`      | `src/components/social/ActivityCard.tsx`      | 动态卡片                     |
| `UserSearchInput`   | `src/components/social/UserSearchInput.tsx`   | 用户搜索输入框               |
| `TrainingCalendar`  | `src/components/social/TrainingCalendar.tsx`  | 训练日历热力图               |
| `UserProfileHeader` | `src/components/social/UserProfileHeader.tsx` | 用户主页头部                 |

### 5.2 Service 扩展

在 `src/app/service/` 下新增:

```typescript
// friendService.ts
export const friendService = {
    searchUsers(query: string): Promise<SearchUserResponse>,
    sendRequest(targetUserId: string): Promise<FriendRequestResponse>,
    getFriends(): Promise<FriendsListResponse>,
    getPendingRequests(): Promise<PendingRequestsResponse>,
    respondToRequest(friendshipId: string, action: 'accept' | 'reject'): Promise<...>,
    removeFriend(friendId: string): Promise<...>,
    getActivity(limit?: number, cursor?: string): Promise<ActivityResponse>,
    getFriendRecords(friendId: string): Promise<FriendRecordsResponse>,
};
```

---

## 6. 导航集成

### 6.1 底部导航栏修改

在 `NavigationStudent.tsx` 中添加"动态"入口:

```
[今日训练] [动态] [消息] [我的]
```

### 6.2 "我的"页面添加入口

在个人中心添加:

- **我的好友** → `/friends`

---

## 7. 实施计划

### 7.1 开发顺序

| 阶段     | 任务                                    | 预计时间 |
| -------- | --------------------------------------- | -------- |
| 1        | 数据库迁移 (social_friendships)         | 0.5h     |
| 2        | 好友核心 API (search, request, respond) | 2h       |
| 3        | 好友列表 API + friendService            | 1h       |
| 4        | 好友管理页 UI (`/friends`)              | 3h       |
| 5        | 好友动态 API (activity)                 | 1h       |
| 6        | 好友动态页 UI (`/friends/activity`)     | 2h       |
| 7        | 好友主页 API + UI (`/user/[userId]`)    | 3h       |
| 8        | 导航集成 + 测试                         | 1.5h     |
| **合计** |                                         | **~14h** |

### 7.2 里程碑

- **M1**: 可以搜索并发送好友请求
- **M2**: 可以接受请求并查看好友列表
- **M3**: 可以查看好友动态 Feed
- **M4**: 可以访问好友主页查看训练记录

---

## 8. 测试要点

### 8.1 功能测试

- [ ] 搜索不到自己
- [ ] 搜索不到已拉黑的用户
- [ ] 重复发送请求返回正确状态
- [ ] 双向请求自动变成好友
- [ ] 删除好友后可重新添加
- [ ] 动态只显示好友的记录
- [ ] 好友主页只显示可见的训练

### 8.2 边界测试

- [ ] 无好友时的空状态显示
- [ ] 大量好友的分页加载
- [ ] 网络错误的重试机制

---

## 9. 未来扩展（Phase 3）

> 以下功能在 MVP 后考虑

- **点赞功能**: 给好友训练点赞
- **评论功能**: 简单文字评论
- **训练 PK**: 与好友对比训练数据
- **推荐好友**: 基于共同教练推荐
- **隐私设置**: 更细粒度的可见性控制
