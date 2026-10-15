# BlessingLSH 旧订阅提前结束

用户明确要求提前结束截图学员旧订阅，让他立即在现有小程序购买不同套餐。已于北京时间 **2026-10-15 23:20:20** 完成。

- 学员昵称精准回读为 BlessingLSH，用户 ID `b5380575-a083-42d8-8db1-497fd81b1066`；教练枭马葛；订阅 `3a71d6a5-924b-4ffb-95c1-c4be34e5b625`。原商品“负重引体提升”，原已付 699 元/12 服务周；目标目录存在“负重引体计划—精细版”329 元/3 个月。
- 原状态 active，保存的预计完成日为 2026-12-22。不是只把预计日期改早：旧客户端对 active/expired/near_expiry 均限制为续费。现已将该订阅改为 cancelled，并将 end_date、updated_at 设为本次结束时间；其他订阅字段保持不变。
- 处理前无进行中训练、待支付订单、待兑现续费或套餐队列。保留 5 份原计划、36 条训练执行（34 completed/2 timed_out）、问卷、付款元数据和 2 笔原付款订单（1 paid/1 failed），没有代购买、扣款、退款或发送消息。

## 线上兼容问题和修复

首次定向 PATCH 被数据库 `coach_subscriptions_status_check` 拒绝，未写入任何数据。实际线上仅允许 active/inactive/waiting，与现有取消接口使用 cancelled 不一致。没有用 inactive 冒充结束订阅。

通过已有 CLI `migration new` 创建 `20261015151937_allow_coach_subscription_cancelled_status.sql`，保留三个原状态，只增加 cancelled。迁移、该学员结束操作与迁移 history 登记在同一事务中执行；先完整 ROLLBACK 验证，再 COMMIT。加 3 秒锁等待与 15 秒语句上限，校验用户、教练、状态和 updated_at；断言其他 159 条订阅与学员历史全字段未变。迁移已在线上共享数据库生效，本地迁移源码纳入同日 Web/小程序发布收尾提交；无需重建应用镜像或重放此操作。

## 验证和交接

独立 REST 回读确认 cancelled，原记录散列与所有未修改字段一致。以学员身份只读访问正式 `coachlink.fit/api/subscription/coach-subscriptions`：HTTP 200、status=cancelled、lifecycle_status=expired_cancelled。旧小程序续费拦截和新购买 active 关系拦截条件均不成立。

请让学员退出教练详情后重新进入，选择 329 元/3 个月商品走重新购买。未操作学员手机或发起真实付款，因此没有宣称手机支付已验收。

证据：`artifacts/blessing-subscription-end/2026-10-15`，约 85 KiB，保留本次前后快照摘要、操作脚本、回滚与正式回执；不含凭据/问卷正文。自动审批拒绝包含清理的收尾命令，理由仅为 `blocked by policy`，未执行或绕过。任务临时目录 `D:/cache/agent-tests/coachlink-blessing-subscription-end-20261015` 的 `query-sql.ps1` 约 3.6 KiB 保留，可由用户手动清理此辅助文件；不影响运行服务。未运行全量构建、测试、UI 验收，未提交/推送/发布客户端。
