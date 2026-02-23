# AI 修改器：上下文配置与测试

## 一、API 默认读取的上下文（未传 contextOptions 时）

| 开关 | 默认值 | 说明 |
|------|--------|------|
| `includeStudentProfile` | **true** | 学员档案（需配合 subscriptionId 或学员端） |
| `includeStudentQuestionnaire` | **true** | 学员问卷 |
| `includeExecutionHistory` | **true** | 历史执行记录 |
| `includeStudentActionLib` | **false** | 学员动作库 |
| `includeCoachActionLib` | **true** | 教练动作库（仅教练端有效） |
| `includePublicActionLib` | **true** | 公共动作库 |
| `includeCoachTemplates` | **true** | 教练模板库（仅教练端有效） |
| `includeTemplateMatch` | **true** | 模板匹配建议（基于水平/兴趣/频次） |
| `includeFeedbacks` | **true** | 学员训练反馈 |
| `subscriptionId` | 无 | 教练改学员计划时必传，用于解析“目标学员” |

## 二、各入口的默认配置（前端传入的 contextOptions）

| 入口 | 路径 | targetActionType | 默认开启的上下文 |
|------|------|------------------|------------------|
| 教练改学员计划 | `/dashboard/students/plan/[id]` | coach | subscriptionId + 学员档案/问卷/执行/反馈 + 学员动作库 + 教练动作库 + 公共库 + 教练模板 + 模板匹配（全开） |
| 教练改模板 | `/dashboard/plan-lib/edit/[id]` | coach | 教练动作库 + 公共库 + 教练模板（学员相关关闭） |
| 教练建模板 | `/dashboard/plan-lib/create` | coach | 同上 |
| 学员建计划 | `/me/plan-lib/create` | student | 学员档案/问卷/执行 + 学员动作库 + 公共库（教练模板、模板匹配、反馈 关闭） |

## 三、每个开关对应 AI 实际读到的内容

- **学员基本情况**（includeStudentProfile + subjectUserId）：`user_profiles` 快照：fitness_goal、fitness_level、weight、gender、birthdate、injuries、training_experience 等（约 360 字 JSON 截断）。
- **学员问卷**（includeStudentQuestionnaire）：`onboarding_questionnaires` 最新 answers 或订阅侧 questionnaires，约 700 字 JSON 截断。
- **执行记录**（includeExecutionHistory）：该学员最近 6 个计划实例下的 `plan_instance_executions` 摘要（总/完成/进行中/跳过次数）+ 最近 5 条执行记录快照（约 520 字）。
- **学员反馈**（includeFeedbacks）：`execution_feedbacks` 最近 10 条：第几天、难度、内容前 60 字。
- **教练动作库**（includeCoachActionLib）：教练动作库最近 30 条中前 20 条：name、type。
- **学员动作库**（includeStudentActionLib）：学员动作库最近 30 条中前 20 条：name、type。
- **公共动作库**（includePublicActionLib）：`community_actions` 按 like_count 取前 20 条：name、type、like_count。
- **教练模板**（includeCoachTemplates）：教练模板库最近 12 条（排除当前 templateId）中前 6 条：name、suitable_for、training_days_count、tags。
- **模板匹配**（includeTemplateMatch）：基于上述教练模板 + 学员水平/问卷答案算出的前 3 个推荐模板及得分理由。

上述所有内容会拼成一段「额外上下文」文本，注入到 AI 的 system prompt 中（在「计划详情」「可用动作列表」之后、「用户指令」之前）。

## 四、高效测试方式：上下文预览 API

不跑 AI、不写库，只返回“本次请求下”会注入给 AI 的完整上下文文本及启用/不可用项。

**接口**：`POST /api/plan-lib/batch-operation-context-preview`

**请求体**（与 batch-operation 的上下文相关字段一致）：

```json
{
  "targetActionType": "coach",
  "templateId": "可选，当前编辑的模板 ID",
  "contextOptions": {
    "subscriptionId": "教练改学员计划时传订阅 ID",
    "includeStudentProfile": true,
    "includeStudentQuestionnaire": true,
    "includeExecutionHistory": true,
    "includeStudentActionLib": true,
    "includeCoachActionLib": true,
    "includePublicActionLib": true,
    "includeCoachTemplates": true,
    "includeTemplateMatch": true,
    "includeFeedbacks": true
  }
}
```

**响应**：

```json
{
  "success": true,
  "data": {
    "prompt": "完整注入给 AI 的上下文文本（与真实执行时一致）",
    "enabled": ["学员基本情况", "学员问卷", "执行记录", "教练动作库", ...],
    "unavailable": ["学员反馈", ...]
  }
}
```

**测试建议**：

1. **教练改学员计划**：登录教练账号，body 中传 `targetActionType: "coach"`、`contextOptions.subscriptionId` 为某学员订阅 ID，查看 `prompt` 是否包含该学员档案/问卷/执行/反馈及教练模板。
2. **学员建计划**：登录学员账号，`targetActionType: "student"`，不传 subscriptionId，查看是否只有学员侧档案/问卷/学员动作库/公共库。
3. **改模板**：`targetActionType: "coach"`、不传 subscriptionId、传 `templateId`，查看是否只有教练动作库/公共库/教练模板，无学员相关段落。
4. 对比 `enabled` / `unavailable` 与预期（如无反馈数据时「学员反馈」应在 unavailable）。

认证与 batch-operation 一致（Session），仅教练可预览 coach 上下文。
