# 学员端社交功能 MVP 实施方案

## 核心目标

打造轻量级社交体系，**重分享、轻社交**，满足学员"晒训练"和"看朋友"的需求。

---

## Phase 1: 分享卡片系统 (P0 - 最高优先级)

> **目标**：训练完成后一键生成精美卡片，发到微信群/朋友圈"打卡"。

### 1.1 数据库变更

#### [MODIFY] `plan_instance_executions` 表

```sql
ALTER TABLE public.plan_instance_executions 
ADD COLUMN share_token uuid DEFAULT gen_random_uuid(),
ADD COLUMN visibility text DEFAULT 'friends'; -- 'private', 'friends', 'public'
```

- `share_token`: 用于生成公开分享链接，任何人持此链接可查看训练详情。
- `visibility`: 隐私控制（默认仅好友可见）。

### 1.2 后端 API

| API 路径                             | 方法 | 功能                                                    |
| ------------------------------------ | ---- | ------------------------------------------------------- |
| `/api/execution/[id]/share-info`     | GET  | 获取分享卡片所需数据（总容量、时长、动作列表等）        |
| `/api/public/training/[share_token]` | GET  | **公开接口**，通过 share_token 获取训练详情（无需登录） |

### 1.3 前端组件

#### [NEW] `ShareCardGenerator` 组件

- **位置**：训练结算页 + 历史记录详情页
- **功能**：
  1. 选择卡片模板（数据流、日历流、极简流）
  2. 使用 `html2canvas` 生成图片
  3. 保存到相册 / 复制链接
- **模板设计**：
  - **数据流**：总容量(kg) + 总组数 + 时长 + 今日 PR
  - **日历流**：当月训练热力图 + 今日打勾
  - **极简流**：背景图 + "Day X - XXX 训练完成"

#### [NEW] `PublicTrainingPage` 公开分享页

- **路由**：`/share/training/[share_token]`
- **特点**：
  - 无需登录即可访问
  - 展示训练摘要 + 动作列表
  - 底部"下载 App"或"关注教练"引导

### 1.4 工作量估算

| 任务               | 时间     |
| ------------------ | -------- |
| 数据库迁移         | 0.5h     |
| API 开发           | 2h       |
| 卡片模板 UI（3款） | 4h       |
| html2canvas 集成   | 2h       |
| 公开分享页         | 3h       |
| **合计**           | **~12h** |

---

## Phase 2: 好友与围观系统 (P1 - 中优先级)

> **目标**：熟人之间互加好友，查看对方训练记录。

### 2.1 数据库变更

#### [NEW] `social_friendships` 表

```sql
CREATE TABLE public.social_friendships (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_id uuid NOT NULL REFERENCES public.users(id),
    addressee_id uuid NOT NULL REFERENCES public.users(id),
    status text NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'blocked'
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(requester_id, addressee_id)
);

CREATE INDEX idx_friendships_requester ON social_friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON social_friendships(addressee_id);
```

### 2.2 后端 API

| API 路径                               | 方法 | 功能                              |
| -------------------------------------- | ---- | --------------------------------- |
| `/api/user/friends`                    | GET  | 获取好友列表（已接受）            |
| `/api/user/friends/request`            | POST | 发送好友请求（需精确搜索昵称/ID） |
| `/api/user/friends/pending`            | GET  | 获取待处理的好友请求              |
| `/api/user/friends/respond`            | POST | 接受/拒绝好友请求                 |
| `/api/user/friends/[friendId]/records` | GET  | 获取好友的训练记录（权限校验）    |
| `/api/user/search`                     | GET  | 精确搜索用户（按昵称/ID）         |

### 2.3 前端页面

#### [NEW] 好友管理页 `/friends`

- **入口**：我的 → 我的好友
- **功能**：
  - 搜索添加好友（精确匹配）
  - 查看好友列表
  - 处理好友请求

#### [NEW] 好友动态页 `/friends/activity`

- **展示内容**：好友最近的训练完成记录
- **格式**：`[头像] 张三 完成了 [深蹲力量周期 Day 3] - 30分钟前`
- **点击跳转**：好友训练详情（只读）

#### [NEW] 好友主页 `/user/[userId]`

- **展示内容**：
  - 基本信息（头像、昵称）
  - 训练日历热力图
  - 最近训练记录列表

### 2.4 工作量估算

| 任务          | 时间     |
| ------------- | -------- |
| 数据库迁移    | 0.5h     |
| 好友 API 开发 | 4h       |
| 好友管理页 UI | 3h       |
| 好友动态页 UI | 3h       |
| 好友主页 UI   | 3h       |
| **合计**      | **~14h** |

---

## Phase 3: 互动功能 (P2 - 低优先级)

> **目标**：简单的正向反馈机制，增强社交粘性。

### 3.1 数据库变更

#### [NEW] `social_likes` 表

```sql
CREATE TABLE public.social_likes (
    user_id uuid NOT NULL REFERENCES public.users(id),
    execution_id uuid NOT NULL REFERENCES public.plan_instance_executions(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, execution_id)
);
```

### 3.2 后端 API

| API 路径                     | 方法   | 功能         |
| ---------------------------- | ------ | ------------ |
| `/api/execution/[id]/like`   | POST   | 点赞         |
| `/api/execution/[id]/unlike` | DELETE | 取消点赞     |
| `/api/execution/[id]/likes`  | GET    | 获取点赞列表 |

### 3.3 前端组件

- 在好友动态卡片上增加"点赞"按钮
- 展示点赞数和点赞用户头像

### 3.4 工作量估算

| 任务       | 时间    |
| ---------- | ------- |
| 数据库迁移 | 0.5h    |
| 点赞 API   | 1.5h    |
| UI 集成    | 2h      |
| **合计**   | **~4h** |

---

## 总工作量

| 阶段              | 时间     | 优先级 |
| ----------------- | -------- | ------ |
| Phase 1: 分享卡片 | ~12h     | P0     |
| Phase 2: 好友围观 | ~14h     | P1     |
| Phase 3: 互动点赞 | ~4h      | P2     |
| **总计**          | **~30h** | -      |

---

## 验证计划

### Phase 1 验证

1. 训练结束后点击"分享" → 生成卡片预览 → 保存图片成功
2. 复制分享链接 → 隐私模式打开 → 能看到训练详情

### Phase 2 验证

1. 用户 A 搜索用户 B 昵称 → 发送请求 → B 收到请求
2. B 接受请求 → 双方在好友列表中看到对方
3. A 完成训练 → B 在好友动态中看到 A 的记录

### Phase 3 验证

1. B 对 A 的训练记录点赞 → A 看到点赞数变化
