# 汇付分账 + 教练提现 实施文档

> 最后更新：2026-05-05

---

## 一、背景

> 2026-10-22 更新：平台服务费改为入驻初期 10%（教练 90%），比例定义在 `packages/core/src/coachPolicy.ts`；分账按结算单付款时记录的金额执行，下文 80/20 为当时的历史口径。

教练订阅支付需要实现 **80/20 分账**：学员付的钱，教练拿 80%，平台拿 20%。原来走的是支付宝直连 + 微信直连，没有分账能力。现在统一切到**汇付（Huifu）斗拱 PaaS 支付平台**，利用其账户体系和余额支付能力实现分账。

---

## 二、架构决策演变

### 最初方案：JSPay 实时分账

在 JSPay 下单时传 `acct_split_bunch`，让汇付在支付成功时实时拆分资金。参数：

```json
{
  "acct_split_bunch": {
    "acct_infos": [
      { "huifu_id": "<教练huifu_id>", "percentage_div": "80.00" },
      { "huifu_id": "<平台huifu_id>", "percentage_div": "20.00" }
    ],
    "percentage_flag": "Y"
  },
  "delay_acct_flag": "N"
}
```

### 遇到的问题 & 为什么放弃

| # | 问题 | 报错/现象 | 根因 | 解决 |
|---|------|-----------|------|------|
| 1 | 商户未配置默认账户 | JSPay 返回错误 `22000005` | 教练个人账户没有默认/虚拟账户，不能作为实时分账接收方 | 放弃实时分账，改用余额支付分账 |
| 2 | 未开通手续费外扣 | `fee_flag=1` 报错 | 该商户未开通外扣功能 | 改为 `fee_flag=2`（内扣） |
| 3 | 多次尝试修复实时分账 | 补 `settle_config_list`、`is_settle_default`、`upper_huifu_id`、`cardType` 从 `"2"` 改 `"0"` | 均无效，根本原因是教练账户类型不支持实时分账 | — |

### 最终方案：两阶段分账（余额支付）

```
阶段1: JSPay 下单 → 钱进平台现金户 F22836659（不分账）
阶段2: 支付成功后 → 余额支付 /v2/trade/acctpayment/pay → 从现金户转 80% 给教练 + 20% 给平台
阶段3: 教练提现 → /v2/trade/settlement/encashment → 打到绑定的银行卡
```

**选择现金户而非基本户的原因**：基本户默认 T+1 自动结算，钱会被汇付自动划走；现金户不自动结算，资金留在账户内可供余额分账调用。

---

## 三、已完成工作清单

### 3.1 数据库 Migration

| Migration | 内容 |
|---|---|
| `20260504_huifu_split_settlement.sql` | `wallet_transactions` 新增 `platform_fee bigint DEFAULT 0`；`coaches` 新增 `huifu_id`、`huifu_open_status`、`huifu_open_msg`；新建 `platform_revenue` 表（`source_order_id`、`order_type`、`amount`、`coach_id`） |
| `20260505_huifu_card_token.sql` | `coaches` 新增 `huifu_card_token text`（提现所需绑卡令牌） |

### 3.2 汇付 API 封装

**文件**：`src/lib/huifuMiniProgramPay.ts`

