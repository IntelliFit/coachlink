# 微信消息推送地址验证失败

用户填写的 URL 为 https://coachlink.fit/api/payment/wechat/xpay/notify，正确。2026-10-08正式公开GET仍401，返回用户未登录；本地proxy缺精确公共回调路径。回调签名校验同时通过getWechatXPayConfig读取所有支付凭证，导致仅配置消息Token也不能完成地址验证。

## 本地修复

- src/proxy.ts仅增加精确/api/payment/wechat/xpay/notify公共路径，继续由route验微信签名。
- src/lib/wechatXPay.ts的回调签名仅依赖WECHAT_XPAY_MESSAGE_TOKEN，不要求OfferID/AppKey/AppSecret。消息Token缺失仍拒绝，支付签名配置要求不变。
- 13项无网络校验通过：匿名回调可达、旁支和订单API仍401、正确签名GET返回原始echostr、坏签名403、无Token503、未签名POST无业务读取或写入。已有83文件588测试和根typecheck通过；lint仅提示未配置；未修改已有测试。
- 隔离构建源基于3fa31c472fb6c8a3679355c6d8c4f7e8c8a2cf4e（仅文档变化，业务基线b94f8e07）并应用上述两处；没有复制当前其他会话的业务WIP。主目录proxy原有local debug修改保留。

## 实际正式配置

通过既有SSH配置ubuntu@154.8.205.78，sudo kubectl --kubeconfig=/etc/kubernetes/admin.conf只读查询。正式deployment coachlink-main仍generation126/3ready，新镜像摘要29b98d04770c7e1c25bbafc63c7fd6dba432c70d54d9f81c31b28eabd157d11c。pod按容器名区分业务容器和apollo-reloader，不用containers[0]误识别Python镜像。

容器内bootstrap读取最新Apollo：appId=coachlink、cluster=main、namespace=app-config。WECHAT_XPAY_OFFER_ID/APP_KEY/MESSAGE_TOKEN均未配置，未输出密钥值。用户明确尚未作虚拟支付配置，正在获指导，不重新询问其密钥。

正式main配置清单：

| Key | Value |
|---|---|
| WECHAT_XPAY_OFFER_ID | 1450666974 |
| WECHAT_XPAY_APP_KEY | 本小程序现网AppKey，安全填写 |
| WECHAT_XPAY_MESSAGE_TOKEN | 用户自行生成的32位Token，与微信后台一致 |
| WECHAT_XPAY_SANDBOX | false |

开发dev联调使用沙箱AppKey和true。现有WECHAT_MINIAPP_APPID/SECRET不要复用FoodLink或随意替换。Apollo需发布并确认进程已重新加载；不能把main写到local集群。

当前消息接收为明文JSON，AES/XML未实现。微信后台选择明文模式与JSON；服务器URL保持原地址，Token与Apollo一致。正式微信保存之前必须确认已配置Token的真实GET挑战返回200原文；不得把匿名403当地址验证已经成功。

## 构建与正式热修上线（2026-10-08 00:52:59 UTC）

- Docker Desktop最初未运行，已隐式启动引擎后完成隔离构建。HEAD基线加上述两处修复的Next构建编译与547页生成通过；Docker独立安装依赖并构建成功，无跨worktree依赖链接。
- 镜像 `ccr.ccs.tencentyun.com/littlehorse/coachlink:xpay-notify-20261008-v1` 已推CCR，摘要 `sha256:0f0c45d491e78f714ed0168efd8cb22f04681b5cf94a952f9ec8323c0ec78537`。revision label为 `3fa31c472fb6c8a3679355c6d8c4f7e8c8a2cf4e+xpay-notify-fix`，不是新Git提交；未提交或推送源码，主目录两处修复仍未提交。
- 隔离Docker运行探针使用临时虚拟Token及无真实凭证配置：匿名403、正确签名200且原文echo完全一致、错误签名403，0支付订单。探针容器finally停止并自动删除。
- 通过resourceVersion及旧镜像JSON patch前置条件，只更新default/coachlink-main业务容器，不改dev或其他项目。generation126→127，滚动完成；三个业务容器均Ready、0重启、相同新摘要，apollo-reloader三实例亦Ready。公网 `/api/healthy` 200。
- 正式真实回调探针结果：source=apollo、cluster=main、messageTokenConfigured=false、unsignedStatus=403、challengeVerified=null。旧登录401已修正，但用户尚未发布消息Token，不能宣称微信签名挑战或后台保存已通过。
- 用户下一步：Apollo coachlink/main/app-config新增并发布上述四项（地址验证优先消息Token），告知已发布后检查配置加载与真实签名GET，再回微信后台保存。dev沙箱配置另用沙箱AppKey和true，不与main现网混用。
- 当前main固定热修标签；后续常规发布需从包含这两处修复的源码构建，并有意更新正常发布镜像，不得把本次标签当长期发布策略。

## 配置发布后的真实校验（2026-10-09）

- 用户确认已发布四项Apollo配置；定向SSH只读检查当前正式应用所选Apollo coachlink/main/app-config，不展示任何密钥值。
- OfferID存在且等于1450666974；AppKey和消息Token均存在；SANDBOX明确为false。这里只核配置存在/OfferID/环境，不能据此宣称AppKey已通过实际支付校验。
- 使用已发布Token生成真实签名GET访问公开正式回调，HTTP200且echostr原文完全匹配；未签名GET403。配置加载与实际回调所用Token一致已验证，不再仅是本地虚拟Token探针。
- 微信后台表单Token是否一致、提交是否成功尚待用户操作确认。下一步原URL/同Token/明文JSON保存，随后核齐八道具及发货/退款订阅，再准备受控联调版本；当前免费版本不会因此自动恢复平台收费。
- 本次未调用付款、发货或退款POST，没有订单/权益变更，也没有后台保存、发布小程序或修改部署。无全量测试、构建、容器构建或大型新产物，仅小脚本增强配置布尔检查并记录本结果。

本轮未启动实付/退款/分账/数据库迁移，不恢复收费、不上传小程序；未使用旧deploy.js的破坏式PM2路径。主目录其他会话业务WIP保留，未打包进此前热修镜像。支付发货/退款、开发沙箱、苹果现网及小程序收费恢复仍待后续授权范围内联调。
