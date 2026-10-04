# 教练销售恢复体验版发布（2026-10-04）

用户明确要求新的体验版本及前后端更新。授权范围：本次恢复代码提交推送dev、更新dev Web/API、小程序体验上传。正式main镜像、小程序提审和正式发布保持不动。

## 发布范围

- 平台会员免费不变；教练价格、市场/购物车、预购问卷、新购/续费使用独立编译期策略，支付继续汇付。
- 保留旧免费客户端不创建收费订单；新能力header只是产品策略，鉴权/订阅所有权保持。
- 新客户端创建inactive订阅，支付通知激活；续费走汇付订单renew=true，不开放无付款直接加周数接口。
- 未改真实分账、提现、支付通知或历史资金。

## 门禁与部署计划

- 推送前重跑lint（仅输出未配置）、root typecheck和74文件477测试，通过。前一轮Next546页、本地mini124页和真实工具CTA→价格截图已完成。
- 独立dist-release生产构建，校验124页产物、禁止localhost/开发登录按钮、能力header与平台free保持。按运行时trial→dev.coachlink.fit，release→coachlink.fit；不改原开发项目dist/。
- 本机Docker Desktop尝试启动后，Inference manager监听残留socket报系统无法访问，engine未就绪；未重置Docker/删除用户数据。远端可用内存6.3GiB、根盘100GB，采用独立BuildKit容器硬限3GiB（禁swap）、CPU配额2核/低相对权重，不做无限制远端构建。使用既有ubuntu@154.8.205.78 Docker与K8s；不运行旧root/PM2脚本。初始dev generation80/main124，各3Ready；只推dev与本次SHA镜像标签，记录原镜像摘要用于回退，绝不推latest/main。构建结束停止该独立构建器，正式main不动。
- 后端与小程序验证不创建真实订单、不扣款、不跑业务库seed E2E。实付到账、退款和分账需专门验收，不宣称本轮覆盖。
- 上传用官方wechatide工具。若返回pending，只提醒工具内确认并记录taskId，不主动循环轮询或重复上传；仅最终success才称上传完成。

## 当前状态

- 源码c1a3d8187f395692d964167d6f35a2f4b0c84199已推送GitHub/Gitee dev。生产mini2884模块/124页通过，968文件无缺页，无localhost:3001或dev-onboarding；free/coach标识及trial/release线上域名存在。独立产物root/srcRoot=./、urlCheck=true。包SHA256为8d80ba6c2ee8c2e5338cf9a6c681aeb2253016db995ff6cb32843c2fe84709a5。
- 官方upload已发起：版本2026.10.04.1200，描述c1a3d818-restore-coach-huifu-free-membership；pendingTask taskId=confirmation_upload_6b04bd45-fc4a-4c70-ab85-10b1fba97012，原工具upload，project=D:/files/coachlink/apps/wechat/dist-release，最后status=pending。已提醒用户在工具内确认，不主动轮询/重发，不更新latest元数据冒称上传成功。
- 独立远端BuildKit首次Docker Hub超时，切现有腾讯镜像后基础镜像/上下文/系统依赖成功，但npm ci的Supabase开发CLI GitHub校验文件下载ECONNRESET失败，未进入Next编译/推送。未跳过其他安装脚本/改业务配置或数据库。已停止此构建器（保留构建缓存）；采用现有手动GitHub Actions工作流构建同一c1a3d818 dev提交，run=37173278319（https://github.com/IntelliFit/coachlink/actions/runs/37173278319），仅dev/c1a3d81标签，CCR登录成功，标准Dockerfile构建中。最终摘要/rollout及微信实际上传结果待补充。
- 独立生产项目实际打开教练页并点击CTA，pricing-card文本与7个时长选项成功读取，99/159/199可见；截图automation_viewport_action超时，simulator_screenshot持续无响应后停止调用，本轮未取得新生产包截图。上一轮本地源码3张PNG已验证，不冒充本轮生产截图。
- 实际common.API_BASE_URL=https://coachlink.fit，env=develop，未登录。对生产编译resolver提取实际代码执行4个env用例，trial→dev、release/develop/unknown→正式均通过。使用urlCheck=true向dev发送只读health被工具白名单拦截；当前无登录token，未执行认证支付探针、未下单。10/3实际后台已确认request包含dev，但本轮尝试只读后台被浏览器安全策略阻止，未尝试旁路；已请用户在此AppID后台核对request域名截图。不关闭校验来制造通过。