| 函数 | 汇付接口 | 用途 |
|---|---|---|
| `createHuifuMiniProgramOrder` | `/v3/trade/payment/jspay` | JSPay 下单，支持 `T_MINIAPP` / `A_JSAPI` / `A_NATIVE`。支持 `acctId` 指定收款账户，`feeFlag` 控制手续费模式 |
| `queryHuifuMiniProgramOrder` | `/v3/trade/payment/jspay` (query) | 查询 JSPay 订单状态 |
| `parseHuifuNotifyContent` | — | 验签 + 解析汇付异步通知数据 |
| `parseAcctSplitBunch` | — | 从通知/响应解析分账实际金额，返回 `SplitActual[]`（含 `huifuId`、`divAmtYuan`、`divAmtFen`） |
| `uploadHuifuFile` | `/v2/supplementary/picture` | 身份证照片上传（multipart/form-data，需 canvas 压缩到 2MB 内） |
| `createHuifuIndividualUser` | `/v2/user/basicdata/indv` | 教练个人开户，需姓名、身份证号、手机号、身份证照片 file_id 列表 |
| `openHuifuUserBusiness` | `/v2/user/busi/open` | 业务入驻 + 绑结算卡 + 结算配置。**返回 `{ tokenNo }`** 用于后续提现 |
| `queryHuifuUserAccounts` | `/v2/acct/query` | 查询用户子账户列表（基本户、现金户等） |
| `transferByBalancePayment` | `/v2/trade/acctpayment/pay` | 余额支付分账：从现金户转钱给多个接收方 |
| `encashmentForCoach` | `/v2/trade/settlement/encashment` | 教练提现到绑定的银行卡 |
| `formatHuifuReqDate` | — | 汇付请求日期格式化 `yyyyMMdd` |
| `generateReqSeqId` | — | 生成唯一请求序列号 `yyyyMMdd_随机8位` |

### 3.3 API 路由

#### 支付下单

| 路由 | 方法 | 功能 |
|---|---|---|
| `POST /api/payment/wechat/coach/create` | POST | 小程序微信支付下单。`trade_type=T_MINIAPP`，`acct_id=F22836659`，`fee_flag=2`。下单前验证教练 `huifu_open_status === 'opened'`，未开通则拒绝 |
| `POST /api/payment/alipay/create` | POST | Web 支付宝下单。教练订阅走汇付 `A_JSAPI`/`A_NATIVE`（同现金户），其他订单走支付宝直连 |

#### 支付回调 & 查询

| 路由 | 方法 | 功能 |
|---|---|---|
| `POST /api/payment/wechat/notify` | POST | **汇付统一异步通知处理器**（虽然路径叫 wechat）。验签 → 更新订单状态 → 履约订阅 → **调 `executeBalancePayment` 余额分账** → `updateTransactionAndWallet` 记账 |
| `POST /api/payment/wechat/query` | POST | 主动查汇付订单状态。查到已支付 → 同样触发余额分账 + 记账（防止异步通知丢失） |
| `POST /api/payment/alipay/notify` | POST | 支付宝直连异步通知。仅处理非教练订阅订单，不受分账链路影响 |

#### 履约共享模块

**文件**：`src/app/api/payment/alipay/fulfillPaidOrder.ts`

| 函数 | 功能 |
|---|---|
| `updateTransactionAndWallet(order, splitInfo?)` | 教练钱包入账 + 流水记录。按 `alipay_order_id` 幂等。有 `splitInfo` 时以汇付实际金额为准，无则 100% 入教练。同时写 `platform_revenue` |
| `fulfillSubscriptionOnPaid(order, orderId, userId, provider)` | 订阅激活/续费确认 + 教练站内信。按 `last_payment_order_id` 幂等 |
| `executeBalancePayment(order)` | **余额分账执行函数**。先查 `wallet_transactions` 幂等 → 查教练 `huifu_id` → 调 `transferByBalancePayment` 80/20 分账 → 返回汇付实际分账金额。失败不阻塞履约 |

#### 教练开户

| 路由 | 方法 | 功能 |
|---|---|---|
| `POST /api/coach/merchant/open-huifu-account` | POST | 三步完成：上传身份证正反面（F04/F05）→ 创建个人用户 → 业务入驻。写入 `huifu_id`、`huifu_open_status`、`huifu_card_token` 到 `coaches` 表。已开户但缺 token 的教练可补调业务入驻 |

#### 教练提现

| 路由 | 方法 | 功能 |
|---|---|---|
| `POST /api/coach/wallet/huifu/withdraw` | POST | 汇付提现。校验余额、`huifu_open_status`、`huifu_card_token` → 调 `encashmentForCoach` → 扣减钱包余额 → 写入 `wallet_transactions`（type: withdrawal） |

### 3.4 前端变更

#### Web 端（`src/app/dashboard/wallet/`）

