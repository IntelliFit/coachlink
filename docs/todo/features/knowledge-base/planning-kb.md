# 学员端知识库功能设计

> 状态：规划中\
> 创建日期：2025-12-26\
> 定位：以最通俗易懂的方式传授运动训练知识

---

## 一、功能定位

### 核心理念

> **把晦涩的运动科学内容，变成人人都能看懂的知识**

- 用大白话解释专业概念
- 举贴近生活的例子
- 配上 AI 生成的讲解音频
- 让完全没基础的人也能入门

### 产品定位

知识库是 **平台自有内容产品**，独立于教练订阅服务：

```
CoachLink 平台
├── 教练服务（C2C，教练定价）
└── 知识库（平台自营，平台定价）← 本功能
```

---

## 二、内容来源

### 2.1 书籍笔记 ⭐ Phase 1 重点

| 步骤        | 说明                           | 工具                |
| ----------- | ------------------------------ | ------------------- |
| 1. 选书     | 运动生理学、营养学、训练方法论 | 人工筛选            |
| 2. AI 处理  | 电子书 → 结构化总结            | NotebookLM / Gemini |
| 3. 生成讲解 | 播客式音频                     | NotebookLM          |
| 4. 人工审核 | 专业教练/专家校对              | 内部审核            |

**输出格式**：

- 章节摘要（Markdown）
- 核心知识点列表
- AI 讲解音频
- 原书引用信息

**推荐书目**：

| 类别     | 推荐书目                           | 优先级 |
| -------- | ---------------------------------- | ------ |
| 力量训练 | 《力量训练基础》《运动解剖学图谱》 | P0     |
| 营养学   | 《运动营养学》                     | P1     |
| 训练理论 | 《周期化力量训练》                 | P1     |

### 2.2 优质视频 📋 Phase 2

| 来源     | 筛选标准                                  | 处理方式              |
| -------- | ----------------------------------------- | --------------------- |
| YouTube  | 优质健身频道（如 Jeff Nippard, AthleanX） | yt-dlp + Whisper 转录 |
| Bilibili | 播放量 > 10万、专业 UP 主                 | 浏览器插件 + 字幕提取 |

**处理流程**：

```
视频下载 → 字幕/转录 → AI 生成摘要 → 时间戳标注 → 封面/元数据 → 审核上架
```

---

## 三、功能模块设计

### 3.1 功能矩阵与分期

| 功能           | 描述                      | Phase          |
| -------------- | ------------------------- | -------------- |
| 书籍笔记展示   | 笔记列表 + 详情阅读       | **Phase 1** ⭐ |
| 音频讲解播放   | NotebookLM 生成的音频     | **Phase 1** ⭐ |
| 免费/付费区分  | 基础 Paywall              | **Phase 1** ⭐ |
| 知识库订阅购买 | 独立于教练订阅的会员系统  | **Phase 1** ⭐ |
| 视频课程       | 视频列表 + 播放器         | Phase 2        |
| 学习进度追踪   | 记录阅读/观看进度         | Phase 2        |
| AI 问答        | 基于知识库的 RAG 智能问答 | Phase 3        |
| 收藏/笔记      | 用户个人收藏和笔记        | Phase 3        |

### 3.2 AI 问答架构（Phase 3）

```
用户提问
    ↓
pgvector 向量检索（书籍 + 笔记 + 视频总结）
    ↓
构建上下文（Top-K 相关内容）
    ↓
Gemini 2.0 Flash 生成回答
    ↓
返回答案 + 引用来源链接
```

---

## 四、付费模型设计

### 4.1 定价方案

| 内容类型 | 权限             | 说明         |
| -------- | ---------------- | ------------ |
| 免费内容 | 所有用户可看     | 引流、体验   |
| 付费内容 | 需购买知识库会员 | 核心收费内容 |

| 会员类型   | 价格      | 权益                   |
| ---------- | --------- | ---------------------- |
| 免费用户   | ¥0        | 1-2本免费书籍          |
| 知识库会员 | ¥19-29/月 | 全部书籍 + 视频 + 音频 |
| 高级会员   | ¥49-99/月 | 全部内容 + AI 问答     |

