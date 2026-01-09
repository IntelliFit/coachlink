# 实施方案验证报告（代码审查确认）

## 审查结论

对以下关键文件进行了二次审查，确认实施方案思路正确，且明确了需要做的设计选择。

---

## 1. `start/route.ts` - 同步问题确认

**文件位置**: `src/app/api/execution/start/route.ts`

**关键代码段 (Lines 49-54)**:

```typescript
if (existingExecution) {
    // 返回现有的执行记录
    return NextResponse.json<StartExecutionResponseDto>({
        success: true,
        data: existingExecution,
    });
}
```

**问题确认**:

- ✅ **确认**：当存在 `in_progress`
  的执行记录时，系统**直接返回旧数据**，没有任何与母版（`coach_plan_instances`）的比对或同步逻辑。
- **修复方案**：在返回前，增加逻辑获取母版数据，对比
  `planned_weight`、`planned_reps` 等字段，若不同则更新快照。

---

## 2. `ActionSetForm.tsx` - PR 不生效问题确认

**文件位置**: `src/app/dashboard/plan-lib/components/ActionSetForm.tsx`

**关键代码段 (Lines 46, 92-97)**:

```typescript
// Line 46: 只读问卷数据
const userInput =
    ((subscription?.subscribe_data || []) as unknown as TrainingItem[])
        .find((item) => item.type === "rm")?.userInputs || {};

// Lines 92-97: 计算 1RM 时只查 userInput
const getUserOneRM = useCallback(() => {
    if (!currentAction) {
        return 1;
    }
    return userInput[currentAction.id] || 1; // <-- 只看问卷，不看 PR 表
}, [currentAction, userInput]);
```

**问题确认**:

- ✅ **确认**：`getUserOneRM` 函数完全依赖 `subscribe_data`（问卷），没有任何对
  `personal_records_history`（PR 表）的引用。
- **修复方案**：在组件加载时，调用 `get-current-1rm` API（或扩展它）获取聚合后的
  1RM，用于 `calcRecommendedLoad`。

---

## 3. `get-current-1rm/route.ts` - API 能力确认

**文件位置**: `src/app/api/student/get-current-1rm/route.ts`

**关键代码段 (Lines 48-55)**:

```typescript
let query = (supabase as any)
    .from("personal_records_history") // <-- 只读 PR 表
    .select(...)
    .eq("user_id", userId)
```

**问题确认**:

- ✅ **确认**：此 API 只读取
  `personal_records_history`，**不读取**问卷（`onboarding_questionnaires`）。
- **设计选择**：
  - **方案 A**：扩展此 API，使其也查询问卷中的初始 1RM，返回
    `max(问卷值, PR值)`。
  - **方案 B**：前端分别调用"问卷"和"PR"两个接口，自行取最大值。
- **推荐**：方案 A，因为统一由后端聚合更健壮，前端只需一次调用。

---

## 4. 最终确认的实施步骤

| 步骤                        | 修改文件                   | 具体改动                                                                                                            | 风险评估                         |
| :-------------------------- | :------------------------- | :------------------------------------------------------------------------------------------------------------------ | :------------------------------- |
| **1. 解决同步问题**         | `start/route.ts`           | 在返回 `existingExecution` 前，对比母版并更新快照中的 `planned_*` 字段（保留 `actual_*` 字段不变）。                | 低：已完成的组不受影响。         |
| **2. 扩展 1RM API**         | `get-current-1rm/route.ts` | 增加对问卷（`onboarding_questionnaires` 或 `coach_subscriptions.subscribe_data`）的查询，返回 `max(问卷值, PR值)`。 | 中：需确保正确识别动作 ID 映射。 |
| **3. 教练编辑器接入新 API** | `ActionSetForm.tsx`        | 移除 `userInput` 依赖，改为在组件加载时调用新的 `get-current-1rm`，使用返回值进行计算。                             | 低：只是数据源替换。             |

---

## 5. 您提到的设计偏好确认

> "看谁先调整先调整就按照那个更新就行了"

- **含义理解**：无论是问卷更新还是 PR 更新，只要有新数据进来，就用最新的。
- **实现方式**：修改 `get-current-1rm/route.ts`，让它返回问卷和 PR
  中**数值较大**的那个（或时间戳较新的，但您偏向"较大"更符合力量增长逻辑）。
- **推荐逻辑**：`有效1RM = max(问卷初始值, PR历史最高值)`。因为初始值是基线，PR
  是进步记录，取最大值永远保证计划基于学员**当前最强能力**。

请确认以上理解是否正确，我将开始修改代码。