| 页面 | 变更 |
|---|---|
| `page.tsx` | 提现自动切换：`huifu_open_status === 'opened'` → `/api/coach/wallet/huifu/withdraw`，否则 → 旧支付宝提现。提现提示文案适配（"T+1 到账银行卡" vs "48 小时内到账"）。交易流水展示 `platform_fee` |
| `merchant/page.tsx` | 教练汇付开户表单（两步向导：身份信息 + 银行卡信息） |

#### 小程序端（`apps/wechat/src/coach/wallet/`）

| 页面 | 变更 |
|---|---|
| `index.tsx` | 余额卡片、汇付开户状态卡片（待开通/已开通/失败）、交易流水展示 `platform_fee`。引导去电脑端操作提现 |
| `index.scss` | 汇付状态卡片样式 |

---

## 四、遇到的问题及解决过程

| # | 问题 | 报错信息 | 根因 | 如何解决 |
|---|------|----------|------|----------|
| 1 | 实时分账失败 | `商户未配置默认账户` (22000005) | 教练个人账户（通过 `/v2/user/basicdata/indv` 创建）没有默认/虚拟账户，不能作为实时分账的接收方 | 放弃 JSPay 实时分账，改为两阶段：JSPay 只收款（进现金户），支付成功后再调余额支付接口分账 |
| 2 | 手续费外扣失败 | `暂未开通手续费外扣功能` | `fee_flag=1`（外扣=平台承担手续费）在该商户未开通 | 改为 `fee_flag=2`（内扣），影响范围：`wechat/coach/create`、`alipay/create`、`huifuMiniProgramPay.ts` 默认值 |
| 3 | `fulfillPaidOrder.ts` JavaScript 解析失败 | `Parsing ecmascript source code failed: Unexpected character '"'` at line 39 | 整个文件的英文双引号被替换成了中文弯引号 `"object"` 而不是 `"object"`，JS 引擎无法解析 | 全文替换为直引号 `"..."`。该文件被多个路由引用（wechat/query、alipay/create、chat/list-chatrooms），一处报错全部挂 |
| 4 | `settle_config_list` vs `settle_config` 参数名不确定 | 业务入驻失败 | 汇付 API 文档中该参数名称、格式（数组 vs 对象）不够明确 | 按汇付官方文档和客服确认，使用 `settle_config_list`，值为 JSON 数组 `[{settle_cycle, min_amt, out_settle_flag, settle_abstract}]` |
| 5 | `cardType` 取值导致开户失败 | 业务入驻失败 | 个人对私卡的正确值为 `"0"`（对私个人），之前误用了 `"2"`（对私非法人） | 改为 `"0"` |
| 6 | Web 支付宝通知格式不匹配 | — | A_JSAPI 下单时 `notify_url` 指向了 `alipay/notify`，该处理器按支付宝参数格式解析，无法处理汇付格式的异步通知 | `alipay/create` 中汇付订单改用 `WECHAT_PAY_NOTIFY_URL` 指向 `wechat/notify`（汇付统一通知处理器） |
| 7 | `openHuifuUserBusiness` 丢弃绑卡令牌 | 提现时无 `tokenNo` 可用 | 函数返回 `Promise<void>`，`huifuPost` 响应（含 `token_no`）被丢弃 | 改为 `Promise<{ tokenNo?: string }>`，开户路由写入 `coaches.huifu_card_token`。同时导出了 `generateReqSeqId` |
| 8 | 身份证照片上传失败 | 文件超 2MB | 汇付图片接口限制 2MB，手机拍照通常远超 | 前端用 canvas 压缩后再上传 |

---

## 五、完整支付链路

