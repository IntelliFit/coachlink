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

### 未修复（在别的会话正在改的文件里，用 `it.fails` 写成规格，修好后去掉 `.fails`）

**INITIAL-PLAN-DOUBLE-RUN**：同一订阅并发激活两次，生成两份计划。
- 位置：`src/lib/coachingAutomation/initialPlan.ts:49-54`、`jobs.ts:38`、`jobs.ts:53`。`createAutomationJob` 遇到已存在的幂等键返回旧任务；`isTerminalJob` 只拦 succeeded/skipped/needs_coach_review，第二个调用拿到 `pending`/`running` 的任务照样往下跑。
- 触发：`finalizeSubscriptionOrder`（`src/lib/subscriptionOrders.ts:595` 读状态、之后无条件更新为 paid、`:639` 再 await 生成计划）不是原子的，支付回调、轮询、返回页同时到达时两路都会调用 `autoMatchPlanForSubscription`；生成计划要几十秒，窗口很大。
- 结果：两条 `coach_plan_instances`（第一份被第二次的 `archiveCurrentPlanInstancesForSubscription` 归档）、学员收到两条“计划已制定完成”和两条计划助理问题、教练两条通知；任务快照取最后写入的那次。
- 建议：用 CAS 认领任务：`update({ status: "running", started_at }).eq("id", job.id).in("status", ["pending", "failed"])`（再加上 running 超过若干分钟可重领），返回 0 行就直接返回“正在生成”。
- 规格：`intake-messaging.test.ts` “BUG INITIAL-PLAN-DOUBLE-RUN”。

**INTAKE-LATE-MESSAGE-DROPPED**：第一条消息还在提取时到达的第二条，在第一条关闭计划助理后被丢掉。
- 位置：`src/lib/coachingAutomation/planIntake.ts:394`、`:400`（租约被占或 CAS 失败直接返回 `handled: true`），`:632`（只有没关闭时才检查新消息）。
- 输入：A“深蹲100公斤5个，卧推80公斤5个”答完全部问题；A 在模型里时 B“对了，我右膝盖有旧伤”到达。
- 结果：B 的 after() 看到租约返回 handled，send-message 不触发 AI 分身；A 关闭计划助理且不再看 B。B 没进任何模型，教练没收到提醒，AI 分身开着也一样。A 的提取报错时同理：A 退回 AI 分身，B 什么都没有。
- 建议：抢不到租约时不要直接算 handled：等租约释放（上限约 `REPLY_LLM_TIMEOUT_MS` + 余量），按 id 重读任务；`lastProcessedMessageAt >= 本条 created_at` 才返回 handled，仍在等待就继续认领处理，已关闭就返回 `handled: false` 交给 AI 分身。
- 规格：`intake-messaging.test.ts` “BUG INTAKE-LATE-MESSAGE-DROPPED”。

**INTAKE-CLOSES-WHILE-ANSWERING**：学员一条答一项时，追问一次后就关闭，最后一项被丢掉。
- 位置：`src/lib/coachingAutomation/planIntake.ts:518-519`（`closed = !(remaining > 0 && followUpsSent < MAX_FOLLOW_UPS)`）。
- 输入：问深蹲/卧推/硬拉；学员依次发“深蹲100 5个”“卧推80 5个”“硬拉140 5个”。
- 结果：第一条后追问剩余两项；第二条只答卧推就关闭（教练收到“还有 1 项没回答”，学员不知道已关闭）；第三条的硬拉不记录，AI 分身没开时学员也得不到回应。
- 建议：`MAX_FOLLOW_UPS` 只限制“再追问”，不限制“继续收”：剩余项没答完就保持 `awaiting_reply`（不再发追问），直到答完或 7 天到期。
- 规格：`intake-loop.test.ts` “BUG INTAKE-CLOSES-WHILE-ANSWERING”。

### 需要产品决定（现状写成 `current behavior` 测试）

- **INTAKE-PAIN-ONLY**（`planIntakeModel.ts:351`，`related = answeredAnything`）：只说伤病、没回答任何问题的消息不算回复，`riskNotes` 被丢弃，任务不标记待教练确认。AI 分身开着时由它按通用安全规则回复；没开时学员没有回应、教练没有提醒。全自动托管下教练未必在看聊天，建议只要有 `riskNotes` 就标记任务并通知教练。
- **INTAKE-EXPIRY-NOT-CLOSED**（`planIntake.ts:363`、`:390`）：过期只在读取时判断，状态永远停在 `awaiting_reply`；`:390` 写 expired 的分支实际走不到（send-message 只在 `hasAwaitingPlanIntake` 为真时才调用）。教练被告知“学员回复后会通知你”，但学员 7 天不回时不会收到任何提醒。

### 其他

- 高次数回答被判为未折算时，学员确认里用的是“没测过的动作没关系……”这句，措辞对不上（`buildStudentConfirmation` 的 `hasUnknown` 把 uncalibrated 也算进去）。
- 全量 vitest 里唯一的失败与本链路无关：`src/lib/streetliftingLocationOverview.test.ts` “includes counts and coverage from points beyond the first 1000 rows”（2026-10 计数 0，期望 126）。它只引用 streetlifting stats 路由，本分支没有改动这些文件。
