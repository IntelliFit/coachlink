-- Migration: Add knowledge_node_id to coach_contents table
-- Enables linking coach articles to knowledge tree nodes

-- 1. Add the column
ALTER TABLE coach_contents
ADD COLUMN knowledge_node_id UUID REFERENCES knowledge_nodes(id) ON DELETE SET NULL;

-- 2. Create index for efficient queries
CREATE INDEX idx_coach_contents_knowledge_node ON coach_contents(knowledge_node_id)
WHERE knowledge_node_id IS NOT NULL;

-- 3. Add comment
COMMENT ON COLUMN coach_contents.knowledge_node_id IS '关联的知识库节点ID，用于将文章挂载到知识树上';
