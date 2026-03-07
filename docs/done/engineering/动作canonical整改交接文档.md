# 动作 canonical 整改交接文档

## 背景与问题定义

当前系统中同一业务动作可能在不同表出现“同名不同 ID”：

- `coach_actions`
- `student_actions`
- `personal_records_history`（历史记录中的 `action_id`）

这会导致：

1. 力量曲线下拉出现同名项，选中后可能“无数据”。
2. 1RM 回填命中率低（按 ID 匹配时漏掉同名异 ID）。
3. 教练计划动作同步到学员动作库后，长期可能继续累积重复。

核心原因：历史阶段未把 `canonical_action_id` 作为强约束业务主键。

---

## 本次已完成（已落地）

## 1) 同步链路补齐（新增计划动作 -> 学员动作库）

- 已在多入口触发同步：
  - `create-instance`
  - `update-instance`
  - `get-instance`
  - `get-today-training-instance`
- 同步逻辑文件：
  - `src/app/api/plan-lib/sync-actions.ts`

说明：已从“直接 upsert”改为“先查已存在再插入缺失”，降低对 DB 唯一约束依赖。

## 2) 教练端 1RM 面板修复

- 文件：`src/app/dashboard/students/plan/[id]/components/CoachOneRMConfigPanel.tsx`
- 修复点：由“数组 index 对齐”改为“canonical/name 匹配”，避免动作和值错位写入。

## 3) 力量曲线同名空数据修复（关键）

- 前端：
  - `src/components/student/profile/E1RMProgressChart.tsx`
  - 请求历史时同时传 `actionId + actionName`
- 后端：
  - `src/app/api/student/get-e1rm-history/route.ts`
  - 动作元信息查询增加 `coach_actions -> student_actions` 双源兜底
- 下拉去重：
  - `src/app/api/student/get-available-actions/route.ts`
  - 从按 `action_id` 去重改为按“归一化动作名”去重（展示层）

---

## 数据侧一次性回填（已准备/部分已执行）

## 1) 历史动作补齐到学员库

- 文件：`supabase/migrations/20260214_backfill_student_actions_from_coach_plan_instances.sql`
- 目的：把历史教练计划中出现但学员库缺失的动作补齐（仅补缺失）。

## 2) 1RM 回填 v1（存在缺陷，不再建议）

- 文件：`supabase/migrations/20260214_backfill_student_actions_reference_1rm.sql`
- 问题：
  - 排除 `AUTO_STATE`
  - 过度依赖 `PR.action_id = student_actions.id`

## 3) 1RM 回填 v2（当前建议执行）

- 文件：`supabase/migrations/20260214_backfill_student_actions_reference_1rm_v2.sql`
- 规则：
  - 只填 `reference_1rm is null`（不覆盖已有）
  - 仅资格动作（STRENGTH + 强度 + 自动计算）
  - 优先非 `AUTO_STATE`
  - 若无非 `AUTO_STATE`，用“最新 `AUTO_STATE`”兜底
  - 问卷支持 `action_id` 与动作名双匹配

---

## 为什么会出现“同名不同 ID”

1. 历史新增流程是“插入新记录生成新 ID”，未强制复用 canonical。
2. 多来源表（教练库/学员库/历史记录）各自存储，未统一业务主键。
3. 早期数据缺少 `canonical_action_id`，查询只能靠 `action_id` 或名字兜底。

---

## 后续整改总策略（必须两步走）

## 第一步：先关口（防止新增脏数据）

目标：从现在起不再产生同名多 ID 的业务歧义。

- 新增/导入动作时必须确定 `canonical_action_id`
- 同域名称唯一（至少在应用层强校验）：
  - 公共库：name 唯一
  - 教练库：`(coach_id, normalized_name)` 唯一
  - 学员库：`(user_id, normalized_name)` 唯一
- 说明：**新增动作防重仅在同域内成立**。不同教练/学员之间允许同名动作并存（描述和细节可能不同）。
- 但在“canonical 归并/赋ID”阶段需要**跨域全局视角**处理（教练库/学员库/公共库联动），因为动作存在流通链路（个人 -> 公共 -> 他人添加）。
- 查询/图表按 canonical 聚合，名称兜底仅过渡

## 第二步：再清洗存量

目标：把现有重复动作归并到 canonical 体系。

- 先 dry-run 产出“可自动合并/需人工确认”清单
- 回填 `canonical_action_id`
- 去重（保留主记录，其他记录归档或迁移引用）
- 回归测试：动作库、计划编辑、执行页、力量曲线

### 自动合并优先规则（新增）

- 合并范围：**跨域全量候选**（`coach_actions` + `student_actions` + `community_actions`）。
- 若候选动作在关键属性上完全一致，可直接判定为同一动作并自动合并：
  - `normalized_name`
  - `type`
  - `positions`
  - `attrs`
  - `item_schema`
  - `suggested_time`
  - `enableAutoWeightCompute`
  - `includesBodyWeight`
- 若名称一致但任一关键属性不一致，进入“人工确认”队列，不做自动合并。
- 结论：**“新增去重”与“存量归并”是两套边界**：
  - 新增去重：同域约束；
  - 存量归并：跨域统一 canonical。

---

## 下一窗口建议执行顺序

1. 先完成“第一步关口”代码与约束（新增逻辑）
2. 再做 dry-run 归并报告（不写库）
3. 人工确认边界案例后执行正式归并
4. 跑全链路回归

---

## 快速核验 SQL（交接可直接用）

## A. 活跃计划动作是否在学员库有缺失

```sql
with active_plan_actions as (
  select
    cpi.id as instance_id,
    coalesce(cpi.student_id, cs.student_id) as student_id,
    coalesce(aset->>'action_id', aset->>'actionId') as coach_action_id_text
  from public.coach_plan_instances cpi
  left join public.coach_subscriptions cs on cs.id = cpi.coach_subscription_id
  cross join lateral jsonb_array_elements(coalesce(cpi.training_days, '[]'::jsonb)) d
  cross join lateral jsonb_array_elements(coalesce(d->'actionSets', '[]'::jsonb)) aset
  where cpi.status = 'active'
),
normalized as (
  select distinct
    apa.instance_id,
    apa.student_id,
    (apa.coach_action_id_text)::uuid as coach_action_id
  from active_plan_actions apa
  where apa.student_id is not null
    and apa.coach_action_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
),
missing as (
  select
    n.instance_id,
    n.student_id,
    ca.id as coach_action_id,
    ca.name
  from normalized n
  join public.coach_actions ca on ca.id = n.coach_action_id
  where not exists (
    select 1
    from public.student_actions sa
    where sa.user_id = n.student_id
      and (
        (ca.canonical_action_id is not null and sa.canonical_action_id = ca.canonical_action_id)
        or lower(trim(sa.name)) = lower(trim(ca.name))
      )
  )
)
select
  count(*) as missing_action_refs,
  count(distinct instance_id) as affected_active_instances,
  count(distinct student_id) as affected_students
from missing;
```

## B. 单学员单动作 1RM 回填核验（按手机号）

将手机号和动作名替换后执行：

```sql
with target as (
  select u.id as user_id
  from public.users u
  where u.phone = '13621820336'
  limit 1
)
select sa.id, sa.name, sa.reference_1rm, sa.updated_at
from public.student_actions sa
join target t on t.user_id = sa.user_id
where lower(trim(sa.name)) = lower(trim('负重引体（底部暂停）'));
```


