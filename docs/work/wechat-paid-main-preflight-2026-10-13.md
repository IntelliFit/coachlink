# 正式收费切换预检（2026-10-13）

用户最新明确：如果没有问题，main、local也可一起开启收费，用户自行提交微信审核。此次条件授权覆盖正式环境准备，但没有“忽略已知安全问题直接上线”或大范围数据库权限改造指令。此前“仅dev”是当时体验交付范围，不是XPay技术限制；普通XPay会员流程没有限定dev。

## 只读复核结果

- default/coachlink-main仍generation128、3Ready、旧3e446dd3...镜像；dev是generation89、3Ready、已验证8c01c933...镜像。main新原子发货/官方Env回调兼容尚未同步，只添加Apollo开关不能证明其新收费链路可用。
- main bootstrap实际收费开关未配置，SANDBOX=false，现网Key与消息Token存在，未打印密钥。dev此前env0签名校验通过，不等于真实现金支付完成；手机原成功订单仍env1。
- 正确CoachLink数据库uhlqribpagvklpqmcqvo最新只读查权限：**alipay_orders与student_membership_orders两表均RLS=false，anon SELECT/INSERT/UPDATE/DELETE全部true**，不满足无风险直接正式收费的前提。
- 权限依赖并非全部服务端角色：membership/create-order、webPaymentOrder部分建单、alipay/query登录分支、alipay/guest/create仍有匿名客户端访问付款表。直接开启RLS或撤匿名权限会破坏这些历史链路，不能借XPay更新未经审计改变汇付分账。旧Edge函数代码使用服务端key，但部署/函数内部鉴权仍须单独核验，不冒充已经全审计。

## 待用户明确范围

建议先授权针对两支付表的权限兼容修复：审查身份/订单归属/游客购买校验，将必要服务端付款访问迁移到私密服务角色，验证匿名不可读写、本人合法查询/通知/分账保持，再以受控顺序同步main后端与Apollo main/local收费开关。不能把所有调用全局切service_role或全库RLS作为快捷修复。

微信通知应继续使用正式coachlink.fit URL，前提是main同步新发货代码并通过签名/订单检查；dev地址是上一轮体验方案，不是永久正式地址。main/local的配置键仍COACHLINK_WECHAT_PAID_RELEASE=true，环境/AppKey必须匹配。Apollo local只有实际bootstrap选择该集群时才影响本地运行，不能绕过专用本地调试服务器的支付禁用。

本轮尚未改Apollo、K8s镜像、Git main或任何DB权限；没有提交微信审核/正式发布/真实扣款。只产生小文档及D:/cache/agent-tests/coachlink-paid-main-preflight-20261013/permissions.sql（不到1KB），可在此检查不再需要后仅清该任务目录，保留金融数据与项目文档。其他kk计划WIP保留，未提交/覆盖。
