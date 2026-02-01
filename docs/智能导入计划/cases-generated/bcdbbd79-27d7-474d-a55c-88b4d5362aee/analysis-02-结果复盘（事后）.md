## 结果复盘（事后）

- traceId：`bcdbbd79-27d7-474d-a55c-88b4d5362aee`
- 重点对照文件（建议工程师先看这几个）：
  - 阶段 1 最终：`stage1.postprocessed.json`
  - 阶段 2 最终：`stage2.merged.json`
  - 各周中间：`stage2.week-1.parsed.json`、`stage2.week-2.parsed.json`
  - UI 快照：`ui.snapshot.json`

### 1. 总览结论

- **输入只包含 W1/W2（两周）**，但最终 `stage2.merged.json.weeks = 4`，因此前端模板编辑器按 4 周渲染，出现你看到的“导入了 4 周”的现象。
- 结构化解析整体质量不错：多数训练日/休息日、强度与计时动作都能落到结构化字段；但仍有几处关键问题需要记录。

### 2. 关键问题 1：weeks 被“猜成 4 周”（导致 UI 显示 4 周）

证据链：

- `stage2.week-1.parsed.json`：`"weeks": 1`
- `stage2.week-2.parsed.json`：`"weeks": 4`  ← **模型在第 2 周片段里把周数猜成了 4**
- 后端合并逻辑会取最大周数（`maxWeek = max(chunk.weeks, chunk.weekIndex)`），因此最终：
  - `stage2.merged.json`: `"weeks": 4`
- 前端在导入模板时按 `weeks*7` 生成日历网格，所以即使 `trainingDays` 实际只有 weekIndex=1/2，也会显示出 week 3/4 的空白天。

建议修复方向（不要求立刻实现）：

- **不要信任模型返回的 weeks**：后端 weeks 直接取 `splitPlanByWeekSections()` 得到的最大 weekIndex（本用例就是 2），或对模型 weeks 做 clamp（例如 `min(modelWeeks, maxSectionWeek)`）。
- 让模型只返回 `trainingDays`，weeks 由后端确定性计算。

### 3. 阶段 1（动作识别）复盘

#### 3.1 动作库命中情况

`stage1.postprocessed.json` 显示：

- 已命中的私有库动作：平板支撑、自重引体、双手悬垂、负重引体、锤式弯举、折刀撑
- 未命中的动作（被当作新建）：深蹲、卧推、硬拉、引体向上、引体悬挂

这会导致导入过程需要创建新动作（UI 中应确认 attrs/部位等）。

#### 3.2 attrs/profile 的现实表现

- 你在输入里写了“平板支撑是计时动作，建议属性选持续时间不选次数”
- 但 `stage1.postprocessed.json` 中平板支撑仍沿用了库内 attrs（包含“次数/强度/休息时间”），因为它匹配到了既有动作，后处理会“以私有库配置为准”。

结论：当前实现下，“计时动作 attrs”能否正确，强依赖你私有动作库里该动作的 attrs 配置；这也是你提出“Profiles 选择”的动机之一。

### 4. 阶段 2（计划结构识别）复盘

#### 4.1 强度解析：绝对重量优先（基本通过）

示例（W1D1 深蹲）：

- `fixedWeight: 112.5` + `relativeIntensity: 75%` 同时存在
- 符合“绝对重量优先”的方向（两者都保留）

#### 4.2 计时动作解析：大部分通过，但出现一次“40秒没进 durationSeconds”

- Week1 的平板支撑：`durationSeconds: 45` ✅
- Week1 的引体悬挂/双手悬垂：`durationSeconds: 30` ✅
- **Week2 的平板支撑**：
  - 结果里 `durationSeconds` 缺失（或为 null），但 note 里写了“每组40秒” ❌

这会导致学员端/执行页无法直接按计时字段渲染，需要人工修正。

可能原因：

- 平板支撑动作 attrs 在私有库里包含“次数”，模型在 week2 没把它当计时字段解析；
- 或模型输出中本就没给 `durationSeconds`，后处理没有“从 note 抽取 xx 秒”的兜底。

建议修复方向：

- 若动作 attrs/profile 为 TIME_STRENGTH，强制从文本中抽取 `xx秒/xx分钟` 填入 `durationSeconds`；
- 或在后处理加一个轻量兜底：当 note 命中 `每组(\d+)秒` 且 durationSeconds 为空时，回填。

#### 4.3 数据形态问题：fixedWeight 有时是 number（不稳定）

示例（Week2 Day1 深蹲/卧推）：`fixedWeight: 120` / `fixedWeight: 82.5`（number）

而 Week1 的 deep squat 里 fixedWeight 出现在混合结构中也被保留为 number。  
当前后处理对 “`fixedWeight: number`” 没有统一包装成 `{ value, unit }`，会带来前端/DB 类型兼容风险（你之前在另一个案例里也见过类似问题）。

建议修复方向：

- 在阶段 2 后处理统一把 `fixedWeight: number` 归一成 `{ value: number, unit: "kg" }`。

### 5. 结论：这次“为什么看起来怪”的一句话解释

不是你输入写错，而是 **模型在 week-2 片段里把 weeks 猜成 4**，后端合并取最大值导致 `weeks=4`，前端按 weeks 渲染所以显示 4 周；实际 `trainingDays` 主要还是 weekIndex=1/2 的内容。

