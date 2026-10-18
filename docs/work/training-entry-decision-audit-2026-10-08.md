# 训练入口/只读/执行权限判断审计

2026-10-08 JST。用户要求调查各处判断、冲突点和解决方法。本轮只读源码、历史及离线执行诊断；没有业务源码、既有测试、数据库、DevTools、提交或发布操作。

## 结论与证据边界

问题不等于“不能在多处做校验”。身份、记录归属、订阅权益和并发写入校验必须留在服务端。真实问题是：显示、进入方式、业务进度、记录状态、同步状态混在一起，而且各入口用不同规则/不同时间的数据自行决定权限。

- 当前工作区包含其他对话尚未发布 WIP，以下行号指审计时源码。上一轮另核对 b94f8e07 已发布源码，首页按钮与 effectiveReadOnly 不一致、route readonly 跳过 start 的核心路径已经存在；不能把所有当前 WIP 都称线上行为。
- 6196 的上一轮只读实查：D78 无 execution；按当时最新事实进度 D76，D76/77 纯休息，D78 满足跨纯休息开练条件。该结果是顺序资格，不代表已经端到端验证全部权益/API/UI。
- 未获取截图时手机路由、缓存、API 响应和客户端版本，不能确认具体是首页、计划详情入口或哪个旧状态触发。不把构造场景说成真实手机复现。
- 独立诊断脚本从实际源码 AST 提取判断，不联网、使用内存 storage，10 项均验证了所列当前行为；不是“修复后 10 项回归通过”。

运行：`node --import tsx artifacts/training-access-audit/2026-10-08/check-decisions.cjs`

## 1. 判断地图

| 层/入口 | 位置（相对仓库根） | 判断依据 | 作用/问题 |
|---|---|---|---|
| 小程序月历可查看 | `apps/wechat/src/training/today-training/components/ScheduleCalendarPanel.tsx:56`、`packages/core/src/planCalendar.ts` | 当前进度周+下一周、是否有历史记录 | 决定能否看，不应当成能否开练；允许看未来日是合理的 |
| 小程序选中日 | `apps/wechat/src/training/today-training/TodayTrainingScreen.tsx:348` | 优先进行中、刚完成、今天完成，最后进度日 | selectedDayIndex 是浏览选择，不等于当前可训练日 |
| 首页按钮文字 | 同文件 `:1407` | completed→查看；in_progress→继续；有力量→开始 | 不检查顺序、超时或同步状态，明确不一致 |
| 首页点击 | 同文件 `:804`；`lib/dayModules.ts:405` | 首页 progressDayIndex、训练日顺序、completed、options.readOnly | 不可执行仍跳 readOnly=1；不刷新后端裁决 |
| 训练须知确认 | 同文件 `:822`、`:864` | 弹窗前保存 effectiveReadOnly，确认又作为强制 options.readOnly 传入 | 旧 true 即使重新算可执行也不能被解除 |
| 执行页路由 | `apps/wechat/src/training/training-execution/index.tsx:370` | 路由 readOnly，目标全部缺失才使用 storage 回退 | 传参决定是否调用 start；正常显式目标不继承旧 readonly 的保护已存在，不应再笼统归因“storage串了” |
| 执行页加载 | 同文件 `:795`、`:904` | 快照→最新计划；route readonly 决定读记录或 start | 新计划数据不会重新纠正旧 route readonly；没有记录就 preview |
| 执行页能力 | 同文件 `:497`、`:523` | completed、timed_out、route readonly、persisted in_progress、preview、cloudReady | 一个 isReadOnly 混多类状态；已持久化进行中会覆盖 readonly；另有独立写入门禁 |
| 首页快照 | `apps/wechat/src/utils/todayTrainingPageCache.ts:111` | 60天快照、局部 execution 补丁 | 更新完成记录，不更新进度指针/完成日期等聚合字段 |
| 计划聚合 API | `src/app/api/plan-lib/get-instance/route.ts:652`、`:705`、`:817` | 展示记录按状态优先，进度用 buildPlanDayFacts + strictProgress + actionsMap | 展示 attempt 和进度 fact 分离合理，但应显式返回，避免被客户端混用 |
| 开练 API | `src/app/api/execution/start/route.ts:155`、`:181`、`:293`、`:344` | 生命周期→权益→最新 attempt→重新计算顺序→超时恢复→原子创建 | 需要保留服务端裁决，但输入/记录选择与聚合 API 有差异 |
| 更新一组 API | `src/app/api/execution/complete-set/route.ts:73` | 归属、超时、状态、权益、并发写入保护 | 不信前端，正确；应与客户端能力一致，不是把这些校验删掉 |
| 小程序计划详情入口 | `apps/wechat/src/coach/plans/dashboard/[id]/index.tsx:76`、`:170` | get-next-training-day + checkToday；只认 nextDayIndex 或进行中 | 仍走另一套旧进度算法；readOnly 经中转路由传给同一执行页 |
| Web 当前入口 | `src/app/today-training/page.tsx:287`；`src/app/training-execution/[instanceId]/page.tsx:667` | 直接进入执行页并请求 start | 不存在小程序相同的 route readonly 门禁；但状态显示/超时处理另有不一致 |
| App 当前入口 | `apps/mobile/src/screens/TrainingScreen.tsx:72` | 进行中可写，已完成/跳过只读，未来日只读 | 不含跨纯休息日例外，同样 D76→D78 与小程序/后端规则不同；仅源码边界检查，未运行 App |
| Web 老训练体系 | `src/app/coach/plans/dashboard/[id]/TodayTraining.tsx:128`、`src/app/api/training/get-training-day-date/route.ts` | week/day、日历日期、should_be_read_only | 另一套表/老路由；代码存在，不证明6196走此路。不把它直接套入当前实例模型或无依据删除 |

