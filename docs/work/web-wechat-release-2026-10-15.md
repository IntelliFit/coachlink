# Web、后端与小程序体验版同步（2026-10-15）

用户要求补交本地未提交代码并更新前后端，确认前端范围为 Web＋微信小程序体验版。小程序 **2026.10.15.2313** 已上传，用户已在微信后台确认体验版指向这个新版本。

## 源码与线上应用

- 启动检查时工作区干净，dev 为 `48561dccfb321868c3fc7e93bf28b68f4338f0e4`，GitHub/Gitee 的 dev/main 均已同步，没有遗漏的业务代码。
- Web/API 应用源码仍为 `27ee1a997b1f41316480ad1baef12739c2f8ea9f`（业务提交 `79333c49`）；至 `48561dcc` 的变化仅 SQL 迁移与发布文档，没有应用运行源码差异。本轮复用已发布镜像，未重复全量构建或滚动部署。
- main generation 130、dev generation 91，各 3/3 Ready。镜像为 `ccr.ccs.tencentyun.com/littlehorse/coachlink@sha256:929921598b70c48046820041ab40b2c7e6a34448aba4584b144ea039cd608ffd`。
- 两个站点首页跟随跳转到 `/coach/discovery` 均 HTTP 200，`/api/healthy` 均 200。两环境各 9 项套餐后端检查通过：真实本人不同 SKU 预览可用，伪造商品 400、越权 403、匿名 401，队列/RPC 仅服务端可用。没有创建订单、改权益或现金支付。
- 最后复核时另一项已完成工作新增 `20261015151937_allow_coach_subscription_cancelled_status.sql` 及回执，故本次提交一并纳入。该迁移已在共享生产数据库生效，只补充既有取消接口需要的 cancelled 状态；不重复执行，不重建应用。具体业务操作与保护断言见 [单学员处理回执](blessing-subscription-early-end-2026-10-15.md)。

## 小程序实际上传包

- AppID：`wx316e39eb71c0e834`；版本：`2026.10.15.2313`。
- 描述：套餐接续：不同套餐可提前购买，旧权益用完后生效；保持会员付费与汇付分账。
- 固定源码：`48561dccfb321868c3fc7e93bf28b68f4338f0e4`。独立生产编译一次成功，2899 模块、125 页面，产物 972 文件/10,406,236 字节。
- `COACHLINK_WECHAT_PAID_RELEASE=true`，正式请求 `https://coachlink.fit`，体验/开发请求 `https://dev.coachlink.fit`；无本机 API URL，根目录和 srcRoot 均 `./`、`urlCheck=true`。套餐切换预览已编译，付费策略已恢复；诊断路由仍注册，但付费包的诊断入口关闭。
- 包指纹 SHA-256：`01c4987424d4ad3f8dfff483b80afed3b44787b141b7bc2d41367f52a3ff1450`。算法记录在任务 `audit-package.cjs`，按路径及内容计算并排除 IDE 私有配置。
- 官方 CLI 成功回执：总包 10,002,944 字节，主包 1,931,638 字节；上传结果文件写于北京时间 23:17:50。首次未显式传 AppID 时虽然退出码为 0，实际报 41002/appid missing，不视为成功。使用原生 Windows 绝对路径并显式传 `--appid` 后，实际日志为 `√ upload` 且生成大小回执。
- 官方 CLI 无法确认体验版后台指向，后台页面读取超时；用户随后明确回复“已是新版本”。体验版分配状态记为 `confirmed-by-user`，未代提审或正式发布，也未构建 App。

## 验证与工具收尾

- `npm run typecheck` 通过；2 份付费/教练购买相关定向测试共 25 项通过。`npm run lint` 退出成功，但脚本只提示未配置 ESLint，不能当作真实 lint。既有测试文件没有修改，未重复全量测试或 E2E。
- 小程序自动验收复用原 IDE HTTP 47696，在固定独立输出上使用自动化端口 9420。同一窗口有限重试仍报 `timeout waiting for automator response`，没有取得截图或完成交互路径，不能声称 UI 或真实手机支付已验收。测试未进入步骤，未安装 mock 或改测试 storage。
- 通过官方 CLI 关闭本任务项目，最后确认 9420 已无监听；原用户 IDE 进程保留，没有整进程退出或强杀。没有统一会话管理器实现，不声称自动排队。

## 证据与磁盘

小型证据保存在 `artifacts/web-wechat-release/2026-10-15/`；本地 latest/versioned 小程序元信息已更新。完整独立包、缓存和日志保留于 `D:/cache/agent-tests/coachlink-web-wechat-release-20261015`，约 26 MiB；该目录无 reparse point。用户验收完成后可整目录清理，不影响服务或用户数据库。Vitest 另更新既有 `test-results/vitest/`（约 1 MiB），未清空其他任务目录。没有重装依赖或本机 Docker 构建。
