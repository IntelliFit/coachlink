# 教练全自动托管闭环：端到端测试台

把下面整条链路放在一个进程里跑，完全离线（不连 Supabase、不调大模型、不发真实消息）：

1. 订阅生效 → `autoMatchPlanForSubscription` → `onSubscriptionActivated` → `createAiInstanceForSubscription`（LLM 两阶段生成；计划模型报错时走规则匹配 `fillTemplate`）
2. `startPlanIntake`：计划助理以教练账号私信学员，问缺的 1RM、体重和 AI 留下的疑问
3. 学员经真实的 `POST /api/chat/send-message` 回复 → `after()` 里 `handlePlanIntakeReply` → 写 `personal_records_history`、`user_profiles.weight`，给学员发确认、给教练发系统通知；计划助理接了就不触发 AI 分身
4. `POST /api/execution/start` 与 `POST /api/plan-lib/get-instance` 按新 1RM 出公斤数

运行：

```bash
npx vitest run tests/coach-automation-e2e
```

`HARNESS_DUMP=1` 会在每个测试后打印聊天记录和被吞掉的 `console.error`。

## 哪些是真的，哪些是替身

| 部分 | 做法 |
| --- | --- |
| 路由、服务、计划脚本编译、1RM 聚合、重量公式 | 真实代码 |
| Supabase | `src/testUtils/fakeSupabase.ts`：内存 PostgREST，支持本链路用到的查询形状（过滤、排序、`single`/`maybeSingle` 多行报错、`upsert ignoreDuplicates`、按 `updated_at` 的 CAS、`coaches!inner(user_id)` 嵌入、`count/head`、rpc）。NULL 比较、`neq` 排除 NULL、ISO 时间按时间比较，与 Postgres 一致；没配置的嵌入关系会像 JSONB 环境一样报 PGRST200 |
| 大模型 | `@/lib/coachlinkLlm` 换成脚本：计划模型按 prompt 区分选模板/出 `plan_script`；回复提取按场景函数作答（拿到解析好的待确认问题和学员原文）；AI 分身回固定文案 |
| 登录 | 请求头 `x-test-user-id` |
| `after()` | 进队列，测试用 `runAfterTasks()` 一起跑，或 `startNextAfterTask()` 只启动一个，配合 `createGate()` 卡住模型调用制造并发时机 |
| 时间 | 只假 `Date`：每次查询 +5ms、模型调用 +1.5~3s；`advanceDays()` 模拟过期 |
| 网络 | `fetch` 被替换成直接报错，`afterEach` 断言没有任何网络请求 |

## 场景

`intake-loop.test.ts`（数据链路）：新学员无 1RM（问 → 答 → 训练出公斤数，计划页同口径）、计划模型失败走规则匹配、只有档案运动卡、负重动作缺体重分两条回答、高次数回答、“不知道”、伤病（带回答 / 只说伤病）、复购同一教练（用学员自己的 1RM，不用教练本人的；回复落到新订阅的计划助理）、一条一项地回答。

`intake-messaging.test.ts`（消息与时序）：一秒内连发两条、第一条还在模型里时第二条到达（部分回答 / 已答完）、重复激活（顺序 / 并发）、AI 分身开着时每条消息恰好一条回复、提取模型报错时退回 AI 分身并在下一条重读、教练自己的消息不被当成回答、草稿模式、7 天过期。

## Bug 清单（2026-11-04）

### 已在本分支修复

| ID | 位置 | 现象 → 修复 | 回归 |
| --- | --- | --- | --- |
| EXEC-RM-LABEL | `src/app/api/execution/start/route.ts:493` | RM 强度算出公斤数时 `planned_intensity` 仍是 `强度` 的裸数字，小程序显示“102.5kg · 5次 · 5”。改为 `5RM`（与固定重量分支一致）。影响所有按 RM 开的计划，不只自动托管 | `intake-loop` 新学员场景断言 `intensity: "5RM"` |
| DEEPSEEK-MISSING-IMPORT | `src/lib/deepseek.ts:77` | `callDeepSeekChat` 用了没导入的 `getCoachlinkLlm`，运行时 ReferenceError，`/api/knowledge/ai/ask` 每次都落到兜底文案；另有 `choices`/`usage` 两个流式联合类型错误。384326a0 让 send-message 引用计划助理，把这个文件带进了 typecheck 门禁，`npm run typecheck` 因此变红。补导入、请求体标成非流式 | `npm run typecheck` |

### 合并后已修复（2026-11-04，dev）

- **INITIAL-PLAN-DOUBLE-RUN**：任务先原子抢占（`claimAutomationJob`，来自 first-plan-reliability 分支），并发激活只跑一次。规格改为普通测试 “two concurrent activations create one plan and ask once”。
- **INTAKE-LATE-MESSAGE-DROPPED**：第一条处理完时再查一遍新消息；问题还开着就再处理一轮，已经关闭的把原文转告教练（含伤病关键词时标记待确认），并把最后一条交给 AI 自动回复。
- **INTAKE-CLOSES-WHILE-ANSWERING**：追问一次后不再催，但问题保持打开到 7 天窗口结束，之后补的答案照样记。

### 产品决定（已按下面实现）

- **INTAKE-PAIN-ONLY**：只提伤病、没回答问题的消息由计划助理处理：标记任务待教练确认、通知教练、回复学员“已转告教练”；问题保持打开，不占追问次数。
- **INTAKE-EXPIRY-NOT-CLOSED**：过期后学员再发消息时（`hasAwaitingPlanIntake`）标记过期并告诉教练哪些项没回答；另有定时清理 `expireStalePlanIntakes`，部署里设 `PLAN_INTAKE_EXPIRY_INTERVAL_MS`（如 3600000）才开启。

### 其他

- 高次数回答被判为未折算时，学员确认里用的是“没测过的动作没关系……”这句，措辞对不上（`buildStudentConfirmation` 的 `hasUnknown` 把 uncalibrated 也算进去）。
- 全量 vitest 里唯一的失败与本链路无关：`src/lib/streetliftingLocationOverview.test.ts` “includes counts and coverage from points beyond the first 1000 rows”（2026-10 计数 0，期望 126）。它只引用 streetlifting stats 路由，本分支没有改动这些文件。
