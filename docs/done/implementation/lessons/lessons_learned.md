# 经验教训文档 - 训练计划执行详情显示功能

> 任务日期: 2025-12-06\
> 功能: 在训练计划页面显示执行详情

---

## 错误总结

### 错误 1: 修改了错误的页面 ❌

**问题描述**:\
用户要求在"训练计划页面"显示执行情况，我最初修改了
`/training/page.tsx`，但用户实际使用的是 `/coach/plans/page.tsx`。

**错误原因**:

- 没有仔细查看用户截图中的URL路径
- 假设用户说的"训练计划"就是 `/training` 路由
- 没有先用浏览器确认用户实际访问的页面

**正确做法**:

1. **先查看用户截图**: 检查浏览器地址栏的URL
2. **搜索UI文本**:
   用grep搜索页面上显示的独特文本（如"已订阅教练"）来定位正确的组件
3. **与用户确认**: 如果不确定页面路径，直接询问用户正在访问的URL

**代码实例**:

```bash
# ✅ 正确做法 - 搜索UI文本定位组件
grep -r "已订阅教练" src/
grep -r "训练安排" src/
```

---

### 错误 2: API字段名使用错误 ❌

**问题描述**:\
在 `get-with-executions/route.ts` 中使用了 `subscription_id`
查询，但数据库表中的字段是 `coach_subscription_id`，导致查询失败。

**错误代码**:

```typescript
// ❌ 错误 - 字段名不匹配
.eq("subscription_id", activeSub.id)
```

**正确代码**:

```typescript
// ✅ 正确 - 使用实际的字段名
.eq("coach_subscription_id", activeSub.id)
```

**错误原因**:

- 凭猜测使用字段名，没有查看数据库schema
- 没有参考项目中其他类似的API实现

**正确做法**:

1. **查看数据库migration文件**: 检查 `supabase/migrations/` 中的表定义
2. **grep搜索现有代码**: 查找其他地方如何查询同一个表
   ```bash
   grep -r "coach_plan_instances" src/app/api/
   grep -r "coach_subscription_id" src/app/api/
   ```
3. **使用Supabase Studio**: 直接查看表结构

**记忆要点**:

- `coach_plan_instances` 表使用 `coach_subscription_id` 而不是 `subscription_id`
- 项目使用带前缀的字段名约定（如 `coach_`, `student_`）

---

### 错误 3: multi_replace工具没有正确应用 ❌

**问题描述**:\
使用 `multi_replace_file_content`
添加代码后，实际文件中代码没有被添加，导致功能不工作。

**错误原因**:

- 依赖工具执行结果，没有验证修改是否真的生效
- 替换的目标内容可能与实际文件内容不完全匹配

**正确做法**:

1. **执行修改后立即验证**:
   ```bash
   # ✅ 用grep验证关键代码是否存在
   grep -n "get-with-executions" src/app/coach/plans/page.tsx
   grep -n "ExecutionDetailsSection" src/app/coach/plans/page.tsx
   ```

2. **对关键功能使用view_file二次确认**:
   ```typescript
   // 修改后查看文件确认
   view_file("path/to/modified/file.tsx", startLine, endLine);
   ```

3. **如果工具失败，立即重试**: 不要继续依赖可能失败的修改进行后续工作

**避免方法**:

- 对于复杂的多处修改，考虑分步进行，每一步都验证
- 优先使用 `replace_file_content` 单次替换，比 `multi_replace` 更可靠

---

### 错误 4: 没有发现和清理Mock数据 ❌

**问题描述**:\
`StudentProfilePage.tsx`
中有mock的timeline数据，导致显示了假的PR记录而不是真实API数据。

**错误原因**:

- 直接修改 `ProgressTimeline` 组件，没有查看父组件如何传递数据
- 没有检查数据来源是否是mock还是真实API

**正确做法**:

1. **修改组件前先查看完整数据流**:
   ```
   StudentProfilePage (数据源？) 
     → ProfileData interface 
     → ProgressTimeline (如何接收数据？)
   ```

2. **搜索"mock"关键字**:
   ```bash
   grep -n "mock" src/components/student/StudentProfilePage.tsx
   grep -n "Mock data" src/components/student/
   ```

3. **检查注释**: 查找 `// TODO`, `// Mock`, `// Placeholder` 等标记

**检查清单**:

- [ ] 数据来自真实API还是mock？
- [ ] 是否有注释说明这是临时数据？
- [ ] 其他组件是如何获取同类数据的？

---

