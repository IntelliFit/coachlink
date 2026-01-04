# 聊天@引用功能 - 实施方案

## 概述

本方案描述如何在现有聊天系统中实现"@引用内容"功能，允许用户在聊天中引用教练发布的内容、训练视频和进步视频。

---

## 技术架构

### 系统架构图

```mermaid
graph TB
    subgraph Frontend
        A[ChatDialog.tsx] --> B[ContentMentionPicker.tsx]
        B --> C[ContentSearchInput.tsx]
        B --> D[ContentList.tsx]
        D --> E[ContentItem.tsx]
        A --> F[ContentCard.tsx]
    end
    
    subgraph API
        G[/api/chat/search-contents] --> H[coach_contents]
        G --> I[execution_set_videos]
        J[/api/chat/send-message] --> K[chat_messages]
    end
    
    B --> G
    A --> J
```

---

## 数据库设计

### 1. 消息表扩展 (chat_messages)

需要扩展消息类型以支持内容引用：

```sql
-- 扩展 chat_messages 表的 message_type 枚举
-- 现有类型: text, image, video, audio
-- 新增类型: content_reference

ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'content_reference';

-- 新增 content_reference 元数据字段
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS content_metadata JSONB;

-- content_metadata 结构示例:
-- {
--   "content_type": "coach_content" | "training_video" | "progress_video" | "video_collection",
--   "content_id": "uuid",
--   "title": "深蹲技术要点",
--   "thumbnail_url": "https://...",
--   "preview_text": "这是教练发布的...",
--   "action_name": "深蹲",  -- 仅视频类型
--   "is_progress": false    -- 是否进步组
-- }
```

### 2. 索引优化

```sql
-- 加速内容搜索
CREATE INDEX IF NOT EXISTS idx_coach_contents_search 
ON coach_contents USING gin(to_tsvector('simple', title || ' ' || COALESCE(content, '')));

-- 加速视频查询
CREATE INDEX IF NOT EXISTS idx_execution_set_videos_execution_id 
ON execution_set_videos(execution_id);
```

---

## API 设计

### 1. 搜索可引用内容

#### 端点

```
POST /api/chat/search-contents
```

#### 请求参数

```typescript
interface SearchContentsDto {
    chatroomId: string; // 聊天室ID
    query?: string; // 搜索关键词
    contentTypes?: ContentType[]; // 内容类型过滤
    dateRange?: {
        start?: string; // ISO日期
        end?: string;
    };
    page: number; // 页码 (从1开始)
    pageSize: number; // 每页数量 (默认20)
}

type ContentType =
    | "coach_content"
    | "training_video"
    | "progress_video"
    | "video_collection";
```

#### 响应结构

```typescript
interface SearchContentsResponseDto {
    success: boolean;
    data: {
        items: ContentItem[];
        pagination: {
            page: number;
            pageSize: number;
            total: number;
            hasMore: boolean;
        };
    };
}

interface ContentItem {
    id: string;
    type: ContentType;
    title: string;
    previewText?: string;
    thumbnailUrl?: string;
    createdAt: string;
    metadata: {
        actionName?: string; // 视频的动作名称
        weight?: number; // 重量
        reps?: number; // 次数
        setIndex?: number; // 组数
        isProgress?: boolean; // 是否进步组
        videoUrl?: string; // 视频URL
    };
}
```

### 2. 发送内容引用消息

#### 端点

```
POST /api/chat/send-message
```

#### 请求参数 (扩展现有)

```typescript
interface SendMessageDto {
    chatroomId: string;
    messageType: "text" | "image" | "video" | "audio" | "content_reference";
    content?: string; // 文本消息内容
    contentReference?: { // 内容引用 (新增)
        contentType: ContentType;
        contentId: string;
        title: string;
        thumbnailUrl?: string;
        previewText?: string;
    };
}
```

### 3. 获取内容详情 (预览用)

#### 端点

```
GET /api/chat/content-preview/:contentType/:contentId
```

---

## 前端组件设计

### 1. 组件结构

```
components/chat/
├── ChatDialog.tsx              # 主聊天对话框 (修改)
├── ChatInput.tsx               # 聊天输入框 (新建)
├── ContentMentionPicker.tsx    # 内容选择器弹窗 (新建)
│   ├── MentionSearchBar.tsx    # 搜索栏
│   ├── MentionFilters.tsx      # 筛选器
│   └── MentionContentList.tsx  # 内容列表
├── ContentReferenceCard.tsx    # 引用内容卡片 (新建)
└── ContentPreviewPopover.tsx   # 悬停预览弹窗 (新建)
```

