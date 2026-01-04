-- 视频集：为学员提供重要视频的管理/收藏入口
create table if not exists public.student_video_collections (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    training_video_id uuid references public.training_videos(id),
    execution_set_video_id uuid references public.execution_set_videos(id),
    source text not null default 'manual', -- progress_set / plan_execution / manual / external_url / training_video
    title text,
    description text not null,
    tags text[] default '{}'::text[],
    is_featured boolean default false,
    video_url text,
    thumbnail_url text,
    storage_path text,
    storage_bucket text default 'videos',
    duration_seconds integer,
    file_size bigint,
    processing_status text default 'ready',
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    deleted_at timestamptz
);

create index if not exists idx_student_video_collections_user_created_at
    on public.student_video_collections(user_id, created_at desc);

create index if not exists idx_student_video_collections_user_featured
    on public.student_video_collections(user_id)
    where deleted_at is null and is_featured = true;

create index if not exists idx_student_video_collections_training_video
    on public.student_video_collections(training_video_id)
    where deleted_at is null;

create index if not exists idx_student_video_collections_execution_video
    on public.student_video_collections(execution_set_video_id)
    where deleted_at is null;

