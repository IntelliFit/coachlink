# BlessingLSH 订阅与训练只读核查

查询日期：2026-10-05，时间口径 Asia/Tokyo。用户要求核查截图中的计划完成原因、订阅时长/到期、购买时间和累计训练量；没有要求修改权益或计划。

- 精准匹配昵称 BlessingLSH，学员 `b5380575-a083-42d8-8db1-497fd81b1066`。截图短 ID `3A71D6A5` 是订阅 ID 前缀，对应 `3a71d6a5-924b-4ffb-95c1-c4be34e5b625`，教练枭马葛。
- 2026-07-17 创建并微信支付，唯一平台订单 `350d6dcc-e1ad-4dbf-b135-9fe62b0fb175`，paid/69900 分（699 元），12 服务周，standard/tier 2。付款确认 2026-07-17 14:54:36（Asia/Tokyo）。未发现续购订单；新版 coach_subscription_orders 表没有此学员订单，旧订单在 alipay_orders 表，其表名不能用于推断支付宝付款。
- 订阅数据库状态 active，start_date 2026-07-17T07:08:34.996Z。保存的 end_date 为 2026-12-12T13:00:36.305Z，与截图 2026/12/12 一致。
- 当前最后一份非归档计划 `04bbd222-dd3a-4a25-9b44-c1941c3fe597`，8 周/56 天，24 训练日，每周 3 练，status=completed，end_date=2026-10-03，没有 active/paused 后续计划。真实最后完成时间 2026-10-03 20:03:24（Asia/Tokyo）。完成原因是本期计划全部训练日已完成，不是订阅取消或权益耗尽。
- 最新计划 start_execution_day=3；本版有 23 条实际 completed 执行，加 1 个接续训练日，列表 summarizePlanCompletion 显示 24/24。所有历史版本合计 30 条实际 completed 执行/310 组；另有 1 条休息日 timed_out，不纳入已完成训练。首次训练 2026-07-17，末次 2026-10-03。

## 权益核查发现

使用现有 `auditSubscriptionEntitlements` 只读推导，返回 available/active，planProgressStatus=completed，shouldAutoCancel=false，remainingCredits=4，remainingServiceWeeks=1.3333333333333321，displayEndDate=null，分类 plan_completed_entitlement_remaining。当前 canTrain=false 因为本期计划已完成，需要后续计划才能继续使用剩余权益。

| 版本 | 实际完成次 | 接续视为已完成次 | 当前算法扣服务周 |
| --- | ---: | ---: | ---: |
| 573ef681 初始废弃版/no_charge | 0 | 0 | 0 |
| 4ecc92e9 历史版/count_service | 1 | 0 | 1/3 |
| 0c1d98f6 接续版/count_service | 6 | 1 | 7/3 |
| 04bbd222 最新版/count_service | 23 | 1 | 8 |

历史两个接续版本均保留 count_service；computeConsumedServiceWeeks 将 start_execution_day 前的训练日视为已消耗，原执行所在历史版本又参与扣减，因此同一个已接续训练日被重复累计，两次多计合计 2/3 服务周（原频率下 2 次）。算法总扣 10 又 2/3 周/32 次份额，但实际完成 30 次，按原每周 3 练及实际完成消耗规则应扣 10 周、剩 2 周/6 次。这是代码和数据核对后的推断，尚未修复历史标记、算法或生产余额。

Web list-students 的 deriveProjectedEndDate 返回 model.displayEndDate || subscription.end_date。当前计划已完成且未来权益尚未排到新计划，模型 displayEndDate=null，界面回退到保存的 12/12 快照。因此不能将这个日期解释为固定失效日；后续计划排期和实际训练决定预测日期。

证据：[evidence.json](../../artifacts/blessing-subscription-audit/2026-10-05/evidence.json)。使用项目 bootstrap 从单一配置来源读取，通过仅允许 GET 的客户端查询；没有修改数据库、登录态、业务源码或测试，没有运行用户 UI，也没有发布、提交或推送。未导出健康问卷、手机号或凭据。

## 8周计划与累计服务消耗的说明（2026-10-05）

- 用户追问12周购买减8周完成为何不剩4周；这是理解疑问，未授权改数据，也未确认接受余额修复。
- 核对执行证据：当前24/24包含7/17接续1次及8/3至10/3本版23次；此外7/20、7/22、7/24、7/27、7/29、7/31旧版另有6次实际完成，均在同一12周订阅购买后，不包含在当前24中。
- 因而当前计划24次（8服务周）+旧版额外6次（2服务周）=累计30次（10服务周），12周剩2服务周/6次；如果订阅下实际只有当前24次，则应剩4周。服务周为原每周3练按完成比例折算，不能说自然经过2周就扣费。前一答遗漏了额外6次的明细，容易让用户误解。没有进一步改库、修改业务或发布。
## 旧版6次的来源与计划替换（2026-10-05，只读核查）

- 用户追问是否中途换计划、旧版6次是什么。进一步查询四版完整训练定义、source/revision字段、AI会话元数据，并比对历史Git保存代码，不执行改库。
- 7/19 05:38:07（Asia/Tokyo）教练账号AI会话applied，明确要求同一BlessingLSH计划每周D1/D3/D5改D1/D4/D6；用户先前措辞也要求其余内容不变。当前旧版0c1d98f6确为该排期，未把草稿视为已应用。
- 旧版0c1d98f6在7/20至7/31实际完成D4、D6、D8、D11、D13、D15六次。它是同一订阅的旧版本，不是额外购买或已经确认独立第二阶段；前面称“额外6次”仅表示不在当前24/24统计内，不能暗示另售一期。
- 8/2 03:25:05（Asia/Tokyo）最新04bbd222建立，同时旧0c归档。两版同名、同56天24训练日、同动作/组次/训练日排期；只D4/D13/D15的部分重量小数/强度配置不同，开始日期7/14→7/30，start_execution_day两版均3。
- 新版未接在旧版已完成D15之后：8/3开始再次完成D4，后续8/6 D6、8/9 D8、8/12 D11、8/14 D13、8/18 D15；由此真实训练多出旧版六次，当前24/24并未合并这些旧记录。
- 历史保存逻辑对有执行的计划修改会建立新实例并归档旧实例/保留旧训练记录；新建阶段或未取得执行进度时可能沿用原起点。记录确认发生替换及从早期重新开练，不能确认8/2是谁点击什么、是否主动重新安排或保存接续异常。source=coach，但revision_of_instance_id/activation_reason等均null，AI历史仅7/19排期，8/2无对应会话依据；不擅自归责教练或断言用户主动重启。
- 精确证据artifacts/blessing-subscription-audit/2026-10-05/plan-revisions.json，描述仅存hash、不保留原始健康描述。业务/测试/生产数据保持未改，未发布。