-- Store structured per-coach AI knowledge documents.
-- The legacy knowledge_base column remains as a short always-on core note.

alter table public.coach_ai_auto_reply_settings
  add column if not exists knowledge_documents jsonb not null default '[]'::jsonb;

comment on column public.coach_ai_auto_reply_settings.knowledge_documents
  is 'Structured coach-authored knowledge documents for lightweight topic retrieval before AI auto replies.';
