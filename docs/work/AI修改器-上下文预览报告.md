# AI 修改器上下文预览报告

生成时间: 2026-02-23T07:31:47.037Z

## 场景一：教练端编辑具体学员计划（枭马葛 → zhaoccy）

### 教练改学员计划（全量上下文）

- **已启用**: 公共动作库
- **不可用**: 教练动作库

<details>
<summary>完整注入给 AI 的上下文文本</summary>

```
- 目标角色: coach
## 教练动作库摘要
- 教练动作库为空
## 公共动作库摘要
- 负重引体（底部暂停） (STRENGTH, likes=4)
- 负重臂屈伸 (STRENGTH, likes=4)
- 手腕热身 (STRENGTH, likes=2)
- 弹力带肩部热身 (STRENGTH, likes=2)
- 臂屈伸 (STRENGTH, likes=1)
- 引体向上 (STRENGTH, likes=1)
- 俄挺 (STRENGTH, likes=1)
- 前水平 (STRENGTH, likes=1)
- 直体双力臂 (STRENGTH, likes=1)
- 直腿双力臂 (STRENGTH, likes=1)
- 提膝双力臂 (STRENGTH, likes=1)
- 弹力带肩部热身 (STRENGTH, likes=1)
- 团身引体 (STRENGTH, likes=1)
- 手肘松解 (STRENGTH, likes=1)
- 负重臂屈伸-弹力带辅助 (STRENGTH, likes=1)
- 徒手深蹲 (STRENGTH, likes=0)
- 箱式深蹲 (STRENGTH, likes=0)
- 靠墙静蹲 (STRENGTH, likes=0)
- 臀桥 (STRENGTH, likes=0)
- 跪姿俯卧撑 (STRENGTH, likes=0)
## 执行权限说明
- 当前接口仅能修改当前计划 trainingDays；不能直接新建模板。
- 若你判断应沉淀为模板，请在 actionPlan 中明确提出“建议创建模板”与模板命名建议。
```

</details>

## 场景二：教练端编辑模板

### 教练改模板（无学员上下文）

- **已启用**: 公共动作库
- **不可用**: 教练动作库

<details>
<summary>完整注入给 AI 的上下文文本</summary>

```
- 目标角色: coach
## 教练动作库摘要
- 教练动作库为空
## 公共动作库摘要
- 负重引体（底部暂停） (STRENGTH, likes=4)
- 负重臂屈伸 (STRENGTH, likes=4)
- 手腕热身 (STRENGTH, likes=2)
- 弹力带肩部热身 (STRENGTH, likes=2)
- 臂屈伸 (STRENGTH, likes=1)
- 引体向上 (STRENGTH, likes=1)
- 俄挺 (STRENGTH, likes=1)
- 前水平 (STRENGTH, likes=1)
- 直体双力臂 (STRENGTH, likes=1)
- 直腿双力臂 (STRENGTH, likes=1)
- 提膝双力臂 (STRENGTH, likes=1)
- 弹力带肩部热身 (STRENGTH, likes=1)
- 团身引体 (STRENGTH, likes=1)
- 手肘松解 (STRENGTH, likes=1)
- 负重臂屈伸-弹力带辅助 (STRENGTH, likes=1)
- 徒手深蹲 (STRENGTH, likes=0)
- 箱式深蹲 (STRENGTH, likes=0)
- 靠墙静蹲 (STRENGTH, likes=0)
- 臀桥 (STRENGTH, likes=0)
- 跪姿俯卧撑 (STRENGTH, likes=0)
## 执行权限说明
- 当前接口仅能修改当前计划 trainingDays；不能直接新建模板。
- 若你判断应沉淀为模板，请在 actionPlan 中明确提出“建议创建模板”与模板命名建议。
```

</details>

## 场景三：学员端创建计划（zhaoccy）

### 学员建计划（学员侧上下文）

- **已启用**: 学员基本情况、执行记录、学员动作库、公共动作库
- **不可用**: 学员问卷

<details>
<summary>完整注入给 AI 的上下文文本</summary>

```
- 目标角色: student
- 目标学员 user_id: 70c89d84-5413-49d9-b4d5-834aaf64ff7c
## 学员档案
- fitness_goal: 力量提升
- fitness_level: beginner
- weight: 60
- 其他档案快照: {"gender":"female"}
## 学员问卷
- 未找到可用问卷回答
## 历史执行摘要
- 总执行 11 次，完成 9 次，进行中 1 次，跳过 0 次
- 最近执行: [{"id":"56259409-bdb5-490a-9a18-a13382ddee87","instance_id":"74b040a5-09d1-48c9-b431-57b107f2175b","day_index":19,"status":"completed","started_at":"2026-02-01T14:36:31.782623+00:00","completed_at":"2026-02-08T12:42:39.397+00:00"},{"id":"1fdf10a3-b4d8-4300-93fa-be9e1d680d99","instance_id":"74b040a5-09d1-48c9-b431-57b107f2175b","day_index":17,"status":"completed","started_at":"2026-01-28T01:31:34.323102+00:00","completed_at":"2026-01-30T06:00:24.002+00:00"},{"id":"071f0b13-2f70-40b4-87b5-25c839c6b51b","instance_id":...
## 学员动作库摘要
- 高位下拉 (STRENGTH)
- 反手负重引体（顶端暂停） (STRENGTH)
- 负重引体（顶端暂停） (STRENGTH)
- 反手负重引体（底部暂停） (STRENGTH)
- 高位引体 (STRENGTH)
- 划船类动作 (STRENGTH)
- 二头弯举 (STRENGTH)
- 锤式弯举 (STRENGTH)
- 海豹划船 (STRENGTH)
## 公共动作库摘要
- 负重引体（底部暂停） (STRENGTH, likes=4)
- 负重臂屈伸 (STRENGTH, likes=4)
- 手腕热身 (STRENGTH, likes=2)
- 弹力带肩部热身 (STRENGTH, likes=2)
- 臂屈伸 (STRENGTH, likes=1)
- 引体向上 (STRENGTH, likes=1)
- 俄挺 (STRENGTH, likes=1)
- 前水平 (STRENGTH, likes=1)
- 直体双力臂 (STRENGTH, likes=1)
- 直腿双力臂 (STRENGTH, likes=1)
- 提膝双力臂 (STRENGTH, likes=1)
- 弹力带肩部热身 (STRENGTH, likes=1)
- 团身引体 (STRENGTH, likes=1)
- 手肘松解 (STRENGTH, likes=1)
- 负重臂屈伸-弹力带辅助 (STRENGTH, likes=1)
- 徒手深蹲 (STRENGTH, likes=0)
- 箱式深蹲 (STRENGTH, likes=0)
- 靠墙静蹲 (STRENGTH, likes=0)
- 臀桥 (STRENGTH, likes=0)
- 跪姿俯卧撑 (STRENGTH, likes=0)
## 执行权限说明
- 当前接口仅能修改当前计划 trainingDays；不能直接新建模板。
- 若你判断应沉淀为模板，请在 actionPlan 中明确提出“建议创建模板”与模板命名建议。
```

</details>
