# 支付宝支付流程说明

## 流程概览

1. **create**：创建订单并返回支付宝表单，前端跳转/展示支付宝付款页。
2. **notify**：支付宝服务器在用户付款后**异步 POST** 到 `notify_url`，**不依赖用户是否关页**，是“已付款”的**主路径**。
3. **return**：用户付款后浏览器**同步跳转**到 `return_url`，跳转到“支付成功”页；同时做一次履约（幂等）。
4. **query**：前端轮询查单；若查到已支付则履约（幂等），用于用户未关页时的即时展示。
5. **sync-pending**：定时兜底，对近期仍为 pending 的订单向支付宝查单并履约（幂等），用于 notify 失败且用户已关页的情况。

## 万无一失原则

- **未付款**：只保留订单记录，不更新订阅、不更新教练钱包。
- **已付款**：必须保证订阅更新 + 教练钱包入账。实现方式：
  - **主路径**：**notify**。用户付款后支付宝主动调 notify，即使用户立刻关页也会执行。
  - **兜底 1**：**return**（用户回到站点时）、**query**（前端轮询）——与 notify 共用同一套履约逻辑，且**幂等**。
  - **兜底 2**：**sync-pending**（定时任务）——若 notify 调用失败（网络/服务不可用）且用户已关页、未触发 query，由定时任务拉取近期 pending 订单向支付宝查单并履约，同样幂等。

## 同步与幂等（不会重复加钱）

- notify、return、query、sync-pending 都调用同一套 **fulfillPaidOrder**（订阅 + 钱包）。
- **幂等键**：
  - 订阅：`coach_subscriptions.last_payment_order_id`，已等于当前订单则跳过。
  - 钱包：`wallet_transactions.related_order_id`，已存在该订单的流水则跳过。
- 因此：无论 notify 先执行、query 后执行，还是 query 先、notify 重试后到，或 sync-pending 再跑一遍，**只会生效一次，不会重复加钱或重复开通**。

## 共享履约逻辑

- 文件：`fulfillPaidOrder.ts`
- 内容：`fulfillSubscriptionOnPaid`（订阅/续费 + 教练站内信）、`updateTransactionAndWallet`（教练钱包入账 + 流水）。
- 调用方：notify、return、query、sync-pending 共用，行为一致且幂等。

## notify 验签

- **一律验签**：所有请求（含开发环境）都必须通过支付宝公钥验签，不通过则返回 `fail`，不处理。
- 伪造或重放请求无法通过验签，不会误更新订单/钱包/订阅。

## sync-pending 定时兜底（进程内，无需外部 cron）

- **推荐**：应用启动后**进程内自动定时执行**，无需再找地方调接口。
- **配置**（可选）：
  - `ALIPAY_SYNC_INTERVAL_MS`：同步间隔毫秒，**未设置时默认 10 分钟**；设为 `0` 则关闭定时同步。
  - `ALIPAY_SYNC_PENDING_WINDOW_HOURS`：只同步「最近 N 小时内创建」的 pending 订单，**默认 48 小时**。超过时间窗口的订单不会去查支付宝，避免运行一年后仍拉一年前的单。
- **实现**：`src/instrumentation.ts` 在 Node 进程启动时注册定时器，按间隔调用与 notify/query 相同的履约逻辑（幂等）。
- **可选**：仍保留接口 `GET/POST /api/payment/alipay/sync-pending`，用于手动触发或外部 cron；请求头需带 `x-cron-secret` 或 `Authorization: Bearer <ALIPAY_SYNC_SECRET>`。