```
学员在小程序/Web 点支付
  │
  ├─ POST /api/payment/wechat/coach/create (或 alipay/create)
  │   ├─ 检查教练 huifu_open_status === 'opened'
  │   ├─ JSPay 下单，参数：
  │   │   acct_id = F22836659 (平台现金户)
  │   │   fee_flag = 2 (内扣)
  │   │   trade_type = T_MINIAPP / A_JSAPI / A_NATIVE
  │   └─ 返回支付参数给前端
  │
  ├─ 前端调起微信支付 / 支付宝
  │
  └─ 用户完成支付

═══════════════ 异步通知路径 ═══════════════

汇付发送通知 → POST /api/payment/wechat/notify
  │
  ├─ 验签 (parseHuifuNotifyContent)
  ├─ 更新 alipay_orders.status = 'paid'
  │
  ├─ fulfillSubscriptionOnPaid
  │   ├─ 激活/续费订阅 (coach_subscriptions)
  │   ├─ 发送教练站内信
  │   └─ 自动匹配训练计划
  │
  ├─ executeBalancePayment (仅 coach_subscription)
  │   ├─ 幂等检查：查 wallet_transactions 是否已有此订单记录
  │   ├─ 查 coaches 表取教练 huifu_id
  │   ├─ transferByBalancePayment (/v2/trade/acctpayment/pay)
  │   │   ├─ 出金账户：F22836659 (平台现金户)
  │   │   ├─ 入金方1：教练 huifu_id，金额 = 订单总额 × 80%
  │   │   ├─ 入金方2：平台 huifu_id，金额 = 订单总额 × 20%
  │   │   └─ 返回实际分账明细 (acct_split_bunch)
  │   └─ parseAcctSplitBunch → SplitActual[]
  │
  └─ updateTransactionAndWallet(alipayOrder, splitInfo)
      ├─ 幂等检查（DB 唯一约束 idx_wallet_transactions_alipay_order_id_income）
      ├─ wallet_transactions INSERT (amount=教练实收, platform_fee=平台抽成)
      ├─ platform_revenue INSERT
      └─ coach_wallets.balance UPDATE (+教练实收)

═══════════════ 主动查询容错路径 ═══════════════

POST /api/payment/wechat/query
  │
  ├─ queryHuifuMiniProgramOrder (主动查汇付)
  ├─ 如果 trans_stat=S 且之前未处理
  └─ 同上：履约订阅 → 余额分账 → 记账

═══════════════ 教练提现路径 ═══════════════

POST /api/coach/wallet/huifu/withdraw
  │
  ├─ 校验：余额充足 + huifu_open_status=opened + huifu_card_token 存在
  ├─ encashmentForCoach (/v2/trade/settlement/encashment)
  │   └─ 从教练汇付账户打到绑定的银行卡（T+1 到账）
  ├─ 扣减 coach_wallets.balance
  └─ wallet_transactions INSERT (type=withdrawal, amount=-提现金额)
```

---

## 六、验证 SQL

```sql
-- 1. 检查订单状态
SELECT id, status, total_amount, order_type, payment_provider
FROM alipay_orders
WHERE id = '<订单ID>';

-- 2. 检查钱包流水（应有 platform_fee 列有值代表分账成功）
SELECT id, wallet_id, amount, platform_fee, type, alipay_order_id, description
FROM wallet_transactions
WHERE alipay_order_id = '<订单ID>';

-- 3. 检查平台收入
SELECT * FROM platform_revenue WHERE source_order_id = '<订单ID>';

-- 4. 检查教练钱包余额
SELECT coach_id, balance, total_income, frozen_amount
FROM coach_wallets
WHERE coach_id = '<教练ID>';

-- 5. 检查教练汇付开户状态和提现令牌
SELECT id, huifu_id, huifu_open_status, huifu_open_msg, huifu_card_token
FROM coaches
WHERE id = '<教练ID>';

-- 6. 检查订阅状态
SELECT id, student_id, coach_id, status, payment_method, payment_confirmed_by,
       subscribed_weeks, start_date, end_date, last_payment_order_id
FROM coach_subscriptions
WHERE id = '<订阅ID>';
```

---

## 七、剩余未完成工作

