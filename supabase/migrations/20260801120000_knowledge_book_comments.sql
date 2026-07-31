-- 书籍总览与章节共用一套轻量讨论表。
-- 不复用 content_interactions（其 content_id 外键只指向 coach_contents），
-- 也不复用 student_comments（教练评价语义）。

CREATE TABLE IF NOT EXISTS public.knowledge_book_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.knowledge_books(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.knowledge_book_comments(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'visible'
    CHECK (status IN ('visible', 'hidden', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_book_comments_book_created
  ON public.knowledge_book_comments(book_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_knowledge_book_comments_parent
  ON public.knowledge_book_comments(parent_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_book_comments_user
  ON public.knowledge_book_comments(user_id, created_at DESC);

DROP TRIGGER IF EXISTS knowledge_book_comments_set_updated_at
  ON public.knowledge_book_comments;
CREATE TRIGGER knowledge_book_comments_set_updated_at
  BEFORE UPDATE ON public.knowledge_book_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 评论只允许通过经过 NextAuth 会话校验的服务端 API 访问。
ALTER TABLE public.knowledge_book_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.knowledge_book_comments FROM anon, authenticated;
GRANT ALL ON public.knowledge_book_comments TO service_role;
