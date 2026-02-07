# 知识库 (Knowledge Base) 功能代码实现计划

> **创建日期**: 2026-02-06
> **依赖**: 基于 `KNOWLEDGE_BASE_PILLARS_WORKPLAN.md` 的业务规划

本文档是知识库功能的**代码层面实现计划**，包含数据库设计、API 路由、前端组件架构和分阶段实施路线。

---

## 一、 现有代码基础分析

| 项目 | 发现 |
|------|------|
| **框架** | Next.js App Router (`src/app/`) |
| **UI 库** | PrimeReact + Tailwind CSS |
| **数据库** | Supabase (PostgreSQL)，迁移脚本在 `supabase/migrations/` |
| **现有知识库表** | `knowledge_books`, `knowledge_subscriptions` (基础版) |
| **工具箱入口** | `/toolbox` 页面 + `/me/toolbox`; 配置在 `src/config/toolbox.ts` |
| **动作库模式** | `canonical_actions` (公共动作) + `coach_actions` (教练私有) |

---

## 二、 数据库设计 (Supabase Migration)

### 2.1 核心表结构

基于用户提供的**训练体系分类**，采用 **Closure Table** 模式存储树形知识节点。

```
┌─────────────────────────────────────────────────────────────────────┐
│                         knowledge_nodes                              │
├─────────────────────────────────────────────────────────────────────┤
│ id (UUID PK)                                                        │
│ node_type ENUM('domain','category','topic','article','video')       │
│ title TEXT NOT NULL                                                 │
│ slug TEXT UNIQUE   -- for SEO-friendly URLs                         │
│ description TEXT                                                    │
│ icon TEXT          -- lucide icon name or image URL                 │
│ content JSONB      -- full article/video content for leaf nodes     │
│ body_region TEXT[] -- ['shoulder','lower_back'] for Body Map        │
│ equipment TEXT[]   -- ['dumbbell','barbell','bodyweight']           │
│ difficulty INTEGER -- 1-5                                           │
│ is_free BOOLEAN DEFAULT true                                        │
│ is_published BOOLEAN DEFAULT false                                  │
│ view_count INTEGER DEFAULT 0                                        │
│ sort_order INTEGER DEFAULT 0                                        │
│ created_by UUID REFERENCES users(id)                                │
│ created_at, updated_at                                              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                  knowledge_node_closures (Closure Table)            │
├─────────────────────────────────────────────────────────────────────┤
│ ancestor_id UUID REFERENCES knowledge_nodes(id)                     │
│ descendant_id UUID REFERENCES knowledge_nodes(id)                   │
│ depth INTEGER NOT NULL                                              │
│ PRIMARY KEY (ancestor_id, descendant_id)                            │
└─────────────────────────────────────────────────────────────────────┘

-- 快速查子树: SELECT * FROM knowledge_node_closures WHERE ancestor_id = :id AND depth > 0
-- 快速查面包屑: SELECT * FROM knowledge_node_closures WHERE descendant_id = :id ORDER BY depth DESC
```

### 2.2 扩展表

```sql
-- 场景急救箱 (Scenario Quick Fixes)
CREATE TABLE knowledge_scenarios (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,           -- e.g. "办公族肩颈救星"
  slug TEXT UNIQUE,
  icon TEXT,
  description TEXT,
  node_ids UUID[],               -- 关联的 knowledge_nodes
  sort_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT false
);

-- AI 问答记录 (用于 RAG 训练反馈)
CREATE TABLE knowledge_ai_conversations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  question TEXT NOT NULL,
  answer TEXT,
  referenced_node_ids UUID[],
  rating INTEGER,                -- 1-5 user feedback
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.3 种子数据 (Seed Data)

根据用户提供的知识体系，插入以下 Domain 节点：

| id | title | node_type |
|----|-------|-----------|
| `domain_assessment` | 评估（训练前置） | domain |
| `domain_training` | 训练体系 | domain |
| `domain_movement` | 动作研判标准 | domain |

> 具体子节点（如颈椎带、胸椎带）将在第一阶段后由教练团队补充。

---

## 三、 API 路由设计 (Next.js Route Handlers)

### 3.1 目录结构

```
src/app/api/knowledge/
├── nodes/
│   ├── route.ts                 # GET (list), POST (create)
│   └── [nodeId]/
│       ├── route.ts             # GET, PATCH, DELETE
│       └── children/route.ts    # GET children of a node
├── tree/route.ts                # GET full tree (for admin/editor)
├── body-map/route.ts            # GET nodes filtered by body_region
├── equipment-filter/route.ts    # GET nodes filtered by equipment
├── scenarios/
│   ├── route.ts                 # GET, POST
│   └── [scenarioId]/route.ts    # GET, PATCH, DELETE
├── search/route.ts              # GET full-text search
└── ai/
    ├── ask/route.ts             # POST question -> RAG answer
    └── feedback/route.ts        # POST user rating
