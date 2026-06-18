create table if not exists public.streetlifting_calc_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source_surface text not null check (source_surface in ('web', 'weapp')),
  exercise_type text not null check (exercise_type in ('weighted_pullup', 'weighted_dips', 'strict_press', 'barbell_curl', 'squat', 'bench', 'deadlift')),
  calc_mode text not null check (calc_mode in ('forward', 'reverse_weight', 'reverse_reps', 'day_max')),
  gender text not null check (gender in ('Male', 'Female')),
  bodyweight_kg numeric not null check (bodyweight_kg > 0),
  reps numeric null,
  sets numeric null,
  rest_cat text null check (rest_cat is null or rest_cat in ('short', 'moderate', 'long', 'very_long')),
  day_first_type text null check (day_first_type is null or day_first_type in ('RIR', 'Achieved')),
  day_first_value numeric null,
  day_last_type text null check (day_last_type is null or day_last_type in ('RIR', 'Achieved')),
  day_last_value numeric null,
  form_quality text null check (form_quality is null or form_quality in ('Competition', 'Minor_Cheat', 'Major_Cheat', 'Extreme_Cheat')),
  penalty_weight_kg numeric null,
  added_weight_kg numeric null,
  added_1rm_kg numeric null,
  working_added_weight_kg numeric null,
  lift_weight_kg numeric null,
  target_1rm_kg numeric null,
  working_lift_weight_kg numeric null,
  estimated_1rm_kg numeric not null,
  final_score numeric not null,
  coefficient numeric not null,
  adjusted_used_weight_kg numeric null,
  computed_added_weight_kg numeric null,
  computed_reps numeric null,
  result_level text null,
  is_ranking_eligible boolean not null default false,
  verified_level text not null default 'self_reported' check (verified_level in ('self_reported', 'verified')),
  input_snapshot jsonb not null default '{}'::jsonb,
  result_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_streetlifting_calc_records_user_created_at
  on public.streetlifting_calc_records (user_id, created_at desc);

create index if not exists idx_streetlifting_calc_records_user_exercise_score
  on public.streetlifting_calc_records (user_id, exercise_type, final_score desc, created_at asc);

create index if not exists idx_streetlifting_calc_records_ranking_bucket
  on public.streetlifting_calc_records (exercise_type, gender, final_score desc, created_at asc)
  where is_ranking_eligible = true;

alter table public.streetlifting_calc_records enable row level security;

create policy "允许用户查看自己的力量计算历史"
  on public.streetlifting_calc_records
  for select
  using (auth.uid() = user_id);

create policy "允许用户新增自己的力量计算历史"
  on public.streetlifting_calc_records
  for insert
  with check (auth.uid() = user_id);
