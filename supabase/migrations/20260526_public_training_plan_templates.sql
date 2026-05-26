create table if not exists public.public_training_plan_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sport text not null,
  goal text not null,
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  weeks integer not null default 4 check (weeks > 0),
  days_per_week integer not null default 3 check (days_per_week > 0),
  equipment text[] not null default '{}',
  tags text[] not null default '{}',
  suitable_for text not null default 'beginner',
  audience text,
  notes text[] not null default '{}',
  training_days jsonb not null,
  template_kind text not null default 'fixed' check (template_kind in ('fixed', 'parameterized')),
  parameter_schema jsonb not null default '{}'::jsonb,
  action_slots jsonb not null default '[]'::jsonb,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_public_training_plan_templates_status
  on public.public_training_plan_templates(status, sort_order);

create index if not exists idx_public_training_plan_templates_level
  on public.public_training_plan_templates(level);

create index if not exists idx_public_training_plan_templates_tags
  on public.public_training_plan_templates using gin(tags);

comment on table public.public_training_plan_templates is
  '平台公共训练计划模板，供知识库/计划市场展示并复制到学员自己的计划库。';

comment on column public.public_training_plan_templates.training_days is
  '基础训练日模式，通常为 7 天。API 会按 weeks 展开成完整 training_days。';

comment on column public.public_training_plan_templates.parameter_schema is
  '参数化模板配置，例如 5x5 所需的动作槽、1RM 输入、百分比或 RPE 规则。';

comment on column public.public_training_plan_templates.action_slots is
  '可替换动作槽位，例如 main_lift/squat_pattern/push_pattern/pull_pattern。';

