-- ======================================
-- Knowledge Base Tables
-- ======================================

-- ======================================
-- Books content table
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
-- Knowledge base subscriptions table (platform owned, separate from coach subscriptions)
-- ======================================
CREATE TABLE knowledge_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'basic',
  status TEXT DEFAULT 'active',
  order_id UUID REFERENCES alipay_orders(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  ai_quota_used INTEGER DEFAULT 0,      -- For Phase 3
  ai_quota_reset_at TIMESTAMPTZ,        -- For Phase 3
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_knowledge_subs_user ON knowledge_subscriptions(user_id);

-- ======================================
-- RLS Policies (to be implemented based on application needs)
-- ======================================
-- Note: RLS policies will be added in a separate migration after implementation decisions