```

### 3.2 核心 API 签名

| 端点 | 方法 | 权限 | 描述 |
|------|------|------|------|
| `/api/knowledge/nodes` | GET | public | 列表/分页，支持 `?parent_id=` `?body_region=` `?equipment=` |
| `/api/knowledge/nodes` | POST | admin/coach L3 | 创建节点 |
| `/api/knowledge/nodes/[id]` | GET | public | 单节点详情 + 面包屑 |
| `/api/knowledge/body-map` | GET | public | 返回所有已发布节点的 body_region 聚合 |
| `/api/knowledge/ai/ask` | POST | user (quota) | RAG 问答 |

---

## 四、 前端组件架构

### 4.1 页面路由

```
src/app/
├── knowledge/
│   ├── page.tsx                 # 知识库首页 (双模式人体图入口)
│   ├── [slug]/page.tsx          # 单个知识节点详情页 (SSG)
│   ├── body-map/page.tsx        # 交互式人体图
│   ├── scenarios/page.tsx       # 场景急救箱列表
│   └── ai/page.tsx              # AI 问答页面
└── toolbox/                     # (现有) 工具箱
    └── page.tsx                 # 增加「知识库」卡片入口
```

### 4.2 组件目录

```
src/components/knowledge/
├── BodyMap/
│   ├── BodyMapCanvas.tsx        # SVG 人体图 (可点击部位)
│   ├── BodyMapModeSwitch.tsx    # 训练/筛查模式切换
│   └── useBodyMapInteraction.ts # Hook: 点击 -> 筛选节点
├── KnowledgeTree/
│   ├── TreeView.tsx             # 递归树形展示
│   └── NodeCard.tsx             # 节点卡片 (图标/标题/描述)
├── ScenarioKit/
│   ├── ScenarioList.tsx         # 场景列表
│   └── ScenarioCard.tsx         # 单场景卡片
├── EquipmentFilter/
│   ├── EquipmentSelector.tsx    # 多选器械筛选
│   └── equipmentOptions.ts      # 配置: bodyweight, dumbbell, barbell...
├── KnowledgeAI/
│   ├── AIChatPanel.tsx          # 聊天 UI
│   └── useKnowledgeRAG.ts       # Hook: 调用 /api/knowledge/ai/ask
└── shared/
    ├── KnowledgeBreadcrumb.tsx  # 面包屑导航
    └── DifficultyBadge.tsx      # 难度标签
```

### 4.3 人体图交互设计 (Body Map)

```
┌──────────────────────────────────────────────────────┐
│  [筛查模式 🩺]   [训练模式 💪]                        │  <-- ModeSwitch
├──────────────────────────────────────────────────────┤
│                                                      │
│           ┌───────────┐                              │
│           │   头/颈   │◀─── 点击后筛选 body_region   │
│           └───────────┘      = ['head','neck']       │
│           ┌───────────┐                              │
│           │    肩     │                              │
│           └───────────┘                              │
│      ┌────┐       ┌────┐                             │
│      │ 肘 │       │ 肘 │                             │
│      └────┘       └────┘                             │
│           ┌───────────┐                              │
│           │  腰/核心  │                              │
│           └───────────┘                              │
│      ┌────┐       ┌────┐                             │
│      │ 髋 │       │ 髋 │                             │
│      └────┘       └────┘                             │
│      ┌────┐       ┌────┐                             │
│      │ 膝 │       │ 膝 │                             │
│      └────┘       └────┘                             │
│      ┌────┐       ┌────┐                             │
│      │踝/足│       │踝/足│                             │
│      └────┘       └────┘                             │
│                                                      │
└──────────────────────────────────────────────────────┘
                     ↓ 点击 "腰/核心"