## 2. 当前主路径及锁死点

```text
首页：先读缓存，再后台刷新
  ↓
选中日有力量且无 completed/in_progress → 文字“开始训练”
  ↓
点击：拿首页 progressDayIndex 判断能不能练
  ├─ 能 → readOnly=0
  └─ 不能 → 短提示 + readOnly=1（仍然进入训练页）
                         ↓
            训练页获取最新计划，但不重新决定进入模式
                         ↓
          readOnly=1 → 不调用 start → 无记录时生成 preview
                         ↓
               “只读模式”，无填写/计时
```

注意存在独立的第二条失败路径：readOnly=0→已展示 preview→start 失败/返回 null→preview 保留、cloudReady=false→提交被 blockUntilExecutionReady 拦住。这不是相同“只读标签”原因，但用户同样体验为不能练，不能只改 isReadOnly 就称彻底修好。

## 3. 已验证冲突及修复方向

### A. 开始文案与进入模式不一致（直接相关，P0）

实际声明离线计算：选择 D78、有力量、尚无 execution，首页显示开始；缓存进度 D74 时导航 readonly=true，进度 D76 时允许。页面“可以看到D78”也不能作为“可以开练D78”。

解决：按钮文案、按钮动作消费同一结果。显式开始/继续走服务端开练；失败保留明确错误和重试，不自动改成预览。独立查看计划入口不能自动创建 execution。

### B. 缓存更新半套状态 + 旧只读结论不可纠正（直接相关，P0）

- 实际 cache patch 运行后 D74 execution 已 completed，而 dayIndex 仍74。云端回包前或刷新失败时数据不一致；这是可出现的窗口，不断言用户手机就是此路径。
- notice 弹窗捕获 readonly=true，后续即使 isExecutablePlanDay=true，`options.readOnly || ...` 仍 true。
- 执行页拿到更新的计划后仍按路由参数跳过 start；普通下拉刷新也不会改变该参数。

解决：本地快照负责快速展示，不是长期权限票据。记录更新后将聚合 decision 标脏/失效，服务端响应回传最新 execution+进度+能力+版本，原子合并同版本结果；旧响应不能覆盖新版本。弹窗只保存计划/日/动作及用户意图，不保存旧的权限结论。route 只表达意图，不携带永久业务授权。

### C. start 失败信息丢失、preview 与同步完成混淆（P0）

