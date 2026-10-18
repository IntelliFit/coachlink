# XPay联调交接（2026-10-11）

## 现网验证切换（最新，覆盖以下旧沙箱步骤）

用户明确要求转真实环境。测试服务已加载main的匹配现网配置，env0/AppKey只读验证成功；不是改dev的沙箱Key签env0。

- API：`https://dev.coachlink.fit/api/payment/wechat/xpay/live-test/health`，sandbox=false/env0/8目录、仅ai_pack_200开放。
- 原项目：`D:/cache/agent-tests/coachlink-xpay-20261011/miniapp`，真实2元付款确认、仅管理员本人微信。原项目重新编译→预览→安卓扫码→本人登录→本人确认付款→查单。不能上传该单页代替正常小程序。
- 验证范围明确是收款/查单，不发放AI额度、会员等实际权益，不回复商品发货成功、不改汇付。19项离线切换检查和6实际只读HTTP检查通过；本轮代理未创建真实单或支付。
- 现金记录持久落盘远程 `/home/ubuntu/coachlink-xpay-sandbox-20261011/live-state`，不可自动作为临时数据删除；同账号未付款复用原单，已确认付款不再建第二单。Pod单副本Recreate/hostPath且权限700，坏状态失败关闭。
- 普通main128/dev86应用/正式免费开关/汇付未动。既有独立测试资源legacy名coachlink-xpay-sandbox-20261011，实际gen4/live模式；旧sandbox端点关闭。基础库3.15.2；19+6证据D任务verification-live.json/cash-live-results.json，总1.5MB。
- DevTools9421有限连接失败，未得页面截图/二维码；不反复开窗口。真实安卓付款、权益、通知、退款仍需继续，不能默认为通过。

收尾：现网用户验证结束后可按明确范围清理D任务temp（约1.3MB），保留构建/报告供复查；远程测试API关闭及现金记录留存另行明确处理，不删除财务记录。原nginx变更前单一备份保留，未制作大型重复备份。

## 最新执行结果（覆盖下方历史待授权状态）

用户已授权构建测试，设备安卓。8商品已配置/发布、dev沙箱true均不再重复询问。

- 独立测试包：D:/cache/agent-tests/coachlink-xpay-20261011/miniapp，同CoachLink AppID，固定基础库3.15.2；8SKU默认AI加油包2元。构建约162KB（含后端），无需Taro/Next全量构建、新依赖或本机Docker。
- 41定向离线检查+13既有通知/认证验证通过，helper独立TS检查通过。包含全部商品签名、原生回调取消、env0阻止、金额/账号/通知匹配、重复回执1次、模拟退款状态与界面逻辑；退款测试是隔离账本而非实际权益回收。
- 6线上实查通过：沙箱health200/env1/8商品、无认证create/query拒绝、unsigned notify403、signed sandbox notify200/echo、原main signed notify200/echo。未创建真实订单或确认付款。
- 新隔离API：dev.coachlink.fit/api/payment/wechat/xpay/sandbox/，K8s coachlink-xpay-sandbox-20261011、1副本/NodePort30019，复用既有94d62a4d immutable dev镜像+小ConfigMap。main128/dev86应用部署未动；只新增dev的sandbox前缀nginx location，nginx-t通过，配置备份仅/home/ubuntu/coachlink-xpay-sandbox-20261011/coachlink.nginx.before.conf一份。
- 安全边界：真实微信JWT、管理员与openid一致、仅8SKU/env1，状态最多64条/24小时、4单/分钟；不调用生产会员/钱包/分账写入。正常免费客户端仍免费，汇付链路未修改。
- 修正源码：notify官方Env与WeChatPayInfo（兼容旧小写），stable_token force_refresh=false。正式main和普通dev尚未发布这些新源码修复；仅隔离API具备新helper。
- UI/真机未通过：automator连接两次有限尝试超时，官方preview卡住无QR；自己的preview CLI已停止、fixture官方close成功后watcher/9421无残留，未改mock/storage。Windows截图返回非目标，不能视为验收。产物保留给用户手动导入，而非声称新体验版已上传。

### 仍未完成，不能据此恢复收费

1. 实际安卓原生收银台与沙箱付款。用户本人确认，代理不代付。
2. 真正业务会员/AI/空间/特效的权益到账和幂等性、数据库约束；fixture只确认测试回执。
3. 通知与轮询完整发货闭环：main全局通知没有转发xpaysbx_测试订单，fixture主动查单尚未调用notify_provide_goods；不得称微信侧已发货验收。
4. 真实退款及业务权益回收（现有代码manual_review）、苹果现网、正式恢复收费与提审。

### 用户安卓验证路径（不是当前正式免费小程序入口）

DevTools导入上述miniapp目录 → 预览 → 安卓微信扫码 → 本人管理员微信登录 → 默认AI商品打开收银台先取消 → 新建再支付 → 查询两次。测试回执最多1，不改变正式会员/余额。若微信侧发货仍待确认，继续完善notify_provide_goods/隔离通知，不能把本地回执当完整上线验收。

