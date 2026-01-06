# 学员端支付功能调试总结

> **日期**: 2026-01-06 **模块**: 支付与履约 (Payment & Fulfillment) **状态**: ✅
> 已解决

## 1. 问题概述

在接入支付宝支付并进行真机调试时，遇到了一系列阻碍支付流程闭环的问题。主要表现为：支付成功但状态未更新、会员权益（AI次数/存储）未到账、订阅页面状态显示错误。

## 2. 详细问题与解决方案

### 问题一：回调接口 307 重定向 (The 307 Redirect Issue)

**表现**：

- 用户支付成功，但本地订单状态一直停留在 `pending`。
- Ngrok 日志显示支付宝发给 `/api/payment/alipay/notify` 的请求返回了
  `307 Temporary Redirect`。

**原因**：

- 项目使用了 `src/proxy.ts`作为中间件进行路由鉴权。
- 支付宝的回调请求是服务器间通信，不携带即时用户的 Session Cookie。
- `proxy.ts` 默认拦截了未定义的路由并重定向到登录页，导致回调无法到达处理逻辑。

**修复**：

- 在 `src/proxy.ts` 的 `PUBLIC_PATHS` 列表中添加了支付回调路径，允许匿名访问。

```typescript
const PUBLIC_PATHS = new Set([
    // ...
    "/api/payment/alipay/notify", // Alipay callback - must be public
]);
```

### 问题二：会员权益未完整发放 (Incomplete Fulfillment)

**表现**：

- 订单状态变为 `paid`，会员等级也更新为 `basic`。
- 但用户的 AI 导入次数仍为 0，云存储空间未扩容。

**原因**：

- `FulfillmentService` 中的 `fulfillMembership` 方法仅更新了
  `student_memberships` 表。
- 缺少了同步更新 `student_quotas` 表（发放 AI 点数和存储空间）的逻辑。

**修复**：

- 在 `FulfillmentService` 中增加了 `applyTierQuota` 方法。
- 在会员履约成功后，自动根据等级（Basic/Premium）更新用户的 Quota 表。
- **补救措施**：为测试期间受影响的用户手动触发了权益发放。

### 问题三：订阅页状态显示错误 (Frontend Display Glitch)

**表现**：

- "我的会员"主页显示正确的"基础会员"。
- 但点击"续费/升级"进入订阅页后，仍显示"免费体验"为"当前计划"，且允许重复购买基础会员。

**原因**：

- 前端 `StudentMembershipService` 与后端 API `get-status` 的数据结构定义不一致。
- API 返回结构为 `{ success: true, data: { tier: '...' } }`。
- 前端 Service 错误地多处理了一层泛型，导致组件获取到的 `tier` 为
  `undefined`，从而回退到默认的 Free 状态。

**修复**：

- 修正了 `src/app/service/studentMembershipService.ts` 中的泛型定义。
- 修正了 `SubscribePage` 组件中的数据获取逻辑 (`res.data.tier` vs `res.tier`)。
- 优化了页面逻辑：已拥有的等级显示"当前计划"并禁用按钮，避免重复订阅。

## 3. 下一步建议

- **监控**：建议在生产环境对 `/api/payment/alipay/notify`
  增加专门的错误日志监控，防止回调静默失败。
- **测试**：目前的测试是在 Dev
  环境下进行的，上线前建议在该流程上进行一次完整的生产环境验证。
