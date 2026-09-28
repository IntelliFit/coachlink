# PROJECT_STATE

- Project: `coachlink`
- Workspace: `D:\projects\coachlink`
- Ownership: dedicated coding agent for `coachlink`
- Surface: monorepo（Web、微信小程序、Expo/React Native 移动 App）
- UI verification tool: `web-devtools`
- Memory rule: durable project facts must be written to `CURRENT_TASK.md`, `DECISIONS.md`, or `memory/YYYY-MM-DD.md` instead of living only in chat history

## 计划服务周结转 (`2026-09-28`)

- 月历后续修复已完成本地实现与Web真实6196验收：按教练原D顺序投影安排、迟补日期标“推算”、保留原始提交时间；D1恢复7/6，6–9月已逐月展开。381测试/typecheck/Web及小程序构建通过；小程序开发者工具截图超时仍未验收。详见 docs/work/6196-plan-order-calendar-fix-2026-09-28.md；未发布或更正真实历史。
- 已确认并本地实现：权益以服务周/月为单位，按原计划各周完成比例消耗，未完成部分顺延。4周每周3练完成1次剩3又2/3周；跨频率不固定剩余次数。覆盖部分周访问、预计日期、计划读取及skip-day完成事实保护。
- 验证：新增27项回归；59 files / 363 tests、typecheck、Next 545页构建通过，lint仅提示。未修改已有测试，未部署/迁移生产/更正真实历史。
- 只读核对手机用户_6196：12周每周2练，20个唯一完成D，按规则剩2服务周/当前频率4次（D71、74、78、81）。D53/D57实际训练日期仍待本人确认，不能仅按原计划顺序修历史。
- 后续发布前须完成隔离写入E2E、日期迁移与部署授权；下方旧“次数结转”描述被本节服务周规则覆盖。

## 计划推进与订阅一致性 (`2026-09-26`)

- Latest: 已继续完成第二批本地月历/日期补记修复：双端共享日历、多D日期桶、历史查看、推进事实分离、明确实际训练日与审计/幂等RPC。新增39项回归，全量336项和根typecheck通过，隔离PostgreSQL实际并发通过且已清理。UI工具连接超时仍待验收；无生产迁移/数据更正/发布。详见 `docs/work/plan-calendar-backfill-2026-09-26.md`，下列第一批说明保留为历史。

- Status: 已按用户追加要求完成当前体系流程图和代码入口审计，并开始第一批本地后端修复：完成事实不被普通补录重写、完成写入条件防覆盖、订阅读取失败不得当作空历史。未改生产数据、未提交或发布；双端日历和权益结转尚未收口。
- Verification: 新增 23 项回归，最终 Vitest 55 files / 297 tests 和 typecheck 通过，本轮 Next 544 页构建通过。测试使用数据库替身；Docker 引擎未运行且本地配置连接远端业务库，未冒险运行写入 E2E，真实隔离库并发验收仍是发布前阻塞项。
- Artifact: `docs/work/plan-subscription-current-flow-2026-09-26.md` 记录实际流程与实施边界；`docs/work/plan-subscription-consistency-2026-09-26.md` 包含证据、固定不变量、验收矩阵和发布标准。方案不是已批准的新计费规则。
- Confirmed: 用户已确认换阶段保留未完成训练权益：4周每周3次，只完成1次，应剩11次，不能整周扣减；结转算法尚未切换，不自动改真实余额或历史训练日期。
- Next: 验证隔离库条件写入，再统一双端日历、历史访问与计划日事实；按已确认规则收口次数结转、频率变化算例与兼容迁移。

## 微信小程序虚拟支付改造 (`2026-09-16`)

- Status: 已按资金归属拆分本地支付链路：平台自营会员、AI/存储加油包和动作特效导出走微信官方 XPay；需要向教练分账的教练订阅继续走汇付小程序支付。尚未提交、推送、部署、执行数据库迁移、上传小程序或向微信发布商品。
- Settlement invariant: 教练订阅必须保留“汇付收款 → 7 天保护期 → 平台汇付现金户真实划转至教练汇付子账户 → 远端成功后才记教练钱包 → 汇付提现”的闭环。禁止用 XPay 收款后只增加数据库钱包余额；此前本地试验性的 `xpay_platform_ledger` 分支和教练金额 SKU 已删除。
- Review finding (`2026-09-25`): 微信最新运营指南将在线教育、技能提升、课程视频和辅导服务列入典型虚拟服务；CoachLink 当前教练套餐又明确包含训练计划、课程咨询、动作/视频反馈和图文/视频教学，所以线上教练订阅继续走汇付普通支付的审核风险高。混合支付本身并非必然违规，但只有真实线下/实体履约部分适合保留普通支付，虚拟权益必须拆成 XPay；纯线上教练套餐应另行设计 XPay 收款后的教练结算，或先取得微信书面确认。
- Verification: lint、typecheck、Vitest 53 files / 274 tests、Next 544 页生产构建、小程序 2,879 modules 构建及 8 个平台商品目录干跑均通过；微信开发者工具已验证会员、加油包、教练汇付等待页，0 error / 0 warning。最终截图位于 `artifacts/wechat-xpay/platform-membership-final-retry.png`、`platform-addon-final.png`、`coach-huifu-waiting-final.png`。
