alter table public.public_training_plan_templates
  add column if not exists specialty_key text not null default 'foundation',
  add column if not exists specialty_label text not null default '基础入门',
  add column if not exists specialty_priority integer not null default 999;

create index if not exists idx_public_training_plan_templates_specialty
  on public.public_training_plan_templates(status, specialty_priority, specialty_key, sort_order);

comment on column public.public_training_plan_templates.specialty_key is
  '训练计划专项领域 key，例如 bench_press、squat、powerlifting、weighted_pullup、weighted_dip、posture。';

comment on column public.public_training_plan_templates.specialty_label is
  '训练计划专项领域展示名，用于小程序知识库专项优先筛选。';

comment on column public.public_training_plan_templates.specialty_priority is
  '专项领域排序权重，数字越小越靠前。';

update public.public_training_plan_templates
set
  specialty_key = case
    when slug ilike '%bench%' or goal ilike '%卧推%' or tags && array['卧推'] then 'bench_press'
    when slug ilike '%squat%' or goal ilike '%深蹲%' or tags && array['深蹲'] then 'squat'
    when slug ilike '%deadlift%' or goal ilike '%硬拉%' or tags && array['硬拉'] then 'deadlift'
    when slug ilike '%powerlifting%' or tags && array['力量举'] then 'powerlifting'
    when slug ilike '%pullup%' or goal ilike '%引体%' or tags && array['引体'] then 'weighted_pullup'
    when slug ilike '%dip%' or goal ilike '%双杠%' or tags && array['双杠'] then 'weighted_dip'
    when goal ilike '%体态%' or goal ilike '%久坐%' or tags && array['体态','久坐'] then 'posture'
    when level = 'beginner' then 'foundation'
    else 'strength_general'
  end,
  specialty_label = case
    when slug ilike '%bench%' or goal ilike '%卧推%' or tags && array['卧推'] then '卧推专项'
    when slug ilike '%squat%' or goal ilike '%深蹲%' or tags && array['深蹲'] then '深蹲专项'
    when slug ilike '%deadlift%' or goal ilike '%硬拉%' or tags && array['硬拉'] then '硬拉专项'
    when slug ilike '%powerlifting%' or tags && array['力量举'] then '力量举'
    when slug ilike '%pullup%' or goal ilike '%引体%' or tags && array['引体'] then '负重引体'
    when slug ilike '%dip%' or goal ilike '%双杠%' or tags && array['双杠'] then '负重双杠'
    when goal ilike '%体态%' or goal ilike '%久坐%' or tags && array['体态','久坐'] then '体态纠正'
    when level = 'beginner' then '基础入门'
    else '通用力量'
  end,
  specialty_priority = case
    when slug ilike '%bench%' or goal ilike '%卧推%' or tags && array['卧推'] then 10
    when slug ilike '%squat%' or goal ilike '%深蹲%' or tags && array['深蹲'] then 20
    when slug ilike '%powerlifting%' or tags && array['力量举'] then 30
    when slug ilike '%pullup%' or goal ilike '%引体%' or tags && array['引体'] then 40
    when slug ilike '%dip%' or goal ilike '%双杠%' or tags && array['双杠'] then 50
    when goal ilike '%体态%' or goal ilike '%久坐%' or tags && array['体态','久坐'] then 60
    when slug ilike '%deadlift%' or goal ilike '%硬拉%' or tags && array['硬拉'] then 70
    when level = 'beginner' then 900
    else 800
  end,
  updated_at = now();
