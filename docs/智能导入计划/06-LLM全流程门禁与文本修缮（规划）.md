## 06. LLM 全流程门禁与文本修缮（规划）

> 状态：规划中（不实现，仅用于对齐研发预期）
>
> 目标：把“输入是否完备/是否太脏”的判断与修缮尽量交给 LLM，使导入更自由；当信息不完备时明确拒绝继续（除非用户强行继续）。

### 6.1 背景：为什么要加 Stage0

当前链路是两阶段：

- 阶段 1：动作识别（`parse-actions`）
- 阶段 2：计划结构识别（`parse-template`）

但真实输入存在两类“卡点”：

- **信息不完备**：例如缺少训练日/休息日结构、动作边界不清、强度与组次无法落到结构化字段也无法可靠落到 note。
- **信息太脏**：例如带大量链接/Markdown、顺序混乱、同一信息多种写法掺杂，导致解析结果波动。

因此新增一个**Stage0（LLM 门禁 + 修缮）**，在进入阶段 1/2 之前做一次“质量预检”。

### 6.2 新增链路（目标形态）

> 强调：这里的“全流程交给 LLM”指的是**判断 + 轻量修缮**尽量交给 LLM；阶段 1/2 仍然走既有解析链路（保证与现有 UI/数据结构兼容）。

新增整体顺序：

1. **Stage0：完备性判断（LLM）**
2. **Stage0：轻量修缮（LLM，可选，仅在“完备但太脏”时执行）**
3. 进入现有阶段 1（动作识别）
4. 进入现有阶段 2（计划结构识别）

### 6.3 Stage0 的输入与输出（建议严格 JSON）

#### 6.3.1 输入

- `text`: string（用户原始粘贴文本）
- `mode`: `"strict" | "force"`（严格模式默认拒绝；force 表示用户强行识别）
- `constraints`: object（硬约束说明，见 6.4）

可选输入（若希望更懂业务）：

- `actionLibraryHints`: string[]（仅私有库动作名列表或摘要；不要把公共库喂进去）
- `knownSchema`: 用于提示“系统字段能力边界”（例如 sets/reps/rest/intensity/note/dayNote/globalDescription）

#### 6.3.2 输出（完备性判断）

```json
{
  "isComplete": true,
  "completenessLevel": "complete | mostly-complete | incomplete",
  "missing": [
    {
      "scope": "global | day | action",
      "where": "W1D1 / 第1周第2天 / 行号或片段",
      "field": "dayMarkers | actionBoundaries | sets | reps | restSeconds | intensity | weekCount | restDays",
      "reason": "为什么缺",
      "exampleFix": "给用户的示例补写方式"
    }
  ],
  "dirtyIssues": [
    {
      "type": "markdown-link | noisy-lines | inconsistent-markers | mixed-order | ambiguous",
      "snippet": "原文片段",
      "suggestion": "如何修缮/如何改写格式（不改语义）"
    }
  ],
  "shouldRepair": true,
  "canProceed": true,
  "userMessage": "给用户看的总结话术（中文）"
}
```

#### 6.3.3 输出（轻量修缮）

```json
{
  "repairedText": "修缮后的文本（尽量保持语义不变）",
  "diffSummary": [
    "删除了 Markdown 链接，仅保留动作文字",
    "统一了 W#D# 标题格式",
    "合并了多余空行"
  ],
  "warnings": [
    "检测到多处含糊描述：…（建议用户补充）"
  ]
}
```

### 6.4 “全流程交给 LLM”时必须声明的硬约束（避免 LLM 乱改）

Stage0 的修缮必须遵守“只修格式，不改事实”：

- **允许变换**
  - 去掉 Markdown 链接：`[负重引体](/xxx)` → `负重引体`
  - 统一标题格式：`第一周 (W1)`/`W1 D1`/`W1D1` → 标准化（保持含义）
  - 合并多余空行、统一中英文标点/空格
  - 将明显的“说明段落”挪到更合适的位置（例如放在开头当全局说明），但必须原文保留
