# 微信小程序虚拟支付改造

CoachLink 小程序内的平台自营会员、AI/存储增值包和动作特效导出使用微信官方 `wx.requestVirtualPayment`，不再跳转 Web/支付宝购买页。涉及教练收入分账的教练订阅继续使用汇付小程序支付、延迟分账和教练取现闭环，不进入 XPay。

## 定价模型

- 固定商品使用“商品 + 价格”稳定 SKU，例如基础月卡 ¥19.90 对应 `m_basic_1990`。
- 运行时 `goodsPrice` 必须与已发布 SKU 的价格完全相同，不使用 `activitySellingPrice` 模拟任意价格。
- 微信 iOS 虚拟支付最低实付 ¥1，因此动作特效价格不得低于 ¥1。
- 教练套餐价格不进入微信虚拟支付商品目录，其定价与结算继续遵循汇付链路。

## 运行时配置

以下变量属于业务运行配置。按 `docs/done/system-design/runtime-config.md` 放入 `CONFIG_SOURCE=local` 选中的 `.env.development` / `.env.production`，或放入 Apollo；不要写入根 `.env`：

```dotenv
WECHAT_XPAY_OFFER_ID=
WECHAT_XPAY_APP_KEY=
WECHAT_XPAY_MESSAGE_TOKEN=
WECHAT_XPAY_SANDBOX=true
WECHAT_MINIAPP_APPID=
WECHAT_MINIAPP_SECRET=
```

- 开发/安卓联调用沙箱：`WECHAT_XPAY_SANDBOX=true`。
- 正式和 iOS 联调用现网：`WECHAT_XPAY_SANDBOX=false`。iOS 不支持沙箱。
- 在微信公众平台把消息推送 URL 配成 `https://coachlink.fit/api/payment/wechat/xpay/notify`，Token 必须与 `WECHAT_XPAY_MESSAGE_TOKEN` 一致。
- Offer ID、AppKey 和商品目录都绑定 CoachLink 小程序 AppID，不能复用 food_link 的配置。

## 商品目录同步

只生成清单，不调用微信接口：

```bash
npm run wechat:xpay:catalog
```

确认清单后上传并逐个发布（生产配置需显式使用 production）：

```bash
npm run wechat:xpay:catalog -- --apply
npm run wechat:xpay:catalog -- --production --apply
```

脚本只读取平台固定商品和动作特效运行时价格；每个商品依次执行上传、等待完成、发布、等待完成。微信批量任务同一时间只允许一个任务，脚本因此串行处理。

## 订单与结算

- `alipay_orders.payment_provider = 'wechat_xpay'` 标识虚拟支付订单；微信侧商户订单号、SKU、价格、openid 和环境保存在 `order_data.xpay_*`。
- 发货回调和主动查单都会校验 openid、环境、SKU、数量和金额，随后幂等开通权益。
- XPay 只允许发放 `student_membership` 和 `motion_effect_export` 两类平台权益；教练订阅、教练内容等分账订单会被服务端拒绝。
- 教练订阅仍由汇付收款。7 天退款保护期后，平台汇付现金户真实转账到教练汇付账户；只有汇付分账成功后才记教练钱包，提现继续从教练汇付账户到本人银行卡。
- 当前管理端不直接调用微信虚拟支付退款 API；平台自营虚拟商品需在微信虚拟支付商户后台发起。退款回调会同步支付单、会员购买单或动作特效任务的退款状态，并把权益处理标记为 `manual_review`；在上线自动权益快照/回滚前，运营必须人工核对已消费额度、已生成内容和会员后续变更，不能自动覆盖用户退款后的其他合法购买。

## 上线顺序

1. 在微信公众平台开通 CoachLink 小程序虚拟支付并取得 Offer ID / AppKey。
2. 配置消息 Token 和回调 URL，完成 GET 校验。
3. 应用数据库迁移 `20260916020000_wechat_xpay_orders.sql`。
4. 配置运行时密钥，先同步沙箱商品并在安卓开发者工具/真机验证。
5. 切换现网配置，同步正式商品；iOS 必须使用现网商品验证。
6. 部署 Web/API 后再上传小程序体验版并提审。