### 错误 5: 使用错误的测试数据 ❌

**问题描述**:\
使用"沈妈妈"账号测试，但该账号没有训练计划数据，导致无法验证功能。

**错误原因**:

- 假设测试账号有完整的测试数据
- 没有先检查数据库中是否存在相关记录

**正确做法**:

1. **测试前检查数据**: 直接查询数据库确认测试数据存在
2. **创建完整的测试数据流程**:
   - 有订阅 → 有计划实例 → 有执行记录 → 有视频/PR
3. **使用多个测试账号**: 准备不同场景的测试账号（空数据、部分数据、完整数据）

**数据验证命令示例**:

```sql
-- 检查用户是否有订阅
SELECT * FROM coach_subscriptions WHERE student_id = 'user_id';

-- 检查是否有计划实例  
SELECT * FROM coach_plan_instances WHERE coach_subscription_id = 'sub_id';

-- 检查是否有执行记录
SELECT * FROM plan_instance_executions WHERE instance_id = 'instance_id';
```

---

## 最佳实践总结

### ✅ 开始任务前

1. **理解用户真实需求**
   - 查看截图中的URL路径
   - 搜索UI中的独特文本定位组件
   - 与用户确认具体页面路径

2. **调研现有实现**
   - 查看类似功能的实现方式
   - grep搜索相关API和组件
   - 检查数据库schema和字段名

3. **检查测试数据**
   - 确认测试账号有必要的数据
   - 准备完整的测试数据流程

### ✅ 执行修改时

1. **使用正确的字段名**
   - 查看migration文件或现有代码
   - grep搜索同一表的其他查询
   - 不要凭猜测使用字段名

2. **验证每步修改**
   - 修改后立即grep验证
   - 使用view_file二次确认
   - 不依赖可能失败的修改进行后续工作

3. **清理Mock数据**
   - 搜索"mock"关键字
   - 检查组件数据来源
   - 确保使用真实API

### ✅ 测试验证时

1. **使用浏览器Console**
   - 检查API调用是否成功
   - 查看返回的数据结构
   - 确认state是否正确更新

2. **逐步调试**
   - API是否返回数据？ → 打印console.log
   - 组件是否收到数据？ → 检查props/state
   - UI是否正确渲染？ → 检查条件判断

---

## 常见陷阱

### 🚫 陷阱 1: 假设字段名

```typescript
// ❌ 危险 - 猜测字段名
.eq("subscription_id", id)

// ✅ 安全 - 查看现有代码确认
// grep -r "coach_plan_instances" src/app/api/
.eq("coach_subscription_id", id)
```

### 🚫 陷阱 2: 不验证工具执行结果

```bash
// ❌ 危险 - 假设修改成功
multi_replace_file_content(...)
// 继续后续工作

// ✅ 安全 - 立即验证
multi_replace_file_content(...)
grep -n "新添加的代码" target_file.tsx
```

### 🚫 陷阱 3: 忽略Mock数据

```typescript
// ❌ 危险 - 没发现mock数据
const timelineData = [
  { title: "假数据", ... }  // Mock data
];

// ✅ 安全 - 检查并使用真实API
useEffect(() => {
  fetchRealData();
}, []);
```

---

## 快速检查清单

修改功能前:

- [ ] 确认正确的页面/组件路径
- [ ] grep搜索UI文本定位组件
- [ ] 查看数据库schema确认字段名
- [ ] 检查是否有mock数据需要清理
- [ ] 验证测试数据是否完整

执行修改时:

- [ ] 每次修改后用grep验证
- [ ] 使用view_file二次确认关键修改
- [ ] 添加console.log调试输出
- [ ] 参考现有代码的实现方式

测试验证时:

- [ ] 检查浏览器Console日志
- [ ] 验证API返回正确数据
- [ ] 确认UI正确渲染
- [ ] 测试边界情况（空数据、错误等）

---

## 关键命令备忘

```bash
# 定位组件
grep -r "UI文本" src/

# 查找字段名用法
grep -r "table_name" src/app/api/
grep -n "field_name" src/

# 验证代码修改
grep -n "新添加的函数名" target_file.tsx

# 查找mock数据
grep -n "mock" src/components/
grep -n "Mock data" src/

# 检查API调用
grep -r "api/endpoint-name" src/
```

---

## 复用复杂组件时的索引陷阱 (2025-12-29)

### 问题描述

在复用教练端的 `PlanDayCard`
组件到学员端计划编辑器时，出现了“第1天添加动作跑到第2天”的 Bug，并且UI显示异常。

