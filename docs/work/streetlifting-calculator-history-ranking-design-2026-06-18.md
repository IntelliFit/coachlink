# 力量计算器历史结果与趣味排名方案（2026-06-18）

## 背景

当前街健力量计算器在 Web 与微信小程序两端都更像一次性工具：

- Web 端结果只存在页面内状态与本机草稿。
- 小程序端只保留：
  - 草稿 `sl_calc_form_data`
  - 最近一次结果 `sl_calc_result`
  - 最近一次正式计算快照 `sl_calc_last_run`

这意味着用户可以“算一次”，但无法形成持续反馈：

- 看不到自己的长期变化
- 看不到个人最佳
- 看不到自己在同动作人群中的大致位置

## 目标

### 核心目标

1. 让力量计算器从“一次性工具”升级为“可回访的小成长系统”
2. 在不引入高审核成本的前提下，增强趣味性与留存
3. 为后续视频认证榜、训练执行自动入榜留出演进空间

### 非目标

- 第一阶段不做“严肃竞技榜”
- 第一阶段不把所有动作混成一个总榜
- 第一阶段不把 `反推次数` / `反推做组重量` 当成正式成绩

## 用户价值

### V1 用户感知

- 我能看到自己最近算过什么
- 我能看到自己该动作的个人最佳
- 我能看到这次比上次强了还是弱了
- 我能看到自己大概超过了多少同动作用户

### V1.5 用户感知

- 我能看到这个动作的趣味榜单
- 我能知道自己排在第几
- 我能看到榜单头部用户，但不会被刷屏用户淹没

### V2 用户感知

- 我能区分“自填趣味榜”和“认证榜”
- 我的视频认证成绩可以进入更正式的榜单

## 关键产品判断

## 1. 先做“历史”，再做“排名”

推荐优先级：

1. 我的历史
2. 个人最佳 + 较上次变化
3. 超越百分位
4. 同动作趣味榜
5. 认证榜 / 视频榜

原因：

- 历史是长期价值，排名是社交放大器
- 历史数据一旦沉淀，后续做榜单、徽章、月报都更容易

## 2. 排名必须按动作分榜

不能把以下动作混在一个榜里：

- 负重引体向上
- 负重双杠臂屈伸
- 实力推
- 杠铃弯举
- 深蹲
- 卧推
- 硬拉

建议至少按以下维度分榜：

- `exercise_type`
- `gender`

后续可扩展：

- `verified_level`
- 时间范围（全部 / 近30天 / 本月）

## 3. 第一阶段榜单定性为“趣味榜”

当前力量计算器输入是用户自填，不是训练执行自动产生，也不是视频审核结果。

因此第一阶段榜单应明确标注：

- `趣味榜`
- `基于用户自填成绩自动计算`
- `非官方认证成绩`

避免用户误解为严格比赛排名。

## 4. 只有部分模式允许入榜

### 推荐入榜

- `forward`

### 不推荐入榜

- `reverse_weight`
- `reverse_reps`

### 可选独立榜，不并入正式趣味榜

- `day_max`

原因：

- `forward` 最接近“我实际做了多少”
- `reverse_*` 是反推值，不是实际完成成绩
- `day_max` 是模型估算，和正式做组成绩应分开展示

## 架构建议

## 总体结论

### 推荐方案

新增独立历史表 `streetlifting_calc_records`，不要直接把 `leaderboard_entries` 当作计算器历史库。

### 原因

现有 `leaderboard_entries` 更像“活动投稿榜”：

- 强依赖 `leaderboard_templates`
- 存在 `pending/approved` 审核语义
- 当前 `create-entry` 会在同用户同模板下删除旧记录，不适合长期保存完整历史

适合作为：

- 活动型排行榜
- 提交审核型榜单
- 后续认证榜展示层

不适合作为：

- 用户个人的原始计算历史事实表

## 数据模型

### 新表：`streetlifting_calc_records`

建议字段：

- `id uuid primary key`
- `user_id uuid not null`
- `source_surface text not null`
  - `web`
  - `weapp`
- `exercise_type text not null`
- `calc_mode text not null`
- `gender text not null`
- `bodyweight_kg numeric not null`
- `reps numeric null`
- `sets numeric null`
- `rest_cat text null`
- `form_quality text null`
- `penalty_weight_kg numeric null`
- `added_weight_kg numeric null`
- `working_added_weight_kg numeric null`
- `lift_weight_kg numeric null`
- `working_lift_weight_kg numeric null`
- `target_1rm_kg numeric null`
- `target_added_1rm_kg numeric null`
- `estimated_1rm_kg numeric not null`
- `final_score numeric not null`
- `coefficient numeric not null`
- `adjusted_used_weight_kg numeric null`
- `computed_added_weight_kg numeric null`
- `computed_reps numeric null`
- `result_level text null`
- `is_ranking_eligible boolean not null default false`
- `verified_level text not null default 'self_reported'`
- `input_snapshot jsonb not null`
- `result_snapshot jsonb not null`
- `created_at timestamptz not null default now()`

### 索引建议

- `idx_streetlifting_calc_records_user_created_at`
  - `(user_id, created_at desc)`
- `idx_streetlifting_calc_records_user_exercise_score`
  - `(user_id, exercise_type, final_score desc, created_at asc)`
- `idx_streetlifting_calc_records_ranking_bucket`
  - `(exercise_type, gender, final_score desc, created_at asc)`
  - 条件：`where is_ranking_eligible = true`