| # | 事项 | 优先级 | 说明 |
|---|------|--------|------|
| 1 | **端到端集成测试** | 🔴 高 | 已完成单次支付但未验证整条链路。需：支付 → 主动调查询触发分账 → 查数据库确认钱包入账和 platform_fee → 验教练余额 → 测提现 |
| 2 | **退款功能** | 🔴 高 | 汇付退款 API `/v2/trade/refund` 未接入。当前无法线上退款，只能汇付后台人工操作。需要：退款 API 封装 → 退款回调处理 → 钱包流水回退 |
| 3 | **余额分账异步回调处理** | 🟡 中 | `transferByBalancePayment` 响应 `trans_stat` 可能为 `P`（处理中）而非 `S`。当前只判断同步 `resp_code`，如果汇付异步回调余额支付结果，需要单独处理 |
| 4 | **alipay/notify 防御性检查** | 🟡 中 | 虽已改 notify URL，但如果有任何链路导致教练订阅订单的支付宝直连通知触发，分账不会被触发。建议在 alipay/notify 加 coach_subscription 类型判断 + 告警日志 |
| 5 | **问卷优先支付流程** | 🟡 中 | 学员点教练套餐 → 先填问卷 → 再付款。当前直接进支付页 |
| 6 | **已开户教练补绑卡 token** | 🟢 低 | 之前开户的教练 `huifu_card_token` 为空。已支持"重新绑卡"模式（有 `huifu_id` + 无 token → 补调 `openHuifuUserBusiness`），但需手动触发或加自动检测 |
| 7 | **提现记录查询 API** | 🟢 低 | 汇付提现复用 `wallet_transactions`（无独立提现表），旧 `alipay_withdrawals` GET 查询接口没有对应汇付版本。当前只能在钱包流水里看提现记录 |
| 8 | **小程序端提现入口** | 🟢 低 | 小程序钱包页只读展示，提示去电脑端操作。可考虑在小程序内开放提现 |
| 9 | **延迟分账模式（冷静期退款）** | 🟢 低 | 如需"7 天冷静期退款"，可切 `delay_acct_flag=Y`：JSPay 下单时不分账，冷静期过后调 confirm 接口确认分账。当前 `transferByBalancePayment` 已预留参数空间 |

---

## 八、关键环境变量

| 变量 | 值 | 用途 |
|---|---|---|
| `HUIFU_CUSTOMER_ID` | `6666000194449179` | 平台汇付商户号 + 平台自身 huifu_id（分账接收） |
| `HUIFU_CASH_ACCT_ID` | `F22836659` | 平台现金户 ID，JSPay 收款入账 + 余额分账出金 |
| `HUIFU_SYS_ID` | `6666000194449179` | 汇付系统 ID |
| `HUIFU_PRODUCT_ID` | `XLSISV` | 汇付产品 ID |
| `WECHAT_PAY_NOTIFY_URL` | `https://coachlink.fit/api/payment/wechat/notify` | 汇付异步通知回调地址 |
| `WECHAT_MINIAPP_APPID` | `wx316e39eb71c0e834` | 微信小程序 AppID |
| `PAYMENT_TEST_PRICING` | `true` (dev) | 测试定价开关，支付 1 元即可测试 |
| `HUIFU_PAY_PRIVATE_KEY` / `HUIFU_PUBLIC_KEY` | — | 汇付 API 签名密钥对 |

---

## 2026-05-05 补充：分账状态表与安全入账规则

- 已确认此前没有专门的分账状态表；本轮新增 `supabase/migrations/20260505_coach_subscription_settlements.sql`。
- 新表 `coach_subscription_settlements` 是汇付余额分账的远端调用幂等账本，一笔教练订阅支付订单只对应一行。
- 状态流转：
  - `pending`: 已创建待分账
  - `processing`: 已认领并已生成/保存汇付请求流水，等待结果或人工/任务核对
  - `split_success`: 汇付返回分账成功且存在 `acct_split_bunch`
  - `split_failed`: 明确失败，可在确认不会重复转账后再补偿
  - `wallet_credited`: 本地 `wallet_transactions` / `platform_revenue` 已写入
- `wallet_transactions` 只作为本地钱包入账流水，不再作为汇付远端分账调用的唯一幂等锁。
- 教练订阅订单必须先完成汇付余额分账；没有 `splitInfo` 时 `updateTransactionAndWallet()` 会拒绝给教练钱包入账，避免分账失败却把 100% 记到教练钱包。
- 如果汇付请求在认领后抛出超时/验签/网络等不确定异常，状态保持 `processing`，不自动换新的 `req_seq_id` 重试，以免第一笔实际已受理后发生重复转账。