### 4.2 AI 问答计费（Phase 3）

| 方案     | 说明      |
| -------- | --------- |
| 基础会员 | 10 次/月  |
| 高级会员 | 100 次/月 |
| 超出部分 | ¥0.5/次   |

---

## 五、数据库设计

### 5.1 Phase 1 需要的表

```sql
-- ======================================
-- 书籍笔记内容表
-- ======================================
CREATE TABLE knowledge_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,              -- 书名
  author TEXT,                      -- 作者
  cover_image TEXT,                 -- 封面图 URL
  summary TEXT,                     -- 一句话简介
  audio_url TEXT,                   -- NotebookLM 音频 URL
  content JSONB NOT NULL,           -- 笔记内容（Markdown 或结构化章节）
  is_free BOOLEAN DEFAULT false,    -- 是否免费
  is_published BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_knowledge_books_published 
  ON knowledge_books(is_published, sort_order);

-- ======================================
-- 知识库订阅表（平台自有，独立于教练订阅）
-- ======================================
CREATE TABLE knowledge_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'basic',
  status TEXT DEFAULT 'active',
  order_id UUID REFERENCES alipay_orders(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  ai_quota_used INTEGER DEFAULT 0,      -- Phase 3 用
  ai_quota_reset_at TIMESTAMPTZ,        -- Phase 3 用
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_knowledge_subs_user ON knowledge_subscriptions(user_id);
```

### 5.2 Phase 2 新增表

```sql
-- 视频内容表
CREATE TABLE knowledge_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source TEXT,                      -- 'youtube' | 'bilibili'
  source_url TEXT,                  -- 原始链接
  cover_image TEXT,
  summary TEXT,
  transcript TEXT,                  -- 字幕/转录
  content JSONB,                    -- 结构化摘要
  duration_seconds INTEGER,
  is_free BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 学习进度表
CREATE TABLE knowledge_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,       -- 'book' | 'video'
  content_id UUID NOT NULL,
  progress FLOAT DEFAULT 0,
  last_position JSONB,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, content_type, content_id)
);
```

### 5.3 Phase 3 新增表

```sql
-- 知识内容分块（用于 RAG 向量检索）
CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL,       -- 'book' | 'video'
  content_id UUID NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_knowledge_chunks_embedding 
  ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- AI 问答记录
CREATE TABLE knowledge_qa_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  sources JSONB,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 用户收藏表
CREATE TABLE knowledge_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  content_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, content_type, content_id)
);
```

---

## 六、前端页面规划

### 6.1 路由设计

```
/dashboard/knowledge                    # 知识库首页
/dashboard/knowledge/books              # 书籍笔记列表（Phase 1）
/dashboard/knowledge/books/[id]         # 书籍详情（Phase 1）
/dashboard/knowledge/videos             # 视频课程列表（Phase 2）
/dashboard/knowledge/videos/[id]        # 视频详情（Phase 2）
/dashboard/knowledge/ai                 # AI 问答页面（Phase 3）
/dashboard/knowledge/my                 # 我的学习（Phase 2）
/dashboard/knowledge/subscribe          # 订阅管理（Phase 1）
```

### 6.2 UI 组件规划

| 组件名          | 用途            | Phase   |
| --------------- | --------------- | ------- |
| `KnowledgeCard` | 内容卡片        | Phase 1 |
| `BookReader`    | Markdown 阅读器 | Phase 1 |
| `AudioPlayer`   | 音频播放器      | Phase 1 |
| `PaywallModal`  | 付费拦截弹窗    | Phase 1 |
| `VideoPlayer`   | 视频播放器      | Phase 2 |
| `ProgressBar`   | 学习进度条      | Phase 2 |
| `AIChat`        | 问答面板        | Phase 3 |

---

## 七、实现计划

### Phase 1：书籍笔记（⭐ 当前重点，2-3 周）

- [ ] 创建 `knowledge_books` 表
- [ ] 创建 `knowledge_subscriptions` 表
- [ ] `/dashboard/knowledge` 首页
- [ ] `/dashboard/knowledge/books` 列表页
- [ ] `/dashboard/knowledge/books/[id]` 详情页
- [ ] Markdown 渲染组件
- [ ] 音频播放器组件
- [ ] 付费内容权限判断
- [ ] 知识库订阅购买流程
- [ ] Admin 后台管理（添加/编辑书籍）
- [ ] 上传 2-3 本书的笔记内容

