# CoachLink 本地用户 ID 模拟登录

日期：2026-10-08。只做本地开发工具，未提交、推送、部署或上传小程序。

## 使用方法

在 `D:\files\coachlink` 打开两个终端：

1. 运行 `npm run dev:debug-login`，保留终端，复制本次启动打印的配对码。默认只监听 `127.0.0.1:3003`。
2. 另一个终端运行 `npm run weapp:debug-login`。固定产物为 `apps/wechat/dist-local-debug`，不会覆盖日常 `dist` 或发布 `dist-release`。
3. 在微信开发者工具中使用该产物，进入 `auth/login`，在“本地开发 · 用户 ID 模拟登录”里填用户 UUID 和配对码。已有同 AppID 窗口必须先确认空闲并复用/切换，不能无限新开窗。
4. 登录后顶部显示模拟用户、用户 ID、本地后端、数据源指纹、失效时间及“退出模拟，恢复原账号”。检查完必须退出模拟。

手机用户_6196 的 ID：`aaa90e01-7a53-444d-b374-9edfe438fa17`。

如默认端口被占用，先通过 port-manager 分配，再对两个命令传相同端口，例如 `npm run dev:debug-login -- 3004` 和 `npm run weapp:debug-login -- 3004`。脚本不会杀占用端口的进程。

这是开发者工具内的入口，不是手机体验版入口。`127.0.0.1` 是电脑本机；不能把该包上传后期待手机连到电脑。要复现已发布客户端特有问题，仍需对应版本的真机验证。

## 数据与安全边界

- `.env` 仍是配置来源选择器；通过既有 bootstrap 按 local/apollo 单源加载，不合并其他业务配置。**本地后端不等于测试数据库**，当前源可能就是真实用户数据。
- 登录接口只 SELECT，不创建账号、不修改昵称、不绑定操作者微信，也不允许模拟管理员。
- 用户 ID 之外还需要每次启动生成的配对码。临时 `cldev.` JWT 使用独立随机签名密钥，最长一小时；重启后旧凭证失效。普通后端与生产环境不能验证它，不使用 `NEXTAUTH_SECRET` 来签此类凭证。
- 后端只有 development + 显式本地启动开关 + 随机密钥/配对码齐备时才启用；验证 loopback Host/转发头/Origin。小程序还要求开发构建、`envVersion=develop`、本地 API 地址。
- 调试后端禁用定时后台任务，拒绝支付、提现、管理及账号绑定等敏感接口；这不是全库只读代理。训练操作仍走正常归属/权益校验，**填写、完成训练等操作会写入当前数据库**。检查真实学员时不要按完成/取消等写操作；需要写入测试应使用明确授权的隔离测试账号。
- 切换时保存原账号，只清既有首页/执行缓存；退出恢复原凭证并再次清训练缓存。原凭证若本来已过期，仍需正常登录。配对码不存 storage，调试过期不自动换成操作者微信账号。
- 普通登录请求不受专用后端的临时密钥影响；延迟返回的旧账号请求不会继续清理/覆盖新账号登录态。

## 实际验证

- 新增后端安全/小程序会话测试 30 项；总计 83 个文件、588 项通过。既有测试文件未修改。
- `npm run lint` 返回既有未配置 lint 的提示；`npm run typecheck` 和新后端文件的定向类型检查通过。不能据此声称小程序全库历史类型问题已解决。
- Next 构建 548 页通过；专用小程序 2906 模块构建及后处理通过。
- 实际本地接口：6196 登录 200、session 200 且 ID 相同；错误配对码 403，支付请求 403，同一临时凭证交给普通 3000 后端返回 401。
- 用户明确允许借用闲置 `D:/files/coachlink/apps/wechat/dist-release` 窗口，AppID `wx316e39eb71c0e834`。原 storage 为空，原页面 `pages/index/index`，已先备份。
- 首次尝试把源码根指到项目外的 `../dist-local-debug/` 后连接超时；恢复原目录后连接恢复。改为该窗口内临时副本后新包能运行，不覆盖旧发布文件。
- 真实 UI 输入 UUID/配对码并点击登录成功；页面与存储均为手机用户_6196，显示刘三乐计划 D78、4 个动作、14 组与“继续训练”。刷新后仍是该账号。仅临时 mock 了登录前警告确认框，不 mock 登录接口/账号/计划数据，确认框 mock 已恢复。
- 点击“退出模拟，恢复原账号”后返回登录页，用户/token/调试元数据清除，符合原来未登录状态。随后恢复原配置、存储与首页，临时副本移出发布目录到忽略的 artifacts。借用窗口不关闭，也没有新建窗口。
- 自动化截图和模拟器诊断截图均超时，**没有可用截图**；交互/刷新及实际页面文本证据在 `artifacts/training-access-audit/2026-10-08/local-debug-ui-after-refresh.json`。不能称视觉截图验收通过。
- 未进入训练执行页、填写/完成/取消训练，未重测完整训练业务，也不将本地登录验收当成已发布小程序缺陷全部修复。
- 既有 Web E2E 会创建真实库用户/订阅，seed 中途失败不完整回滚、cleanup 为 best-effort；本轮未在真实数据源运行该写入套件，未擅改既有测试。新入口的登录→刷新→退出使用真实开发者工具流程验证；隔离库的完整 Web E2E 仍需另行执行。

## 启动过程发现的副作用与处理

第一轮专用后端启动时，尚未隔离普通 instrumentation 定时任务，日志显示 00:23:28–00:23:42 UTC 自动请求结算 process-due/reconcile 并返回 200。发现后立即停止本任务进程，补了后台任务禁用和敏感路径拦截；第二轮日志确认 `[BackgroundJobs] disabled for isolated local debug login`。

用只读查询核查 00:23–00:27 UTC：没有对应 `coach_subscription_settlements.updated_at` 行或新 `wallet_transactions` 行。此结果不等于证明整个数据库无任何日志写入。未主动执行支付/提现，未重发出款。

验证结束停止本任务 3003 后端，旧临时凭证已失效。使用时由操作者重新运行命令获取自己的配对码。相关私有日志/备份仅在被 Git 忽略的 artifacts 中，不应外发或提交。

## 实现位置

- `scripts/start-local-debug.mjs`：单源配置启动、loopback、临时凭证与独立 Next 产物。
- `apps/wechat/scripts/build-local-debug.cjs`：独立小程序开发构建。
- `src/lib/localDebugLogin.ts`、`src/app/api/miniapp/local-debug-login/route.ts`、`src/lib/jwt.ts`、`src/proxy.ts`：安全校验及会话识别。
- `apps/wechat/src/services/localDebugService.ts`、`components/LocalDebugLogin.tsx`：登录、警告、恢复账号与缓存隔离。
- `tests/local-debug-login.test.ts`、`tests/local-debug-session.test.ts`：新增回归；`tests/ai/local-debug-login-regression.md`：后续操作清单。
