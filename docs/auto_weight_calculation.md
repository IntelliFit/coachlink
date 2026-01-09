# 自动计算重量逻辑说明文档

本文档旨在阐述项目中自动计算训练负重（重量）的逻辑，特别是关于“自重（体质）”在计算中的角色及其处理方式。

## 1. 核心计算模式

项目支持两种主要的自动计算模式：**RM 模式** 和 **百分比模式**。

### 1.1 RM 模式 (Repetition Maximum)

当教练或学员设置一个具体的 RM 值（如 5RM，即只能连续完成 5
次的最大重量）时，系统会基于学员的 **1RM 记录** 和 **当前体重** 进行计算。

- **核心公式**： `推荐重量 = (1RM + α × 体重) / λ(r) - α × 体重` 其中：
  - `1RM`：学员在该动作上的 1 次最大重量记录。
  - `体重`：学员当前的身体重量。
  - `r`：目标 RM 次数（如 5）。
  - `λ(r)`：强度系数，基于选择的算法（如 Epley, Brzycki 等）。
  - `α`：**自重系数**。如果该动作包含自重（如深蹲、引体向上），则 `α = 1`；否则
    `α = 0`。

### 1.2 百分比模式 (Percentage of 1RM)

当设置 1RM 的百分比（如 80% 1RM）时，计算逻辑相对简单。

- **核心公式**： `推荐重量 = 1RM × 百分比`
- **注意**：在当前实现中，百分比模式**不考虑**自重抵扣。它假设提供的 1RM
  已经是该动作的“外部负重”能力。

---

## 2. 自重 (Body Weight) 的处理逻辑

关于“包含自重”和“不包含自重”的处理是本系统的关键特性。

### 2.1 包含自重的动作 (Includes Body Weight)

对于某些动作，身体重量本身就是阻力的一部分。

- **动作识别**：系统会自动识别如 `深蹲`、`引体向上`、`俯卧撑`、`平板支撑`
  等动作（由 `includesBodyWeight` 字段或硬编码白名单决定）。
- **计算逻辑**：
  1. **总负荷计算**：将 1RM 视为“总系统重量”（外部负重 + 参与做功的身体重量）。
  2. **目标总重**：根据目标 RM 次数，算出对应的目标总系统重量。
  3. **净负重输出**：从目标总系统重量中减去当前的身体重量，得到学员应该额外增加的配重。

### 2.2 不包含自重的动作 (Excludes Body Weight)

对于大多数器械动作（如
`卧推`、`器械划船`），自重不直接参与阻力计算。此时直接应用 RM
转换公式，无需考虑体重抵扣。

---

## 3. 核心代码展示

### 3.1 RM 计算引擎 (src/lib/rmCaculator.ts)

以下是计算推荐负重的核心函数：

```typescript
/**
 * 计算推荐负重 L_r
 * 公式：L_r = (1RM + αW) / λ(r) - αW
 */
export function calcRecommendedLoad(
    oneRM: number,
    weight: number,
    reps: number,
    alpha: number = 1,
    model: LambdaModel = "average",
): number {
    // ... lambda 计算逻辑 ...

    // 核心计算公式
    const load = (oneRM + alpha * weight) / lambda - alpha * weight;

    return Math.max(0, Number(load.toFixed(2)));
}
```

### 3.2 UI 实时自洽逻辑 (src/app/dashboard/plan-lib/components/ActionSetForm.tsx)

在前端表单中，系统通过 `useEffect` 实时响应参数变化：

```typescript
useEffect(() => {
    if (!studentData || !currentAction?.enableAutoWeightCompute) return;

    const oneRm = getUserOneRM();
    const userBodyWeight = studentData?.profile?.weight;
    
    // 是否考虑自重（alpha 系数）
    const includesBodyWeight = currentAction?.includesBodyWeight || 
        ['深蹲', '引体向上', '俯卧撑', '平板支撑'].includes(currentAction?.name);

    if (intensityType === 'rm') {
        calculatedWeight = calcRecommendedLoad(
            oneRm,
            userBodyWeight,
            rmValue,
            includesBodyWeight ? 1 : 0,
            model
        );
    } else if (intensityType === 'percentage') {
        // 百分比模式直接计算
        calculatedWeight = oneRm * (pctValue / 100);
    }
    
    // 更新到表单状态
    updateParams({ load: calculatedWeight, loadUnit: 'kg' });
}, [ ...依赖项... ]);
```

---

## 4. 相关文件索引

- **计算引擎**：[`src/lib/rmCaculator.ts`](file:///d:/files/coachlink/src/lib/rmCaculator.ts)
- **UI
  集成**：[`src/app/dashboard/plan-lib/components/ActionSetForm.tsx`](file:///d:/files/coachlink/src/app/dashboard/plan-lib/components/ActionSetForm.tsx)