- **禁止变换（红线）**
  - 禁止新增/删除任何数字（次数、组数、RM、分钟、重量、百分比等）
  - 禁止改写动作名为另一个动作（除非仅删除链接/符号，动作文字不变）
  - 禁止把“可选/建议/注意事项”硬变成结构化字段（只能留在 note/dayNote/globalDescription）

> 实现时建议增加一个“安全校验”：修缮前后抽取所有数字 token（含 `11RM`、`4组9次`、`4-5分钟`、`127.5kg`、`70%`）必须一致，否则拒绝采用 `repairedText`，回退原文并提示用户。

### 6.5 阻断策略（拒绝继续 vs 强行继续）

默认（strict）：

- 若 `isComplete=false` 或 `canProceed=false`：**拒绝进入阶段 1/2**
  - UI 展示：缺失项清单 + “示例补写”
  - 提供一键复制“建议格式模板”

强行（force）：

- 用户点击“强行识别（可能不准确）”后，允许进入阶段 1/2
  - 但 Stage0 必须把 `warnings` 传给后续 UI（让用户知道风险点）

### 6.6 与现有阶段 1/2 的衔接方式（不破坏现有实现）

衔接建议：

- 若 Stage0 产出 `repairedText`：后续阶段 1/2 使用 `repairedText` 作为输入文本（同时保留原始 text 用于 trace）
- 若 Stage0 不修缮：后续阶段 1/2 继续使用原始 text

保证两点：

- **全局说明**仍由既有 `splitPlanGlobalPreface()` 提取（或 Stage0 直接输出 `globalDescription` 供后续复用）
- 既有 trace/case 机制仍可复现：能看到 Stage0 前后的文本与判断依据

### 6.7 计划新增的接口与前端步骤（仅规划）

#### 6.7.1 API（教练端，规划）

- `POST /api/plan-lib/smart-import/preflight`（Stage0 完备性判断）
- `POST /api/plan-lib/smart-import/repair-text`（Stage0 文本修缮，可合并到 preflight）

#### 6.7.2 前端（规划）

在 `SmartImportDialog` 增加一个“预检”步骤（Step -1 或 Step 0 内部）：

- 运行 Stage0
- 若拒绝：展示缺失清单与建议，提供“返回编辑文本/强行继续”
- 若通过且 `shouldRepair=true`：展示“修缮预览（可展开查看）”，用户确认后再进入现有 Step1（解析动作）

### 6.8 留痕/用例文件命名（规划）

若启用 trace，建议新增 Stage0 文件（保持脚本友好）：

- `stage0.preflight.prompt.txt`
- `stage0.preflight.raw.txt`
- `stage0.preflight.parsed.json`
- `stage0.preflight.result.json`（最终判断输出）
- `stage0.repair.prompt.txt`
- `stage0.repair.raw.txt`
- `stage0.repair.parsed.json`
- `stage0.repair.result.json`（包含 repairedText）

并在 `meta.json` 中记录是否启用 Stage0、是否通过、是否强行继续。

### 6.9 风险与成本（必须提前讲清楚）

- **成本上升**：Stage0 至少增加 1 次 LLM 调用（若修缮再加 1 次），且 prompt 通常较长（要写清硬约束）。
- **稳定性波动**：LLM 清洗如果不加“红线约束 + 校验”，容易出现“偷偷改数字/改语义”的不可控风险。
- **体验权衡**：拒绝继续会增加用户一步操作，但能显著降低“垃圾输入导致导入结果崩坏”的投诉成本。

### 6.10 验收标准（工程实现时建议）

- **拒绝准确**：明显不完备的输入能被拦截，并给出可操作的补写建议。
- **修缮无损**：修缮前后数字 token 不变；动作文字不变（仅去链接/符号/空格/标题格式）。
- **收益可见**：对“脏但完备”的输入，阶段 1/2 的输出稳定性提升（用 `cases-generated` 做对比回归）。