### 2. 核心组件接口

#### ContentMentionPicker

```typescript
interface ContentMentionPickerProps {
    visible: boolean;
    onHide: () => void;
    chatroomId: string;
    onSelect: (content: ContentItem) => void;
}
```

#### ContentReferenceCard

```typescript
interface ContentReferenceCardProps {
    content: {
        type: ContentType;
        id: string;
        title: string;
        thumbnailUrl?: string;
        previewText?: string;
        metadata?: Record<string, any>;
    };
    onPreview?: () => void;
    onClick?: () => void;
}
```

---

## 实施步骤

### Phase 1: 数据库准备

#### [MODIFY] supabase/migrations/20260105_chat_content_reference.sql

1. 扩展 `chat_messages` 表，添加 `content_metadata` JSONB 字段
2. 添加必要的索引优化查询性能
3. 更新 RLS 策略

---

### Phase 2: 后端 API

#### [NEW] src/app/api/chat/search-contents/route.ts

- 实现内容搜索 API
- 查询 `coach_contents` 和 `execution_set_videos` 表
- 支持分页、搜索和筛选

#### [NEW] src/app/api/chat/search-contents/entity.ts

- 定义请求/响应 DTO

#### [MODIFY] src/app/api/chat/send-message/route.ts

- 扩展现有发送消息 API
- 支持 `content_reference` 消息类型
- 存储内容元数据

---

### Phase 3: 前端组件

#### [NEW] src/components/chat/ContentMentionPicker.tsx

- 内容选择器弹窗组件
- 包含搜索、筛选、分页功能

#### [NEW] src/components/chat/ContentReferenceCard.tsx

- 引用内容卡片展示组件
- 支持不同内容类型的展示

#### [NEW] src/components/chat/ContentPreviewPopover.tsx

- 悬停预览弹窗组件

#### [MODIFY] src/components/chat/ChatDialog.tsx

- 在输入框添加 "@" 按钮
- 集成 ContentMentionPicker
- 渲染 ContentReferenceCard 消息

---

### Phase 4: 服务层

#### [MODIFY] src/app/service/chatService.ts

- 添加 `searchContents` 方法
- 扩展 `sendMessage` 支持内容引用

---

## 验证计划

### 自动化测试

由于项目当前没有发现完整的自动化测试套件,建议在开发完成后进行手动测试。

### 手动验证步骤

#### 测试1: 内容选择器功能

**前置条件**:

- 教练账户已登录
- 有已发布的教学内容
- 有学员上传的训练视频

**测试步骤**:

1. 进入教练端聊天页面
2. 与任意学员开始对话
3. 点击输入框旁的 "@" 按钮
4. 验证弹窗正确显示
5. 在搜索框输入关键词，验证搜索结果
6. 切换筛选条件（类型、时间），验证筛选生效
7. 滚动到底部，验证分页加载

**预期结果**: 所有操作正常，数据显示正确

---

#### 测试2: 发送内容引用

**测试步骤**:

1. 在内容选择器中选择一个内容项
2. 验证弹窗关闭，输入框显示待发送内容
3. 点击发送
4. 验证消息以卡片形式出现在聊天中

**预期结果**: 内容卡片正确显示，包含标题、缩略图等信息

---

#### 测试3: 内容预览与跳转

**测试步骤**:

1. 在聊天中找到一条内容引用消息
2. 将鼠标悬停在卡片上（PC端）
3. 验证预览弹窗显示
4. 点击卡片
5. 验证跳转到正确的内容详情页

**预期结果**: 预览正确显示，跳转目标正确

---

#### 测试4: 权限验证

**测试步骤**:

1. 以学员身份登录
2. 打开内容选择器
3. 验证只能看到自己的训练视频和所订阅教练的已发布内容
4. 尝试引用他人内容（通过API）

**预期结果**:

- 列表只显示有权限的内容
- API 拒绝未授权的引用请求

---

## 风险与注意事项

> [!WARNING]
>
> ### 性能考虑
>
> - 视频缩略图生成可能较慢，建议异步处理
> - 大量内容搜索需要适当的数据库索引

> [!IMPORTANT]
>
> ### 安全考虑
>
> - 确保 RLS 策略正确，防止未授权访问
> - 验证内容所有权才能引用

---

## 估时

| 阶段     | 任务       | 预估时间 |
| -------- | ---------- | -------- |
| Phase 1  | 数据库迁移 | 0.5天    |
| Phase 2  | 后端 API   | 1天      |
| Phase 3  | 前端组件   | 2天      |
| Phase 4  | 集成测试   | 0.5天    |
| **合计** |            | **4天**  |
