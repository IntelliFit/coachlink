-- 平台公告/通知栏：管理员在 /admin/announcements 发布，用户打开小程序或网页时弹窗，
-- 首页有入口和未读红点，可在列表/详情页阅读。
-- 只新建两张表，不改动现有表。所有访问经 Next.js 服务端（service_role）。
--
-- Rollback:
--   drop table if exists public.announcement_reads;
--   drop table if exists public.announcements;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 60),
  summary text not null default '' check (char_length(summary) <= 200),
  content text not null default '' check (char_length(content) <= 5000),
  cover_image_url text,
  image_urls jsonb not null default '[]'::jsonb check (jsonb_typeof(image_urls) = 'array'),
  -- 详情页底部按钮：跳转站内路径（小程序与 Web 各一个，可留空）
  action_label text not null default '' check (char_length(action_label) <= 20),
  weapp_path text not null default '' check (char_length(weapp_path) <= 300),
  web_path text not null default '' check (char_length(web_path) <= 300),
  audience text not null default 'all' check (audience in ('all', 'coach', 'student')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  -- 是否在用户打开时自动弹窗（每人只弹一次）；false 时只进列表
  popup boolean not null default true,
  pinned boolean not null default false,
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_announcements_status_published
  on public.announcements (status, published_at desc);

create table if not exists public.announcement_reads (
  user_id uuid not null references public.users(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  -- 已自动弹出过（关闭也算），之后不再弹
  popped_at timestamptz,
  -- 打开过详情，之后不再算未读
  read_at timestamptz,
  primary key (user_id, announcement_id)
);

create index if not exists idx_announcement_reads_announcement
  on public.announcement_reads (announcement_id);

comment on table public.announcements is
  'Platform announcements shown to users as an on-open popup, a home entry with unread badge, and a list.';
comment on table public.announcement_reads is
  'Per-user popup/read state of announcements.';

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;
revoke all on table public.announcements from public, anon, authenticated;
revoke all on table public.announcement_reads from public, anon, authenticated;
grant select, insert, update, delete on table public.announcements to service_role;
grant select, insert, update, delete on table public.announcement_reads to service_role;
