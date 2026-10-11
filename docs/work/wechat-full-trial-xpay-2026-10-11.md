# 完整体验版与 XPay 沙箱验收

用户授权全部本地改动提交推送，最新正常小程序与配套dev后端；不是单页测试包，不提交正式审核、不恢复普通会员收费。

沿用dev Apollo沙箱AppKey/env1。本人微信管理员登录Android体验版，“我的→管理员：支付联调”，服务端每次查users核验is_admin/微信绑定；main/env0/cldev拒绝。普通免费版与Huifu购买/分账保留。

首轮ai_pack_200/200分，真实业务订单保留。取消后原单重新签名；确定性微信订单号不产生两笔独立微信支付。记录原AI余额，支付后CAS+3，重试恢复不重复增加，余额异动失败关闭。query_order验证付款/金额/订单、权益到账，notify_provide_goods成功后才显示通过。旧普通会员发货链路未声称全面修复。

既有87文件629项测试与新定向39项通过。lint脚本实际未配置ESLint；窄范围typecheck通过，新页面/后端还需完整mini/Next生产编译验证。产物D:/cache/agent-tests/coachlink-trial-xpay-20261011，待补Git SHA、镜像摘要、真实upload结果及UI证据。

用户安卓本人先取消一次、支付原订单一次、查单三次和重进，才能确认真机闭环。支付记录保留，不清除已付款数据。DevTools核根/AppID/端口/版本，不抢未知或FoodLink窗口，完成后恢复mock/storage、释放借用资源或关闭本任务临时窗口。

## 实际进展

- 全部本地源码提交1f9ecf1bc169e3d173f66aa3acb0fe79ee85a63e，618文件；独立构建路径修复aae107b67d23342027d482f32b499841efb5bc52；GitHub/Gitee dev都已成功推送。
- 官方CLI成功上传2026.10.11.0905完整正常包，总5757294字节、主包1934113。固定目录与AppID校核，miniprogramRoot/srcRoot均./、urlCheck=true；未上传独立现金小包。需微信后台体验版指向该版本，CLI上传本身不能独立证明后台选择已完成。
- 全量88文件633测试通过；窄范围typecheck及Node构建脚本语法通过。mini2899模块成功，125页已含管理员联调页，无localhost:300x/本地用户切换按钮。
- 本轮新建窗口完整D根、AppID wx316e39eb71c0e834、auto8998、HTTP28264；automator及mrc连接但读取/截图超时，无有效截图。没有成功mock或storage写入；finally恢复/disconnect，CLI close精确任务项目成功，8998无监听，释放登记。原用户/其他项目窗口未关闭。
- 回收未使用全仓archive副本258228224字节（源码已在Git可重打包），保留119628027字节runtime源码包；当前D任务产物132772798字节约127MiB。任务temp可清，miniapp与收据保留供手机验收；远程支付记录不删除。
- 配套后端从1f9ecf1b业务源码构建（aae107b6只改本机mini构建脚本）。首次归档遗漏根config/motion-effects-presets.json，补齐后远程Next生产编译3.7分钟、549页生成成功；Next配置跳过类型校验，不能将此称完整类型检查通过。
- 镜像ccr.ccs.tencentyun.com/littlehorse/coachlink:trial-xpay-20261011-1f9ecf1b，固定摘要sha256:521a63213cf09b47f5cdb4ba3777d0f99f419c7772b3eb13b6ce39cdc7bc0209。dev已用旧镜像guard精确更新，generation87、3/3新实例Ready；main generation128、3/3原sha256:3e446dd3d8e72676d048d47b1b1edc46f6c4381bc2f8bbc6c04932cf958fe031保持。
- 部署后8项只读/负向检查通过：dev/env1、未绑定管理员拒绝、普通免费购买403、伪联调头无登录401、汇付仍需认证401、cldev拒绝、unsigned通知403、公开dev真实Token签名GET200/echo匹配。没有创建订单、付款、修改角色/微信绑定或实际额度。短期诊断JWT仅进程内使用且只查自己的联调配置，不打印或持久化。
- 公网dev/main的实际健康路由/api/healthy均200；通用/api/health在此项目并不存在，404不视为部署失败。部署收据artifacts/xpay-trial/2026-10-11/deployment-preflight.json不含Token、AppKey、openid或登录JWT。文档收尾后lint脚本/窄typecheck再次通过；业务源码与633项通过时一致，不重复生成全量构建产物。

## 尚未完成与准确阻碍

- 数据库仅一个is_admin账号，目前wechat_openid为空；联调入口正确403，不能把前置检查通过称支付通路通过。已请求用户给准备测试账号的昵称/用户编号，确认前不修改is_admin或放开其他账号。
- 原管理员如为本人账号，可正常登录后“我的→设置→跨端账号同步→绑定微信”；该流程会核验真实微信code及冲突，不需要手工填openid。其他本人账号需身份确认后做最小联调授权，不提高后台管理员权限。
- CLI上传不证明后台已选体验版；用户须在版本管理确认体验版本2026.10.11.0905。随后Android：取消一次→原单付款一次→查单三次→退出重进，核验AI余额只+3、订单paid和微信发货确认。代理不代用户确认付款，支付证据保留。
- 页面截图未取得，真机支付/实际权益/退款未测；会员月卡、存储及动作特效不是本轮已验收项目，收费恢复与正式审核发布也未做。旧现金fixture不作为本轮交付，持久账本目录未删除。
