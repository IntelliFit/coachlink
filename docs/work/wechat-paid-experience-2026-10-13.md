# CoachLink 收费体验版恢复（2026-10-13）

## 授权与现状

用户要求恢复此前平台收费体系、提交所有本地改动、更新完整体验版及配套后端。没有正式小程序提审/发布授权；教练购买和汇付自动分账不改。其他训练计划文档 WIP 按用户“所有本地修改”纳入提交，不重新写业务计划。

手机订单 c7c05eec-7edc-4876-b388-34fc50b0ff31 经实际数据库回读：XPay/env1、200分、ai_pack_200、paid、AI余额2→5，发货确认已记录。**这是沙箱闭环，不是现网现金扣款凭证。** 原支付记录/权益保留。

## 本次实现

- 客户端显式构建 `COACHLINK_WECHAT_PAID_RELEASE=true` 恢复会员、加油包、存储、动作特效入口/原付费限制；无此构建参数仍为免费包。服务端 Apollo 同名开关需要配套 opt-in，默认免费，老免费客户端 header 始终禁止发起新的平台收费。
- 不改教练汇付购买/结算常量及资金路由。付费体验版隐藏旧沙箱入口；沙箱页查询按钮不再被付款 busy/disabled 绑住，独立加载状态并给查询反馈，不能据此声称已真机复验。
- 普通4类会员商品改用 service_role-only、SECURITY INVOKER 的原子 RPC。权益、会员业务单 paid、不可公开访问的发货回执同事务，按 env/out_trade_no 幂等，续卡保留原业务30天规则，失败回滚并可重试。旧沙箱记录仍走既有处理，避免再次赠送。
- 普通 XPay 查询即使数据库已 paid 也重新向微信验款，不能把可修改的历史付款行当作现金证明。已发货状态不重复调用微信发货确认；发货竞争失败后真实复查而不盲吞错误。动作特效更新失败不再忽略。
- 新迁移 20261013084632 已直接执行到正确 CoachLink 云库；尚不等于迁移历史已登记。真实事务测试4商品/同档月卡续期/重复调用/失败回滚/角色权限，全部ROLLBACK，0探针订单、0回执，用户原AI余额仍5。

## Apollo 配套（只改 dev/app-config）

```properties
COACHLINK_WECHAT_PAID_RELEASE=true
WECHAT_XPAY_SANDBOX=false
WECHAT_XPAY_APP_KEY=<微信后台现网AppKey，不是沙箱Key>
```

OfferID 1450666974、AppID wx316e39eb71c0e834、消息 Token/已有配置不变；禁止把 AppKey/Token 写入聊天或提交 Git。发布配置并确认进程重新加载。main 免费开关不打开。

全局消息 URL 当前指向 main 旧支付代码，它不具备本次普通商品原子发货和官方 Env/WeChatPayInfo 兼容。收费体验应将消息推送 URL 配套指向 `https://dev.coachlink.fit/api/payment/wechat/xpay/notify`（或明确授权代理做精确回调路由切换），同一 Token、明文 JSON；不得只测客户端轮询就说通知已完整验收。

## 8 个现网道具代码映射

|ID|价格元|权益|
|---|---:|---|
|m_basic_1990|19.90|基础月卡30天|
|m_premium_3990|39.90|高级月卡30天|
|ai_pack_200|2.00|AI导入+3次|
|storage_990|9.90|存储+1024MB|
|motion_p_290|2.90|标准导出|
|motion_p_490|4.90|高清导出|
|motion_p_480|4.80|标准+优先|
|motion_p_680|6.80|高清+优先|

dev/main Apollo motion price override 均未配置，使用上述默认值。用户已确认8个已发布；query_publish_goods 只能读最后发布任务，不等于完整目录验证；本次不重复上传/发布商品。

## 尚未覆盖的风险与边界

- 既有两支付表 RLS 关闭、anon 读写过宽仍需独立依赖审查/治理；本次新增回执/RPC只授予service_role。真实微信复查减少伪造paid发权益，但不等于全库安全已修复。正式收费上线前必须处理该已披露问题。
- 用户只验了 AI 沙箱，不代表月卡/存储/特效及现网实扣全部真机通过；退款权益仍按既有 manual_review 运营处理，不宣称自动撤回全部权益。
- 发布结果、构建/截图门禁、实际配置状态需在下方收据补齐，不提前宣称上传/部署/现网完成。

## 执行收据（进行中）

lint 脚本实际未配置；窄 typecheck通过，第一轮90文件642项单测通过。完整付费小程序在 D:/cache/agent-tests/coachlink-paid-trial-20261013/miniapp 构建中，远端只更新 dev。用户尚未回复 dev 现网+收费 opt-in 发布。无实际现金付款/退款由代理发起。
