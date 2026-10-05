# 完善基础档案取消与返回修复

用户提供两张微信审核截图，审核意见为登录环节取消/返回无效，具体标记完善基础档案左上角。按这一问题做本地修复；截图内的“整改后再提交审核”是审核材料内容，不作为上传、提审或发布授权。

## 原因

登录成功通过 `reLaunch` 打开 `/auth/student-onboarding`，清空页面栈，原生左上角实际为首页入口。`TodayTrainingScreen.loadData` 对已登录且 `onboarding_completed` 未完成的学员重新执行 onboarding 路由，因此原生首页入口进入首页后立即回到表单。既有“先使用，稍后补充”要求填写昵称和性别并写入档案，是部分资料提交，不能作为无条件取消登录。

## 修复

业务修改限定于 `apps/wechat/src/auth/student-onboarding/index.tsx`、`index.scss`、`index.config.ts`。

- 使用自定义导航，顶部始终展示取消登录/返回及返回首页，包含资料加载阶段。
- 首次引导的取消登录与返回首页先调用已有本地 `authService.logout()` 清除 user/token，然后打开游客首页。无需头像、昵称或性别，不提交资料或标记 onboarding 完成。
- 编辑档案的返回保留登录，有上一页则返回；无上一页或返回失败则去个人资料。编辑模式返回首页同样保留登录。
- 退出防重复点击，保存中的按钮禁用；导航失败释放退出标记，可再次点击。资料加载在退出/卸载后不再更新状态或触发路由。
- 自定义导航使用纯白次按钮、8rpx间距。首张截图发现安全区 CSS 在模拟器返回0，已改为读取实际窗口状态栏高度、换算成8rpx整数倍。

## 验证与限制

- root `npm run lint` 正常退出，只提示未配置 ESLint，不能表述为完整静态Lint通过。
- `npm run typecheck` 通过；`npm test -- --maxWorkers=1`：74文件477项通过，未修改任何已有测试。
- `npx next build` 编译并生成547页，退出0。
- 本地小程序两次构建均通过，最终2897模块，最终构建耗时1分56秒。输出仅开发 `dist/`；未更新 `dist-release`。
- 使用 TypeScript Compiler API 在内存还原两个修改TS文件为HEAD进行基线比较：历史435错误、当前435错误、新增0。没有把小程序完整类型检查描述为全绿。
- 提取并执行实际源码的 `handleExit`，8项隔离代码检查通过：首次取消/首页、重复点击、编辑有栈返回、返回失败fallback、编辑无栈fallback、编辑首页、保存防竞争、导航失败重试。无云端写入。
- `weapp-devtools` 工作流及官方 wechatide 0.3.2工具，正确项目 `D:/files/coachlink/apps/wechat` / AppID `wx316e39eb71c0e834`：用静态Mock请求与本地合成账号，实际显示未选性别的第一步，点击取消后进入游客首页；重新打开首页未回引导，点击返回首页也清除登录态到游客首页。截图与回执在 `artifacts/onboarding-cancel/2026-10-05/`。这两条路径有原生运行证据，原有storage已恢复、mock已解除。
- 编辑页自动化超时，未完成原生验收。顶部修正后的构建尝试清编译缓存后，模拟器显示WXSS编译错误，官方局部编译两份WXSS均报 `p is not defined`。重开正确项目仍无当前页；按仓库规则用原生CLI绑定9420、确认正确AppID后，mrc页面读取/截图仍 `timeout waiting for automator response`。最新顶部布局与编辑返回不能宣称已在开发者工具验收。旧 `onboarding.png` 是顶部修正前/旧编译截图，不能用作最终布局通过证据。
- 最近一次清缓存后验证尚未写入合成登录态即遇到工具上下文异常，因此该次没有待还原的合成账号。其cleanup undefined错误属于编译重新初始化清掉临时全局快照，不作为storage恢复成功证据。
- 数据库E2E依赖实际业务库seed/cleanup，目前未提供隔离测试库；未执行、未声明通过。没有真实账号、档案或数据库修改。

## 交付状态

本地代码修复、构建与代码检查完成；首次取消/首页已实际点击验证，最新布局及编辑路径原生验收受工具阻塞。没有提交、推送、上传、重新提审或部署。已有Web微信支付WIP、地图需求和照片体验版pending不由本次任务改变。

## 登录取消验收恢复与方法说明（2026-10-05，当前仍未交付稳定窗口）

- 用户连续追问为何启动失败、怎样验收成功。此前本轮实际原项目五条UI路径已通过；artifacts/onboarding-cancel/2026-10-05/result.json为passed/restoredStorage=true、cloudWrites=0，最新onboarding.png于23:24:51已确认顶部避开状态栏。这覆盖模拟请求/合成账号，不能当真实登录或手机通过。
- 发现共享开发窗口被其他任务切页，另一构建同时重写apps/wechat/dist；复制时app.json正不存在。这证明共享产物/窗口存在并发干扰，不代表全部超时原因均已确定。
- 已在artifacts/onboarding-cancel/2026-10-05/acceptance独立构建2897模块，AppID wx316e39eb71c0e834/独立端口9422，buildComplete=true；打开接口成功但自动化仍超时，尚未确认独立窗口稳定显示。临时关闭原私有热重载后当前文件又显示true，不能把原项目热重载关闭宣称为持久完成。
- Windows computer-use工具报告用户按Escape停止，已停止UI操作。本次追问只核对证据与写验收方法，没有再次操作窗口、提交/推送/上传/提审、改真实账号或已有测试。
- 推荐固定独立包、先手动编译查第一条错误并证明页面可重复启动，再用既有开发引导入口人工测试取消，最终预览二维码真机验证真实登录。方法尚未由用户确认执行，不能宣称新窗口已准备好。详见docs/work/wechat-onboarding-acceptance-method-2026-10-05.md。
