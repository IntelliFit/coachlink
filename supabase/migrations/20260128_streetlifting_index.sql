-- Streetlifting Index (街健力量指数) - isolated tables & seed data
-- 注意：根据项目规范，新建表不要开启 RLS（保持默认关闭）。

-- Extensions
create extension if not exists pgcrypto;

-- =============================================
-- 1) submissions（数据提交）
-- =============================================
create table if not exists public.streetlifting_submissions (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),

    gender text not null check (gender in ('Male', 'Female')),
    bodyweight double precision not null,
    added_weight double precision not null,
    reps integer not null check (reps >= 1 and reps <= 36),

    form_quality text not null check (form_quality in ('Competition', 'Minor_Cheat', 'Major_Cheat', 'Extreme_Cheat')),
    penalty_weight double precision not null default 0,

    user_name text,
    video_url text,
    pullup_type text check (pullup_type in ('Overhand', 'Underhand')),
    exercise_type text not null default 'weighted_pullup' check (exercise_type in ('weighted_pullup', 'weighted_dips'))
);

create index if not exists idx_streetlifting_submissions_created_at on public.streetlifting_submissions(created_at desc);
create index if not exists idx_streetlifting_submissions_gender on public.streetlifting_submissions(gender);
create index if not exists idx_streetlifting_submissions_exercise_type on public.streetlifting_submissions(exercise_type);
create index if not exists idx_streetlifting_submissions_pullup_type on public.streetlifting_submissions(pullup_type);

comment on table public.streetlifting_submissions is '街健力量指数：用户提交的训练数据（公开社区数据）';
comment on column public.streetlifting_submissions.form_quality is '动作质量：Competition / Minor_Cheat / Major_Cheat / Extreme_Cheat';

-- =============================================
-- 2) formulas（系数公式）
-- =============================================
create table if not exists public.streetlifting_formulas (
    id bigserial primary key,
    gender text not null check (gender in ('Male', 'Female')),
    exercise_type text not null default 'weighted_pullup' check (exercise_type in ('weighted_pullup', 'weighted_dips')),

    coeff_a double precision not null default 0,
    coeff_b double precision not null,
    coeff_c double precision not null,
    coeff_d double precision not null,
    coeff_e double precision not null,
    coeff_f double precision not null,

    total_submissions_used integer not null default 0,
    last_updated timestamptz not null default now(),

    constraint streetlifting_formulas_gender_exercise_key unique(gender, exercise_type)
);

create index if not exists idx_streetlifting_formulas_gender on public.streetlifting_formulas(gender);
create index if not exists idx_streetlifting_formulas_exercise_type on public.streetlifting_formulas(exercise_type);
create index if not exists idx_streetlifting_formulas_last_updated on public.streetlifting_formulas(last_updated desc);

comment on table public.streetlifting_formulas is '街健力量指数：体重标准化系数（男女/动作类型可扩展）';

-- Seed: V0.1 公式系数（来源：旧 streetlifting-index 项目 scripts/02-seed-initial-data.sql）
insert into public.streetlifting_formulas
    (gender, exercise_type, coeff_a, coeff_b, coeff_c, coeff_d, coeff_e, coeff_f, total_submissions_used, last_updated)
values
    ('Male',   'weighted_pullup', 0, 1.559673e-07, -5.634172e-05, 7.929852e-03, -0.532135, 16.838986, 0, now()),
    ('Female', 'weighted_pullup', 0, 3.995298e-07, -1.252007e-04, 1.544642e-02, -0.904901, 25.002010, 0, now()),

    -- 负重臂屈伸：当前沿用同一套初始系数（计算时仍按旧逻辑额外 / 1.3 调整分数）
    ('Male',   'weighted_dips',   0, 1.559673e-07, -5.634172e-05, 7.929852e-03, -0.532135, 16.838986, 0, now()),
    ('Female', 'weighted_dips',   0, 3.995298e-07, -1.252007e-04, 1.544642e-02, -0.904901, 25.002010, 0, now())
on conflict (gender, exercise_type) do update set
    coeff_a = excluded.coeff_a,
    coeff_b = excluded.coeff_b,
    coeff_c = excluded.coeff_c,
    coeff_d = excluded.coeff_d,
    coeff_e = excluded.coeff_e,
    coeff_f = excluded.coeff_f,
    total_submissions_used = excluded.total_submissions_used,
    last_updated = excluded.last_updated;

-- =============================================
-- 3) stories（社区故事）
-- =============================================
create table if not exists public.streetlifting_stories (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    content text,
    video_url text,
    type text not null default 'story' check (type in ('story', 'event')),
    event_date date,
    created_at timestamptz not null default now(),
    user_contact text
);

create index if not exists idx_streetlifting_stories_created_at on public.streetlifting_stories(created_at desc);

comment on table public.streetlifting_stories is '街健力量指数：社区故事/事件';

-- Seed: 旧项目的遗留故事（作为初始内容）
insert into public.streetlifting_stories (title, video_url, type, event_date)
values ('风吹裤管和小马哥冲突事件', 'https://www.wolai.com/fxoxabrZCusUeZY4h67uEF', 'event', '2024-01-01')
on conflict do nothing;

-- =============================================
-- 4) locations（寻找单杠）
-- =============================================
create table if not exists public.streetlifting_locations (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    address text,
    city text,
    province text,
    image_url text,           -- 兼容旧字段
    image_urls text[],        -- 多图（最多4张，前端限制）
    latitude double precision,
    longitude double precision,
    created_at timestamptz not null default now(),
    user_contact text
);

create index if not exists idx_streetlifting_locations_created_at on public.streetlifting_locations(created_at desc);
create index if not exists idx_streetlifting_locations_province on public.streetlifting_locations(province);

comment on table public.streetlifting_locations is '街健力量指数：单杠/训练点位置信息（公开社区数据）';