- request 封装保留服务端 code/message 并短 toast，但 mini executionService.startExecution 遇 success=false 返回 null，丢掉结构化原因。
- 页面已有 preview 时，错误 UI 的 `!execution` 条件不成立，持久错误/重试入口不展示；写入只提示“正在同步”，即使请求已经结束失败。
- readonly 分支用本地 preview 也会 setCloudExecutionReady(true)；这不代表云端 execution 已建立。
- useDidShow 遇任何 executionRef 就 return，preview 也算，不自动恢复；下拉可重试，但 readonly 分支仍不 start。

解决：拆开 dataLoaded、startPending、startFailed、persistedExecutionReady；保留错误 code/message/retryable。预览内容可继续展示，同时常驻“尚未开始/开始失败”和重试；只有服务端持久化 in_progress 才有执行权限。网络失败不归类为“只读”。

### D. 同一个 readonly 混了四种业务状态（P1）

- 完成、更正历史；未来预览；超时补记/重开；同步未完成不是同一种状态。
- 实际运行：同一个 completed，readOnly=0 允许更正，readOnly=1 不允许；timed_out 同样由路由决定是否有补记恢复。
- 已持久化 in_progress 即使 route readonly=true 也进入可编辑，是旧缓存误锁的补丁，却说明 route readonly 不是可靠能力模型。
- Web 执行页只有部分完成按钮禁用 timed_out，逐组表单条件没有检查 timed_out，complete-set API 却明确409拒绝；这是源码确认的界面/服务端不一致，未做 UI 复现。Web旧10小时提醒与后端5小时生命周期也需要明确统一。

解决：预览意图与业务能力分别表示，能力细分 canStart/canResume/canRecordSet/canCorrectSet/canConfirmPastCompletion/canRestart/canCancelEmpty。完成更正只允许已许可字段并保留审计；不把已完成页重新变成进行中。超时显示恢复选择，不用一个含糊只读标签遮盖。

### E. “休息日”规则存在真实矛盾（P1）

离线实际函数验证：D2 为含饮食任务的休息日，strictProgress 停D2；前后端两个跨休息判断都只检查 type != training，因此都允许D3。并非纯粹前端/后端各错一次，而是同一业务链规则互相矛盾。

另一个构造的历史格式场景：休息日 actionSet 只有 actionId、类型在动作库里；get-instance 传 actionsMap，进度停D2；start 不传 actionsMap，进度变D3。字段 day_index/dayIndex 兼容也不同：前端允许 snake_case，start helper及目标查找只认 dayIndex。

解决：同一入口规范化计划数据/动作类型；共用 isActionableDay、isPureRestDay、deriveProgress、canStartDay。按现有注释及既有测试意图：只有纯休息日能直接跨过，有必做轻任务则完成/显式跳过后再推进。若业务要允许轻任务不阻断力量训练，应先明确规则，再前后端同时改，不能各自实现相反规则。

### F. 多套进度算法和 attempt 选择（P1）

- 旧 get-next-training-day 只查 completed、忽略 abandoned、跳过全部休息；strictProgress 把正常 abandoned 当已解决并区分任务休息。
- 实际离线验证：D1 abandoned、D2 未完成，旧API片段给D1，新进度给D2。小程序计划详情确实仍调用旧API，不是只有死代码。
- get-instance 展示取 in_progress 优先；进度 facts 取 completed 优先；start SQL 排除 abandoned 后取 started_at 最新。人工构造 completed + in_progress +更新 timed_out 时，三者分别给进行中/完成/超时。展示与进度分开本身正确；用任意一份代表全部状态才有问题。此构造不代表6196真实存在该组合。
- checkToday 仅查今天 started_at，不能等同“当前可恢复执行”，跨日或补记更容易显示不一致。
- App 把所有未来日设只读，与允许跨纯休息日规则不一致。Web旧week/day日期体系不适用当前基于完成进度顺延体系。

解决：明确 progressFact / activeAttempt / completedHistory 三份概念；服务端统一选 attempt 并返回 activeExecutionId，不能每个入口自行抢优先级。旧 next-day API 做兼容适配，转同一决策服务；旧路由逐一登记迁移，不先删除用户可达页面。App纳入同一能力协议。

### G. 并发及安全边界（后续实施必须保留）

