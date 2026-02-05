# 结构化数据优化方案：饮食、有氧与习惯

> **状态**: 提案中
> **目标**: 升级 "动作 (Action)" 系统的内部数据结构，使其从简单的文本记录进化为专业级、可量化、可追踪的数据系统。

## 1. 饮食结构优化 (Diet Structure)

### 现状问题
当前仅通过 text (`content`) 和 `calories` 记录。
*   **痛点**: 无法精确计算三大营养素（蛋白质/碳水/脂肪），无法与食品数据库联动，用户体验粗糙。

### 优化方案：引入 "Food Item" 与 "Nutrient Database" 概念

我们将饮食建议 (`Diet Action`) 视为**一餐 (Meal)**，它可以包含多个**食物项 (Food Item)**。

#### 数据结构设计 (JSON Schema)

```typescript
// 存放在 coach_actions.item_schema 或 student_actions.params.custom_data 中

interface DietConfig {
    mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_workout' | 'post_workout';
    targetCalories?: number; // 这一餐的总热量目标
    
    // 核心：食物列表
    items: FoodItem[]; 
    
    // 自动汇总（用于显示）
    summary?: {
        protein: number; // g
        carbs: number;   // g
        fat: number;     // g
    };
    
    note?: string; // 烹饪建议等
}

interface FoodItem {
    id?: string;        // 关联到标准食物库 ID (如 "food_123")，可选
    name: string;       // 食物名称，如 "鸡胸肉"
    
    // 份量描述
    amount: number;     // 如 100
    unit: string;       // 如 "g", "ml", "片", "勺"
    
    // 营养数据 (每单位或当前分量，建议存当前分量的绝对值)
    nutrition?: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        fiber?: number;
    };
    
    isEstimated?: boolean; // 如果是 AI 估算或用户手填，标记为 true
}
```

### 功能迭代路径
1.  **Phase 1 (结构化)**: UI 允许添加多行食物，每行手动输入名称和估算热量/蛋白。
2.  **Phase 2 (本地库)**: 建立基础常见食物库（米饭、鸡蛋、鸡胸肉等 50 种），输入时自动补全营养素。
3.  **Phase 3 (AI 辅助)**: 导入 "鸡胸肉 200g" 时，LLM 自动查表并填充 `nutrition` 字段。

---

## 2. 有氧结构优化 (Cardio Structure)

### 现状问题
仅支持距离、时长、单一配速。
*   **痛点**: 无法表达**间歇跑 (Intervals)**、**心率区间训练**，也无法区分室内/室外场景。

### 优化方案：支持 "Segment (分段)" 与 "Target Context (目标上下文)"

#### 数据结构设计

```typescript
interface CardioConfig {
    subType: 'running' | 'cycling' | 'swimming' | 'rowing' | 'elliptical' | 'other';
    environment?: 'indoor' | 'outdoor'; // 影响显示的图标（如跑步机 vs 户外跑）

    // 训练模式：持续 (Steady) vs 间歇 (Interval)
    mode: 'steady' | 'interval';

    // 总体目标 (Steady 模式用)
    targets?: {
        distance?: number;  // meters
        duration?: number;  // seconds
        calories?: number;
    };

    // 间歇/分段详情 (Interval 模式用)
    segments?: CardioSegment[];
    
    // 强度监控指标
    intensityTarget?: {
        type: 'pace' | 'heart_rate' | 'power' | 'rpe';
        min?: number;
        max?: number;
        zone?: 1 | 2 | 3 | 4 | 5; // 心率区间
        customText?: string; // 如 "5:30 配速"
    };
}

interface CardioSegment {
    type: 'warmup' | 'work' | 'rest' | 'cooldown';
    duration?: number; // seconds
    distance?: number; // meters
    intensity?: string; // 这一段的特定强度，如 "冲刺", "慢走"
    repeats?: number;   // 这一段重复几次（如果是简单循环）
}
```

### 场景举例
*   **LSD 长距离慢跑**: `mode: 'steady'`, `intensityTarget: { type: 'heart_rate', zone: 2 }`
*   **亚索 800 (间歇)**: `mode: 'interval'`, `segments: [{ type: 'work', distance: 800 }, { type: 'rest', duration: 400 }]`

---

## 3. 习惯结构优化 (Habit Structure)

### 现状问题
单纯的 Checkbox + 备注。
*   **痛点**: 无法定义“量化目标”（如喝水 2000ml，而不是只打个勾），缺乏频次控制。

### 优化方案：引入 "Tracking Type (追踪类型)" 与 "Schedule (排期)"

#### 数据结构设计

```typescript
interface HabitConfig {
    // 追踪类型
    trackingType: 'checkbox' | 'counter' | 'value' | 'timer';
    // checkbox: 完成/未完成 (早睡)
    // counter: 计数器 (比如一天喝几杯水)
    // value: 数值记录 (比如晨脉值、体重)
    // timer: 倒计时 (比如冥想 10分钟)

    // 量化目标 (如果非 checkbox)
    targetValue?: number; 
    unit?: string; // 如 "ml", "页", "分钟"
    
    // 频次控制 (用于生成计划时)
    frequency?: {
        type: 'daily' | 'weekly';
        daysOfWeek?: number[]; // [1, 3, 5] 表示周一三五
        timesPerDay?: number;
    };

    // 提醒/触发
    reminder?: {
        time?: string; // "08:00"
        context?: 'waking_up' | 'before_bed' | 'after_workout';
    };
}
```

### 场景举例
*   **喝水**: `trackingType: 'counter'`, `targetValue: 8`, `unit: '杯(250ml)'`. UI 显示为 `0/8` 的进度条。
*   **早起晨重**: `trackingType: 'value'`, `unit: 'kg'`. UI 显示为数字输入框。
*   **冥想**: `trackingType: 'timer'`, `targetValue: 600`. UI 显示倒计时播放器。

---

## 4. 实施建议 ("智能导入" 视角)

既然我们有强大的 LLM 智能导入功能，这些复杂结构**不需要用户手动填写**，而是通过 Prompt 让 AI 自动生成。

**Prompt 升级示例**:

*   **原文**: "早餐吃两个鸡蛋一杯牛奶"
*   **解析结果 (Diet)**:
    ```json
    {
        "items": [
             { "name": "鸡蛋", "amount": 2, "unit": "个", "isEstimated": true },
             { "name": "牛奶", "amount": 1, "unit": "杯", "isEstimated": true }
        ],
        "summary": { "protein": 20, "calories": 250 } // AI 估算值
    }
    ```

*   **原文**: "间歇跑 800米冲刺，休息2分钟，重复4组"
*   **解析结果 (Cardio)**:
    ```json
    {
        "mode": "interval",
        "segments": [
            { "type": "work", "distance": 800, "repeats": 4 },
            { "type": "rest", "duration": 120, "repeats": 4 }
        ]
    }
    ```

这个方案能让 CoachLink 的数据深度瞬间对标顶级健身 App。