do $$
declare
  full_body_3d jsonb := $json$
  [
    {"dayIndex":1,"type":"training","note":"全身力量 A：动作质量优先，保留 2-3 次余力。","actionSets":[
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"高脚杯深蹲","setName":"高脚杯深蹲","params":{"sets":3,"reps":"8-10","intensity":"RPE 6-7","rest_seconds":90}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"俯卧撑","setName":"俯卧撑","params":{"sets":3,"reps":"6-12","intensity":"RPE 6-7","rest_seconds":90}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"哑铃划船","setName":"哑铃划船","params":{"sets":3,"reps":"10/侧","intensity":"RPE 7","rest_seconds":90}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"平板支撑","setName":"平板支撑","params":{"sets":3,"reps":"30-45秒","intensity":"","rest_seconds":60}}
    ]},
    {"dayIndex":2,"type":"rest","note":"休息或轻松步行 20-30 分钟。","actionSets":[]},
    {"dayIndex":3,"type":"training","note":"灵活性与有氧：轻松完成，作为恢复和动作学习日。","actionSets":[
      {"type":"no-filter","itemType":"CARDIO","actionId":"","actionName":"快走或椭圆机","setName":"快走或椭圆机","params":{"sets":1,"reps":"25-35分钟","intensity":"轻松可说话","rest_seconds":60}},
      {"type":"no-filter","itemType":"HABIT","actionId":"","actionName":"髋踝灵活性","setName":"髋踝灵活性","params":{"sets":1,"reps":"10分钟","intensity":"","rest_seconds":30}},
      {"type":"no-filter","itemType":"HABIT","actionId":"","actionName":"胸椎打开","setName":"胸椎打开","params":{"sets":1,"reps":"8分钟","intensity":"","rest_seconds":30}}
    ]},
    {"dayIndex":4,"type":"rest","note":"休息，优先保证睡眠。","actionSets":[]},
    {"dayIndex":5,"type":"training","note":"全身力量 B：稳定节奏完成，最后一组不要力竭。","actionSets":[
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"罗马尼亚硬拉","setName":"罗马尼亚硬拉","params":{"sets":3,"reps":"8-10","intensity":"RPE 6-7","rest_seconds":120}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"哑铃推举","setName":"哑铃推举","params":{"sets":3,"reps":"8-10","intensity":"RPE 7","rest_seconds":90}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"反向弓步","setName":"反向弓步","params":{"sets":3,"reps":"8/侧","intensity":"RPE 7","rest_seconds":90}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"死虫","setName":"死虫","params":{"sets":3,"reps":"10/侧","intensity":"","rest_seconds":60}}
    ]},
    {"dayIndex":6,"type":"rest","note":"休息或轻松拉伸。","actionSets":[]},
    {"dayIndex":7,"type":"rest","note":"完全休息。","actionSets":[]}
  ]
  $json$::jsonb;
  fat_loss_4d jsonb := $json$
  [
    {"dayIndex":1,"type":"training","note":"减脂循环：心率上来但不要动作变形。","actionSets":[
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"壶铃硬拉","setName":"壶铃硬拉","params":{"sets":3,"reps":"12","intensity":"RPE 7","rest_seconds":60}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"哑铃推举","setName":"哑铃推举","params":{"sets":3,"reps":"10","intensity":"RPE 7","rest_seconds":60}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"台阶上步","setName":"台阶上步","params":{"sets":3,"reps":"12/侧","intensity":"RPE 7","rest_seconds":60}},
      {"type":"no-filter","itemType":"CARDIO","actionId":"","actionName":"划船机或单车","setName":"划船机或单车","params":{"sets":1,"reps":"12-18分钟","intensity":"中等强度","rest_seconds":60}}
    ]},
    {"dayIndex":2,"type":"rest","note":"休息。","actionSets":[]},
    {"dayIndex":3,"type":"training","note":"全身力量：保留肌肉量。","actionSets":[
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"高脚杯深蹲","setName":"高脚杯深蹲","params":{"sets":3,"reps":"10","intensity":"RPE 7","rest_seconds":90}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"俯卧撑","setName":"俯卧撑","params":{"sets":3,"reps":"8-12","intensity":"RPE 7","rest_seconds":90}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"哑铃划船","setName":"哑铃划船","params":{"sets":3,"reps":"10/侧","intensity":"RPE 7","rest_seconds":90}}
    ]},
    {"dayIndex":4,"type":"training","note":"低强度有氧与灵活性。","actionSets":[
      {"type":"no-filter","itemType":"CARDIO","actionId":"","actionName":"快走","setName":"快走","params":{"sets":1,"reps":"35-45分钟","intensity":"Zone 2","rest_seconds":60}},
      {"type":"no-filter","itemType":"HABIT","actionId":"","actionName":"拉伸放松","setName":"拉伸放松","params":{"sets":1,"reps":"10分钟","intensity":"","rest_seconds":30}}
    ]},
    {"dayIndex":5,"type":"training","note":"减脂循环重复，略微提高质量或次数。","actionSets":[
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"壶铃摆动","setName":"壶铃摆动","params":{"sets":4,"reps":"12-15","intensity":"RPE 7","rest_seconds":60}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"弓步走","setName":"弓步走","params":{"sets":3,"reps":"12/侧","intensity":"RPE 7","rest_seconds":60}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"平板支撑","setName":"平板支撑","params":{"sets":3,"reps":"45秒","intensity":"","rest_seconds":45}}
    ]},
    {"dayIndex":6,"type":"rest","note":"休息。","actionSets":[]},
    {"dayIndex":7,"type":"rest","note":"完全休息。","actionSets":[]}
  ]
  $json$::jsonb;
  upper_lower_4d jsonb := $json$
  [
    {"dayIndex":1,"type":"training","note":"上肢力量：推拉平衡。","actionSets":[
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"卧推","setName":"卧推","params":{"sets":4,"reps":"5-8","intensity":"RPE 7-8","rest_seconds":150}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"引体向上或高位下拉","setName":"引体向上或高位下拉","params":{"sets":4,"reps":"6-10","intensity":"RPE 7-8","rest_seconds":120}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"哑铃肩推","setName":"哑铃肩推","params":{"sets":3,"reps":"8-10","intensity":"RPE 7","rest_seconds":90}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"坐姿划船","setName":"坐姿划船","params":{"sets":3,"reps":"10-12","intensity":"RPE 7","rest_seconds":90}}
    ]},
    {"dayIndex":2,"type":"training","note":"下肢力量：深蹲和髋铰链。","actionSets":[
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"深蹲","setName":"深蹲","params":{"sets":4,"reps":"5-8","intensity":"RPE 7-8","rest_seconds":180}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"罗马尼亚硬拉","setName":"罗马尼亚硬拉","params":{"sets":4,"reps":"6-8","intensity":"RPE 7-8","rest_seconds":150}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"腿举","setName":"腿举","params":{"sets":3,"reps":"10-12","intensity":"RPE 8","rest_seconds":120}}
    ]},
    {"dayIndex":3,"type":"rest","note":"休息。","actionSets":[]},
    {"dayIndex":4,"type":"training","note":"上肢容量：控制离心和泵感。","actionSets":[
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"上斜卧推","setName":"上斜卧推","params":{"sets":4,"reps":"8-10","intensity":"RPE 8","rest_seconds":120}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"胸托划船","setName":"胸托划船","params":{"sets":4,"reps":"8-12","intensity":"RPE 8","rest_seconds":90}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"侧平举","setName":"侧平举","params":{"sets":3,"reps":"12-15","intensity":"RPE 8","rest_seconds":60}}
    ]},
    {"dayIndex":5,"type":"training","note":"下肢容量：臀腿后侧和单侧稳定。","actionSets":[
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"保加利亚分腿蹲","setName":"保加利亚分腿蹲","params":{"sets":3,"reps":"8-10/侧","intensity":"RPE 8","rest_seconds":120}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"臀推","setName":"臀推","params":{"sets":4,"reps":"8-12","intensity":"RPE 8","rest_seconds":120}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"腿弯举","setName":"腿弯举","params":{"sets":3,"reps":"12-15","intensity":"RPE 8","rest_seconds":60}}
    ]},
    {"dayIndex":6,"type":"rest","note":"休息。","actionSets":[]},
    {"dayIndex":7,"type":"rest","note":"完全休息。","actionSets":[]}
  ]
  $json$::jsonb;
  ppl_6d jsonb := $json$
  [
    {"dayIndex":1,"type":"training","note":"Push 推：胸肩三头。","actionSets":[
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"上斜卧推","setName":"上斜卧推","params":{"sets":4,"reps":"8-10","intensity":"RPE 7-8","rest_seconds":120}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"哑铃卧推","setName":"哑铃卧推","params":{"sets":3,"reps":"10-12","intensity":"RPE 8","rest_seconds":90}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"器械肩推","setName":"器械肩推","params":{"sets":3,"reps":"8-12","intensity":"RPE 8","rest_seconds":90}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"绳索下压","setName":"绳索下压","params":{"sets":3,"reps":"12-15","intensity":"RPE 8","rest_seconds":60}}
    ]},
    {"dayIndex":2,"type":"training","note":"Pull 拉：背二头。","actionSets":[
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"高位下拉","setName":"高位下拉","params":{"sets":4,"reps":"8-12","intensity":"RPE 8","rest_seconds":90}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"胸托划船","setName":"胸托划船","params":{"sets":4,"reps":"8-12","intensity":"RPE 8","rest_seconds":90}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"面拉","setName":"面拉","params":{"sets":3,"reps":"12-15","intensity":"RPE 7","rest_seconds":60}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"哑铃弯举","setName":"哑铃弯举","params":{"sets":3,"reps":"10-12","intensity":"RPE 8","rest_seconds":60}}
    ]},
    {"dayIndex":3,"type":"training","note":"Legs 腿：股四、臀腿后侧都覆盖。","actionSets":[
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"前蹲或深蹲","setName":"前蹲或深蹲","params":{"sets":4,"reps":"6-10","intensity":"RPE 8","rest_seconds":150}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"保加利亚分腿蹲","setName":"保加利亚分腿蹲","params":{"sets":3,"reps":"8-10/侧","intensity":"RPE 8","rest_seconds":120}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"臀推","setName":"臀推","params":{"sets":4,"reps":"8-12","intensity":"RPE 8","rest_seconds":120}}
    ]},
    {"dayIndex":4,"type":"rest","note":"休息或主动恢复。","actionSets":[]},
    {"dayIndex":5,"type":"training","note":"Push 推重复，尝试小幅加量。","actionSets":[
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"卧推","setName":"卧推","params":{"sets":4,"reps":"6-8","intensity":"RPE 8","rest_seconds":150}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"哑铃肩推","setName":"哑铃肩推","params":{"sets":3,"reps":"8-10","intensity":"RPE 8","rest_seconds":90}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"侧平举","setName":"侧平举","params":{"sets":4,"reps":"12-15","intensity":"RPE 8","rest_seconds":60}}
    ]},
    {"dayIndex":6,"type":"training","note":"Pull 拉重复，背部收缩优先。","actionSets":[
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"引体向上","setName":"引体向上","params":{"sets":4,"reps":"6-10","intensity":"RPE 8","rest_seconds":120}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"杠铃划船","setName":"杠铃划船","params":{"sets":4,"reps":"8","intensity":"RPE 8","rest_seconds":120}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"锤式弯举","setName":"锤式弯举","params":{"sets":3,"reps":"10-12","intensity":"RPE 8","rest_seconds":60}}
    ]},
    {"dayIndex":7,"type":"training","note":"Legs 腿重复，降低一点强度也可以。","actionSets":[
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"腿举","setName":"腿举","params":{"sets":4,"reps":"10-12","intensity":"RPE 8","rest_seconds":120}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"罗马尼亚硬拉","setName":"罗马尼亚硬拉","params":{"sets":3,"reps":"8-10","intensity":"RPE 8","rest_seconds":120}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"提踵","setName":"提踵","params":{"sets":4,"reps":"12-15","intensity":"RPE 8","rest_seconds":60}}
    ]}
  ]
  $json$::jsonb;
  power_5x5 jsonb := $json$
  [
    {"dayIndex":1,"type":"training","note":"5x5 A：主项动作可替换，按 1RM 或 RPE 设定重量。","actionSets":[
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"主项动作 A","setName":"主项动作 A","params":{"sets":5,"reps":"5","intensity":"75-80%","rest_seconds":180}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"水平推","setName":"水平推","params":{"sets":5,"reps":"5","intensity":"75-80%","rest_seconds":180}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"水平拉","setName":"水平拉","params":{"sets":4,"reps":"8","intensity":"RPE 7","rest_seconds":120}}
    ]},
    {"dayIndex":2,"type":"rest","note":"休息。","actionSets":[]},
    {"dayIndex":3,"type":"training","note":"5x5 B：主项动作可替换，保持动作质量。","actionSets":[
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"主项动作 B","setName":"主项动作 B","params":{"sets":5,"reps":"5","intensity":"75-80%","rest_seconds":180}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"垂直推","setName":"垂直推","params":{"sets":5,"reps":"5","intensity":"75-80%","rest_seconds":180}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"垂直拉","setName":"垂直拉","params":{"sets":4,"reps":"6-10","intensity":"RPE 7","rest_seconds":120}}
    ]},
    {"dayIndex":4,"type":"rest","note":"休息。","actionSets":[]},
    {"dayIndex":5,"type":"training","note":"5x5 C：略低强度或重复本周弱项。","actionSets":[
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"主项动作 C","setName":"主项动作 C","params":{"sets":5,"reps":"5","intensity":"70-77.5%","rest_seconds":180}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"辅助动作","setName":"辅助动作","params":{"sets":3,"reps":"8-10","intensity":"RPE 7","rest_seconds":120}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"核心稳定","setName":"核心稳定","params":{"sets":3,"reps":"30-45秒","intensity":"","rest_seconds":60}}
    ]},
    {"dayIndex":6,"type":"rest","note":"休息。","actionSets":[]},
    {"dayIndex":7,"type":"rest","note":"完全休息。","actionSets":[]}
  ]
  $json$::jsonb;
  running_4d jsonb := $json$
  [
    {"dayIndex":1,"type":"training","note":"轻松跑：全程能说完整句子。","actionSets":[
      {"type":"no-filter","itemType":"CARDIO","actionId":"","actionName":"轻松跑","setName":"轻松跑","params":{"sets":1,"reps":"30-45分钟","intensity":"Zone 2","rest_seconds":60}},
      {"type":"no-filter","itemType":"HABIT","actionId":"","actionName":"跑后拉伸","setName":"跑后拉伸","params":{"sets":1,"reps":"8分钟","intensity":"","rest_seconds":30}}
    ]},
    {"dayIndex":2,"type":"rest","note":"休息。","actionSets":[]},
    {"dayIndex":3,"type":"training","note":"间歇跑：快段不要冲刺。","actionSets":[
      {"type":"no-filter","itemType":"CARDIO","actionId":"","actionName":"热身慢跑","setName":"热身慢跑","params":{"sets":1,"reps":"10分钟","intensity":"轻松","rest_seconds":60}},
      {"type":"no-filter","itemType":"CARDIO","actionId":"","actionName":"间歇跑 6-8 组","setName":"间歇跑 6-8 组","params":{"sets":1,"reps":"20分钟","intensity":"快慢交替","rest_seconds":60}}
    ]},
    {"dayIndex":4,"type":"rest","note":"休息。","actionSets":[]},
    {"dayIndex":5,"type":"training","note":"轻松跑，积累有氧底盘。","actionSets":[
      {"type":"no-filter","itemType":"CARDIO","actionId":"","actionName":"轻松跑","setName":"轻松跑","params":{"sets":1,"reps":"35-50分钟","intensity":"Zone 2","rest_seconds":60}}
    ]},
    {"dayIndex":6,"type":"training","note":"长距离慢跑：重点是时间和稳定节奏。","actionSets":[
      {"type":"no-filter","itemType":"CARDIO","actionId":"","actionName":"长距离慢跑","setName":"长距离慢跑","params":{"sets":1,"reps":"50-80分钟","intensity":"Zone 2","rest_seconds":60}},
      {"type":"no-filter","itemType":"HABIT","actionId":"","actionName":"泡沫轴放松","setName":"泡沫轴放松","params":{"sets":1,"reps":"10分钟","intensity":"","rest_seconds":30}}
    ]},
    {"dayIndex":7,"type":"rest","note":"完全休息。","actionSets":[]}
  ]
  $json$::jsonb;
  calisthenics_4d jsonb := $json$
  [
    {"dayIndex":1,"type":"training","note":"街健基础：引体、双杠、核心。","actionSets":[
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"引体向上","setName":"引体向上","params":{"sets":4,"reps":"尽量多但不力竭","intensity":"RPE 8","rest_seconds":120}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"双杠臂屈伸","setName":"双杠臂屈伸","params":{"sets":4,"reps":"6-12","intensity":"RPE 8","rest_seconds":120}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"悬垂举腿","setName":"悬垂举腿","params":{"sets":3,"reps":"8-12","intensity":"","rest_seconds":90}}
    ]},
    {"dayIndex":2,"type":"rest","note":"休息。","actionSets":[]},
    {"dayIndex":3,"type":"training","note":"徒手容量：小空间也可完成。","actionSets":[
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"徒手深蹲","setName":"徒手深蹲","params":{"sets":4,"reps":"15-20","intensity":"RPE 7","rest_seconds":60}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"俯卧撑","setName":"俯卧撑","params":{"sets":4,"reps":"8-15","intensity":"RPE 7-8","rest_seconds":60}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"臀桥","setName":"臀桥","params":{"sets":4,"reps":"15-20","intensity":"RPE 7","rest_seconds":60}}
    ]},
    {"dayIndex":4,"type":"rest","note":"休息。","actionSets":[]},
    {"dayIndex":5,"type":"training","note":"街健专项重复，逐步提高总次数。","actionSets":[
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"引体向上","setName":"引体向上","params":{"sets":5,"reps":"3-8","intensity":"RPE 8","rest_seconds":120}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"双杠臂屈伸","setName":"双杠臂屈伸","params":{"sets":5,"reps":"5-10","intensity":"RPE 8","rest_seconds":120}},
      {"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"平板支撑","setName":"平板支撑","params":{"sets":3,"reps":"45秒","intensity":"","rest_seconds":60}}
    ]},
    {"dayIndex":6,"type":"training","note":"灵活性恢复。","actionSets":[
      {"type":"no-filter","itemType":"HABIT","actionId":"","actionName":"肩胛控制","setName":"肩胛控制","params":{"sets":1,"reps":"10分钟","intensity":"","rest_seconds":30}},
      {"type":"no-filter","itemType":"HABIT","actionId":"","actionName":"髋踝灵活性","setName":"髋踝灵活性","params":{"sets":1,"reps":"10分钟","intensity":"","rest_seconds":30}}
    ]},
    {"dayIndex":7,"type":"rest","note":"完全休息。","actionSets":[]}
  ]
  $json$::jsonb;
