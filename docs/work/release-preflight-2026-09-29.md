# 全部本地修复发布预检（2026-09-29）

用户授权提交全部本地修复、更新Web/API、上传小程序体验版；不包含提审或小程序正式发布。

## 已确认

- 代码范围：计划日历/日期补记/服务周结转、小程序回放、平台XPay改造及配套文档、迁移和新增测试。
- 本轮 lint 命令正常退出（仅提示未配置ESLint），typecheck通过，全量60文件381测试通过。
- 上轮同一业务代码的Next545页构建和小程序2884模块构建通过；本轮未因支付阻塞而重新发布。
- 部署实际为ubuntu@154.8.205.78的Kubernetes，coachlink-main和coachlink-dev当前均3/3；不能使用旧scripts/deploy.js中的root/PM2流程。
- 主站和API同属coachlink镜像，推送latest会由Keel触发滚动更新，因此未把推镜像当作无副作用准备步骤。

## 阻塞：平台XPay未配置

在生产coachlink-main容器内使用现有bootstrapEnv读取实际production配置，仅输出存在性：WECHAT_XPAY_OFFER_ID=false、WECHAT_XPAY_APP_KEY=false、WECHAT_XPAY_MESSAGE_TOKEN=false。未输出密钥值。

本地当前实现已把会员/特效小程序购买切换到XPay；直接全量部署会导致新购买接口缺配置失败。需用户选择先排除支付改造发布其他修复，或者先安全配置虚拟支付再全量发布。不能擅自通过恢复不合规支付或关闭鉴权来绕过。

## 数据库与后续门禁

生产迁移列表未包含以下三项（本轮只读查询，未应用）：

- 20260916010000_complete_timed_out_execution.sql
- 20260916020000_wechat_xpay_orders.sql
- 20260925203825_plan_completion_dates.sql

发布范围确定后，需完成对应隔离API/UI回归与迁移验证，再按数据库→API/Web→小程序体验版顺序发布。当前完整E2E默认连接业务配置，不直接运行以免在业务库造测试账号；原SQL隔离测试记录见前序报告。

本轮未推送镜像、未改生产数据库、未上传体验版、未提审。
