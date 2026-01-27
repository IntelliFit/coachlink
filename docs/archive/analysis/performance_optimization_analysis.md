# 页面加载性能优化分析报告

> **文档类型**: 技术分析报告\
> **创建日期**: 2026-01-18\
> **关联页面**: `/coach/plans`, `/today-training`, `/training-execution`,
> `/me/profile`, `/dashboard/students`

---

## 目录

1. [问题概览](#问题概览)
2. [受影响页面分析](#受影响页面分析)
3. [API 层面问题](#api-层面问题)
4. [数据库层面分析](#数据库层面分析)
5. [前端层面问题](#前端层面问题)
6. [优化建议汇总](#优化建议汇总)
7. [实施优先级](#实施优先级)
8. [预期收益](#预期收益)

---

## 问题概览

### 性能问题严重程度评估

| 页面                       | 严重程度      | 主要问题                             | 影响范围 |
| -------------------------- | ------------- | ------------------------------------ | -------- |
| `/coach/plans`             | 🔴 很慢       | 5+ 串行 API 调用、重复 instance 查询 | 所有学员 |
| `/today-training`          | 🔴 很慢       | 4+ 串行 API 调用                     | 所有学员 |
| `/training-execution/[id]` | 🟡 中等       | 2 API 调用、大 JSONB 数据量          | 训练时   |
| `/me/profile`              | 🟡 中等       | 3+ API 调用                          | 所有学员 |
| `/dashboard/students`      | 🟡 多学员时慢 | N+1 查询模式                         | 教练     |

### 问题根源分类

```
┌─────────────────────────────────────────────────────────────────┐
│                       性能瓶颈分布                               │
├─────────────────────────────────────────────────────────────────┤
│  ■■■■■■■■■■■■■■■■  API 调用次数过多 (40%)                        │
│  ■■■■■■■■■■■■      N+1 查询问题 (30%)                            │
│  ■■■■■■■■         串行请求未并行 (20%)                           │
│  ■■■■             调试代码/日志开销 (10%)                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 受影响页面分析

### 1. `/coach/plans` 学员计划查看页面

**文件位置**: `src/app/coach/plans/page.tsx`

**当前请求时序**:

```
Time(ms)  0    200   400   600   800   1000  1200  1400
          │     │     │     │     │     │     │     │
          ├─────┤ getCoachSubscriptions
          │     ├─────┤ getInstance (coach plan)
          │     ├─────┤ getInstance (self plan)
          │           ├─────┤ getWithExecutions
          │                 ├─────┤ get-next-training-day
          │                       ├─────┤ get-next-training-day (self)
          Total: ~1400ms (串行)
```

**主要问题**:

1. `loadSelfPlan` 和 `loadInstance` 分别调用，但可以并行
2. `getInstance` 已返回 executions，`getWithExecutions` 重复获取
3. `get-next-training-day` 单独调用但数据已在 instance 中

**代码定位**:

```typescript
// src/app/coach/plans/page.tsx, lines 46-166
// load() → 获取订阅列表
// loadSelfPlan() → 获取自建计划 + 执行记录 + nextDayIndex
// loadInstance() → 获取教练计划 + 执行记录 + nextDayIndex
```

---

### 2. `/today-training` 今日训练页面

**文件位置**: `src/app/today-training/page.tsx`

**当前请求时序**:

```
Time(ms)  0    200   400   600   800   1000
          │     │     │     │     │     │
          ├─────┤ getCoachSubscriptions
          │     ├─────┼─────┤ getInstance × 2 (并行)
          │                 ├─────┤ get-next-training-day
          │                       ├─────┤ get-next-training-day
          Total: ~1000ms
```

**主要问题**:

1. `get-next-training-day` 在 instance 返回后才调用（可在后端合并）
2. 两个 `get-next-training-day` 调用可以并行但目前是串行

**代码定位**:

```typescript
// src/app/today-training/page.tsx, lines 67-160
// loadData() 函数包含所有数据加载逻辑
```

---

### 3. `/dashboard/students` 学员管理页面

**文件位置**: `src/app/dashboard/students/page.tsx`

**问题模式**: N+1 查询

```
┌─────────────────────────────────────────────────────────────────┐
│                    学员列表加载流程                              │
├─────────────────────────────────────────────────────────────────┤
│  1. 获取订阅列表 (1 query)                                       │
│  2. 获取用户档案 (1 query, IN clause)                            │
│  3. 每个学员获取视频统计 (N queries) ← 问题                      │
│  4. 每个学员获取计划数据 (2N queries) ← 问题                     │
├─────────────────────────────────────────────────────────────────┤
│  假设 20 个学员: 2 + 20 + 40 = 62 queries                        │
│  假设 100 个学员: 2 + 100 + 200 = 302 queries                    │
└─────────────────────────────────────────────────────────────────┘
```

**代码定位**:

```typescript
// src/app/api/coach/list-students/route.ts
// getVideoStats() - lines 13-39: N 次视频统计查询
// getStudentPlanData() - lines 41-81: 2N 次计划查询
```

---

### 4. `/me/profile` 学员个人档案页面

**文件位置**: `src/components/student/StudentProfilePage.tsx`

**当前请求时序**:

```typescript
// fetchData() - lines 46-127
const [profileRes, subsRes] = await Promise.all([
    studentService.getStudentProfile(session?.user.id), // 1 API
    subscriptionService.getCoachSubscriptions({ studentId }), // 2 API
]);
// 然后串行调用:
const instanceRes = await planLibService.getInstance({ subscriptionId }); // 3 API
```

**问题**: 第 3 个请求依赖第 2 个结果，无法完全并行

---

### 5. `/training-execution/[instanceId]` 训练执行页面

**文件位置**: `src/app/training-execution/[instanceId]/page.tsx`

**当前请求时序**:

```typescript
// startTraining() - lines 172-219
const instanceRes = await planLibService.getInstance({ id: instanceId }); // 1 API
const res = await executionService.startExecution({ instanceId, dayIndex }); // 2 API
```

**问题**:

- `getInstance` 返回完整数据包括 actions 和 executions
- `startExecution` 可能在服务端获取相同数据

---

## API 层面问题

### 问题 1: `get-instance` API 存在冗余查询

**文件**: `src/app/api/plan-lib/get-instance/route.ts`

**问题清单**:

| 问题     | 行号         | 描述                                    | 影响         |
| -------- | ------------ | --------------------------------------- | ------------ |
| 调试代码 | 25-41        | 生产环境保留 DEBUG 查询                 | +1 query     |
| 调试日志 | 63-65, 77-82 | console.log 影响性能                    | 微小         |
| 分次查询 | 169-199      | coach_actions 和 student_actions 分两次 | +1 query     |
| 权限检查 | 107-136      | 可能需要 2-3 次额外查询                 | +2-3 queries |

**当前查询序列** (最坏情况):

```sql
-- 1. DEBUG: 列出用户计划 (冗余，应删除)
SELECT id, status, source, updated_at, name 
FROM coach_plan_instances WHERE student_id = ? LIMIT 5;

-- 2. 获取计划实例
SELECT * FROM coach_plan_instances WHERE id = ?;

-- 3. 权限检查 - 教练身份
SELECT user_id FROM coaches WHERE id = ?;

-- 4. 权限检查 - 订阅关系 (如果教练检查失败)
SELECT student_id FROM coach_subscriptions WHERE id = ?;

-- 5. 获取教练动作
SELECT * FROM coach_actions WHERE id IN (...);

-- 6. 获取学员动作 (剩余 ID)
SELECT * FROM student_actions WHERE id IN (...);

-- 7. 获取执行记录 (嵌套 JOIN)
SELECT pie.*, 
       ae.*, 
       es.*, 
       esv.*
FROM plan_instance_executions pie
LEFT JOIN action_executions ae ON ...
LEFT JOIN execution_sets es ON ...
LEFT JOIN execution_set_videos esv ON ...
WHERE pie.plan_instance_id = ?;
```

**总计**: 5-7 次查询/请求

---

### 问题 2: `list-students` API 的 N+1 模式

**文件**: `src/app/api/coach/list-students/route.ts`

**getVideoStats 函数分析** (lines 13-39):

```typescript
// 当前实现: 为每个学员单独查询
const tasks = studentIds.map((id) =>
    limitController(async () => {
        const { data: videos } = await supabase
            .from("training_videos")
            .select("coach_feedback")
            .in("user_id", [id]); // ← 每个学员一次查询
        // ...
    })
);
```

**getStudentPlanData 函数分析** (lines 41-81):

```typescript
// 每个学员 2 次查询
async function getStudentPlanData(coachId: string, studentId: string) {
    // Query 1: 获取计划实例
    const { data: planInstance } = await supabase
        .from("coach_plan_instances")
        .select(...)
        .eq("coach_id", coachId)
        .eq("student_id", studentId);

    // Query 2: 统计已完成任务
    if (planInstance) {
        const { count: completedCount } = await supabase
            .from("plan_instance_executions")
            .select("id", { count: "exact", head: true })
            .eq("instance_id", planInstance.id);
    }
}
```

---

### 问题 3: `get-next-training-day` 重复查询 instance

**文件**: `src/app/api/execution/get-next-training-day/route.ts`

```typescript
// 该 API 单独查询 instance 获取 training_days
const { data: instance } = await supabase
    .from("coach_plan_instances")
    .select("id, training_days, start_execution_day")
    .eq("id", instanceId)
    .single();

// 然后查询执行记录
const { data: executions } = await supabase
    .from("plan_instance_executions")
    .select("id, day_index, status, completed_at")
    .eq("instance_id", instanceId)
    .eq("status", "completed");
```

**问题**: 前端通常已通过 `get-instance` 获取了 training_days 和 executions

---

## 数据库层面分析

### 现有索引评估

基于 `supabase_schema_branch.md` 分析:

**coach_plan_instances 表索引** ✅ 良好

- `idx_plan_instances_template` (coach_plan_template_id)
- `idx_plan_instances_student` (student_id)
- `idx_plan_instances_coach` (coach_id)
- `idx_coach_plan_instances_start_execution_day` (start_execution_day)

**plan_instance_executions 表索引** ✅ 良好

- `idx_exec_student` (student_id)
- `idx_exec_instance_day` (instance_id, day_index) - 复合索引
- `idx_exec_date` (started_at DESC)
- `idx_exec_lookup` (student_id, instance_id, day_index, started_at DESC) -
  覆盖索引
- `idx_exec_status` (status) WHERE status <> 'completed' - 部分索引

**潜在缺失索引**:

| 表                     | 建议索引                              | 理由             |
| ---------------------- | ------------------------------------- | ---------------- |
| `coach_plan_instances` | (coach_subscription_id, status)       | 订阅维度查询常见 |
| `coach_plan_instances` | (student_id, source, status)          | 自建计划查询     |
| `training_videos`      | (user_id, coach_feedback IS NOT NULL) | 视频统计优化     |

### RLS 策略影响

当前 RLS 策略使用 `auth.uid()` 进行权限检查，这在每次查询执行时都会调用:

```sql
-- 示例: coach_subscriptions 表的 RLS
CREATE POLICY "Coaches can view own subscribers" 
ON coach_subscriptions FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM coaches 
    WHERE coaches.id = coach_subscriptions.coach_id 
    AND coaches.user_id = auth.uid()::text
));
```

**影响**:

- 每次查询都会执行子查询验证权限
- 使用 service role 可绕过但需谨慎

**当前做法**: 部分 API 使用 `serviceRoleSupabase` 绕过 RLS，在应用层做权限检查

---

## 前端层面问题

### 问题 1: 请求串行化

**典型模式**:

```typescript
// 当前 (串行): ~1200ms
const subs = await getSubscriptions(); // 200ms
const instance = await getInstance(subs[0].id); // 400ms
const nextDay = await getNextDay(instance.id); // 200ms
const executions = await getExecutions(instance.id); // 400ms

// 优化后 (并行): ~600ms
const [subs, selfPlan] = await Promise.all([
    getSubscriptions(),
    getInstance({ fetchSelf: true }),
]); // 400ms (取最长)
const [instance, nextDay] = await Promise.all([
    getInstance({ subscriptionId: subs[0].id }),
    getNextDay(selfPlan?.id), // 可与其他请求并行
]); // 400ms
```

### 问题 2: 重复请求

**示例**: `/coach/plans` 页面

```typescript
// loadSelfPlan() 中:
await planLibService.getInstance({ fetchSelf: true });
await planLibService.getWithExecutions({ instanceId }); // ← 重复获取 executions

// loadInstance() 中:
await planLibService.getInstance({ subscriptionId });
await planLibService.getWithExecutions({ subscriptionId }); // ← 重复获取 executions
```

`getInstance` 已返回 `executions`，`getWithExecutions` 调用是冗余的。

### 问题 3: 缺少请求缓存

当前没有使用 SWR/React Query 等缓存库，导致:

- 页面切换后重新加载相同数据
- 组件重渲染触发重复请求
- 无法利用 stale-while-revalidate 模式

---

## 优化建议汇总

### 第一阶段: 快速修复 (Quick Wins)

| ID   | 优化项                                     | 影响文件                 | 预估收益    | 风险 |
| ---- | ------------------------------------------ | ------------------------ | ----------- | ---- |
| QW-1 | 移除 `get-instance` 中的 DEBUG 代码        | `get-instance/route.ts`  | -1 query    | 极低 |
| QW-2 | 合并 coach_actions 和 student_actions 查询 | `get-instance/route.ts`  | -1 query    | 低   |
| QW-3 | 批量化 `getVideoStats`                     | `list-students/route.ts` | -N queries  | 低   |
| QW-4 | 批量化 `getStudentPlanData`                | `list-students/route.ts` | -2N queries | 中低 |

**QW-1 实现**:

```typescript
// 删除 lines 25-41:
// try {
//     const { data: debugPlans } = await supabase...
//     console.log(`[get-instance DEBUG]...`);
// } catch (e) {...}
```

**QW-3 实现**:

```typescript
// 优化前: N 次查询
const tasks = studentIds.map((id) =>
    limitController(async () => {
        const { data } = await supabase.from("training_videos")
            .select("coach_feedback").in("user_id", [id]);
        // ...
    })
);

// 优化后: 1 次查询
async function getVideoStats(studentIds: string[]) {
    const { data: videos } = await supabase
        .from("training_videos")
        .select("user_id, coach_feedback")
        .in("user_id", studentIds);

    // 在内存中分组计算
    const statsMap = new Map();
    studentIds.forEach((id) => statsMap.set(id, { uploaded: 0, reviewed: 0 }));

    videos?.forEach((v) => {
        const stat = statsMap.get(v.user_id);
        if (stat) {
            stat.uploaded++;
            if (v.coach_feedback && Object.keys(v.coach_feedback).length > 0) {
                stat.reviewed++;
            }
        }
    });

    return statsMap;
}
```

---

### 第二阶段: API 优化

| ID    | 优化项                                      | 影响文件                          | 预估收益          | 风险 |
| ----- | ------------------------------------------- | --------------------------------- | ----------------- | ---- |
| API-1 | 在 `get-instance` 返回中增加 `nextDayIndex` | `get-instance/route.ts`, 前端多处 | -2 API calls/页面 | 中   |
| API-2 | 合并 `getInstance` 和 `getWithExecutions`   | `planLibService.ts`, 前端多处     | -1 API call/页面  | 中   |
| API-3 | 优化权限检查逻辑                            | `get-instance/route.ts`           | -1-2 queries      | 中   |

**API-1 实现思路**:

```typescript
// get-instance/route.ts 在返回前增加:
const trainingDays = instance.training_days as any[] || [];
const completedDays = executionsList
    .filter((e) => e.status === "completed")
    .map((e) => e.day_index);
const trainingOnlyDays = trainingDays
    .filter((d) => d.type === "training")
    .sort((a, b) => a.dayIndex - b.dayIndex);

let nextDayIndex = 1;
for (const day of trainingOnlyDays) {
    if (!completedDays.includes(day.dayIndex)) {
        nextDayIndex = day.dayIndex;
        break;
    }
}

return NextResponse.json({
    success: true,
    data: {
        instance,
        actions: actionsMap,
        executions: executionsList,
        nextDayIndex, // ← 新增字段
        completedDays, // ← 新增字段
    },
});
```

---

### 第三阶段: 前端优化

| ID   | 优化项                              | 影响文件                                          | 预估收益       | 风险 |
| ---- | ----------------------------------- | ------------------------------------------------- | -------------- | ---- |
| FE-1 | 并行化请求                          | `today-training/page.tsx`, `coach/plans/page.tsx` | -30% 加载时间  | 中   |
| FE-2 | 移除重复的 `getWithExecutions` 调用 | `coach/plans/page.tsx`                            | -1 API call    | 低   |
| FE-3 | 引入 SWR/React Query                | 多个页面                                          | 缓存 + 更好 UX | 中高 |

**FE-1 实现示例** (`today-training/page.tsx`):

```typescript
// 优化前
const subsRes = await subscriptionService.getCoachSubscriptions();
const [coachPlan, selfPlan] = await Promise.all([...]);
// 串行获取 nextDay
const coachNextDay = await fetch(`/api/.../get-next-training-day?instanceId=${coachPlan.id}`);
const selfNextDay = await fetch(`/api/.../get-next-training-day?instanceId=${selfPlan.id}`);

// 优化后 (如果实现了 API-1)
const [subsRes, selfPlanRes] = await Promise.all([
    subscriptionService.getCoachSubscriptions(),
    planLibService.getInstance({ fetchSelf: true })  // 现在包含 nextDayIndex
]);

if (subsRes?.subscriptions[0]?.id) {
    const coachPlanRes = await planLibService.getInstance({ 
        subscriptionId: subsRes.subscriptions[0].id 
    });  // 包含 nextDayIndex，无需额外调用
}
```

---

### 第四阶段: 数据库优化

| ID   | 优化项              | 影响         | 预估收益 | 风险 |
| ---- | ------------------- | ------------ | -------- | ---- |
| DB-1 | 添加复合索引 (建议) | 查询性能     | 查询加速 | 低   |
| DB-2 | 考虑物化视图 (可选) | 复杂统计查询 | 显著加速 | 中高 |

**DB-1 建议索引**:

```sql
-- 优化订阅维度的实例查询
CREATE INDEX IF NOT EXISTS idx_plan_instances_subscription_status 
ON coach_plan_instances(coach_subscription_id, status);

-- 优化自建计划查询
CREATE INDEX IF NOT EXISTS idx_plan_instances_student_source_status 
ON coach_plan_instances(student_id, source, status);

-- 优化视频统计查询 (部分索引)
CREATE INDEX IF NOT EXISTS idx_training_videos_user_with_feedback 
ON training_videos(user_id) 
WHERE coach_feedback IS NOT NULL;
```

---

## 实施优先级

```
┌─────────────────────────────────────────────────────────────────┐
│                    实施优先级矩阵                                │
├─────────────────────────────────────────────────────────────────┤
│                 │ 低风险         │ 中风险          │ 高风险     │
│─────────────────┼────────────────┼─────────────────┼────────────│
│ 高收益 (30%+)   │ ★ QW-3, QW-4   │ API-1, FE-1     │            │
│ 中收益 (10-30%) │ QW-1, QW-2     │ API-2, FE-2     │ FE-3       │
│ 低收益 (<10%)   │ DB-1           │ API-3           │ DB-2       │
└─────────────────────────────────────────────────────────────────┘

★ = 建议首先实施
```

**推荐实施顺序**:

1. **第一批 (1-2 天)**: QW-1, QW-2, QW-3, QW-4
2. **第二批 (3-5 天)**: API-1, FE-1, FE-2
3. **第三批 (按需)**: API-2, API-3, DB-1
4. **长期优化**: FE-3, DB-2

---

## 预期收益

### 量化预估

| 页面                             | 当前 API 调用数 | 优化后调用数 | 当前估计耗时 | 优化后估计耗时 |
| -------------------------------- | --------------- | ------------ | ------------ | -------------- |
| `/coach/plans`                   | 6-8             | 2-3          | ~1400ms      | ~500ms         |
| `/today-training`                | 4-6             | 2            | ~1000ms      | ~400ms         |
| `/dashboard/students` (20 学员)  | ~62             | ~8           | ~2000ms      | ~500ms         |
| `/dashboard/students` (100 学员) | ~302            | ~10          | ~8000ms      | ~800ms         |
| `/me/profile`                    | 3-4             | 2            | ~600ms       | ~400ms         |
| `/training-execution`            | 2-3             | 2            | ~400ms       | ~350ms         |

### 用户体验改善

- **感知加载时间**: 减少 50-70%
- **页面可交互时间**: 减少 40-60%
- **服务器负载**: 降低 30-50% (减少数据库查询)

---

## 附录: 快速修复代码片段

### A. 移除 DEBUG 代码 (QW-1)

```diff
// src/app/api/plan-lib/get-instance/route.ts

export async function POST(req: Request) {
    const session = await getServerSession();
    const userId = session?.user?.id || null;
    // ... 权限检查 ...

-    // --- DEBUGGING START ---
-    try {
-        const { data: debugPlans } = await supabase
-            .from("coach_plan_instances")
-            .select("id, status, source, updated_at, name")
-            .eq("student_id", userId)
-            .order("updated_at", { ascending: false })
-            .limit(5);
-
-        console.log(
-            `[get-instance DEBUG] Plans for user ${userId}:`,
-            JSON.stringify(debugPlans, null, 2),
-        );
-    } catch (e) {
-        console.error("[get-instance DEBUG] Error listing plans:", e);
-    }
-    // --- DEBUGGING END ---

    // ... 后续逻辑 ...
```

### B. 批量化视频统计 (QW-3)

```typescript
// src/app/api/coach/list-students/route.ts

async function getVideoStats(studentIds: string[]) {
    if (studentIds.length === 0) return new Map();

    // 单次查询获取所有学员的视频
    const { data: videos } = await supabase
        .from("training_videos")
        .select("user_id, coach_feedback")
        .in("user_id", studentIds);

    // 在内存中聚合
    const statsMap = new Map<string, { uploaded: number; reviewed: number }>();
    studentIds.forEach((id) => statsMap.set(id, { uploaded: 0, reviewed: 0 }));

    for (const v of videos || []) {
        const stat = statsMap.get(v.user_id);
        if (stat) {
            stat.uploaded++;
            if (v.coach_feedback && Object.keys(v.coach_feedback).length > 0) {
                stat.reviewed++;
            }
        }
    }

    return statsMap;
}
```

### C. 批量化计划数据 (QW-4)

```typescript
// src/app/api/coach/list-students/route.ts

async function getStudentPlanDataBatch(coachId: string, studentIds: string[]) {
    if (studentIds.length === 0) return new Map();

    // 批量获取所有学员的最新计划实例
    const { data: instances } = await supabase
        .from("coach_plan_instances")
        .select(
            "id, name, description, status, student_id, training_days_count",
        )
        .eq("coach_id", coachId)
        .in("student_id", studentIds)
        .order("created_at", { ascending: false });

    // 按学员分组，取每个学员最新的实例
    const latestByStudent = new Map<string, typeof instances[0]>();
    for (const inst of instances || []) {
        if (!latestByStudent.has(inst.student_id)) {
            latestByStudent.set(inst.student_id, inst);
        }
    }

    // 批量获取完成数量
    const instanceIds = Array.from(latestByStudent.values()).map((i) => i.id);
    const { data: execCounts } = await supabase
        .from("plan_instance_executions")
        .select("instance_id")
        .in("instance_id", instanceIds)
        .eq("status", "completed");

    // 统计每个实例的完成数
    const completedByInstance = new Map<string, number>();
    for (const exec of execCounts || []) {
        const count = completedByInstance.get(exec.instance_id) || 0;
        completedByInstance.set(exec.instance_id, count + 1);
    }

    // 组装结果
    const result = new Map();
    for (const [studentId, inst] of latestByStudent) {
        result.set(studentId, {
            plan: {
                name: inst.name,
                description: inst.description,
                status: inst.status,
                id: inst.id,
            },
            progress: {
                total: inst.training_days_count || 0,
                completed: completedByInstance.get(inst.id) || 0,
            },
        });
    }

    // 无计划的学员设置默认值
    for (const studentId of studentIds) {
        if (!result.has(studentId)) {
            result.set(studentId, {
                plan: null,
                progress: { total: 0, completed: 0 },
            });
        }
    }

    return result;
}
```

---

_文档结束_