begin
  insert into public.public_training_plan_templates (
    slug, name, description, sport, goal, level, weeks, days_per_week, equipment, tags,
    suitable_for, audience, notes, training_days, template_kind, parameter_schema, action_slots, sort_order
  )
  values
    ('beginner-strength-3d','零基础力量 3 日入门','用全身训练建立深蹲、推、拉、髋铰链和核心控制。','力量训练','基础力量','beginner',4,3,array['哑铃','杠铃可选','器械可替代'],array['新手','全身训练','基础动作'],'beginner','0-6 个月训练经验，希望先学会稳定动作和固定训练节奏。',array['每周优先完成 3 次主训练。','所有动作保留余力，不需要做到力竭。'],full_body_3d,'fixed','{}','[]',10),
    ('beginner-gym-machine','器械新手 3 日','用固定器械建立训练节奏，降低动作学习门槛。','力量训练','器械入门','beginner',4,3,array['固定器械','哑铃'],array['器械','新手'],'beginner','刚开始去健身房，希望先安全熟悉器械的人。',array['重量从轻开始。','每个动作先找到目标肌肉发力。'],full_body_3d,'fixed','{}','[]',20),
    ('beginner-posture-fix','体态改善 3 日','围绕核心、背部和灵活性改善久坐后的紧张与无力。','功能训练','体态改善','beginner',4,3,array['瑜伽垫','弹力带可选'],array['体态','核心','久坐'],'beginner','久坐、肩颈背紧张，希望从低门槛训练开始的人。',array['动作疼痛时停止。','优先完成灵活性和核心控制。'],full_body_3d,'fixed','{}','[]',30),
    ('beginner-home-bodyweight','居家徒手 3 日','不依赖健身房，用徒手动作完成全身训练。','徒手训练','居家训练','beginner',4,3,array['瑜伽垫'],array['居家','徒手','零器械'],'beginner','时间碎片化、暂时没有器械或不方便去健身房的人。',array['动作标准优先。','可用背包增加难度。'],calisthenics_4d,'fixed','{}','[]',40),
    ('beginner-fat-loss-home','居家减脂 4 日','用徒手与低冲击循环提升消耗。','徒手训练','居家减脂','beginner',4,4,array['瑜伽垫','弹力带可选'],array['居家','减脂'],'beginner','希望在家先建立减脂运动习惯的人。',array['心率上来即可，不需要冲刺。','保持轻微热量缺口。'],fat_loss_4d,'fixed','{}','[]',50),
    ('fat-loss-starter-4d','减脂塑形 4 日基础','力量训练配合低冲击有氧，提升消耗同时保留肌肉量。','综合体能','减脂塑形','beginner',4,4,array['哑铃','壶铃','跑步机可选'],array['减脂','塑形','有氧'],'beginner','希望降低体脂、改善体态，但不想一上来做高强度冲刺的人。',array['训练日之间尽量间隔 1 天。','饮食保持轻微热量缺口。'],fat_loss_4d,'fixed','{}','[]',60),
    ('beginner-women-shape','女生塑形 4 日基础','围绕臀腿、上肢线条和低强度有氧建立基础塑形节奏。','综合体能','塑形','beginner',4,4,array['哑铃','固定器械'],array['塑形','臀腿'],'beginner','希望提升臀腿和全身线条的新手。',array['不要只练局部，力量和有氧都要保留。'],fat_loss_4d,'fixed','{}','[]',70),
    ('beginner-office-relief','久坐缓解 3 日','用灵活性、背部和核心训练缓解久坐不适。','功能训练','久坐缓解','beginner',4,3,array['瑜伽垫','弹力带'],array['久坐','灵活性'],'beginner','长期伏案、肩颈腰背紧张的人。',array['每天可额外散步 20 分钟。'],full_body_3d,'fixed','{}','[]',80),
    ('beginner-joint-friendly','关节友好入门','低冲击训练，适合先恢复运动习惯。','功能训练','低冲击','beginner',4,3,array['固定器械','瑜伽垫'],array['低冲击','关节友好'],'beginner','体重较大或膝踝不适，需要温和开始的人。',array['避免跳跃。','疼痛动作直接替换。'],full_body_3d,'fixed','{}','[]',90),
    ('running-5k-starter','5K 跑步入门','从轻松跑和走跑结合开始，逐步建立能连续跑完 5K 的基础。','跑步','5K 入门','beginner',6,4,array['跑鞋'],array['跑步','5K','心肺'],'beginner','能快走 30 分钟，希望开始跑步但担心强度太大的人。',array['宁可慢一点，也不要每次跑到喘爆。','小腿紧张时增加拉伸和休息。'],running_4d,'fixed','{}','[]',100),
    ('upper-lower-4d','上/下肢 4 日进阶','用上肢、下肢分化提升训练容量。','力量训练','力量与增肌','intermediate',6,4,array['杠铃','哑铃','固定器械'],array['上肢下肢','进阶','增肌'],'intermediate','已经能稳定训练 3 个月以上，希望提高单周容量。',array['主项可逐周小幅加重。','恢复差时先减少辅助动作组数。'],upper_lower_4d,'fixed','{}','[]',110),
    ('classic-hypertrophy-4d','经典增肌 4 日','以复合动作为骨架，配合孤立动作提高肌肥大容量。','健美增肌','肌肥大','intermediate',6,4,array['完整健身房'],array['增肌','四分化'],'intermediate','有基础动作经验，希望系统增肌的人。',array['大动作保留 1-2 次余力。','孤立动作可接近力竭。'],upper_lower_4d,'fixed','{}','[]',120),
    ('ppl-6d-hypertrophy','Push Pull Legs 6 日增肌','高频分化增肌模板，覆盖胸肩三头、背二头、腿臀核心。','健美增肌','肌肥大','intermediate',6,6,array['完整健身房'],array['PPL','增肌','高频'],'intermediate','每周能训练 5-6 天，且已有稳定动作基础的人。',array['不要每组力竭。','睡眠不足时改成 PPL 休 PPL。'],ppl_6d,'fixed','{}','[]',130),
    ('glute-leg-4d','臀腿强化 4 日','围绕深蹲、分腿蹲、臀推和后侧链加强臀腿。','健美增肌','臀腿','intermediate',6,4,array['杠铃','哑铃','固定器械'],array['臀腿','下肢'],'intermediate','希望强化臀腿围度和力量的人。',array['注意膝盖轨迹和骨盆稳定。'],upper_lower_4d,'fixed','{}','[]',140),
    ('pullup-focus','引体向上提升','通过专项容量和背部力量提高引体能力。','街健','引体专项','intermediate',6,4,array['单杠','弹力带可选'],array['引体','背部'],'intermediate','能做 1-5 个引体，希望提高次数的人。',array['不足时用弹力带辅助。','每组不要完全力竭。'],calisthenics_4d,'fixed','{}','[]',150),
    ('dip-focus','双杠臂屈伸提升','强化推力链和双杠动作容量。','街健','双杠专项','intermediate',6,4,array['双杠','单杠'],array['双杠','推力'],'intermediate','希望提高双杠臂屈伸和上肢推力的人。',array['肩肘不适时降低容量。'],calisthenics_4d,'fixed','{}','[]',160),
    ('calisthenics-base-4d','街健基础 4 日','围绕引体、双杠、俯卧撑和核心建立街健基本能力。','街健','自重力量','intermediate',6,4,array['单杠','双杠'],array['街健','引体','双杠'],'intermediate','能完成基础俯卧撑，希望提高引体和双杠能力的人。',array['动作范围完整比数量更重要。'],calisthenics_4d,'fixed','{}','[]',170),
    ('running-10k-build','10K 跑步进阶','通过轻松跑、间歇和长距离慢跑提高 10K 完成能力。','跑步','10K','intermediate',8,4,array['跑鞋','心率表可选'],array['跑步','10K','耐力'],'intermediate','已经能连续跑 5K，希望准备 10K 或提升有氧能力。',array['长跑日不要追配速。','总跑量每周最多小幅增加。'],running_4d,'fixed','{}','[]',180),
    ('10k-speed','10K 配速提升','在保留轻松跑的基础上加入间歇刺激。','跑步','速度耐力','intermediate',8,4,array['跑鞋'],array['跑步','配速'],'intermediate','能完成 10K，希望提升配速的人。',array['快段保持均匀。','不要连续安排高强度跑。'],running_4d,'fixed','{}','[]',190),
    ('soccer-conditioning','足球体能基础','变速跑、下肢力量和基础心肺结合。','球类体能','变速耐力','intermediate',6,4,array['跑鞋','哑铃可选'],array['足球','体能'],'intermediate','踢球频率较高，希望补充体能训练的人。',array['比赛日前一天降低强度。'],running_4d,'fixed','{}','[]',200),
    ('basketball-conditioning','篮球体能基础','下肢力量、弹跳基础和间歇体能结合。','球类体能','弹跳体能','intermediate',6,4,array['哑铃','球场'],array['篮球','弹跳'],'intermediate','希望提升篮球专项体能和下肢基础的人。',array['落地缓冲优先于跳得更高。'],upper_lower_4d,'fixed','{}','[]',210),
    ('kettlebell-conditioning','壶铃全身体能','用壶铃动作建立全身力量耐力。','综合体能','壶铃训练','intermediate',6,4,array['壶铃'],array['壶铃','全身'],'intermediate','想用少量器械做高效全身训练的人。',array['摆动类动作先学会髋铰链。'],fat_loss_4d,'fixed','{}','[]',220),
    ('rowing-conditioning','划船机体能 4 日','力量训练配合划船机，提高心肺和后侧链耐力。','综合体能','心肺体能','intermediate',6,4,array['划船机','哑铃'],array['划船机','体能'],'intermediate','有划船机条件，希望提升心肺能力的人。',array['保持划船技术，不要只追瓦数。'],fat_loss_4d,'fixed','{}','[]',230),
    ('strength-5x5-parameterized','5x5 力量模板（可替换动作）','5x5 不是固定动作，而是一套组次数和强度结构，可套用到深蹲、卧推、推举、引体或划船等项目。','力量训练','5x5 模板','intermediate',8,3,array['杠铃','哑铃','自重动作可选'],array['5x5','力量','可参数化'],'intermediate','已经掌握基础动作，希望用 5x5 结构推进力量的人。',array['主项动作可以替换。','后续应结合用户 1RM 或 RPE 自动换算重量。'],power_5x5,'parameterized','{"progression":"5x5","supports1RM":true,"loadInputs":[{"slotKey":"main_lift_a","label":"主项 A 1RM","type":"one_rm"},{"slotKey":"main_lift_b","label":"主项 B 1RM","type":"one_rm"},{"slotKey":"main_lift_c","label":"主项 C 1RM","type":"one_rm"}]}'::jsonb,'[{"key":"main_lift_a","label":"主项动作 A","defaultActionName":"深蹲"},{"key":"main_lift_b","label":"主项动作 B","defaultActionName":"卧推"},{"key":"main_lift_c","label":"主项动作 C","defaultActionName":"硬拉或引体"}]'::jsonb,240),
    ('powerlifting-5x5','力量举 5x5 基础','围绕深蹲、卧推、硬拉建立基础力量。','力量举','三大项力量','intermediate',8,3,array['杠铃','深蹲架','卧推凳'],array['力量举','5x5','三大项'],'intermediate','已经掌握三大项技术，想提高基础力量的人。',array['主项重量不要跳太快。','动作变形时优先降重。'],power_5x5,'parameterized','{"progression":"5x5","supports1RM":true}'::jsonb,'[{"key":"main_lift_a","label":"深蹲","defaultActionName":"深蹲"},{"key":"main_lift_b","label":"卧推","defaultActionName":"卧推"},{"key":"main_lift_c","label":"硬拉","defaultActionName":"硬拉"}]'::jsonb,250),
    ('texas-method-intro','Texas Method 入门','用容量日、恢复日、强度日组织基础力量进阶。','力量训练','力量进阶','advanced',6,3,array['杠铃','深蹲架','卧推凳'],array['Texas Method','力量','进阶周期'],'advanced','线性加重变慢，且能稳定掌握深蹲卧推硬拉的人。',array['容量日不要超出恢复能力。','恢复日真的要轻。'],power_5x5,'parameterized','{"progression":"volume_recovery_intensity","supports1RM":true}'::jsonb,'[{"key":"squat","label":"深蹲类动作","defaultActionName":"深蹲"},{"key":"press","label":"推类动作","defaultActionName":"卧推"},{"key":"pull","label":"拉类动作","defaultActionName":"硬拉"}]'::jsonb,260),
    ('dup-strength-4d','DUP 力量 4 日','同一周内安排容量、力量和技术刺激。','力量训练','DUP 周期','advanced',6,4,array['完整健身房'],array['DUP','力量','周期化'],'advanced','已有周期训练经验，希望更细地管理强度和容量的人。',array['不同训练日目标不同。','记录 RPE 和恢复反馈。'],upper_lower_4d,'parameterized','{"progression":"dup","supports1RM":true}'::jsonb,'[]'::jsonb,270),
    ('powerbuilding-4d','Powerbuilding 4 日','力量主项与健美容量结合。','力量与健美','力量增肌','advanced',6,4,array['完整健身房'],array['力量','增肌'],'advanced','既想提高主项力量，又想保留增肌容量的人。',array['主项不要力竭。','辅助动作按肌肉感受推进。'],upper_lower_4d,'fixed','{}','[]',280),
    ('bench-specialization','卧推专项 4 日','提高卧推技术、容量和推力链。','力量举','卧推专项','advanced',6,4,array['杠铃','卧推凳'],array['卧推','专项'],'advanced','卧推进入平台期，想做短期专项的人。',array['肩肘不适时减少窄握和大重量。'],power_5x5,'parameterized','{"progression":"bench_specialization","supports1RM":true}'::jsonb,'[{"key":"main_lift_a","label":"比赛卧推","defaultActionName":"卧推"}]'::jsonb,290),
    ('squat-specialization','深蹲专项 4 日','提高深蹲技术、容量和下肢支撑。','力量举','深蹲专项','advanced',6,4,array['杠铃','深蹲架'],array['深蹲','专项'],'advanced','深蹲进入平台期，想做短期专项的人。',array['保持深度和躯干稳定。'],power_5x5,'parameterized','{"progression":"squat_specialization","supports1RM":true}'::jsonb,'[{"key":"main_lift_a","label":"比赛深蹲","defaultActionName":"深蹲"}]'::jsonb,300),
    ('deadlift-specialization','硬拉专项 3 日','提高硬拉启动、锁定和后侧链能力。','力量举','硬拉专项','advanced',6,3,array['杠铃'],array['硬拉','专项'],'advanced','硬拉进入平台期，想做短期专项的人。',array['硬拉恢复压力大，避免额外堆太多容量。'],power_5x5,'parameterized','{"progression":"deadlift_specialization","supports1RM":true}'::jsonb,'[{"key":"main_lift_a","label":"比赛硬拉","defaultActionName":"硬拉"}]'::jsonb,310),
    ('half-marathon-base','半马基础准备','用 4 跑日结构积累半马所需的有氧耐力和节奏控制。','跑步','半马','advanced',10,4,array['跑鞋','心率表可选'],array['跑步','半马','耐力'],'advanced','能稳定完成 10K，准备半马或更长距离的人。',array['长跑日是核心，但不要每周都跑崩。','轻松跑占大多数。'],running_4d,'fixed','{}','[]',320),
    ('hybrid-athlete','混合体能运动员','力量训练与跑步体能结合。','综合体能','力量耐力','advanced',8,5,array['完整健身房','跑鞋'],array['混合体能','力量耐力'],'advanced','希望同时保持力量和耐力表现的人。',array['不要让跑步影响关键力量日恢复。'],upper_lower_4d,'fixed','{}','[]',330),
    ('bodybuilding-5d','健美五分化增肌','更高容量的专业增肌安排。','健美增肌','专业增肌','advanced',6,5,array['完整健身房'],array['健美','五分化'],'advanced','恢复能力较好、每周可训练 5 天的人。',array['注意总量管理。','第 4-6 周可安排降量。'],ppl_6d,'fixed','{}','[]',340)
  on conflict (slug) do update set
    name = excluded.name,
    description = excluded.description,
    sport = excluded.sport,
    goal = excluded.goal,
    level = excluded.level,
    weeks = excluded.weeks,
    days_per_week = excluded.days_per_week,
    equipment = excluded.equipment,
    tags = excluded.tags,
    suitable_for = excluded.suitable_for,
    audience = excluded.audience,
    notes = excluded.notes,
    training_days = excluded.training_days,
    template_kind = excluded.template_kind,
    parameter_schema = excluded.parameter_schema,
    action_slots = excluded.action_slots,
    status = 'published',
    sort_order = excluded.sort_order,
    updated_at = now();
end $$;