现有 create_plan_execution_atomic 在实例行锁内检查实例状态、对同日进行中记录幂等；源码顺序/权益检查在进入RPC前，不能用它宣称已把全部授权原子化。此次只读审计没有读取线上函数定义或并发写测试，不称确认线上竞态事故。

设计上权限预检只供展示；真正开练在受保护的提交边界重读版本/状态并决定返回 existing/resume/create/blocked。重复点击同日返回同一execution；多端操作/补记/教练更新引发版本变化时返回明确冲突并刷新，不另建空记录。任何前端 capabilities 都不能替代服务端身份、归属、权益和每次写入校验。

## 4. 建议统一后的职责

```text
计划 + 订阅服务周余额 + 完成事实 + 执行尝试 + 北京日期
                        ↓
             服务端同一决策服务/共享纯规则
                        ↓
   进度、可开练日、当前execution、允许操作、禁止原因、版本
              ↙                         ↘
       首页文字/按钮                预览/记录页操作

用户明确点击开始/继续
          ↓
POST start/resume（重新检查，不信旧缓存/路由）
          ├─ 成功：持久化in_progress + 最新决策 → 填写和计时
          ├─ 已完成/超时：明确对应操作 → 不冒充新开练
          └─ 失败：明确原因 + 返回/刷新/重试 → 不偷偷转只读
```

建议结果中区分 relation/entitlement/plan/day/attempt 状态，并提供 `reasonCode`、`executionId`、`progressDayIndex`、`nextStartableDayIndex`、`capabilities`、`decisionVersion`。不是新增一个布尔值替换旧布尔值。

缓存仍遵守60天展示/离线规则，但60天不是权限有效期；不要为修权限问题取消快速读缓存。没有云端确认的新开练不得伪装成成功；已经开始的离线恢复/草稿应清楚显示待同步，不能静默丢组数或误声称已写云端。

订阅周/月与按完成比例消耗服务周的已确认规则不改。此次不是重新设计扣费，不以固定剩余次数替代服务时长。

## 5. 实施顺序及验收门槛（方案，尚未执行）

1. P0先统一mini入口意图、按钮与执行能力，移除“失败/不允许→静默只读”，保留明确预览；修须知旧判定、错误恢复、缓存聚合失效。
2. P1建立共享规则和服务端决策输出，统一跨休息、任务类型、字段格式、attempt选择；接入Web、mini详情旧入口，登记App/旧Web适配范围。
3. 加版本/并发控制和受控状态日志，再做发布前验收。日志只记录必要ID、版本、意图、reasonCode与耗时，不记token、联系方式、全部训练正文。

| 回归情境 | 必须验证的结果 |
|---|---|
| 6196同构D74完成→D76/77休息→D78 | 最新资格允许；开始后有真实execution、能填/计时；不改真实学员完成记录做测试 |
| 首页旧进度/后台未返回/返回旧响应 | 不据旧结论锁死；旧版本不能覆盖新；点击明确核对 |
| 预览D78返回再开始 | 看计划不建记录；开始建/恢复一次，预览参数不污染 |
| 须知弹窗期间进度刷新 | 确认重新裁决，不沿用旧readonly=true |
| 409顺序冲突、权益拒绝、503、断网 | 精确原因常驻、可重试；不能“正在同步”无限停留 |
| completed更正、timed_out补记/重开 | 正確显示能力，不因不同入口变规则，不误覆盖历史 |
| 休息无任务/有必做任务/历史actionId格式 | 三端和后端同一规则 |
| abandoned、跨日恢复、多次attempt | 进度、展示、恢复对象明确且一致 |
| 多端同时开始/开始与补记/计划更新并发 | 幂等、版本冲突可恢复、不重复扣权益/重复空记录 |
| 换频率换计划、服务周不足 | 延续已确认服务周口径，不把本次入口修复变成扣费改造 |

测试分三层：共享决策表单测；受控API/数据库集成（所有数据finally清理）；实际mini/Web交互截图与一次填写/计时/回读路径。当前既有 planProgress.test.ts 有进度单测，但本轮搜索未见上述首页→readOnly路由→start→执行能力整链自动覆盖，不能用全量单测绿替代。

这次新增的是独立诊断工具，不修改既有测试/业务；真正回归测试应断言修复目标，不能继续把当前冲突作为期望。
