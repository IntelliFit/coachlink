-- Enable pgvector extension for RAG
create extension if not exists vector;

-- ======================================
-- Knowledge Base Core Tables
-- ======================================

-- 1. Knowledge Nodes (Closure Table Pattern)
create type knowledge_node_type as enum ('domain', 'category', 'topic', 'article', 'video');

create table knowledge_nodes (
  id uuid primary key default gen_random_uuid(),
  node_type knowledge_node_type not null default 'article',
  title text not null,
  slug text unique,
  description text,
  icon text,          -- lucide icon name or image url
  content jsonb,      -- for leaf nodes (article/video content)
  
  -- Metadata for filtering/searching
  body_region text[], -- ['shoulder', 'lower_back']
  equipment text[],   -- ['dumbbell', 'barbell', 'bodyweight']
  difficulty integer default 1, -- 1-5
  
  -- Status
  is_free boolean default true,
  is_published boolean default false,
  view_count integer default 0,
  sort_order integer default 0,
  
  -- Embeddings for RAG (OpenAI text-embedding-3-small is 1536 dim)
  embedding vector(1536),
  
  -- Audit
  created_by uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for vector similarity search
create index idx_knowledge_nodes_embedding 
on knowledge_nodes using hnsw (embedding vector_cosine_ops);

-- Index for filters
create index idx_knowledge_nodes_filters 
on knowledge_nodes using gin (body_region, equipment);

-- 2. Closure Table for Tree Structure
create table knowledge_node_closures (
  ancestor_id uuid references knowledge_nodes(id) on delete cascade,
  descendant_id uuid references knowledge_nodes(id) on delete cascade,
  depth integer not null,
  primary key (ancestor_id, descendant_id)
);

create index idx_knowledge_closures_descendant 
on knowledge_node_closures(descendant_id);

-- 3. Scenario Quick Fixes (生活化急救箱)
create table knowledge_scenarios (
  id uuid primary key default gen_random_uuid(),
  title text not null, -- e.g. "办公族肩颈救星"
  slug text unique,
  icon text,
  description text,
  node_ids uuid[],     -- References knowledge_nodes(id)
  sort_order integer default 0,
  is_published boolean default false,
  created_at timestamptz default now()
);

-- 4. Knowledge AI Conversations (Feedback Loop)
create table knowledge_ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  question text not null,
  answer text,
  referenced_node_ids uuid[],
  rating integer,      -- 1-5 stars
  created_at timestamptz default now()
);

-- ======================================
-- Seed Initial Structure (Based on Requirements)
-- ======================================

-- Function to easily insert nodes (helper)
create or replace function create_knowledge_node(
  p_title text, 
  p_type knowledge_node_type, 
  p_parent_id uuid default null,
  p_description text default null
) returns uuid as $$
declare
  v_node_id uuid;
begin
  insert into knowledge_nodes (title, node_type, description, is_published)
  values (p_title, p_type, p_description, true)
  returning id into v_node_id;

  -- Self-closure
  insert into knowledge_node_closures (ancestor_id, descendant_id, depth)
  values (v_node_id, v_node_id, 0);

  -- Parent closures
  if p_parent_id is not null then
    insert into knowledge_node_closures (ancestor_id, descendant_id, depth)
    select ancestor_id, v_node_id, depth + 1
    from knowledge_node_closures
    where descendant_id = p_parent_id;
  end if;

  return v_node_id;
end;
$$ language plpgsql;

-- Seed Root Domains
do $$
declare
  v_assess_id uuid;
  v_train_id uuid;
  v_judge_id uuid;
begin
  -- 1. 动作研判标准
  v_judge_id := create_knowledge_node('动作研判标准', 'domain', null, '动作执行的底层逻辑与标准');
  perform create_knowledge_node('身体位置', 'category', v_judge_id, '初始姿态、张拉结构等');
  perform create_knowledge_node('动作过程', 'category', v_judge_id, '近端控制、远端意识等');

  -- 2. 评估（训练前置）
  v_assess_id := create_knowledge_node('评估（训练前置）', 'domain', null, '静态体态与动态功能评估');
  perform create_knowledge_node('静态评估', 'category', v_assess_id, '肌骨关节对位');
  perform create_knowledge_node('动态评估', 'category', v_assess_id, '肌骨关节功能');

  -- 3. 训练体系
  v_train_id := create_knowledge_node('训练体系', 'domain', null, '系统化的训练分类');
  perform create_knowledge_node('封闭技能体系', 'category', v_train_id, '环境相对固定的项目');
  perform create_knowledge_node('开放技能体系', 'category', v_train_id, '环境变化多端的项目');
  perform create_knowledge_node('健康管理体系', 'category', v_train_id, '身体管理与调理');
end $$;

-- Drop helper function specific to seed
drop function create_knowledge_node;

-- ======================================
-- RLS Policies (Basic Permissions)
-- ======================================
alter table knowledge_nodes enable row level security;
alter table knowledge_scenarios enable row level security;

-- Public read access for published nodes
create policy "Public read published nodes" 
on knowledge_nodes for select 
using (is_published = true);

create policy "Public read published scenarios" 
on knowledge_scenarios for select 
using (is_published = true);

-- Admin write access (Assuming admin role logic exists, using service role for now for simplicity in user request context, 
-- or you can add specific user ID checks if needed)
-- For now, letting authenticated users read everything for dev purposes if needed, or keep it strict.
-- We will stick to public read essential for the app.