## 排名口径

### 排名桶（ranking bucket）

第一阶段：

- `exercise_type + gender`

例如：

- 男子负重引体榜
- 女子负重引体榜
- 男子卧推榜

### 入榜规则

- 仅 `calc_mode = 'forward'`
- `verified_level = 'self_reported'`
- 每个用户每个排名桶只取最佳一条

### 排序规则

主排序：

- `final_score desc`

并列 tie-breaker：

1. `estimated_1rm_kg desc`
2. `created_at asc`

说明：

- 主排序按计算器对外承诺的核心分数走
- 同分时更高 1RM 靠前
- 再同分则保留先达成者靠前

### 百分位口径

结果页展示建议优先用：

- `超过 xx% 用户`

计算方式：

- 以同排名桶“每用户最佳记录集”为分母
- 当前用户最佳成绩在其中的百分位

原因：

- 比“第 183 名”更直观
- 早期样本量较小时观感更好

## 接口设计

## 1. 保存计算结果

`POST /api/streetlifting-index/calculator/save-result`

### 请求

- 提交原始输入参数
- 提交 `source_surface`

### 服务端职责

- 重新计算，不信任客户端直接上传的 `score`
- 生成标准结果
- 判断是否允许入榜
- 写入 `streetlifting_calc_records`
- 返回：
  - 当前记录
  - 当前动作个人最佳
  - 较上次变化
  - 百分位

### 重要原则

服务端必须自己重算结果，不能把客户端的 `final_score` 直接落库。

否则很容易被伪造请求刷榜。

## 2. 我的历史

`GET /api/streetlifting-index/calculator/history`

参数建议：

- `exercise_type?`
- `page`
- `limit`

返回：

- 历史列表
- 个人最佳
- 最近一次

## 3. 我的摘要

`GET /api/streetlifting-index/calculator/summary`

参数建议：

- `exercise_type`

返回：

- 个人最佳
- 最近一次
- 较上次变化
- 超越百分位
- 当前榜单名次

## 4. 趣味榜

`GET /api/streetlifting-index/calculator/ranking`

参数建议：

- `exercise_type`
- `gender`
- `period?=all|30d|month`
- `page`
- `limit`

返回：

- 排名列表（每用户一条最佳）
- 当前用户自己的名次与最佳记录

## 客户端设计

## 微信小程序 V1

### 计算页

保留当前“上一次正式计算”卡片，并新增入口：

- `我的历史`
- `我的最佳`

### 结果页

在现有结果卡片下新增三块：

1. `历史最佳`
2. `较上次变化`
3. `超过 xx% 用户`

再加一个次级入口：

- `查看同动作趣味榜`

### 历史页

建议新增页面：

- `streetlifting/index/calculator/history`

内容：

- 最近记录列表
- 动作筛选
- 最近 30 天最佳
- 历史最佳

## Web V1

### 计算页内联展示

Web 可直接在结果区下方增加：

- 最近 5 次
- 当前动作最佳
- 超越百分位

不一定第一版单独开页。

## 本地缓存策略（遵循移动端缓存规则）

适用于小程序：

### 存储范围

- 仅缓存最近 60 天历史记录

### 写入策略

1. 本地先写
2. 异步同步云端
3. 云端成功返回后覆盖本地标准结果

### 读取策略

1. 先读本地缓存秒开
2. 后台拉云端最新
3. 云端为准覆盖本地

建议新增缓存键：

- `streetlifting_calc_history_v1`

## 防刷与风控

第一阶段不做重风控，但至少做这些约束：

1. 服务端重算结果
2. 只允许登录用户写入云端历史
3. 排名只取每用户每动作最佳一条
4. 明确标记为 `self_reported`
5. 结果页与榜单显式写明 `趣味榜`

可选增强：

- 同一输入短时间重复提交去重
- 过高异常值打标但不拦截
- 未来增加 `verified_level`

## 与现有排行榜体系的关系

## 第一阶段

不直接复用 `leaderboard_entries` 存个人历史。

## 第二阶段可选

当某动作趣味榜稳定后，可以由后台把“每用户最佳自填记录”镜像到某个固定 `leaderboard_template`，用于复用现有排行榜页面与运营能力。

此时关系为：

- `streetlifting_calc_records` = 原始事实表
- `leaderboard_entries` = 展示/活动层镜像

这样既保留历史，又不破坏现有排行榜的活动语义。

## 推荐实施阶段

## Phase 1：个人成长版

- 新表 `streetlifting_calc_records`
- 保存云端历史
- 小程序结果页显示：
  - 历史最佳
  - 较上次变化
  - 超越百分位
- 小程序历史页

## Phase 2：趣味榜

- 同动作榜单
- 结果页跳榜单
- 榜单只取每用户最佳

## Phase 3：认证榜

- 接视频
- 接审核
- `verified_level` 拆分
- 自填趣味榜 / 认证榜双轨

## 推荐最终结论

建议落地方向：

1. 先做云端历史
2. 结果页先加 `个人最佳 + 较上次变化 + 超越百分位`
3. 排名先做“同动作趣味榜”
4. 排名仅纳入 `forward`
5. 不直接拿 `leaderboard_entries` 当历史表

这样能在较低复杂度下，最快把“更有趣”这件事做出来，同时不给后续认证化路线埋坑。
