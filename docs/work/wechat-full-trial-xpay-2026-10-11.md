# 完整体验版与 XPay 沙箱验收

用户授权全部本地改动提交推送，最新正常小程序与配套dev后端；不是单页测试包，不提交正式审核、不恢复普通会员收费。

沿用dev Apollo沙箱AppKey/env1。本人微信管理员登录Android体验版，“我的→管理员：支付联调”，服务端每次查users核验is_admin/微信绑定；main/env0/cldev拒绝。普通免费版与Huifu购买/分账保留。

首轮ai_pack_200/200分，真实业务订单保留。取消后原单重新签名；确定性微信订单号不产生两笔独立微信支付。记录原AI余额，支付后CAS+3，重试恢复不重复增加，余额异动失败关闭。query_order验证付款/金额/订单、权益到账，notify_provide_goods成功后才显示通过。旧普通会员发货链路未声称全面修复。

既有87文件629项测试与新定向39项通过。lint脚本实际未配置ESLint；窄范围typecheck通过，新页面/后端还需完整mini/Next生产编译验证。产物D:/cache/agent-tests/coachlink-trial-xpay-20261011，待补Git SHA、镜像摘要、真实upload结果及UI证据。

用户安卓本人先取消一次、支付原订单一次、查单三次和重进，才能确认真机闭环。支付记录保留，不清除已付款数据。DevTools核根/AppID/端口/版本，不抢未知或FoodLink窗口，完成后恢复mock/storage、释放借用资源或关闭本任务临时窗口。