证据：任务目录build-manifest.json、verification.json、ui-verification.json；源脚本scripts/xpay-sandbox/。临时API为待真机验收保留；结束后先移除dev sandbox location并nginx-t/reload，再仅删除命名为coachlink-xpay-sandbox-20261011的Deployment/Service/ConfigMap。勿改或删除正常coachlink-dev/main资源。D盘本任务目录可在不再使用且确认无reparse/窗口后清理；本轮没有清用户数据。

## 以下为历史检查记录

## 已完成与实查

- 最新：用户改true后dev新bootstrap确认true；沙箱AppKey已通过/xpay/query_publish_goods env=1验签errcode0，stable_token force_refresh=false。probe-sandbox.mjs只读，不创建订单。dev通知真实签名GET401，需在保留现有分享修复基线的前提补回调匿名放行；不能倒退镜像或宣称dev通过。数据库元数据execute_sql权限拒绝，唯一索引/退款CHECK仍未验证。
- 联调后端/包尚未构建。已向用户请求D:/cache/agent-tests/coachlink-xpay-20261011约1–3GB构建预算和测试设备（安卓/iPhone）；不使用C临时，不做普通用户付费开关，不上传/提审正式包。大构建与实际付款等待授权及设备决定。

- 用户确认微信消息推送已提交、八道具均发布现网，不重复要求填相同表单。
- main/app-config四项存在，OfferID1450666974和现网环境false正确，真实Token签名公开回调GET200原文/无签名403再次通过。
- 使用稳定凭据非强刷模式和只读/xpay/query_publish_goods/env0，errcode0，现网AppKey已通过微信接口验签。该接口仅最后发布任务，返回status0，不是全部目录查询；八项线上发布记为用户确认，不假称通过此接口列出八项。
- alipay_orders、student_membership_orders、tool_video_render_jobs分别limit=0读取必要支付字段200，未读取实际订单或客户行。直接目标数据库连接不可用，唯一索引及refunded CHECK尚未复核，不自动应用迁移。
- dev配置存在OfferID/AppKey/消息Token，但SANDBOX不是true；不知道当前dev AppKey是否沙箱，不能据存在即当沙箱凭据已验证。
- 用户随后确认第二步完成，重新从Pod新bootstrap及Apollo configs直接取已发布配置：dev releaseKey=20261011013959-b1ec6960590c8330，SANDBOX明确false；main/local也false，均单一键。不是旧进程缓存，等刷新/重启不能把已发布false变true。请仅dev更正true并发布，密钥保持私密、对应沙箱；main不变。诊断脚本artifacts/wechat-xpay-callback/2026-10-11/inspect-apollo-xpay.mjs仅只读且输出白名单。
- main/dev共用的现有源码免费策略仍会拦平台会员创建和客户端requestVirtualPayment；当前免费包不能拿来直接验付费。

## 执行顺序与责任

- 测试设备现已由用户明确确定为安卓，不再询问苹果。D盘1–3GB构建预算尚未明确同意，现阶段仅必要小文件/只读工作。
- 隔离方案必须包含：测试包仅dev、正式免费编译策略保留、测试账号受限、订单env=1；通知服务器当前要求input.env===config.env，统一main/env0通知不能直接承接env1，需明确沙箱通知路由/校验方案；沙箱不得给普通正式用户赠送付费权益。不能只解除一个免费布尔值就称联调版已准备。

1. 用户在Apollo coachlink/dev/app-config为安卓沙箱选择沙箱AppKey并设置WECHAT_XPAY_SANDBOX=true，保存发布；main现网配置不改，已有dev OfferID/消息Token保留。若只用iPhone，则跳过安卓沙箱计划，改为先经用户确认金额/账号的现网受控测试，不伪称苹果可用沙箱。
2. 代理准备受控联调后端和小程序开发/体验包，隔离正式免费版与普通用户，不通过远程开关让审核版变收费、不动汇付。真正构建/容器写入前须按磁盘保护规则说明目录/预算、核余量，超过500MB或C盘写入风险需明确授权。本轮未构建、部署或上传。
3. 代理先复核XPay唯一订单索引及退款状态约束、测试包的正式/沙箱域名与环境、发货/退款通知；缺项须明确修复范围，不把字段可读当迁移全完成。
4. 用户真机发起已核价SKU付款；代理观察创建订单、支付结果、回调/主动查单及权益到账。先AI加油包小额商品，再会员、存储与动作特效代表规格；对真实付款必须由用户本人确认执行。
5. 受控测试取消/失败不发货、重复通知/查单不重复加权益、退款到账/本地状态与权益处理一致。当前退款代码记录manual_review，不宣称已自动回收会员/AI/空间权益。测试订单保留真实财务审计，不删除真实交易冒充零残留。
6. 用户设置简称、启用苹果IAP并在现网真机付款；再次核到账和通知，不能用Android沙箱成功替代iPhone验收。
7. 整链通过后才准备恢复收费版本与正常提审发布。恢复收费范围需用户明确确认，教练汇付购买及真实分账保留，审核分类合规问题不能由接口测试担保。

## 本轮资源与边界

只读检查，无支付/退款/订单、商品发布、数据库或部署写入；稳定token获取使用force_refresh=false，不强刷生产凭据。新脚本约5KB及本清单为小文件，位于D盘任务目录，未新增构建/依赖/镜像。D盘检查约40.24GiB可用，不生成大型隔离副本。
