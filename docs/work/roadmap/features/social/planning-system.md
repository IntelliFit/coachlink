# [规划] 学员端社交体系建设方案 (V2)

> **版本变更说明 (V2)**： 根据用户反馈，调整了核心方向：
>
> 1. **去中心化**：不搞同门推荐，避免破坏教练的信息壁垒。
> 2. **重分享，轻发布**：不不仅做平台内的“朋友圈”，更侧重生成高质量的“分享图”供学员发到微信群/朋友圈。
> 3. **围观机制**：保留加好友看训练的功能，但尽量简化。

## 1. 核心目标

1. **对外分享
   (Core)**：生成精美的训练总结长图/卡片，满足学员在私域（微信群、朋友圈）的打卡虚荣心，同时为平台带来潜在曝光。
2. **好友围观
   (Spectating)**：允许真实认识的朋友互相关注，查看对方的训练日历和详细数据，起到互相监督作用。
3. **隐私保护**：严格限制社交范围，禁止系统自动推荐，保护教练的学员私域池。

## 2. 核心功能模块

### 2.1 高级分享系统 (Share Card System) - **P0 优先级**

这是目前的重中之重。学员完成训练后，希望“一键装逼”。

- **功能流程**：
  - 训练结束结算页 -> 点击“分享/打卡” -> 进入卡片预览页 -> 保存图片/复制链接。
  - 历史记录页 -> 选择某次训练 -> 点击“分享”。

- **分享卡片设计 (多种模版)**：
  - **模版 A (数据流)**：核心展示 总容量 (Ton)、总组数、时长，以及当天的 1RM
    估算记录（如有）。
  - **模版 B (日历流)**：展示当月训练热力图 (GitHub style heatmap) +
    今日打卡的大勾。
  - **模版 C (极简流)**：一张背景图（用户上传或默认酷炫背景） + 核心文字“Day
    24 - 胸肌训练完成”。

- **技术实现**：
  - 前端生成：使用 `html2canvas` 或 `satori` (Vercel) 在客户端/Edge 生成图片。
  - 二维码植入：卡片右下角自动附带小程序码/网页二维码（带参数，他人扫码可看详情页）。

### 2.2 极简好友系统 (Basic Connections)

- **添加机制**：
  - **仅支持精确搜索**：必须输入对方完整的昵称或 ID
    才能发送请求。禁止“附近的人”、“同门推荐”。
  - **分享链接添加**：通过微信分享个人名片链接，对方点击后可直接申请添加。

- **权限控制**：
  - 默认开启“允许好友查看我的训练详情”。
  - 敏感数据（如体重、围度）默认仅自己可见，需手动开启共享。

### 2.3 好友动态 (Friend Activity)

不再做一个复杂的 Feed 流（类似朋友圈），而是做一个 **“好友最近练了啥”** 的列表。

- **入口**：社区 Tab -> 列表展示。
- **展示内容**：
  - 仅展示系统自动生成的 **“训练完成记录”**。
  - 格式：`[头像] 张三 完成了 [深蹲力量周期 Week 3 Day 1] - 30分钟前`。
  - **互动**：
    - **点赞**：简单的点赞按钮。
    - **详情**：点击卡片跳转到该次训练的只读详情页 (Read-only Workout Detail)。

---

## 3. 数据库设计 (Database Schema)

大幅简化 V1 方案，不再创建独立的 Post 表，而是基于 `training_records` 进行扩展。

### 3.1 社交关系表 (`social_friendships`) - 保留

```sql
create table public.social_friendships (
    id uuid not null default gen_random_uuid() primary key,
    requester_id uuid not null references public.users(id),
    addressee_id uuid not null references public.users(id),
    status text not null default 'pending', -- pending, accepted, rejected, blocked
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(requester_id, addressee_id)
);
create index idx_friendships_requester on social_friendships(requester_id);
create index idx_friendships_addressee on social_friendships(addressee_id);
```

### 3.2 训练记录扩展 (`training_records`)

直接在训练记录上增加分享属性，不单独建 Post 表。

```sql
-- 修改 training_records 表 (无需新建)
alter table public.training_records 
add column visibility text default 'friends', -- 'private', 'friends', 'public' (用于外链分享)
add column share_token uuid default gen_random_uuid(); -- 用于生成不依赖登录的公共分享页链接
```

### 3.3 互动表 (`social_interactions`)

仅保留针对 `training_records` 的点赞。评论功能初期可不做，或者简单做一个。

```sql
create table public.social_likes (
    user_id uuid not null references public.users(id),
    training_record_id uuid not null references public.training_records(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, training_record_id)
);
```

---

## 4. 开发优先级规划

### Phase 1: 分享卡片 (Priority High)

- **目标**：让学员能在微信群里发好看的图。
- **工作量**：
  - 设计 2-3 款分享图 UI 组件。
  - 引入 `html2canvas` 或类似库实现前端截图下载。
  - 实现“分享详情页” (Public Page)，通过 `share_token`
    访问，无需登录即可查看该次训练内容（用于二维码扫码跳转）。

### Phase 2: 好友与围观 (Priority Medium)

- **目标**：满足熟人之间的互看需求。
- **工作量**：
  - `social_friendships` 表与 API。
  - “社区”页面：展示好友列表 + 好友最近的 Training Records 列表。
  - 好友主页：点击好友头像，查看其历史训练日历。

### Phase 3: 互动 (Priority Low)

- **目标**：简单的正向反馈。
- **工作量**：
  - 点赞功能。
  - (可选) 简单的评论。

---

## 5. UI/UX 变更点

1. **底部导航**：保持不变，或者将“社区”作为一个次级入口放在“我的”或者首页的某个位置，不一定要占据一级
   Tab，避免喧宾夺主。建议先放在 **“我的 -> 我的好友”** 中。
2. **训练结束页**：大幅增强。当前只是简单的显示“完成”，改为显示“今日战绩卡片”，下方醒目的大按钮
   **“保存卡片分享”**。

## 6. 总结

这个方案更轻量，更符合私教工具的定位工具属性（Tool），而非强社交平台属性（Network）。核心在于利用学员的外部社交关系（微信）来做裂变和活跃，而不是试图在
App 内部重建社交关系网。