### Phase 2：视频课程 + 进度追踪（2-3 周）

- [ ] 创建 `knowledge_videos` 表
- [ ] 创建 `knowledge_progress` 表
- [ ] 视频列表 + 详情页
- [ ] 视频播放器（嵌入式）
- [ ] 学习进度追踪
- [ ] 我的学习页面

### Phase 3：AI 问答 + 收藏（2-3 周）

- [ ] 启用 pgvector 扩展
- [ ] 创建 `knowledge_chunks` 表
- [ ] 创建 `knowledge_qa_logs` 表
- [ ] 创建 `knowledge_favorites` 表
- [ ] 内容向量化处理
- [ ] RAG 问答 API
- [ ] AI 问答页面
- [ ] 收藏功能

---

## 八、API 设计

### Phase 1 API

```
GET  /api/knowledge/books              # 书籍列表
GET  /api/knowledge/books/[id]         # 书籍详情（含权限校验）
POST /api/knowledge/books              # 创建书籍（admin）
PUT  /api/knowledge/books/[id]         # 更新书籍（admin）

GET  /api/knowledge/subscription       # 获取订阅状态
POST /api/knowledge/subscription       # 创建/购买订阅
```

### Phase 2 API

```
GET  /api/knowledge/videos             # 视频列表
GET  /api/knowledge/videos/[id]        # 视频详情

GET  /api/knowledge/progress           # 获取所有进度
PUT  /api/knowledge/progress           # 更新进度
```

### Phase 3 API

```
POST /api/knowledge/ai/ask             # 提交问题
GET  /api/knowledge/ai/history         # 问答历史
GET  /api/knowledge/ai/quota           # 查询剩余配额

GET  /api/knowledge/favorites          # 获取收藏
POST /api/knowledge/favorites          # 添加收藏
DELETE /api/knowledge/favorites/[id]   # 取消收藏
```

---

## 九、技术注意事项

### 9.1 Phase 1

- 书籍内容存储：使用 JSONB 存储 Markdown 或结构化内容
- 音频存储：Supabase Storage 或外链
- 付费判断：查询 `knowledge_subscriptions` 表

### 9.2 Phase 3（AI 问答）

```sql
-- 在 Supabase 中启用 pgvector
CREATE EXTENSION IF NOT EXISTS vector;
```

- Chunk 大小：500-800 字符
- Embedding 模型：`text-embedding-3-small`（1536 维）
- 检索 Top-K：5-10

### 9.3 成本控制

| 项目                    | 估算成本            | 控制措施           |
| ----------------------- | ------------------- | ------------------ |
| Embedding 生成          | $0.02 / 百万 tokens | 预处理、缓存       |
| AI 问答（Gemini Flash） | ~$0.01 / 次         | 配额限制           |
| Supabase 存储           | 按用量              | 外链视频、压缩图片 |

---

## 十、待决策项

- [ ] 定价最终确认（¥19 还是 ¥29）
- [ ] 年费套餐是否提供
- [ ] AI 问答配额具体数值
- [ ] 视频存储方案（Supabase Storage vs 外链）
- [ ] 是否开放用户投稿内容

---

## 十一、版权与合规

- **书籍笔记**：属于「读书笔记/书评」性质，注明原书信息，不直接复制原文
- **视频内容**：优先使用嵌入式播放（iframe），避免下载存储
- **AI 生成内容**：标注「AI 辅助生成，仅供参考」
- **来源标注**：所有内容明确标注原始来源

---

## 十二、Phase 1 待准备内容

开发之前需准备：

1. ⏳ 选定 2-3 本入门级书籍
2. ⏳ 使用 NotebookLM 生成通俗笔记
3. ⏳ 生成音频讲解
4. ⏳ 人工优化笔记内容
5. ⏳ 准备书籍封面图

---

_当前重点：Phase 1 书籍笔记功能，其他功能后续迭代_
