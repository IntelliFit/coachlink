# 金额精度问题修复说明

## 问题描述

数据库中使用浮点类型（numeric）存储金额，导致精度问题。例如：
- 0.1 + 0.2 = 0.30000000000000004
- 8.079999999999998 这样的精度丢失

## 解决方案

将所有金额字段改为使用整数存储，单位为"分"（cent），避免浮点数精度问题。

### 存储规则
- **数据库存储**：整数（单位：分）
- **代码计算**：使用整数（分）进行计算
- **前端显示**：转换为元（小数）显示

例如：
- 3.14 元 → 存储为 314 分
- 100 分 → 显示为 1.00 元

## 代码修改

### 1. 金额工具函数库（精度安全）

文件：`src/lib/moneyUtils.ts`

**约定**：内部一律使用「分」（整数）；仅在返回给前端或调第三方接口时转为「元」。元↔分换算及带小数的乘除使用 `decimal.js` 保证精度。

工具函数：
- `yuanToFen(yuan)` - 元→分（仅用于前端/第三方传入的元）
- `fenToYuan(fen)` - 分→元（仅用于返回前端或调支付宝等）
- `formatYuan(yuan)` / `formatYuanFromFen(fen)` - 格式化为两位小数字符串（展示用）
- `addFen(fen1, fen2)` - 分+分→分
- `subtractFen(fen1, fen2)` - 分-分→分
- `multiplyFen(fen, multiplier)` - 分×系数→分（系数可为小数，用 Decimal 保证精度）
- `divideFen(fen, divisor)` - 分÷数→分
- `ensureNonNegativeFen(fen)` - 保证非负
- `toFenSafe(value, alreadyFen)` - 来源不确定时安全取分（兼容旧数据）

### 2. 修复的文件列表

#### API 路由（内部用分，返回前端的金额字段已转元）
- ✅ `src/app/api/payment/alipay/fulfillPaidOrder.ts` - 钱包入账
- ✅ `src/app/api/payment/alipay/refund/route.ts` - 退款
- ✅ `src/app/api/payment/alipay/create/route.ts` - 订单创建
- ✅ `src/app/api/payment/alipay/query/route.ts` - 订单查询
- ✅ `src/app/api/coach/wallet/route.ts` - 钱包查询（返回 balance/total_income/amount 为元）
- ✅ `src/app/api/coach/wallet/alipay/withdraw/route.ts` - 提现（余额用分比较，返回列表金额为元）
- ✅ `src/app/api/coach/wallet/alipay/withdraw/cancel/route.ts` - 撤回提现（余额为分）
- ✅ `src/app/api/admin/withdrawals/route.ts` - 管理员提现列表（返回 amount/fee 为元）
- ✅ `src/app/api/admin/withdrawals/confirm/route.ts` - 确认提现
- ✅ `src/app/api/admin/payment-orders/route.ts` - 管理员订单列表（返回 total_amount 为元）
- ✅ `src/app/api/subscription/list-subscriptions/route.ts` - 订阅列表（返回 monthly_price 为元）
- ✅ `src/app/api/coach/list-students/route.ts` - 学员列表（返回 monthly_price 为元）
- ✅ `src/app/api/coach/get-student/route.ts` - 学员详情（返回 monthly_price 为元）
- ✅ `src/app/api/coach/get-overview-data/route.ts` - 概览（monthlyRevenue 为元）
- ✅ `src/app/api/purchase-history/list/route.ts` - 购买记录（返回 amount 为元）
- ✅ `src/app/api/subscription/create-subscription/route.ts` - 创建订阅（前端传元，写入 DB 为分）

#### 前端页面
- ✅ `src/app/dashboard/wallet/page.tsx` - 钱包（API 已返回元，直接 toFixed(2) 展示）
- ✅ `src/app/dashboard/overview/page.tsx` - 概览本月收入为元，toFixed(2) 展示

## 数据库操作步骤

### ⚠️ 重要：在执行迁移前请备份数据库！

### 步骤 1：备份数据库