### 根本原因

组件内部对索引的使用不一致（Inconsistent Indexing）：

1. **Inconsistent Callback Arguments**: `PlanDayCard`
   组件内部对于不同的回调使用了不同的索引基准：
   - `onAddActionSet(day.dayIndex)`：传递的是 **1-based** 的业务属性 `dayIndex`
     (如 1, 2, 3...)。
   - `onRemoveDay(dayIndex)`、`onDayTypeChange(dayIndex)`：传递的是 **0-based**
     的数组下标 (props 中传入的 `dayIndex`)。
2. **Assumption Error**: 在父组件实现 `handleAddActionSet`
   时，错误地假设传入参数是数组下标，直接使用 `days[index]` 访问。
3. **Result**: 当点击第1天 (dayIndex=1) 的添加按钮时，访问了
   `days[1]`，即数组的第2个元素，导致动作被加到了第二天。

### 解决方案

在处理此类回调时，**永远不要假设 ID 或 Index
可以直接作为数组下标**，除非非常确定。

**改进后的代码模式**：

```typescript
// ❌ 错误做法：直接当做下标
const handleAddActionSet = (index: number) => {
   // 如果 index 是 1-based，访问 days[1] 实际上是第二个元素
   const day = days[index];
   // ...
};

// ✅ 正确做法：根据特征查找（Find by Property）
const handleAddActionSet = (dayIndexVal: number) => {
   // 无论传入的是下标还是业务ID，都通过属性匹配来查找
   const arrayIndex = days.findIndex((d) => d.dayIndex === dayIndexVal);

   // 如果找不到，作为 fallback 再尝试作为下标（视情况而定）
   if (arrayIndex === -1) {
      console.error("Day not found");
      return;
   }

   const day = days[arrayIndex];
   // ...
};
```

### 预防措施

1. **组件契约审查 (Component Contract Review)**：在复用现有组件前，不仅要看
   Props 类型，还要看源码中回调函数是如何被调用的。不要想当然。
2. **防御性编程 (Defensive Programming)**：在处理数组元素时，优先使用 `find` /
   `findIndex` 配合唯一标识符，而不是直接索引操作。
3. **明确变量命名 (Explicit Naming)**：在变量名中区分 `index` (数组下标) 和 `id`
   / `order` (业务属性)。例如使用 `dayIndexVal` 而不是 `dayIndex`。

---

## 总结

本次任务的核心教训：

1. **先确认，后行动** - 不要假设，要验证
2. **参考现有代码** - 项目中已有的实现是最好的文档
3. **逐步验证** - 每一步修改都要确认生效
4. **清理技术债** - 发现mock数据要及时清理
5. **完整的测试数据** - 确保测试环境有真实可用的数据
6. **组件复用需谨慎** - 仔细检查回调参数的含义（索引 vs ID）

记住：**多花5分钟确认，能节省1小时的调试时间**。

---

## 学员自建计划功能调试经验 (2025-12-29)

### 背景

实现学员自建训练计划功能，允许用户创建自己的训练计划（不依赖教练订阅），并在"今日训练"页面执行。本次调试耗时约1小时，经历了多次错误诊断。

---

### 错误 1: 插入不存在的数据库字段 ❌

**错误信息**：`PGRST204: Could not find the 'current_day_index' column`

**错误代码**：

```typescript
// ❌ 凭记忆添加字段
.insert({
    student_id: userId,
    current_day_index: 1,  // 这个字段根本不存在！
    // ...
})
```

**错误原因**：

- 凭印象认为"自动顺延功能"需要 `current_day_index` 字段
- 没有查看数据库 schema 就直接写代码

**正确做法**：

```bash
# ✅ 修改前先查看 schema
cat supabase_schema.md | grep -A 30 "coach_plan_instances"
# 或查看 SQL 迁移文件
cat sql/20251229_student_self_plan.sql
```

---

### 错误 2: 字段名拼写错误 ❌

**错误信息**：`PGRST204: Could not find the 'plan_data' column`

**错误代码**：

```typescript
// ❌ 错误的字段名
.insert({
    plan_data: { execution: [...] },  // 字段不存在
})

// ✅ 正确的字段名
.insert({
    training_days: [...],  // 这才是正确的
})
```

**错误原因**：

- 混淆了不同表的字段名
- 项目里可能有多种命名风格

**正确做法**：

```bash
# ✅ 在相关 API 中搜索正确用法
grep -r "training_days" src/app/api/
grep -r "coach_plan_instances" src/app/api/
```

