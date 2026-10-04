# 教练销售恢复体验版发布（2026-10-04）

用户明确要求新的体验版本及前后端更新。授权范围：本次恢复代码提交推送dev、更新dev Web/API、小程序体验上传。正式main镜像、小程序提审和正式发布保持不动。

## 最新交付状态

- dev Web/API已完成：generation82、3/3全部新摘要Ready，health200/buildTime2026-10-04T03:39:36.938Z。实际运行摘要sha256:1787f827d2e9500d6bac1dce0e1095a22750bd11f1e151b394765763b2cbe006；dev/c1a3d81/domestic三标签同摘要。业务源码c1a3d818已推，构建时HEAD52a227f6仅增加状态文档。
- 正式main未改：generation124、3/3原f8b60be658e1b825f2e5ef813d65a7d2323b792cb790cc4325445aae35d40855、health200。没有latest/main写入、没有小程序提审或正式发布。
- 真实原开发项目已有登录JWT内部发请求（不导出凭据/不改登录态）：新版free+coach标识的coach/create空body400缺少参数、旧free标识coach/create403、平台会员购买403。新教练请求已到正常参数校验，会员仍禁止；0个有效下单请求/0扣款/无业务数据创建。这是后端策略验证，原项目urlCheck=false，不代替独立生产包/手机域名验收。
- 小程序生产包构建/124页/compiled resolver/真实CTA→套餐价格文本验证完成，但体验upload仍待工具确认。pendingTask=confirmation_upload_6b04bd45-fc4a-4c70-ab85-10b1fba97012；版本2026.10.04.1200，project=D:/files/coachlink/apps/wechat/dist-release；不主动轮询/重发、不更新latest元数据冒称成功。
- 独立生产项目urlCheck=true对dev health仍报request:fail url not in domain list；一次刷新复查不变。10/3后台记录曾包含dev，当前后台只读访问被安全策略阻止，已请用户核对CoachLink AppID wx316e39eb71c0e834的request合法域名https://dev.coachlink.fit。不关闭校验绕过；需工具确认后查询原upload任务，并由体验手机复验。
- CI attempt2长时间传输已按本轮自主构建任务取消并确认completed/cancelled，不是业务编译失败；国内临时构建器已停止。备用Webpack完整编译/546页通过，所有其他native hooks执行，锁定依赖与runtime bootstrap保持；只跳过不用于运行时的开发CLI二进制下载。证据artifacts/wechat-coach-restore/2026-10-04/deployment-result.json、domestic-docker-metadata.json、release-package.json、production-ui-check.json。

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
- 独立远端BuildKit首次Docker Hub超时，切现有腾讯镜像后基础镜像/上下文/系统依赖成功，但npm ci的Supabase开发CLI GitHub校验文件下载ECONNRESET失败，未进入Next编译/推送。未跳过其他安装脚本/改业务配置或数据库。已停止此构建器（保留构建缓存）；采用现有手动GitHub Actions工作流构建同一c1a3d818 dev提交，run=37173278319（https://github.com/IntelliFit/coachlink/actions/runs/37173278319）。标准Dockerfile/npm安装/Next编译全部通过且缓存导出成功，但attempt1推送被DENIED：仓库变量TENCENT_CCR_NAMESPACE为coachlink，与真实K8s/本地脚本littlehorse不一致。只修正此非敏感部署变量为littlehorse，未读取/更改CCR凭据，rerun同一原始SHA，仅dev/c1a3d81标签；attempt2执行中。最终摘要/rollout及微信实际上传结果待补充。
- 独立生产项目实际打开教练页并点击CTA，pricing-card文本与7个时长选项成功读取，99/159/199可见；截图automation_viewport_action超时，simulator_screenshot持续无响应后停止调用，本轮未取得新生产包截图。上一轮本地源码3张PNG已验证，不冒充本轮生产截图。
- attempt2正确命名空间推送持续超过12分钟，主服务/旧dev仍正常。并行启动国内备用构建，不覆盖dev标签：沿用3GiB/2CPU限制，临时artifact Dockerfile.release与标准Dockerfile运行阶段一致；保持锁定依赖，npm ci --ignore-scripts后只删除安装目录内Supabase开发CLI的postinstall下载hook，再npm rebuild执行所有其他安装/native hooks，完整Next构建照常。仅发布c1a3d81-domestic备用标签，不改根Dockerfile/DB/runtime配置；此期间源码HEAD52a227f6只比业务c1a3d818增加发布状态文档，Docker上下文业务源码不变。后端部署以先完成并验证的镜像为准，避免两条pipeline竞争dev标签。
- 国内备用依赖916包与其他hooks成功；Turbopack编译201秒触及3GiB cgroup上限SIGKILL，未生成/推送镜像。host MemoryPressure=False、main3Ready/health200、available恢复6.3GiB，不提高共享服务器构建内存预算。改用项目已有COACHLINK_BUILD_USE_WEBPACK=1构建逃生模式及build-only Node heap1536MiB，仍3GiB/2CPU硬限，runtime阶段及业务源码保持；这是编译器切换，不跳过Next构建。
- 国内Webpack完整编译4.4分钟、546/546页与standalone整理成功；镜像层50.6秒及manifest推送成功。备用镜像c1a3d81-domestic实际摘要sha256:1787f827d2e9500d6bac1dce0e1095a22750bd11f1e151b394765763b2cbe006，build metadata与registry inspect一致。已停止本轮构建器释放资源；对耗时CI run37173278319 attempt2发出取消请求，需确认终态后才以国内镜像更新dev，避免tag竞争。正式main仍generation124/3Ready，旧dev80，部署尚待执行。
- 后续CI已确认completed/cancelled（不是编译失败）；以国内已验证摘要carbon-copy到dev/c1a3d81，registry inspect一致，无latest/main写入。只restart coachlink-dev，generation81滚动中；首个45秒窗口到2个新副本，非终态失败，health已返回新的buildTime=2026-10-04T03:39:36.938Z/200。继续等待3/3新摘要Ready再验支付guard，正式main124/3Ready不变。
- 实际common.API_BASE_URL=https://coachlink.fit，env=develop，未登录。对生产编译resolver提取实际代码执行4个env用例，trial→dev、release/develop/unknown→正式均通过。使用urlCheck=true向dev发送只读health被工具白名单拦截；当前无登录token，未执行认证支付探针、未下单。10/3实际后台已确认request包含dev，但本轮尝试只读后台被浏览器安全策略阻止，未尝试旁路；已请用户在此AppID后台核对request域名截图。不关闭校验来制造通过。