┌──────────────────────────────────────────────────────┐
│  🔍 筛查模式结果: 腰部相关                            │
├──────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐ ┌─────────────────────┐ │
│  │ 💢 腰曲变直             │ │ 💢 腰椎间盘突出      │ │
│  │ 松解-激活-强化方案       │ │ 鉴别诊断 + 康复建议  │ │
│  └─────────────────────────┘ └─────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## 五、 分阶段实施路线

### Phase 1: 骨架搭建 (Week 1-2)

| 任务 | 产出物 |
|------|--------|
| 编写 Supabase 迁移脚本 | `supabase/migrations/20260206_knowledge_base_v2.sql` |
| 实现基础 CRUD API | `/api/knowledge/nodes` |
| 创建知识库首页骨架 | `/knowledge/page.tsx` |
| 创建 TreeView 组件 | `src/components/knowledge/KnowledgeTree/TreeView.tsx` |
| **验收标准**: 能够在页面上查看、创建、删除知识节点树 | |

### Phase 2: 人体图与筛选 (Week 3-4)

| 任务 | 产出物 |
|------|--------|
| 设计 SVG 人体图 | `BodyMapCanvas.tsx` |
| 实现 body_region / equipment 筛选 API | `/api/knowledge/body-map` |
| 接入筛选 UI | `EquipmentSelector.tsx` |
| 场景急救箱 CRUD | `/api/knowledge/scenarios` |
| **验收标准**: 点击人体部位能筛选出对应内容 | |

### Phase 3: AI 问答与内容填充 (Week 5-6)

| 任务 | 产出物 |
|------|--------|
| 接入 LLM (OpenAI/DeepSeek) + RAG | `/api/knowledge/ai/ask` |
| AI 聊天 UI | `AIChatPanel.tsx` |
| 教练后台内容管理页面 | `/coach/knowledge/editor` |
| 嵌入式计算器入口 (链接到现有 toolbox) | 在知识库侧边栏显示 |
| **验收标准**: 用户可向 AI 提问并获得基于知识库的回答 | |

---

## 六、 技术选型与依赖

| 模块 | 技术/库 |
|------|---------|
| **人体 SVG** | 自绘 SVG 或 [body-svg](https://github.com/nicholasadamou/body-svg) |
| **树形组件** | PrimeReact TreeTable 或自研 |
| **RAG** | LangChain + Supabase pg_vector (Phase 3) |
| **图标** | Lucide React (已在项目中使用) |

---

## 七、 与现有功能的集成

### 7.1 底部导航入口（已存在）
知识库已在 `NavigationStudent.tsx` 底部导航中注册（341-345行），路由为 `/dashboard/knowledge`。

> **注意**：知识库是独立的核心板块，与工具箱（`/me/toolbox`）平级，不是工具箱的子功能。

### 7.2 知识库页面内嵌工具链接
知识库页面**顶部或侧边栏**应嵌入工具箱的快捷入口（计算器、找单杠等），方便用户在学习过程中使用工具。

```typescript
// src/components/knowledge/ToolboxQuickLinks.tsx
import { STUDENT_TOOLBOX_LINKS } from '@/config/toolbox';

export function ToolboxQuickLinks() {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {STUDENT_TOOLBOX_LINKS.map((tool) => (
        <Link key={tool.key} href={tool.url} className="shrink-0 px-3 py-1.5 bg-surface-50 rounded-full text-sm">
          <i className={tool.icon} /> {tool.label}
        </Link>
      ))}
    </div>
  );
}
```

### 7.3 动作库联动
`knowledge_nodes` 可通过 `related_action_id` 字段关联 `canonical_actions`，实现：
- 知识库文章页显示"相关动作"卡片
- 动作详情页显示"延伸阅读"知识链接

---

## 八、 待决策项

1.  **人体图 SVG 来源**: 自绘？购买商业素材？使用开源方案？
2.  **RAG 向量数据库**: 使用 Supabase 自带的 `pg_vector` 还是外部服务 (Pinecone)?
3.  **内容版权**: 是否需要增加水印/防盗机制？

---

## 附录: 用户提供的知识体系大纲

详见本文档开头引用的完整分类树（动作研判标准、评估、训练体系）。

---

_文档创建者: AI Assistant_
_最后更新: 2026-02-06_