---

### 错误 3: 过早 return 导致逻辑短路 ❌

**最严重的错误**：应用计划成功（API 200），但页面依然空白。

**错误代码**：

```typescript
const loadData = async () => {
   const subsResponse = await subscriptionService.getCoachSubscriptions();

   // ❌ 这里直接 return 了！
   if (!subsResponse?.subscriptions?.length) {
      setLoading(false);
      return; // 没有订阅就退出，fetchSelf 根本不会执行
   }

   // ... 后面的 fetchSelf 逻辑永远不会被执行
   if (!res?.instance) {
      res = await planLibService.getInstance({ fetchSelf: true });
   }
};
```

**诊断过程**：

1. ⚠️ 怀疑是 RLS 问题 → 换用 serviceRoleSupabase → 没效果
2. ⚠️ 怀疑是 `source` 字段值问题 → 移除 filter → 没效果
3. ⚠️ 添加后端日志 → 发现日志**根本没打印**
4. ✅ 检查前端代码 → 发现 early return

**正确代码**：

```typescript
const loadData = async () => {
   const subsResponse = await subscriptionService.getCoachSubscriptions();

   // ✅ 不要 return，继续执行
   const activeSub = subsResponse?.subscriptions?.[0] || null;
   setSubscription(activeSub);

   // 即使没有订阅，也会执行到这里
   if (!res?.instance) {
      res = await planLibService.getInstance({ fetchSelf: true });
   }
};
```

**教训**：

- **后端日志没打印 = API 没被调用**，问题在前端
- 不要只盯着后端，要**全链路思考**
- 调试日志要加在**正确的位置**（前端 + 后端）

---

### 错误 4: 凭猜测诊断问题 ❌

**错误诊断链**：

```
页面空白 → 猜测是 RLS → 修改后端 → 没效果
         → 猜测是字段值 → 修改后端 → 没效果
         → 猜测是 ... → 修改后端 → 没效果
```

**正确诊断链**：

```
页面空白 → 添加日志 → 发现 API 没被调用 → 检查前端 → 找到 early return
```

**教训**：

- **不要凭猜测修改代码**，先用日志确认问题点
- 日志是最可靠的调试工具
- 系统性排查比碰运气更高效

---

### 数据库约束问题

**问题**：`coach_plan_instances` 表的 `coach_subscription_id` 原本是 NOT NULL

**解决**：运行 SQL 迁移

```sql
-- 允许自建计划（无订阅）
ALTER TABLE coach_plan_instances 
    ALTER COLUMN coach_subscription_id DROP NOT NULL;
ALTER TABLE coach_plan_instances 
    ALTER COLUMN coach_id DROP NOT NULL;

-- 添加来源标识
ALTER TABLE coach_plan_instances 
    ADD COLUMN IF NOT EXISTS source text DEFAULT 'coach';
```

**教训**：复用现有表结构时，要检查约束是否兼容新场景。

---

### 调试检查清单

当遇到"API 成功但页面不显示"的问题时：

1. **后端检查**
   - [ ] 添加日志确认 API 被调用
   - [ ] 打印查询条件和结果
   - [ ] 检查数据库是否有数据

2. **前端检查**
   - [ ] 是否有 early return 阻止了 API 调用？
   - [ ] 条件判断是否正确？
   - [ ] State 是否正确更新？

3. **全链路检查**
   - [ ] 打开浏览器 DevTools → Network 看请求是否发出
   - [ ] Console 是否有错误？
   - [ ] 后端终端是否有日志？

---

### 关键命令备忘

```bash
# 查看数据库 schema
cat supabase_schema.md | grep -A 50 "表名"

# 搜索字段用法
grep -rn "字段名" src/app/api/

# 搜索组件中的条件判断
grep -n "return" src/app/today-training/page.tsx

# 检查 API 调用
grep -rn "getInstance" src/
```

---

### 本次调试总结

| 错误类型     | 浪费时间 | 根本原因     |
| ------------ | -------- | ------------ |
| 不存在的字段 | 10分钟   | 未查 schema  |
| 字段名错误   | 10分钟   | 未查 schema  |
| 凭猜测修改   | 30分钟   | 未用日志定位 |
| early return | 10分钟   | 未检查前端   |

**核心教训**：

1. **先查 Schema，再写代码** - 不要凭记忆
2. **先加日志，再改代码** - 不要凭猜测
3. **前后端都要检查** - 不要只盯着一端
4. **日志没打印 = 代码没执行** - 这是最重要的信号