```sql
-- 备份相关表
CREATE TABLE coach_wallets_backup AS SELECT * FROM coach_wallets;
CREATE TABLE wallet_transactions_backup AS SELECT * FROM wallet_transactions;
CREATE TABLE alipay_orders_backup AS SELECT * FROM alipay_orders;
CREATE TABLE alipay_withdrawals_backup AS SELECT * FROM alipay_withdrawals;
```

### 步骤 2：执行迁移脚本

在 Supabase Dashboard 的 SQL Editor 中执行：

```sql
-- 文件：supabase/migrations/20260130_fix_money_precision.sql
```

或者使用 Supabase CLI：

```bash
supabase db push
```

### 步骤 3：验证数据

执行迁移后，验证数据是否正确转换：

```sql
-- 检查钱包余额（应该显示为分，例如 314 表示 3.14 元）
SELECT coach_id, balance, total_income, frozen_amount 
FROM coach_wallets 
LIMIT 5;

-- 检查订单金额（应该显示为分）
SELECT id, total_amount 
FROM alipay_orders 
ORDER BY created_at DESC 
LIMIT 5;

-- 检查交易记录（应该显示为分）
SELECT id, amount, type 
FROM wallet_transactions 
ORDER BY created_at DESC 
LIMIT 5;
```

### 步骤 4：验证前端显示

1. 登录系统，访问钱包页面
2. 检查余额显示是否正确（应该显示为元，例如 3.14）
3. 检查交易记录金额显示是否正确
4. 测试提现功能
5. 测试退款功能

## 注意事项

1. **所有金额计算必须在整数（分）层面进行**
   - ✅ 正确：`const totalFen = addFen(balanceFen, amountFen)`
   - ❌ 错误：`const total = balance + amount`（会导致精度问题）

2. **数据库存储时使用分（整数）**
   - ✅ 正确：`balance: yuanToFen(amountYuan)`
   - ❌ 错误：`balance: amountYuan`（会存储小数）

3. **返回给前端时转换为元（小数）**
   - ✅ 正确：`total_amount: fenToYuan(order.total_amount)`
   - ❌ 错误：`total_amount: order.total_amount`（前端会显示错误）

4. **支付宝接口需要元（字符串，保留两位小数）**
   - ✅ 正确：`refund_amount: fenToYuan(amountFen).toFixed(2)`
   - ❌ 错误：`refund_amount: amountFen`（支付宝会拒绝）

## 回滚方案（如果需要）

如果迁移出现问题，可以使用备份恢复：

```sql
-- 恢复表数据
TRUNCATE coach_wallets;
INSERT INTO coach_wallets SELECT * FROM coach_wallets_backup;

TRUNCATE wallet_transactions;
INSERT INTO wallet_transactions SELECT * FROM wallet_transactions_backup;

TRUNCATE alipay_orders;
INSERT INTO alipay_orders SELECT * FROM alipay_orders_backup;

TRUNCATE alipay_withdrawals;
INSERT INTO alipay_withdrawals SELECT * FROM alipay_withdrawals_backup;
```

然后需要将字段类型改回 numeric：

```sql
ALTER TABLE coach_wallets
    ALTER COLUMN balance TYPE numeric USING balance::numeric / 100,
    ALTER COLUMN total_income TYPE numeric USING total_income::numeric / 100,
    ALTER COLUMN frozen_amount TYPE numeric USING frozen_amount::numeric / 100;
```

## 测试清单

- [ ] 钱包余额显示正确
- [ ] 交易记录金额显示正确
- [ ] 提现功能正常
- [ ] 退款功能正常
- [ ] 订单创建金额正确
- [ ] 订单查询金额正确
- [ ] 管理员页面金额显示正确
- [ ] 金额计算无精度问题

## 相关文件

- 工具函数：`src/lib/moneyUtils.ts`
- 数据库迁移：`supabase/migrations/20260130_fix_money_precision.sql`
- 修复文档：`docs/fixes/money-precision-fix.md`
