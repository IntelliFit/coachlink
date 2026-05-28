with specialty_templates as (
  select *
  from (values
    (
      'weighted-dip-8w-strength',
      '负重双杠臂屈伸 8 周提升',
      '围绕负重双杠、卧推变式、肩胛稳定和肱三头辅助提高上肢推力。',
      '街健力量',
      '负重双杠',
      'advanced',
      8,
      3,
      array['双杠','负重腰带','杠铃或哑铃'],
      array['负重双杠','双杠','街健','推力'],
      'advanced',
      '自重双杠能稳定完成 10 次以上，想提升负重双杠力量的人。',
      array['肩前侧夹痛时停止深幅度双杠。','双杠深度以肩部舒适和胸肩控制为准。'],
      'weighted_dip',
      '负重双杠',
      50,
      1050,
      '[{"key":"weighted_dip","label":"负重双杠","defaultActionName":"负重双杠臂屈伸"}]'::jsonb,
      '[{"dayIndex":1,"type":"training","note":"负重双杠容量日。","actionSets":[{"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"负重双杠臂屈伸","setName":"负重双杠臂屈伸","params":{"sets":5,"reps":"5","intensity":"RPE 7-8","rest_seconds":180}},{"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"窄握卧推","setName":"窄握卧推","params":{"sets":4,"reps":"6-8","intensity":"RPE 7-8","rest_seconds":150}},{"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"面拉","setName":"面拉","params":{"sets":3,"reps":"15-20","intensity":"RPE 7","rest_seconds":60}}]},{"dayIndex":2,"type":"rest","note":"休息。","actionSets":[]},{"dayIndex":3,"type":"training","note":"上肢推拉平衡。","actionSets":[{"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"卧推","setName":"卧推","params":{"sets":4,"reps":"5","intensity":"RPE 7","rest_seconds":150}},{"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"引体向上","setName":"引体向上","params":{"sets":4,"reps":"6-10","intensity":"RPE 8","rest_seconds":120}},{"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"绳索下压","setName":"绳索下压","params":{"sets":3,"reps":"12-15","intensity":"RPE 8","rest_seconds":60}}]},{"dayIndex":4,"type":"rest","note":"休息。","actionSets":[]},{"dayIndex":5,"type":"training","note":"负重双杠强度日。","actionSets":[{"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"负重双杠臂屈伸","setName":"负重双杠臂屈伸","params":{"sets":6,"reps":"2-3","intensity":"RPE 8-9","rest_seconds":210}},{"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"哑铃卧推","setName":"哑铃卧推","params":{"sets":3,"reps":"8-10","intensity":"RPE 8","rest_seconds":90}},{"type":"no-filter","itemType":"STRENGTH","actionId":"","actionName":"俯卧撑","setName":"慢速俯卧撑","params":{"sets":3,"reps":"8-12","intensity":"RPE 7","rest_seconds":90}}]},{"dayIndex":6,"type":"rest","note":"肩胛控制或轻松活动。","actionSets":[]},{"dayIndex":7,"type":"rest","note":"完全休息。","actionSets":[]}]'::jsonb
    )
  ) as t(slug, name, description, sport, goal, level, weeks, days_per_week, equipment, tags, suitable_for, audience, notes, specialty_key, specialty_label, specialty_priority, sort_order, action_slots, training_days)
)
insert into public.public_training_plan_templates (
  slug, name, description, sport, goal, level, weeks, days_per_week, equipment, tags,
  suitable_for, audience, notes, specialty_key, specialty_label, specialty_priority,
  training_days, template_kind, parameter_schema, action_slots, status, sort_order
)
select
  slug,
  name,
  description,
  sport,
  goal,
  level,
  weeks,
  days_per_week,
  equipment,
  tags,
  suitable_for,
  audience,
  notes,
  specialty_key,
  specialty_label,
  specialty_priority,
  training_days,
  case when jsonb_array_length(action_slots) > 0 then 'parameterized' else 'fixed' end,
  case when jsonb_array_length(action_slots) > 0 then '{"supports1RM":true}'::jsonb else '{}'::jsonb end,
  action_slots,
  'published',
  sort_order
from specialty_templates
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
  specialty_key = excluded.specialty_key,
  specialty_label = excluded.specialty_label,
  specialty_priority = excluded.specialty_priority,
  training_days = excluded.training_days,
  template_kind = excluded.template_kind,
  parameter_schema = excluded.parameter_schema,
  action_slots = excluded.action_slots,
  status = 'published',
  sort_order = excluded.sort_order,
  updated_at = now();
