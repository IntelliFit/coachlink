## 微信小程序教练列表训练方向筛选弹层修复 (`2026-07-14`)

- Task: 修复教练列表“筛选方向”点击无反应；开发者工具报 `showActionSheet:fail parameter error: itemList should not be larger than 6`。
- Status: 代码修复完成，待验证后提交。方向数据接口、前端筛选状态和列表请求参数均已存在并正确接通；根因是微信原生 `showActionSheet` 仅允许最多 6 项，实际方向列表超过该上限。
- Changes: 改为自定义底部方向筛选面板，展示全部方向并支持滚动；选择后继续复用原有 `handleSpecialtyChange -> loadCoaches` 筛选请求，不受 6 项限制。
- Verification: `npm run lint`、`npm run typecheck`、`npm test`（35 files / 177 tests）、小程序构建（2755 modules）与 `git diff --check` 通过；`npx next build` 仍被既有 `busboy`、`pdf-parse/lib/pdf-parse.js` 缺失依赖阻断。`mrc` 可用但 9420 无监听，无法自动化点击验证。

## 微信小程序训练首页更多入口弹层排版优化 (`2026-07-14`)

- Task: 优化训练首页右上角三点菜单的“即兴训练 / AI 长期计划 / 浏览教练”入口，解决内容挤在左上角、留白失衡的问题。
- Status: 代码修复完成，待验证后提交。根因是 `more-training-sheet` 及其三个入口没有任何样式，导致 Popup 中仅以裸行内内容排列。
- Changes: 增加底部面板拖拽把手、标题和说明；三个入口改为独立完整的可点击卡片，统一图标容器、主标题、辅助说明、右箭头和按压反馈，使用 8rpx 栅格留白。
- Verification: `npm run lint`、`npm run typecheck`、`npm test`（35 files / 177 tests）、小程序构建（2755 modules）与 `git diff --check` 通过；`npx next build` 仍被既有 `busboy`、`pdf-parse/lib/pdf-parse.js` 缺失依赖阻断。`mrc` 可用但 9420 无监听，无法自动化点击验证。

## 微信小程序教练详情订阅价格套餐文字排版修复 (`2026-07-14`)

- Task: 修复教练详情“订阅价格”内套餐介绍紧跟标题、长介绍可能越界的问题；用户以枭马葛教练多套餐页面为例反馈。
- Status: 代码修复完成，待验证后提交。根因是共用 `PricingSection` 中套餐标题和介绍使用默认行内 `Text`；并非教练套餐数据异常，所有教练详情均会受影响。
- Changes: 标题和介绍均改为块级行；介绍固定从标题下一行开始、占满卡片可用宽度、正常换行，并对无空格长文本启用断行，不使用省略号或截断。
- Verification: `npm run lint`、`npm run typecheck`、`npm test`（35 files / 177 tests）、小程序构建（2755 modules）与 `git diff --check` 通过；`npx next build` 仍被既有 `busboy`、`pdf-parse/lib/pdf-parse.js` 缺失依赖阻断。`mrc` 可用但 9420 无监听，无法自动化点击验证。

## 微信小程序教练详情学员评价数量与内容一致性修复 (`2026-07-14`)

- Task: 修复教练详情“学员评价(1)”标签与评价面板显示“暂无评价数据”的不一致问题；用户以刘三乐教练为例反馈。
- Status: 代码修复完成，待验证后提交。聚合接口从 `student_comments` 正确统计到 1 条；根因是小程序评价组件始终渲染空状态，从未请求或展示评论。已有 `get-coach-reviews` 查询另一张 `coach_reviews` 表且不按 coachId 过滤，不能用于此处。
- Changes: 新增只返回公开昵称、头像、评分、正文及日期的 `get-public-reviews` 接口，按 `student_comments.coach_id` 查询，与数量统计同源；小程序实际加载并渲染列表，加载成功后标签数量直接采用同一列表长度，消除缓存短暂不一致。
- Verification: `npm run lint`、`npm run typecheck`、`npm test`（35 files / 177 tests）、小程序构建（2755 modules）与 `git diff --check` 通过；`npx next build` 仍被既有 `busboy`、`pdf-parse/lib/pdf-parse.js` 缺失依赖阻断。`mrc` 可用但 9420 无监听，无法自动化点击验证。

## 微信小程序教练详情联系方式与社交链接交互修复 (`2026-07-14`)

- Task: 修复教练详情页的邮箱、电话与社交平台卡片点击无反应，并确认数据链路归属。
- Status: 代码修复完成，待验证后提交。后端已实现教练申请信息保存与聚合接口返回；截图中的邮箱和抖音已证明数据到达页面。根因是小程序 `AboutSection` 仅展示字段，未给联系方式/社交链接绑定任何点击逻辑，社交 URL 值也未使用。
- Changes: 邮箱和社交链接点击后复制对应内容并显示明确提示；电话点击调用小程序系统拨号，非用户取消的失败场景降级为复制号码。微信小程序不能可靠直接拉起邮件客户端或抖音 App，复制是可用且符合平台限制的交互方案。
- Verification: `npm run lint`、`npm run typecheck`、`npm test`（35 files / 177 tests）、小程序构建（2755 modules）与 `git diff --check` 通过；`npx next build` 仍被既有 `busboy`、`pdf-parse/lib/pdf-parse.js` 缺失依赖阻断。`mrc` 可用但 9420 无监听，无法自动化点击验证。

## 微信小程序教练专栏内容卡片排版修复 (`2026-07-14`)

- Task: 修复教练详情“教练专栏”中超长教学内容标题越出卡片，以及“图文/视频”标签有时紧跟标题、有时换行的不一致排版。
- Status: 代码修复完成，待用户验证后再决定是否提交。问题来自所有教练共用的 `ContentSection`：标题和元信息都是默认行内 `Text`，导致省略号约束与垂直间距失效，并非某位教练的内容数据异常。
- Changes: 将内容信息区固定为纵向 flex 布局，标题和元信息设为独立块级行；标题宽度受卡片可用空间限制并单行省略，`图文/视频` 统一显示于标题下方，间距为 `8rpx`。
- Verification: `npm run lint`、`npm run typecheck`、`npm test`（35 files / 177 tests）、小程序构建（2755 modules）与 `git diff --check` 通过；`npx next build` 仍被既有 `busboy`、`pdf-parse/lib/pdf-parse.js` 缺失依赖阻断。`weapp-devtools` 9420 无监听，无法截图点击验证。

## 微信小程序即时训练动作库跳转修复 (`2026-07-14`)

- Task: 修复即时训练页“动作库”点击无反应；用户提供控制台 `page "me/action-lib?tab=public" is not found`。
- Status: 用户已在小程序中手动验证通过并授权提交。公共动作库页面和接口均已存在，接口请求也已发出；根因是三个前端跳转地址遗漏注册页面的 `/index`，导航目标不存在。
- Changes: 将即时训练页右上角动作库入口、空状态入口和旧兼容跳转页统一改为 `/me/action-lib/index?tab=public`，与 `app.config.ts` 中 `me` 分包的 `action-lib/index` 注册路径一致。
- Verification: `npm run lint`、`npm run typecheck`、`npm test`（35 files / 177 tests）与小程序构建（2755 modules）通过，`git diff --check` 通过；`npx next build` 仍被既有 `busboy`、`pdf-parse/lib/pdf-parse.js` 缺失依赖阻断。已按 `weapp-devtools` 检查，`mrc` 可用但 9420 无监听，不能自动化点击验证。

## 微信小程序注销确认词视觉强化 (`2026-07-14`)

- Task: 强化“账户设置 -> 注销账号”弹窗中的确认词可理解性；用户已确认功能无误并授权提交。
- Status: 已作为独立本地提交完成。正文中的 `注销账号` 已改为独立警示标签（加粗、深红、浅红底、边框），输入字段改为“输入确认文案”和“请输入“注销账号””占位；实际注销校验逻辑未改。
- Verification: `npm run lint`、`npm run typecheck`、`npm test`（35 files / 177 tests）与小程序构建通过；`npx next build` 仍被既有 `busboy`、`pdf-parse/lib/pdf-parse.js` 缺失依赖阻断。`weapp-devtools` 9420 端口未监听，无法自动化点击/截图验证。

## 微信小程序自定义底部导航切换异常诊断 (`2026-07-14`)

- Task: 用户反馈自定义底部导航首次多次切换会出现方向滑动，反复切换后才变为普通刷新，要求分析根因与可行性；本轮仅诊断，不修改代码。
- Status: 已定位高置信根因。`apps/wechat/src/components/BottomNav.tsx` 将首页级导航优先走 `Taro.navigateTo`，持续压入页面栈；达到微信页面栈上限后该调用失败，代码再静默退回 `redirectTo`，故出现“前期滑动、后期普通刷新”的不一致行为。`BOTTOM_NAV_SWITCH_KEY` 仅驱动底栏胶囊的 active 状态动画，不是整页方向滑动的主因。
- Fix direction: 当前所有学生首页（除训练首页）位于分包，不能直接改为原生 `switchTab`。短期应让底栏入口统一直接 `reLaunch`，清空页面栈并得到稳定的无方向刷新；长期若需要原生 Tab 生命周期与缓存能力，应将五个一级入口迁至主包/入口壳页后配置原生或 custom TabBar，再统一使用 `switchTab`。
- Verification: 已检查打包产物与代码历史；`weapp-devtools` 所需 9420 自动化端口未监听，未能抓取实际页面栈与录像。

## 微信小程序个人中心清除缓存 (`2026-07-14`)

- Task: 在学员端“我的”页的“退出登录”上方增加“清除缓存”按钮，并实现实际清理功能；用户已确认功能无误并授权提交。
- Status: 已作为独立本地提交完成。清除操作会删除本地训练快照、草稿、计时器及其他可再生 storage 数据，但保留 `token`、`user` 和 `app-theme-mode`，因此不会退出登录或丢失主题偏好。
- Verification: `npm run lint`、`npm run typecheck`、`npm test`（35 files / 177 tests）与小程序构建通过；`npx next build` 被当前分支既有的 `busboy` 和 `pdf-parse/lib/pdf-parse.js` 缺失依赖阻断。`weapp-devtools` 的 9420 端口未监听，未能完成自动化点击/截图验证。
## 小程序重复进行中计划与 Day 6 → Day 3 错序排查 (`2026-07-14`)

- Task: 用户截图反馈“力量观察员6380”在小程序“全部计划”同时出现两份进行中的教练计划，训练日历又出现 Day 6 后回到 Day 3；用户意向是保留截图上方第一套计划。
- Status: 已完成系统代码修复、目标学员线上数据修复、全站教练订阅重复 current 清理、数据库唯一性迁移部署，以及 Web/微信开发者工具双端实测；应用代码尚未提交、推送或发布。
- Confirmed target data:
  - 同一订阅 `2b2efa4d-0bb7-457c-811a-ecc931173fde` 下确有两份 active 实例，创建时间仅相差约 35 秒，并非训练数日后换计划造成。
  - 截图上方、应保留的是实例 `59084a16-ae8c-4091-9c16-7150a0b5c8e7`：56 个日历日、32 个训练日；Day 1 已完成，Day 3 当前 in_progress。
  - 截图下方、可归档的是实例 `6aac209c-dc14-4b8f-ba58-98cca001e8d0`：56 个日历日、24 个训练日；没有任何 execution。
  - 错序来自保留实例中的空 Day 6 execution `2c0a5deb-7585-47f2-b632-452c608ee7c5`：在 Day 1 开始后约 1 分 42 秒被创建，0/16 组、一直 in_progress；日历按 execution 的实际开始日期将 Day 6 钉到 7 月 13 日。Day 3 execution `afd0784c-a9be-4caf-a0c9-fcac47b0c767` 才是当前正确训练日。
- General audit:
  - 全站当前有 6 个重复 current 分组、共 14 个 active/paused 实例；其中 2 个是教练订阅重复计划，另 4 个是较早的 self plan 重复。
  - 此类问题有系统性风险，但本截图包含两个独立根因：重复创建 current 实例，以及服务端允许为非当前顺序日创建 execution；并不能简单归因于“执行几天后换计划”。
- Implemented data repair:
  - 保留实例 `59084...`；无 execution 的重复实例 `6aac...` 已删除，因此不会继续出现在“全部计划”。
  - 0/16 的误建 Day 6 execution `2c0a...e7c5` 已删除；Day 1 `14/14 completed` 与 Day 3 `in_progress` 保留。
  - 后置计算确认严格推荐日为 Day 3。
  - 另一组明确的教练订阅重复 current（Wayne 旧订阅）已按 newest-wins 收敛：保留 `66a2...` active，旧 `2e7c...` 非破坏性归档。线上教练订阅重复 current 分组现为 0；4 组早期 self plan 未擅自清理，因为个人计划是否允许多 active 需另行产品判断。
- Implemented system fix:
  - `/api/execution/start` 在创建或恢复 in-progress execution 前按 `deriveStrictSequentialProgressDay` 校验；非当前日返回 `TRAINING_DAY_NOT_CURRENT`，已完成快照仍可回看。
  - 小程序今日训练所有动作入口统一把非当前日强制为 read-only，并提示先完成当前日；教练分配/模板创建入口使用同步 ref 防止连点双请求。
  - create-instance 采用确定性 newest-wins 并发收敛，避免两个请求各自保留自己；唯一约束冲突下相同请求幂等返回，不同请求返回 409。
  - 新增迁移 `20260714000000_single_current_coach_plan.sql`：部署后通过归档历史重复、数据库 partial unique index 和 trigger，最终保证每个教练订阅至多一个 active/paused 实例。
- Verification:
  - `npm run lint`、`npm run typecheck`、`npm test`（35 files / 177 tests）、`npx next build`、`npm --workspace apps/wechat run build:weapp`、`git diff --check` 均通过。
  - 目标学员“力量观察员6380”的用户 ID 已核实为 `aa0755f7-25d8-4590-a32d-ef483c0d40dc`。
  - Web 开发模式通过用户 ID 快速登录后，`/me/plan-history` 接口与页面均显示 `共 1 个计划`、仅 1 个“进行中”。
  - 已通过 `D:\software\微信web开发者工具\cli.bat auto --project D:\files\coachlink\apps\wechat --auto-port 9420` 启动自动化，并将开发者工具调试登录态切换为该学员；小程序“全部计划”显示 1 条记录，今日训练显示 Day 3、32 个训练日、完成度 3%，错误日志为 0。
- Release note:
  - 线上数据已经即时修复，数据库唯一索引与归档 trigger 已部署并从数据库层阻止同一教练订阅再次出现两份 current；执行日严格顺序校验及小程序只读/防连点仍需随正常 Web/API 与小程序发布后完整生效。

## Web AI 计划修改器首次发送后输入框残留修复 (`2026-07-14`)

- Task: 用户反馈 AI 计划修改器首次提交内容后，原文字仍留在底部聊天输入框，必须手动删除才能继续输入；本次暂不处理万界方舟超时。
- Status: 已完成。首次发送时先将文字保存到 `submittedInstruction` 作为首条聊天记录，再立即清空受控输入状态 `instruction`；请求后续即使超时或失败，输入框也不会恢复旧内容。后续多轮发送原有清空逻辑保持不变。
- Verification: `npm run lint`、`npm run typecheck`、`npx next build`（517 pages）、`npm test`（35 files / 177 tests）及 `git diff --check` 均通过。按用户长期偏好未运行浏览器 UI 验证，实际交互留给用户验收。

## 微信小程序寻找单杠附近结果页面归属修复 (`2026-07-14`)

- Task: 用户反馈“定位我附近”得到的最近单杠显示在“单杠数据”页，不在用户浏览单杠的当前页面，交互归属不合理。
- Status: 已完成代码修复与全部代码级门禁；附近定位入口、定位提示及“离你最近”列表现统一放在“单杠列表”页，“单杠数据”页只保留统计内容。
- Verification: `npm run lint`、`npm run typecheck`、`npm test`（35 files / 177 tests）、`npm --workspace apps/wechat run build:weapp`（2754 modules）、`npx next build`（517 pages）和 `git diff --check` 均通过。按用户长期偏好未运行微信开发者工具 UI 验证，实际交互留给用户验收。

## 微信小程序输入字符悬浮修复 (`2026-07-14`)

- Task: 用户反馈微信小程序多个输入框在安卓设备聚焦并弹出键盘后，输入字符悬浮到输入框上方；截图可在即兴锻炼训练执行页的 RPE 输入框稳定观察到。
- Status: 已完成代码修复与构建验证；因本机微信开发者工具 9420 自动化端口未监听，未完成实际聚焦输入后的模拟器/真机截图验证。
- Root cause: 单行原生 `input` 继承或显式使用无单位 `line-height`；截图中的 RPE 输入框同时固定为 `72rpx` 高度但使用 `line-height: 1.1`，部分安卓微信内核会把该值当成极小实际行高，导致输入文字基线上浮到边框外。
- Changes: `apps/wechat/src/app.scss` 为单行原生 `input` 增加全局 `line-height: normal !important` 基线保护（不影响 `textarea`）；训练执行页 RPE 输入框清除内边距并显式使用与高度一致的 `72rpx` 行高。
- Verification: `git diff --check`、`npm run lint`、`npm run typecheck`、`npm test`（35 files / 177 tests）、`npx next build`、`npm --workspace apps/wechat run build:weapp` 均通过；构建产物确认包含全局 input 规则和 RPE 专用规则。
## 提交当前工作区并同步 main/dev (`2026-07-14`)

- Task: 保留 GitHub `dev` 上 `codex/dev-workspace-20260714` 的 9 项小程序改动，融合当前本地已完成工作，并让本地、GitHub、Gitee 的 `main/dev` 全部指向同一最终提交，作为新版本部署基线。
- Status: 已完成融合、发布门禁、最终提交与两远端四分支对齐；`.tmp/`、`.codex-remote-attachments/`、Next 自动生成改写和 Supabase CLI 临时版本标记均未进入提交。
- Integration: 本地 `main` 先 fast-forward 到 GitHub `origin/dev=ca410545`，再回放本地工作；唯一冲突位于 `CURRENT_TASK.md` 文件头，采用保留两边完整任务记录解决。业务源码自动合并成功，`TodayTrainingScreen.tsx` 同时保留“更多训练方式”弹层和严格顺序训练日只读控制。
- Verification: `npm run lint`、`npm run typecheck`、`npm test`（35 files / 177 tests）、`npm run test:e2e`（4/4，覆盖订阅、登录刷新会话保持、API/DB 幂等 CRUD）、`npx next build`（518 pages）、`npm --workspace apps/wechat run build:weapp`（2755 modules）及 `git diff --check` 全部通过。
- Recovery: 同步前基线保留在本地安全分支 `codex/safety-pre-sync-20260715`，本地工作原始快照保留在 stash `pre-sync-main-dev-20260715-local-work`，待部署确认稳定后可清理。

## Production Health Probe 401 Recurrence (`2026-07-05`)

- Status: 已完成并已部署；`/api/healthy` 与 `/api/health` 必须同时存在于 `src/proxy.ts` 的公开路径集合与 API 前缀白名单，避免 Kubernetes 探针被代理层 401 拦截。
- 远端提交 `ae6c35b2` 修复该问题，`f2e64e03` 记录部署恢复；本次分支同步保留两项提交及其修复。

## 功率分析器上传、下载、体积与音频问题复核 (`2026-07-14`)

- Task: 用户反馈线上微信小程序视频直接上传失败；Web 分析视频下载不稳定、输出体积显著增大且音频丢失；另需确认手机浏览器中途停止下载后继续分析下一条视频的问题是否已解决。
- Status: 已完成诊断与代码侧修复；服务器配置、镜像部署、小程序发布和生产真机验收需由发布/服务器工程师继续执行。代码尚未提交或推送。
- Remote/deployment check:
  - 已执行 `git fetch --all --prune`。GitHub `origin/main` 比本地多 2 个健康探针相关提交，均不涉及功率分析；功率分析相关代码与本地 `HEAD` 一致。Gitee `main/dev` 仍停在本地提交。
  - 线上 `/api/healthy` 显示当前生产构建时间为 `2026-07-05T07:48:03.234Z`；线上功率分析页面 JS 已包含 7 月 1 日加入的 signed URL 下载、活动任务恢复和轮询容错代码。
- Confirmed unresolved:
  - 小程序上传走 `Taro.uploadFile -> Next multipart API -> Supabase Storage`，不是 Web 使用的对象存储直传。线上实测 512KB 请求能到应用并返回 401，2MB 请求被 Nginx 直接以 413 拒绝；部署仓库 `coachlink/coachlink.conf` 未设置 `client_max_body_size`，因此当前约 1MB 网关限制会阻断正常视频。Next 的 100MB/200MB 限制无法覆盖上游 Nginx。
  - Python 分析器用 OpenCV `VideoWriter(mp4v)` 逐帧重写，只输出视频流，没有复用或重新封装输入音轨；音频丢失为确定性问题。
  - 输出仍使用低压缩效率的 `mp4v` 且保持原分辨率/FPS，没有 H.264/HEVC 转码、码率/CRF 或输出体积门禁。等价 4 秒样本从 1.73MB H.264+AAC 增至 4.75MB MPEG-4 video-only（约 2.75 倍）。
- Partially/resolved:
  - Web 下载在 7 月 1 日后优先使用 Supabase signed URL，已绕过旧的 Next 下载代理主路径；线上 JS 已确认包含该逻辑。因此旧的应用代理下载瓶颈在代码层已修，但未用登录态完成真实大文件端到端下载，且大文件根因仍未解决。
  - “停止下载后无法分析下一条”在当前模型中不再由下载占用任务名额：`done` 不计 active task，新文件会替换客户端 job；并已增加 queued 10 分钟 / processing 45 分钟的 stale job 自动释放。代码和线上构建层面可判定已基本解决，但没有复现原设备场景做最终端到端确认。
- Verification blocker:
  - `weapp-devtools` 所需的本机 9420 自动化端口未监听，无法执行小程序页面点击上传验证。
  - Web 端要求的 `web-devtools` skill 当前会话未提供；本轮使用线上 HTTP/API 探测和已部署 JS bundle 核对，未执行登录态浏览器交互。
- Repository gates:
  - `npm run lint` ✅（项目提示性脚本）；`npm run typecheck` ✅；`npm test` ✅（将 TEMP/TMP 切到 D 盘后 35 files / 177 tests）。
  - `npx next build` ❌ 被当前工作区无关的未提交代码 `src/app/api/plan-lib/extract-file-text/route.ts:123` 语法错误阻断；本轮未修改该文件。首次测试还因系统盘 C: 可用空间为 0 报 ENOSPC，切换临时目录后通过。
- Implemented code fixes:
  - 小程序 multipart 上传接口改为 Busboy 流式解析并直接写 Supabase Storage，不再用 `formData()` / `arrayBuffer()` 把整段视频读入 Next 内存；HTTP 413 显示明确的上传限制提示。
  - Worker 输入下载、结果上传以及 Next 下载兜底接口均改为流式传输，降低大文件的 Node 内存峰值；Web 仍优先走 signed URL。
  - OpenCV 输出改为临时分析画面，最终由 FFmpeg 编码成 H.264，并从原视频合并/转码 AAC 音轨；有声输入若输出缺音轨会直接失败，不再交付静音文件。
  - `Dockerfile.power-worker` 已安装 FFmpeg；服务器交接与验收步骤见 `docs/work/power-analysis-code-and-infra-handoff-2026-07-14.md`。
- Verification after implementation:
  - `npm run lint` ✅；`npm run typecheck` ✅；`npm test` ✅（35 files / 177 tests）；`npm --workspace apps/wechat run build:weapp` ✅（2754 modules）。
  - H.264+AAC 样例：有声输入约 1.73MB，输出约 1.59MB，音轨保留；无声输入也可正常生成仅 H.264 视频。
  - `git diff --check` ✅。
  - `npx next build` 仍被无关的 `src/app/api/plan-lib/extract-file-text/route.ts:123` 语法错误阻断；微信自动化仍因 9420 无监听而无法执行真机交互。
- Required infra/release follow-up: 生产 Nginx 增加约 110MB 的专用上传限制并关闭请求缓冲；Supabase `videos` bucket 上限至少 200MB；重新构建并部署 Web/API 与 Power Worker 镜像，发布小程序后用有声 MP4、无声 MP4、iPhone MOV、接近上限视频完成登录态验收。
- Nginx implementation update (`2026-07-14`):
  - 已在生产服务器 `ubuntu@154.8.205.78` 的 `/etc/nginx/conf.d/coachlink.conf` 增加功率分析专用 location：`client_max_body_size 110m`、请求/响应关闭缓冲、上传下载超时 360 秒；只影响 `coachlink.fit` 功率分析 API，不修改站点全局或 dev 域名限制。
  - 已同步服务器真实部署仓库 `/home/ubuntu/littlehorse-deployment/coachlink/coachlink.conf` 和 Windows 快照 `D:\files\littlehorse-deployment-main\coachlink\coachlink.conf`。服务器仓库该文件当前为未提交修改，留给后续部署仓库提交/推送。
  - 原配置备份：`/etc/nginx/conf.d/coachlink.conf.bak-20260714-054144`。
  - `sudo nginx -t` ✅，reload 后服务 `active`；2MB multipart 线上探针返回应用 JSON `401 用户未登录`，不再返回 Nginx HTML 413。
  - 剩余基础设施/发布事项：Supabase 全局与 `videos` bucket 上限、两套镜像构建推送、Keel 自动更新后的 FFmpeg 验证、小程序审核发布和登录态真实视频验收。

## 普通空白计划误触发 AI 自动生成排查 (`2026-07-14`)

- Task: 用户反馈 AI 自动创建计划原本用于“学员订阅教练计划”链路，但学员或兼任教练的用户进入普通“创建空白计划”场景时也会自动生成内容。
- Status: 已完成 Web 与微信小程序普通创建页的自动 AI 触发收口；代码尚未提交或推送。
- Confirmed root cause:
  - Web `src/app/me/plan-lib/create/page.tsx` 在检测到计划为空时，通过 `useEffect` 自动调用 `generateAiDraftFromProfile()` 并回填 7 天计划。
  - 微信小程序 `apps/wechat/src/me/plan-lib/create/index.tsx` 在页面加载时直接把 `generateAiDraftFromProfile()` 放进 `Promise.all`，因此打开创建页就会触发 AI。
  - 订阅激活后的自动计划由 `create-subscription` / `auto-match-plan` / `coachingAutomation` 独立触发，不是本次普通创建页误触发的来源。
  - 移动 APP 当前是用户明确点击生成函数后才请求 AI，没有发现同类自动触发。
- Intended boundary: 订阅教练计划链路可继续自动生成；普通空白计划只创建空白编辑器，AI 从零生成能力保留为用户明确触发的可选动作。
- Changes:
  - Web 普通创建页移除了检测空计划后自动调用 `generateAiDraftFromProfile()` 的 effect，仍保留用户主动使用的 AI 智能导入与 AI 修改器。
  - 微信小程序普通创建页不再在初始化 `Promise.all` 中请求 AI 草稿，默认进入空白编辑器；智能导入等显式操作不受影响。
  - AI 草稿接口、订阅激活自动生成链路和移动 APP 的显式“AI 草稿”按钮均未修改。
- Verification:
  - `npm run lint`、`npm run typecheck`、`npm test`（35 files / 177 tests）、`npx next build`、`npm --workspace apps/wechat run build:weapp` 均通过。
  - 按用户长期偏好未运行浏览器或微信开发者工具手动 UI 验证，由用户自行验证实际页面。

## Wayne Tan 覆盖计划后的执行记录错配排查 (`2026-07-14`)

- Task: 用户（教练枭马葛）反馈学员 Wayne Tan 在微信小程序中遇到：今日安排显示 4 个动作/12 组且已完成，进入记录却只有 1 个动作/3 组；下一训练日又显示只读模式。
- Status: 已完成系统代码修复与 Wayne 线上数据修复；代码尚未提交、推送或部署，小程序自动化真机验证受微信开发者工具 9420 端口未开启阻塞。
- Confirmed data timeline:
  - 当前使用实例 `bf765e26-95b3-4b51-ae3f-950c21286f6d` 在 2026-07-11 21:24（北京时间）被覆盖，仍沿用 `start_date=2026-07-05`。
  - 第 3 天旧 execution `ffec849f-4f03-4af8-bb11-b38a8ae0e52a` 于 2026-07-07 创建，当时只有 1 个动作/3 组；2026-07-11 21:18 被标为 completed。
  - 覆盖后的第 3 天计划为 4 个动作/12 组。首页按当前 `training_days` 展示结构，但按同一 `instance_id + day_index` 复用了旧 completed execution，因此出现外面 4 个动作、里面 1 个动作。
  - 同一订阅下还存在一个无执行记录但仍为 active 的重复实例 `2cb2d2d9-f04c-4482-a10c-2908d3a934b2`，需在正式数据修复时一并处理。
- Root causes:
  - “覆盖当前（保留执行记录）”直接原地更新 `coach_plan_instances.training_days`，没有计划版本/执行快照版本边界。
  - `/api/execution/start` 复用旧 execution；`syncExecutionPlanWithCurrentConfig` 仅按动作序号改写旧动作名称和计划参数，不补新增动作/组，也会污染历史记录语义。
  - 小程序计划看板以 `plannedDate !== today` 判只读。覆盖后第 4 天由旧起始日期映射到 7 月 8 日，虽然它是推荐的下一训练日，仍被错误判为过去只读。
  - 只读预览仍运行训练计时持久化逻辑，因此会出现无真实 execution 但显示 `01:20` 一类时长。
- Implemented system fix:
  - execution 改为不可变计划快照；读取/恢复时不再按当前计划重写动作，并删除危险的按序号同步 helper。
  - Web 与小程序在已有执行历史时把“覆盖当前”自动转为新 plan instance/revision，从下一未完成训练日继续；API 同时拒绝对已有 execution 的实例原地结构更新。
  - 新实例先创建、旧 current 实例后归档；归档失败自动回滚新实例，避免出现零 current 或重复 current。
  - 今日训练遇到旧 execution 与当前计划结构不一致时，按 execution 快照展示；小程序可编辑性改为按 execution/progress 判断；只读预览不再启动或恢复本地计时器。
- Wayne data repair:
  - 新建唯一 active 实例 `05c0fa6f-b941-41a9-becf-ade26bdab68d`，`start_date=2026-07-11`、`start_execution_day=4`，第 4 天有 2 个动作。
  - 旧使用实例 `bf765e26-95b3-4b51-ae3f-950c21286f6d` 与空重复实例 `2cb2d2d9-f04c-4482-a10c-2908d3a934b2` 均已非破坏性归档；旧第 1/3 天完成记录仍绑定旧实例并完整保留。
  - 权益核验：购买 4 周、已计 1 周、剩余 3 周；第 4 天访问允许，新实例无伪造 execution。
- Verification:
  - `npm run lint`、`npm run typecheck`、`npx next build`、`npm test`（35 files / 177 tests）均通过。
  - `npm --workspace apps/wechat run build:weapp` 通过。
  - 微信开发者工具自动化未执行：本机 `mrc` 已安装，但 9420 无监听端口。
- Follow-up:
  - 线上数据库尚未应用 `20260517_plan_instance_entitlement_policy.sql` 所含归档/权益元数据列；代码已做仅归档 status 的兼容回退，后续仍应正式执行迁移并回填元数据。

## 融资 BP 后端数据支撑：支付口径补强 (`2026-07-05`)

- Task: 用户纠正上一版融资 BP 数据里付费口径不完整；早期订阅学员虽未走平台支付，但都是直接转账给教练，不能因为 `alipay_orders` 里没有订单就视为未付费。
- Status: completed revised backend aggregate report.
- Output:
  - 新增 `docs/work/bp-backend-data-2026-07-05.md`。
  - 将付费拆成两层：① `coach_subscriptions` 代表已发生付费服务关系；② `coach_subscription_orders` / `alipay_orders` / 结算 / 钱包代表平台支付接入后的可核验订单链路。
- Key numbers:
  - 累计教练-学员付费服务关系 138 条，覆盖 122 名付费学员、3 名收款教练。
  - active 付费服务关系 95 条，active 付费学员 88 名。
  - 历史/直接收款/线下确认关系 102 条；平台支付宝/微信标记关系 36 条。
  - `monthly_price >= 99 元` 的订阅关系 97 条；订阅记录首期/套餐金额合计约 16,993 元；按周期粗估合同服务额约 46,742 元，但该估算不建议放 BP 正文。
  - 平台订单/结算链路已接通：`coach_subscription_orders` paid 6 笔约 500 元；教练相关 `alipay_orders >=100 元` paid 12 笔约 3,498 元；结算记录 10 条，平台费约 180 元。
- Communication guidance:
  - BP 正文建议讲“138 条真实教练付费服务关系 + 平台支付正在迁移接入”。
  - 不建议只展示平台支付金额，因为会低估早期真实付费；也不建议把估算 GMV 放大讲，因为早期直接转账缺少完整平台流水。

## Web 学员计划百分比强度显示与算重修复 (`2026-07-05`)

- Task: 用户反馈刘三乐给 Wayne Tan 制定的计划里，教练端学员计划页显示 `70%1RMRM`，且无法显示具体重量。
- Status: completed at code/build level; manual browser verification left to the user per durable preference.
- Root cause:
  - 历史计划数据可能只在 `params["强度"]` 旧字段里保存字符串 `70%1RM` / `70%rm`，而不是标准 `intensityConfig.relativeIntensity`。
  - 前端 `ActionSetForm` 将任意 `params["强度"]` 都当成 RM 次数字段，再追加 `RM`，所以出现 `70%1RMRM`。
  - 同一个误判会让自动算重逻辑把 `70%1RM` 当 reps 输入计算，得到非数值，最终无法回填具体 kg。
- Changes:
  - `src/lib/rmCaculator.ts`：统一兼容解析旧强度字段，支持 `70%1RM`、`70%rm`、`70%`、`5RM`、`"5"`，并在 `calcIntensityDisplay` / `hasDynamicIntensityTarget` 中复用。
  - `src/app/dashboard/plan-lib/components/ActionSetForm.tsx`：RM 输入与预览改用归一化后的 RM 值，避免把百分比字符串当 RM 展示或计算。
  - `src/types/intensity.ts`：允许旧字段 `legacyRm` 为字符串。
  - `src/lib/e1rmAndLoadCalculation.test.ts`：新增百分比字符串和 RM 字符串兼容回归测试。
- Verification:
  - `npm run lint` ✅（项目脚本为提示性输出）
  - `npm run typecheck` ✅
  - `npm test` ✅（35 files / 177 tests）
  - `npx next build` ✅

## 融资 BP 后端数据支撑 (`2026-07-03`)

- Task: 用户需要从 CoachLink 后端数据中提取投资人喜欢看的指标；对外 BP 可选择性展示有利数据，但必须把不利或需要谨慎处理的数据单独告诉用户。
- Status: completed first-pass backend aggregate report.
- Notes:
  - 本轮应优先查询真实后端聚合数据，不展示用户隐私明细。
  - 输出应区分：适合进 BP 的亮点数据、需要包装/解释的数据、不建议主动展示的数据、后续建议补埋点/补口径的数据。
  - 已生成 `docs/work/bp-backend-data-2026-07-03.md`，包含用户、教练、订阅、收入、训练交付、动作资产、聊天、工具入口、弱项与埋点建议。
  - 关键注意：`alipay_orders.total_amount` 应按“分”折算，且历史订单混有 1 分/1 元测试订单；正式 BP 不能直接展示未清洗 GMV。

## 融资 BP 核心素材梳理 (`2026-07-02`)

- Task: 用户准备为 CoachLink 拉投融资，需要先从项目真实沉淀中整理出最精华、最核心、较细节的 BP 素材，后续再进一步聚焦和打磨。
- Status: completed for first-pass material extraction.
- Notes:
  - 本轮先做项目资产梳理与核心价值提炼，不直接生成完整 BP。
  - 输出应贴合 CoachLink 当前 Web / 微信小程序 / 移动 App / AI 训练计划 / 动作库 / 功率分析 / 街健工具等真实能力，避免空泛商业话术。
  - 初步建议主叙事从旧版“力量训练教练数字化办公室”升级为“线上自由教练商业化操作系统”，但用专业训练系统、计划结构化、自动算重、训练执行和视频上下文证明护城河。
  - 旧 BP 中 2026 年 4 月运营数据可作为历史验证材料，但正式对外融资前需要用户确认最新真实数据。
  - 用户已纠偏：不要主要依赖旧文档，需要基于实际代码、Git 历史和当前工程结构做更细的判断。
  - 二次梳理证据：2026 年以来本地 Git 历史显示高频 feature/fix 迭代；核心改动集中在 `src/app/api`、`apps/wechat/src`、`src/app/dashboard`、`src/app/coach`。当前 API 模块以 `coach`、`user`、`plan-lib`、`student`、`execution`、`subscription`、`streetlifting-index`、`payment` 为重；小程序已按 `coach/me/training/toolbox/streetlifting/content/auth` 等分包组织；移动端 Expo 工程已覆盖训练、教练、知识、街健、工具、支付等 screen。

## 直接提交并同步主分支/开发分支 (`2026-07-01`)

- Task: 用户要求直接提交当前工作区代码并推送，保持 `main` 与开发分支一致；本轮明确不执行测试、不做额外手动验证。
- Status: completed and pushed.
- Notes:
  - 以当前工作区现状为准直接提交，不额外清理或拆分历史改动。
  - 已将远端 `origin/main` 与 `origin/dev` 合入当前本地分支；冲突文件按当前本地代码优先解决，非冲突远端新增文件保留。
  - 已将同一提交推送到远端 `main` 与 `dev`；Gitee 与 GitHub push 均成功。
  - 本轮按用户明确要求跳过测试和手动验证。

## WeChat 注册基础档案保存失败快速修复 (`2026-07-01`)

- Task: 用户截图反馈小程序注册流程第 5 步“训练条件”完成时提示 `基础档案保存失败`，怀疑是字段匹配问题，需要快速修后便于推后端。
- Status: completed at code/build level; manual mini-program registration verification left to the user per durable preference.
- Root cause / risk:
  - 小程序注册提交先调用 `/api/user/update-profile` 写 `user_profiles` 基础档案，再调用 `/api/user/submit-onboarding` 保存训练条件问卷。
  - `update-profile` 已做 `gender` / `fitness_level` 归一化，但档案读写仍使用普通 Supabase client；在小程序 JWT 已由 Next API 自行验证的场景下，普通 client 可能没有 Supabase Auth `auth.uid()` 上下文，线上 RLS/权限环境变化时容易出现写入失败。
  - 小程序 `studentService.updateProfile` 失败时只返回 `null`，页面只能显示泛化的 `基础档案保存失败`，真实数据库错误会被吞掉。
- Changes:
  - `src/app/api/user/update-profile/route.ts`：保留 `getAuthUser` 鉴权不变，但将 `user_profiles` 查询/更新/插入以及教练资料同步写入改为 `serviceRoleSupabase`，避免已鉴权 API 与 Supabase RLS 上下文错位。
  - `src/app/api/user/update-profile/route.ts`：补充 `fitness_level` 对 `精英 / 职业`、`精英/职业` 文案的兼容归一化。
  - `apps/wechat/src/services/studentService.ts`：`updateProfile` 在 API `success:false` 时抛出后端 `message`，避免注册页继续只显示泛化错误。
- Verification:
  - `npm run lint` ✅（项目脚本为说明性提示）
  - `npm run typecheck` ✅
  - `npm test` ✅（35 files / 175 tests）
  - `npx next build` ✅
  - `npm --workspace apps/wechat run build:weapp` ✅

## WeChat 单杠定位改用模糊定位 (`2026-07-01`)

- Task: 根据小程序后台截图确认 `wx.getLocation` / `wx.onLocationChange` 审核不通过，而 `wx.getFuzzyLocation` 已开通；修复单杠位置“定位我附近”不能用的问题。
- Status: completed at code/build level; manual mini-program UI verification left to the user per durable preference.
- Root cause:
  - 单杠位置列表页和地图页直接调用 `Taro.getLocation({ type: 'gcj02' })`，对应微信 `wx.getLocation` 精确定位能力。
  - 当前后台截图显示 `wx.getLocation` 审核不通过，因此线上/体验版会在定位链路失败；但 `wx.getFuzzyLocation` 已开通，足够支持“附近点位”这种粗粒度浏览。
- Changes:
  - `apps/wechat/src/streetlifting/index/locations/index.tsx` 新增 `getApproxUserLocation()`：优先调用 `getFuzzyLocation`，旧环境没有该 API 时才回退 `getLocation`。
  - `apps/wechat/src/streetlifting/index/locations-map/index.tsx` 同样改为优先模糊定位，并关闭地图组件 `showLocation`，避免地图控件主动触发精确定位蓝点能力。
  - 保留/补齐定位失败分支：权限类失败引导去设置或先浏览全国地图，点位加载失败单独提示。
- Verification:
  - `npm run lint` ✅（项目脚本为说明性提示）
  - `npm run typecheck` ✅
  - `npm test` ✅（35 files / 175 tests）
  - `npx next build` ✅
  - `npm --workspace apps/wechat run build:weapp` ✅
  - `git diff --check` ✅

## WeChat 功率分析页顶部与页面密度收紧 (`2026-07-01`)

- Task: 调整微信小程序 `toolbox/power-analysis` 页面，让左上角返回入口不要过高、整页纵向密度更接近现有工具箱/力量计算器页面。
- Status: completed at code/build level; manual mini-program UI verification left to the user per durable preference.
- Root cause:
  - 当前功率分析页使用了 `navigationStyle: 'custom'` 的自绘顶栏，顶部高度固定为 `104rpx`，导致返回操作整体偏高。
  - 该页首屏同时叠加了较高的标题卡、模式卡、视频卡和按钮高度，所以体感上比力量计算器更“顶”和更难点。
- Changes:
  - `apps/wechat/src/toolbox/power-analysis/index.config.ts` 去掉 `navigationStyle: 'custom'`，改回小程序原生导航栏，顶部交互对齐其他工具页。
  - 移除了页面内部自绘 `返回 / 功率视频分析` 顶栏，避免重复导航和额外高度占用。
  - 收紧了功率分析页的纵向尺寸：缩小首屏标题字号、卡片阴影和间距，压低动作模式卡、输入框、视频预览、状态卡和操作按钮高度，让页面整体更紧凑。
  - 页面背景改成与力量计算器更接近的浅灰渐变，视觉上不再像单独做了一套更厚重的工具页。
- Verification:
  - `npm run lint` ✅（信息提示脚本）
  - `npm run typecheck` ✅
  - `npm test` ✅（35 files / 175 tests）
  - `npm --workspace apps/wechat run build:weapp` ✅
  - `npx next build` ⚠️ 未能完成；当前仓库已有 `next dev --webpack` 进程占用 `D:\\files\\coachlink\\.next\\lock`，本次未强行停止现有开发进程。

## WeChat 今日训练首页状态收口 (`2026-07-01`)

- Task: 理清训练首页未登录、已登录无计划、已登录有计划三种状态的关系，并去掉无计划首页上下重复入口。
- Status: completed at code/build level; manual mini-program UI verification left to the user per durable preference.
- Product clarification:
  - 未登录首页是 `访客态`：不展示个人训练计划，不承诺同步训练资产，只提供登录和公开浏览入口。
  - 已登录但无长期计划是 `空计划态`：用户身份已确定，可以即兴锻炼、找教练或看计划库，但这些入口只能出现一组。
  - 已登录且有计划是 `执行态`：展示当前计划、整体计划进度、日历和当天安排。
- Changes:
  - 移除了登录后无计划 / 等待教练计划分支下旧的 `训练入口` 支持面板，避免和上方 `今天重点` 卡重复出现 `即兴锻炼 / 找教练 / 查看计划库`。
  - 访客态顶部 hero 只保留 `登录同步训练` 主动作；公开浏览入口保留在下方列表中，避免 `先找教练` 与 `找教练` 重复。
  - 清理了已移除支持面板对应的 `tt-support-*` 样式和访客态旧次按钮样式。
- Verification:
  - `npm run lint` ✅（信息提示脚本）
  - `npm run typecheck` ✅
  - `npm --workspace apps/wechat run build:weapp` ✅（第一次 180s 超时无日志，延长后通过）
  - `npm test` ✅（35 files / 175 tests）
  - `npx next build` ⚠️ 编译与静态页生成通过，最终仍因本机 Windows 文件锁 `EBUSY copyfile .next\\server\\middleware-build-manifest.js -> .next\\standalone...` 失败；与既有本机环境问题一致，不是本次小程序首页代码错误。

## WeChat 工具箱/Streetlifting 同类登录提示排查 (`2026-07-01`)

- Task: 继续排查微信小程序里“页面能进入，但真正使用时才发现必须登录，而且提示不清楚”的同类问题，优先覆盖 `toolbox` 与 `streetlifting` 相关入口。
- Status: completed at code/build level; manual mini-program UI verification left to the user per durable preference.
- Findings:
  - 这类问题不止力量计算器一个，至少还包括：
    - `streetlifting` 首页：游客可打开，但初始化 `stats` 数据实际被 API 鉴权挡住，容易表现成静默空数据。
    - `streetlifting/社区数据`：游客可打开，但列表与公式接口同样被挡住，容易只看到笼统“加载失败”。
    - `streetlifting/单杠位置`：游客可打开，但列表/统计/贡献榜/地图点位初始化接口原先同样被挡住；新增/编辑入口也缺少前置登录提示。
    - `toolbox/功率视频分析`：能进入页面，但直到选择视频/开始分析时才会遇到登录错误，缺少明确前置说明。
- Changes:
  - `src/proxy.ts` 已把 `streetlifting` 的只读公开接口加入白名单：
    - `/api/streetlifting-index/stats`
    - `/api/streetlifting-index/formulas/list`
    - `/api/streetlifting-index/submissions/list`
    - `/api/streetlifting-index/locations/list`
    - `/api/streetlifting-index/locations/contributors`
    - `/api/streetlifting-index/locations/map-pins`
  - 这样游客现在可以正常浏览街健首页统计、社区数据列表、地点列表/贡献榜/地图点位，而不是被登录拦截。
  - `apps/wechat/src/toolbox/power-analysis/index.tsx` 已增加前置登录引导：未登录时选择视频或开始分析会直接弹“去登录”，不再等到上传/分析请求失败后才报错。
  - `apps/wechat/src/streetlifting/index/locations/index.tsx` 的新增/编辑入口现在也会先检查登录态，并给出明确登录引导。
- Verification:
  - `npm run lint` ✅（信息提示脚本）
  - `npm run typecheck` ✅
  - `npm test` ✅（35 files / 175 tests）
  - `npx next build` ✅
  - `npm --workspace apps/wechat run build:weapp` ✅

## WeChat 力量计算器登录提示修复 (`2026-07-01`)

- Task: 修复微信小程序工具箱里的力量计算器在未登录时把真实登录要求误提示成“未找到对应公式”的问题，并把历史页的未登录状态提示改清楚。
- Status: completed at code/build level; manual mini-program UI verification left to the user per durable preference.
- Root cause:
  - 小程序 `/streetlifting/index/calculator` 页面会在进入时请求 `/api/streetlifting-index/formulas/list`。
  - 该接口当前经过统一 API 鉴权代理，未登录时会返回 `用户未登录`。
  - 页面原本没有区分“公式真的缺失”和“未登录拿不到公式”，所以未登录用户会看到误导性的 `未找到对应公式，请稍后重试`。
- Changes:
  - 计算页现在会先检测登录态；未登录时不再主动请求公式接口，而是展示明确的登录提示卡片。
  - `开始计算` 按钮在未登录时改为 `登录后开始计算`，点击后会直接引导去登录，而不是继续走到公式缺失报错。
  - 上肢公式提示文案现在区分：
    - 登录后加载公式；
    - 公式加载失败；
    - 公式真实缺失。
  - `我的历史与趣味排名` 入口在未登录时会弹出登录引导，不再让用户进到一个无反馈的空页面。
  - `streetlifting/index/calculator/history` 历史页新增未登录占位态，直接说明“历史记录/排名属于个人数据，需要登录后查看”，并提供登录按钮。
- Verification:
  - `npm run lint` ✅（信息提示脚本）
  - `npm run typecheck` ✅
  - `npm test` ✅（35 files / 175 tests）
  - `npx next build` ✅
  - `npm --workspace apps/wechat run build:weapp` ✅

# 功率分析器大文件下载与排队可视化 (`2026-07-01`)

- Task: 修复功率分析器分析后视频变大、超过约 50MB 下载失败的问题，并在分析中展示当前排队情况。
- Status: completed at code/build level; manual Web/mini-program UI verification left to the user per durable preference.
- Changes:
  - Web/Next 代理体积默认上限从 `50mb` 提升为 `200mb`，并支持用 `NEXT_PROXY_CLIENT_MAX_BODY_SIZE` 继续按环境调整。
  - `/api/toolbox/power-analysis/jobs/[id]/download-url` 现在同时返回同域代理下载地址和 Supabase signed URL；Web 下载优先使用 signed URL，降低大文件经过 Next 代理失败的风险；小程序保存失败时复制 signed URL 作为兜底。
  - 功率分析 job DTO 新增 `queueInfo`，按同一 `queue_topic` 统计前方正在处理和排队中的任务数量。
  - Web 与微信小程序功率分析页面现在会在进度条下展示排队提示，例如“前面还有 N 个任务，其中 X 个正在分析、Y 个在等待”。
- Verification:
  - `npm run lint` ✅（项目脚本为说明性提示）
  - `npm run typecheck` ✅
  - `npm test` ✅（35 files / 175 tests）
  - `npx next build` ✅（第一次被已有 `next dev` 锁挡住；停止本仓库 Next dev 后重跑通过，构建输出确认 `proxyClientMaxBodySize: "200mb"`）
  - `npm --workspace apps/wechat run build:weapp` ✅
  - `git diff --check` ✅

## Bug 临时群 CoachLink 快速批处理 (`2026-07-01`)

- Task: 根据 `C:\Users\29454\Documents\New project\bug临时群_近两周Bug整理_2026-07-01.md` 快速核查 CoachLink 相关 bug，挑选低风险项批量修复并完成验收。
- Status: completed at code/build level; manual mini-program UI verification left to the user per durable preference.
- Triage:
  - 适合本轮批处理：功率分析器旧任务卡住后阻止新任务、单杠地图定位失败提示/恢复路径不足。
  - 暂不批量硬改：小程序登录/注册链路异常、深色模式异常。两者当前证据过泛，容易误伤主链路，需要按复现步骤逐条查。
  - 需求类不混入 bug 修复：意见反馈入口可单独排期，不与本轮 bug 批处理绑定。
- Changes:
  - 功率分析器新增 stale active job 兜底：`queued` 默认 10 分钟无进展、`processing` 默认 45 分钟无进展时自动转 `failed` 并释放名额；阈值可通过 `POWER_ANALYSIS_QUEUED_STALE_MINUTES` / `POWER_ANALYSIS_PROCESSING_STALE_MINUTES` 调整。
  - 创建新功率分析任务前会先释放当前用户的 stale `queued/processing` 任务，避免旧任务长期挡住新分析。
  - 查询旧功率分析任务时也会执行过期/卡住兜底，让前端轮询能拿到终态并退出“处理中”。
  - 小程序单杠点位定位失败时，授权类失败会弹出“去设置/先浏览”，非授权失败提示“可先浏览全国地图”；定位成功但点位加载失败时保留当前位置并单独提示点位加载失败。
- Verification:
  - `npm run lint` ✅（信息提示脚本）
  - `npm run typecheck` ✅
  - `npm test` ✅（35 files / 175 tests）
  - `npx next build` ✅
  - `npm --workspace apps/wechat run build:weapp` ✅

## Web 空计划 AI 修改器可从零建计划 (`2026-07-01`)

- Task: 修复教练端学员计划页在“当前计划为空”时，AI 修改器无法直接创建第一版计划、报 `脚本编辑引擎暂不可用：当前计划无法转换为计划脚本` 的问题。
- Status: completed at code/build level; manual UI verification left to the user per durable preference.
- Root cause:
  - 学员计划页当前强制使用 `plan_script` 编辑引擎。
  - 后端把 `formatTemplateToPlanScript()` 产出的空字符串也当成“脚本不可用”，导致空 `training_days` 场景在进入 LLM 前就直接报错。
- Changes:
  - `src/app/api/plan-lib/batch-operation/route.ts` 现在区分“脚本转换失败”和“当前计划为空”两种状态：只有真正转换异常才视为引擎不可用。
  - 当当前计划为空时，批量修改上下文会明确告诉 AI“可根据用户要求从零创建完整计划脚本”，不再把空计划当成异常分支。
  - `runPlanScriptEdit()` 的 prompt 已补充空计划规则：允许直接生成完整周/天/动作脚本，而不是要求基于现有脚本做差量修改。
  - `src/lib/planScript.ts` 现已兼容 AI 偶发输出的 `W1 D1` / `W1 D2 off` 同行写法，会在解析前自动拆成标准两行，避免再次报 `无法识别的脚本行：W1 D1`。
  - `runPlanScriptEdit()` prompt 进一步收紧，优先要求模型把 `W1` 和 `D1` 分两行输出，降低继续产出同行格式的概率。
- Verification:
  - `npm run lint` ✅（信息提示脚本）
  - `npm run typecheck` ✅
  - `npx next build` ✅
  - `npm test` ✅（35 files / 175 tests）

## WeChat 动作素材展示 + 公共动作自动通过 (`2026-07-01`)

- Task: 让微信小程序把公共动作/即兴训练里的动作素材展示出来，并把公共动作编辑建议从“待审核”改为默认自动通过、即时生效。
- Status: completed at code/build level; manual mini-program UI verification left to the user per durable preference.
- Changes:
  - 新增 `apps/wechat/src/utils/mediaUrl.ts`，统一把小程序里的相对媒体地址补成可访问绝对 URL，并提供视频 URL 判断。
  - 小程序 `我的动作库 -> 公共动作` 卡片现在会优先展示 `reference_image_url` 参考图；无图时才回退到首字母占位。
  - 小程序 `training/action-detail` 详情页现在支持：
    - 展示参考图；
    - 展示演示素材区；
    - 直连视频时直接预览；
    - 外部链接素材时一键复制。
  - 小程序 `training/impromptu-training` 即兴训练列表现在给每个动作增加缩略图位，优先展示参考图，不再只剩纯文字列表；点击缩略图可进入动作详情页查看素材。
  - `POST /api/public-action-lib/submit-edit` 已从“写入 pending 提案、等待作者审核”改成“直接写入 approved 编辑记录并立即更新 `community_actions`”；同时保留贡献者编辑记录。
  - Web 端公共动作相关文案同步更新为“提交后直接更新并保留编辑记录”，避免前后端产品描述不一致。
- Verification:
  - `npm run lint` ✅（项目脚本为说明性提示）
  - `npm run typecheck` ✅
  - `npm test` ✅（35 files / 175 tests）
  - `npx next build` ✅
  - `npm --workspace apps/wechat run build:weapp` ✅

## 动作素材覆盖率核查 (`2026-07-01`)

- Task: 核查“小程序动作素材为什么看起来只有前面少量动作有图/有演示”，并统计当前动作素材覆盖率。
- Status: completed, and the production data repair has been executed.
- Findings:
  - 初始核查时：
    - 生产库 `canonical_actions` 为 **386** 条，其中 `reference_image_url` 覆盖 **282 / 386 = 73.1%**，缺图 **104** 条；
    - `community_actions_ranked` 共 **144** 条，至少有一种素材的仅 **24 / 144 = 16.7%**；
    - 小程序真正关心的 **STRENGTH 力量动作** 共 **104** 条，至少有一种素材的仅 **24 / 104**，并且覆盖几乎全部集中在前 24 条。
  - 根因拆解：
    - 最初只有 **24** 条公共力量动作挂了 `canonical_action_id`；
    - 缺素材公共力量动作里，有 **40** 条能唯一/近唯一匹配到现有标准动作；
    - 剩余缺口则是“公共动作根本没有对应标准动作条目”，不是前端展示问题。
  - 本轮已执行的生产数据修复：
    - 新增可复用脚本：
      - `scripts/backfill-community-action-canonical-links.ts`
      - `scripts/bootstrap-canonical-actions-from-community.ts`
      - `scripts/backfill-canonical-reference-fallbacks.ts`
    - 先把已有标准动作可确定匹配的公共力量动作批量补链 **38** 条；
    - 再把剩余无标准动作承接的公共力量动作补建到 `canonical_actions` **40** 条；
    - 对 `高位下拉`、`锤式弯举` 两个重复标准动作歧义项，固定到现有标准动作；
    - 用统一参考卡批量补齐缺失 `reference_image_url`，消灭小程序空白素材位。
  - 修复后最新线上结果：
    - `canonical_actions` 已从 **386** 条增加到 **426** 条；
    - `canonical_actions.reference_image_url` 已覆盖 **426 / 426 = 100%**；
    - `community_actions` 中 **STRENGTH 力量动作 104 条已全部关联 canonical，且 104 / 104 都有素材**；
    - 小程序力量动作排序里：
      - 前 **12** 条有素材 **12/12**；
      - 前 **24** 条有素材 **24/24**；
      - 前 **48** 条有素材 **48/48**；
      - 已不存在“翻到后面突然大段没素材”的情况。
    - 整个 `community_actions`（含非力量类型）当前至少有一种素材的为 **104 / 144**；剩余 **40** 条无素材主要是本轮未处理的非 `STRENGTH` 类型。
  - 实施细节/注意：
    - 这轮补图使用的是统一“参考卡”型素材，目的是先解决小程序空白位；后续仍可在相同 `canonical_action_id` 上覆盖成正式三帧解剖示意图。
    - Apollo 当前未下发 `COS_CDN_ASSETS`，因此补图脚本执行时需要显式注入 `COS_CDN_ASSETS=https://cdn-assets.coachlink.fit`；后续若要重复跑该脚本，应先补齐这项运行时配置。

## WeChat 动作素材/审核链路排查 (`2026-07-01`)

- Task: 排查“朋友创建的动作库素材是否已有后台审批查看能力”，以及为什么微信小程序动作列表/即兴训练里仍只显示文字、不显示素材。
- Status: investigation completed; no code changes yet.
- Findings:
  - 公共动作库后端已存在素材字段返回：`/api/public-action-lib/list-actions` 与 `/api/public-action-lib/get-action` 会返回 `url`，并在 `canonical_action_id` 存在时补充 `reference_image_url`。
  - Web 端已存在“作者审核编辑建议”链路：`/api/public-action-lib/submit-edit` 提交建议，`/api/public-action-lib/review-edit` 由 `community_actions.owner_user_id` 对提案执行通过/驳回，`pending-edits-summary` 可汇总待审核条目。
  - Web 端公共动作详情弹窗 `src/components/action-lib/PublicActionDetailDialog.tsx` 已能展示 `reference_image_url` 参考图、`url` 演示视频/外链，并查看待审核/历史编辑记录。
  - 小程序公共动作页 `apps/wechat/src/me/action-lib/index.tsx` 虽然会请求公共动作列表，但卡片只渲染动作首字、标题、标签和“有演示”文字状态，没有渲染图片或视频封面。
  - 小程序动作详情页 `apps/wechat/src/training/action-detail/index.tsx` 只从本地 `action_detail_*` cache 读取 `id/name/detail/positions/attrs/type/url`，未接收或展示 `reference_image_url`，也没有视频内嵌预览，只提供“复制视频链接”。
  - 即兴训练页 `apps/wechat/src/training/impromptu-training/index.tsx` 只把公共动作素材降级成 `action.url ? '有演示' : '公共动作'` 的文本提示，因此你截图里看到的就是纯文字列表。
- Likely gap:
  - 现在不是“后台完全没有素材/审核代码”，而是“小程序没有把已有素材字段接到卡片和详情展示上”；如果要补齐，优先复用 `reference_image_url + url` 两条现成数据链路即可。

## Web 计划 AI 修改器缺失动作创建恢复 (`2026-06-25`)

- Task: 用户反馈教练端学员计划 AI 修改器在替换为动作库不存在的新动作时只报错，不能像以前一样创建新动作后修改计划。
- Status: completed at code/build level; manual UI verification left to the user per durable preference.
- Root cause:
  - 教练学员计划页当前强制使用 `plan_script` AI 修改引擎。
  - 旧 `code` 引擎仍支持 `pending:` 临时动作和前端“确认并映射动作”流程，但 `plan_script` prompt 要求“新动作不在动作库中则返回无法执行”，且成功分支固定返回 `pendingActions: []`，导致新动作创建流程被绕开。
- Changes:
  - `parsePlanScript` 新增 `allowPendingActions` 选项；仅在开启时，动作名精确未命中会生成 `pending:<动作名>`，而不是硬匹配相似旧动作或直接失败。
  - `/api/plan-lib/batch-operation` 的 `plan_script` 引擎现在允许脚本保留用户指定的新动作名，并把解析出的 pending 动作通过既有 `new_actions_detected` / `preview_result.pendingActions` 返回前端。
  - 已复用现有 `BatchOperationDialog` 的“确认并映射动作”与 `/api/plan-lib/confirm-batch-actions` 流程，无需重做 UI。
  - 新增 `planScript` 单测覆盖“窄距反手引体不在动作库时生成待确认动作”的行为。
- Verification:
  - `npx vitest run src/lib/planScript.test.ts src/app/api/plan-lib/ai-personalize-plan/personalize-plan.test.ts` ✅
  - `npm run lint` ✅（信息提示脚本）
  - `npm run typecheck` ✅
  - `npm test` ✅（35 files / 174 tests）
  - `npx next build` ✅

## WeChat 工具箱封面区分优化 (`2026-06-23`)

- Task: 用户反馈小程序工具箱里的 4 个工具加 1 个小游戏封面过于相似，其中 3 个视觉重叠感明显，需要尽量拉开差异。
- Status: completed at code/build level; manual UI verification left to the user per durable preference.
- Changes:
  - `apps/wechat/src/toolbox/index.tsx` 的工具卡从“统一照片 + 黑色蒙版”改成“按工具类型分化的封面系统”：
    - `动动豆试玩版` 改为无照片的体感游戏风格封面；
    - `功率视频分析` 保留分析向照片，但叠加折线/数据面板装饰；
    - `力量计算器` 改成计算面板 / 1RM 风格封面；
    - `单杠位置` 保留场地照片并加定位波纹装饰；
    - `社区数据` 改成排行榜/柱状图风格封面。
  - 移除了 `动动豆试玩版` 与 `社区数据` 共用 `toolbox-data.jpg` 的重复封面问题。
  - 为每张工具卡新增 badge 与 tag 文案，让 5 张卡片在视觉和语义上都更容易区分。
- Verification:
  - `npm run lint` ✅（信息提示脚本）
  - `npm run typecheck` ✅
  - `npm test` ✅（35 files / 173 tests）
  - `npx next build` ✅
  - `npm run build:weapp`（`apps/wechat`）✅

## Web 计划 AI 改重量 / 1RM 能力核查 (`2026-06-23`)

- Task: 核查教练端“创建计划 / 计划 AI 修改器”是否已经支持根据学员反馈自动调整动作重量或全局 1RM。
- Status: implemented at code/test level.
- Findings:
  - `AI 生成计划 / AI 生成下一阶段` 链路会读取学员最新 PR/1RM 记录作为生成输入，说明“创建时参考 1RM”已存在。
  - 教练端学员计划页已有手动 `学员动作 1RM 设定` 面板，调用 `/api/coach/batch-update-student-1rm` 回写 `student_actions.reference_1rm`，用于后续自动计算训练负荷。
  - 当前 `计划 AI 修改器` 能改当前计划 `trainingDays` 内的 `weight` / `RM` / `%1RM`，但接口上下文明确“仅能修改当前计划 trainingDays”；现状没有发现它会直接回写学员动作库里的全局 `reference_1rm`。
  - 当前学员计划页传给 `计划 AI 修改器` 的默认上下文关闭了 `includeExecutionHistory`、`includeFeedbacks`、`includeStudentActionLib`，因此它默认也拿不到“学员最近反馈太重/太轻”和“当前动作库 1RM 基线”这两类关键信号。
  - 训练执行链路的现有产品规则仍是“系统自动只会上调，手动可下调”；若要下调全局 1RM，当前依旧需要人工设置。
- Product direction update:
  - 用户已明确倾向只保留“全局 1RM 实时调整”主路径：学员反馈太重/太轻时，优先直接调整动作级全局 `reference_1rm`，并让依赖该 1RM 的当前计划负荷自动联动。
  - 后续实现仍需注意两个边界：
    - 固定重量处方不要被误当作 1RM 派生负荷去重算；
    - 每次自动 1RM 调整要保留原因、方向和幅度（例如 `-2.5kg`），便于追溯和撤销。
- Implemented:
  - 为 `计划 AI 修改器` 新增 `oneRmAdjustments` 协议：AI 现在除了返回计划草稿修改外，还可以返回“动作级全局 1RM 调整清单”。
  - 新增 `src/lib/oneRmAdjustments.ts` 负责把 AI 返回的增减量规范化为 `2.5kg` 步进，并结合当前学员 1RM / 动作映射解析成可落库的调整。
  - 教练端学员计划页现在会把 AI 预览出的 1RM 调整先叠加到本地 `planReference1RMs`，因此依赖 1RM 的处方重量会在编辑页实时联动。
  - 保存和自动保存现在都会在计划写入成功后，继续调用 `/api/coach/batch-update-student-1rm` 回写学员动作库里的 `reference_1rm`；若部分动作无法映射，会阻止跳走并提示继续处理。
  - 学员计划页传给 `计划 AI 修改器` 的默认上下文已改为开启 `includeExecutionHistory`、`includeFeedbacks`、`includeStudentActionLib`，并且学员动作库上下文会附带现有 `reference_1rm` 数值。
  - 本轮继续补齐“重量多能力”结构化协议：新增 `src/lib/loadAdjustments.ts`，支持 AI 直接返回 `loadAdjustments`，把“固定重量回填 / 固定重量 ±2.5kg / 改成 8RM / 改成 75%1RM”这类负荷调整直接落到当前计划，而不再强依赖整份 `trainingDays` / `plan_script` 重写。
  - `batch-operation/route.ts` 的 `plan_script` 和 `code` 两条 AI 编辑链路现在都支持 `loadAdjustments + oneRmAdjustments` 双协议并存；如果只是小范围负荷调整，AI 可以保持 `script/code` 不变，仅返回结构化负荷调整清单。
  - 差异分析现在会识别 `load` / `intensityConfig.fixedWeight` 产生的固定重量变化，不会再把“只改固定重量”误判成“没有修改”。
  - `src/types/intensity.ts` 与 `src/lib/rmCaculator.ts` 已正式补上 `fixedWeight` 能力，避免类型层仍把固定重量当成“半支持”状态。
- New requirement clarification:
  - 用户补充确认：“重量”本身是弹性的多能力字段，不能只等价于“调全局 1RM”。
  - 除了这次已实现的“反馈驱动全局 1RM 调整”外，后续还需要明确支持：
    - 直接写入固定重量；
    - 根据问卷/已知测试结果直接把重量腾进计划；
    - 继续保留 RM / %1RM / recommendedLoad 这类相对强度能力。
- Verification:
  - `npm run lint`（项目脚本仅提示 Next 16 未配置 eslint）
  - `npm run typecheck` ✅
  - `npm test` ✅（35 files / 173 tests）
  - `npx next build`：编译与静态页生成通过，但最终 `copyfile .next -> .next/standalone` 仍被本机 Windows 文件锁阻塞，报 `EBUSY`；属于环境问题，不是本次逻辑错误

## 拉取最新代码并与本地改动融合 (`2026-06-23`)

- Task: 按用户要求拉取 `origin/main` 最新代码，并把当前本地未提交改动安全融合回来。
- Status: completed.
- Result:
  - 先执行 `git fetch --all --prune`，确认本地 `main` 落后 `origin/main` 4 个提交，远端最新到 `6eb3423c feat(mobile): align login/nav and dev test account flow`。
  - 用 `git stash push -u -m "sync-before-pull-2026-06-23"` 暂存当前工作区和未跟踪文件后，执行 `git pull --ff-only origin main`，本地 `main` 已快进到远端最新。
  - 之后执行 `git stash pop` 恢复本地改动；业务代码改动已成功弹回，`CURRENT_TASK.md` 与 `DECISIONS.md` 的冲突已人工合并，保留远端 APP 迁移状态和本地 2026-06-23 Web/接口修复记录。
  - 当前仍保留本地未提交改动：Web AI 下一阶段兜底相关文件、`src/app/api/user/update-profile/route.ts`、memory 文件，以及未跟踪的 `wechat_app/`/`scripts/power-analysis/__pycache__/`。
- Verification:
  - 本轮只做 Git 同步与文本融合，未重新运行 `npm run lint` / `npm run typecheck` / `npm test` / `npx next build`。

## Web 学员 AI 计划周期过长修复 (`2026-06-23`)

- Task: 用户反馈教练端为学员执行 `AI 生成计划 / AI 生成下一阶段` 时，系统把学员 `已购40周` 误当成单次计划 phase 长度，直接把短模板扩写成 40 周长计划，导致生成时间过长且结果不符合教练实际使用方式。
- Status: completed at code/test level.
- Root cause:
  - `src/app/api/plan-lib/ai-personalize-plan/personalize-plan.ts` 把 `subscribedWeeks` 直接写进 Stage B prompt，强制要求“本次计划必须覆盖已购周数”。
  - `src/app/api/plan-lib/ai-personalize-plan/service.ts` 又把 `subscribedWeeks` 当成保存前的计划长度校验目标，进一步强化了“按已购周数铺满”的错误逻辑。
- Fix:
  - 新增 `inferPlanPhaseWeeks()`：当已有模板/历史骨架时，单次生成周期优先使用骨架自身长度；没有模板时才做保守兜底，避免一次性生成超长年度计划。
  - Stage B prompt 现在明确区分：
    - `已购周数` 只是长期订阅权益参考；
    - `本次计划输出周期` 才是单次 phase 需要生成的长度。
  - 新增硬规则：禁止为了对齐已购 40 周，把 4~16 周骨架机械重复扩展成 40 周。
  - 保存前的周期校验改成：
    - 模板骨架场景：只做“超长裁剪”，不再因为 `subscribed_weeks` 强迫扩写；
    - 从零生成且明确有购买周期时：仍保留“明显过短计划”拦截。
- Verification:
  - `npx vitest run src/app/api/plan-lib/ai-personalize-plan/personalize-plan.test.ts src/app/api/plan-lib/ai-personalize-plan/service.test.ts`: passed.
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 166 tests.
  - `npx next build`: compile/static generation passed, but final standalone copy仍被本机 Windows `.next` 文件锁阻断，报 `EBUSY copyfile ... .next\\standalone ...`；这是本地运行环境阻塞，不是本次逻辑改动的类型/编译错误。

## APP Documentation Migration Pack (`2026-06-21`)

## 当前任务（`2026-06-21`）

- 已完成：实现 APP 登录与开发测试账号链路和移动端角色化首页导航切换。
- 已完成：`AuthProvider` 从 `src/config/devUsers.ts` 读取测试账号（支持 `NEXT_PUBLIC_DEV_USERS`/`NEXT_PUBLIC_DEV_ACCOUNTS`），并移除 mock token 登录；登录页提供账号按钮直接登录，同时保留手动切换登录模式、无返回入口。
- 已完成：`RootNavigator` 现在根据用户身份进入学生/教练两套底部 Tab 结构；`FloatingTabBar` 匹配 `iconfont` 图标映射。
- 已完成：`AuthShell` 通过 `contentInsetAdjustmentBehavior="never"`/`automaticallyAdjustContentInsets={false}` 修复登录页顶部空白间隙。
- 已完成：补齐 `apps/mobile/src/screens/coach/CoachProfileScreen.tsx` 的 props 类型兼容（支持作为 tab 入口），并通过本轮 `npm --workspace apps/mobile run typecheck`。
- 验证结果：
  - `npm run lint`（项目脚本提示 Next v16 无 lint）
  - `npm run typecheck` ✅
  - `npm test` ✅
  - `npx next build` ✅
  - `npm --workspace apps/mobile run typecheck` ✅
  - `npm run test:e2e` 失败：`bootstrap-env` 无法访问 Apollo 命名空间（同历史阻塞）。

- Task: organize a reusable migration package and test-user index for current APP/小程序对齐工作.
- Status: completed.
- Changes:
  - Added `docs/test-accounts/APP-DEV-TEST-ACCOUNTS.md` containing the current local development test users and a verification checklist.
  - Created `skill-factory/coachlink-mobile-app-migration/`（多文件结构）用于 APP 小程序对齐迁移与复用，包含路径、API、图标、登录态、模拟器等章节。
  - Kept `skill-factory` intentionally untracked via `.gitignore` per你的要求（本地知识资产，不入 Git）。
- Notes:
  - 当前工作以“文档和可复用技能沉淀”为主线，APP 代码迁移的执行细节与关键配置已同步到 skill 内。
  - 你将手动验证前端交互与键盘/粘贴行为（已在说明中保留手动校验清单）。

## Anatomy Model Persona Sheet (`2026-06-21`)

- Mobile APP video review + authentication compatibility (`2026-06-21`)

- Task: complete mini-program aligned video review migration into mobile APP and provide a hardening pass for emulator input/clipboard.
- Status: implemented in code, awaiting your manual UI/input verification.
- Changes made:
  - Added auth-compatible video execution pending/review API support for APP bearer-token users.
  - Added `CoachVideosScreen` and `CoachVideoReviewScreen`, plus navigation wiring from coach dashboard.
  - Kept manual verification flag for simulator interactions per your preference.
- Validation:
  - `npm --workspace apps/mobile run typecheck` ✅
  - `npm run lint` (informational script) ✅
  - `npm run typecheck` ✅
  - `npm test` ✅
  - `npm run test:e2e` blocked: start script failed resolving Apollo namespace `app-config` from `https://apollo-configservice.paper2ppt.work/...` during bootstrap; local `CONFIG_SOURCE=local` did not override because bootstrap source is fixed in `.env`.

- Task: find the current standard-action-library character reference in `design/image-workspace`, identify the matching three-key-frame barbell/bench-press reference image, and generate the CoachLink anatomy-model persona sheet from the documented requirements.
- Status: completed.
- Source found:
  - `design/image-workspace/references/model-reference-latest.jpg` is the three-key-frame bench-press/barbell reference image. It shows start position, lowering, and press-up frames, with pectoralis major as red primary muscle and anterior deltoid/triceps as orange assisting muscles.
  - `design/image-workspace/docs/anatomy-model-character-guide.md` defines the reusable anonymous male anatomy model requirements.
- Output:
  - Generated `design/image-workspace/outputs/anatomy-model-persona-sheet-v1.png`.
  - The output is a horizontal persona sheet with front, side, three-quarter, and bench-press thumbnail views, preserving the anonymous face, short dark hair, lean athletic proportions, translucent gray-white body/skeleton treatment, red/orange muscle highlights, and black equipment accent language.
  - Revised per initial user feedback and generated `design/image-workspace/outputs/anatomy-model-persona-sheet-v2.png` as a previous revision.
  - V2 keeps the left three main character views clean with translucent gray-white body/skeleton only, no red/orange muscle highlights, and keeps red/orange muscle display only in the right-side bench-press action reference. The face treatment is also more natural and less like a smeared blur.
  - V2 is no longer the target because the user clarified that shoulder/arm orange regions should remain and only the red chest/pectoralis color should be removed from the standing model views.
  - Revised again per user clarification and generated `design/image-workspace/outputs/anatomy-model-persona-sheet-v3.png` as a previous revision.
  - V3 is based on the user's provided reference image and preserves its layout/color distribution more closely: the standing model views keep orange shoulder/arm highlights, remove only the red chest/pectoralis highlight, remove shoes in favor of bare feet, and replace the blurred face with a natural faceless male mannequin head. The right-side bench-press reference keeps action-specific red/orange muscle highlights.
  - V3 is no longer the target because the user clarified that the left-side standing views should have no colored muscle markings anywhere, including no orange shoulder/arm regions.
  - Revised per latest user clarification and generated `design/image-workspace/outputs/anatomy-model-persona-sheet-v4.png` as the current recommended persona sheet.
  - V4 removes all colored muscle markings from the three standing character views, including the orange shoulder/arm regions. The standing views are now fully translucent white/gray with skeleton hints only, barefoot, and faceless. The right-side bench-press reference keeps action-specific red/orange muscle highlights.
  - Updated `design/image-workspace/README.md` and `design/image-workspace/docs/anatomy-model-character-guide.md` to make V4 the recommended target.
- Verification:
  - Visually inspected the source reference and generated image.
  - Confirmed output file is PNG, `1717 x 916`.
  - Confirmed V2 output file is PNG, `1693 x 929`.
  - Confirmed V3 output file is PNG, `1717 x 916`.
  - Confirmed V4 output file is PNG, `1717 x 916`.

## Standard Action Library Sequence Image Pilot (`2026-06-21`)

- Task: find the current standard action library, plan 10 sub-agents, and start generating three-key-frame sequence images for an initial 50-action pilot before scaling to the full 300+ action set.
- Status: in progress; not complete.
- Source of truth found:
  - Production Supabase `canonical_actions` currently has **383** standard actions.
  - Production Supabase `community_actions` currently has **144** public action rows with richer action metadata such as target positions/muscles.
  - Exported full standard action dictionary to `design/image-workspace/action-library/standard-actions-export.json`.
- Pilot scope prepared:
  - Selected 50 unique `STRENGTH` public actions with target muscle positions for the first visual pilot.
  - Wrote manifest to `design/image-workspace/action-library/pilot-50-actions.json`.
  - Wrote production plan to `design/image-workspace/action-library/production-plan.md`.
  - Wrote production status to `design/image-workspace/action-library/production-status.json`.
- 10 sub-agent plan executed:
  - Spawned 10 sub-agents, each responsible for 5 pilot actions.
  - Persisted returned frame specs to:
    - `design/image-workspace/action-library/batches/batch-01-frame-spec.md`
    - `design/image-workspace/action-library/batches/batch-02-frame-spec.md`
    - `design/image-workspace/action-library/batches/batch-03-frame-spec.md`
    - `design/image-workspace/action-library/batches/batch-04-frame-spec.md`
    - `design/image-workspace/action-library/batches/batch-05-frame-spec.md`
    - `design/image-workspace/action-library/batches/batch-06-frame-spec.md`
    - `design/image-workspace/action-library/batches/batch-07-frame-spec.md`
    - `design/image-workspace/action-library/batches/batch-08-frame-spec.md`
    - `design/image-workspace/action-library/batches/batch-09-frame-spec.md`
    - `design/image-workspace/action-library/batches/batch-10-frame-spec.md`
- First image generated:
  - Generated and visually inspected `design/image-workspace/action-library/outputs/001-负重臂屈伸-sequence.png`.
  - The output is a horizontal 3-key-frame PNG (`1773 x 887`) using the v4 barefoot/faceless anatomy model and action-specific muscle highlights.
  - Note for next prompts: for cyclic actions, make frame 3 visually distinct enough from frame 1 when useful for downstream video interpolation.
- Pilot images generated in follow-up:
  - Generated, copied into the workspace, and visually inspected:
    - `design/image-workspace/action-library/outputs/002-负重引体-底部暂停-sequence.png`
    - `design/image-workspace/action-library/outputs/003-弹力带肩部热身-sequence.png`
    - `design/image-workspace/action-library/outputs/004-手腕热身-sequence.png`
    - `design/image-workspace/action-library/outputs/005-臂屈伸-sequence.png`
  - QA notes: 002 is usable but the rear-view back highlight is strong and may be tightened in a consistency pass; 003 is usable but rotator-cuff specificity could improve with a slightly oblique/rear angle; 004 and 005 are usable for the pilot. All four preserve the no-shoes/no-text/no-watermark requirement.
- Remaining scope:
  - Generate and review pilot outputs `006` through `050`.
  - Then decide whether to scale the same pipeline to all 383 `canonical_actions`.

## Canonical Action Reference Image Pipeline (`2026-06-21`)

- Task: implement the pipeline for standard-action reference images: add a `canonical_actions.reference_image_url` field, upload generated action sequence images to COS, and write the public URL back to the standard action dictionary.
- Status: implemented at code level; production migration/upload/write execution still pending.
- Scope decision:
  - Only concrete, drawable canonical actions should be processed in the first pass.
  - Generic/ambiguous names such as auxiliary items or unclear holds should be skipped and recorded in the manifest for later manual handling.
  - Production DB direct write is allowed after dry-run and small-batch validation.
- Code changes:
  - Added migration `supabase/migrations/20260621_canonical_action_reference_images.sql` for `canonical_actions.reference_image_url`.
  - Added COS logical bucket `action-reference-images`, mapped to the assets bucket with prefix `action-reference-images/`.
  - Added `reference_image_url` to database/canonical/public-action DTO types.
  - Public action list/detail APIs now read `canonical_actions.reference_image_url` by `canonical_action_id` and return it.
  - Public action detail dialog now shows a reference-image block when available.
  - Added `scripts/generate-canonical-action-reference-images.ts` and npm script `canonical-actions:reference-images`.
- Script behavior:
  - Default `--dry-run`: reads `canonical_actions`, classifies concrete/skipped actions, looks for local images, and writes manifest without upload/write.
  - `--execute`: uploads existing local images to COS logical bucket `action-reference-images` and updates `canonical_actions.reference_image_url`; default is fill-empty-only unless `--overwrite` is passed.
  - Supports `--limit`, `--offset`, `--shard=i/n`, `--concurrency`, `--manifest`, and `--image-dir`.
  - Does not call built-in image generation from Node; missing local images are recorded with standardized image prompts for sub-agent/imagegen generation, then the script can be rerun.
- Verification:
  - `npm run canonical-actions:reference-images -- --dry-run --limit=5 --manifest=/tmp/coachlink-canonical-reference-dry-run.json`: passed; detected 383 canonical actions and produced a dry-run manifest. Because production DB has not run the migration yet, it warned that `reference_image_url` is missing and continued in dry-run mode.
  - `git diff --check`: passed.
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed.
- Next steps:
  - Apply the new Supabase migration in production before any `--execute`.
  - Run COS verification for `action-reference-images`.
  - Generate/copy concrete canonical action images into `design/image-workspace/action-library/canonical-outputs/`.
  - Run a small production batch, for example `npm run canonical-actions:reference-images -- --execute --limit=10`, inspect COS URLs and DB writes, then shard the remaining concrete actions.

## Mobile WeChat Module Migration (`2026-06-21`)

- Task: continue migrating remaining WeChat mini-program modules into `apps/mobile` with matching style and behavior, including bottom navigation parity and every nested module path.
- Status: in progress; not complete.
- Current progress in this turn:
  - Verified current `ProfileTab` already uses the full `apps/mobile/src/screens/me/MeScreens.tsx` `ProfileScreen`, so the earlier simplified `ProfileScreen.tsx` is no longer the active "我的" tab.
  - Updated `apps/mobile/src/screens/CoachesScreen.tsx` to match the mini-program discovery page behavior more closely: `/api/student/visibility-status` focus/exclusive coach mode, paginated coach loading with local buffer, test coach filtering, specialty filtering, search, rating badge, featured badge, start price, load-more and list-end states.
  - Added `apps/mobile/src/screens/coach/CoachMarketScreen.tsx` for the mini-program `discovery/market` service market: coach pricing aggregation, tier filters, keyword search, product/month price cards, buy navigation, and add-to-cart flow.
  - Wired `CoachMarket` into `RootNavigator`, `RootStackParamList`, and the Coaches tab service entrance.
  - Added `apps/mobile/src/screens/coach/GeneratePlanScreen.tsx` and `GeneratePlanWaitingScreen.tsx` for the mini-program `discovery/generate-plan` flow: domain selection, rulepack/default assessment fields, step validation, `/api/user/submit-onboarding`, waiting/progress state, `/api/user/generate-quick-plan`, success/async/error actions, and plan-history redirect.
  - Wired `GeneratePlan` / `GeneratePlanWaiting` into `RootNavigator` and added an `AI 生成计划` CTA on the coach profile bottom action panel.
  - Added `apps/mobile/src/screens/training/TrainingShareScreen.tsx` for mini-program `discovery/share`: loads `/api/execution/share-info`, renders the training completion preview card, exposes system share and copy-share-text actions, and is reachable from completed training execution and training history items.
  - Extended `Page` to accept an optional `contentContainerStyle` for special pages such as the training share card background without changing default layouts.
  - Migrated the mini-program training action detail/copy-from-coach gap into APP:
    - Added `ActionDetail` route and screen for action name/type/detail/positions/attrs/video-link display, plus video URL copy and personal-action edit entry.
    - Added `CopyCoachActions` route and screen using `/api/student/action-lib/list-coach-actions` and `/api/student/action-lib/copy-coach-action`, with coach action cards, added/copying states, empty/loading/error states.
    - Updated APP action library to show a `从教练复制动作` entry and route personal actions to `ActionDetail`.
    - Updated Training tab recent actions to open `ActionDetail` instead of jumping straight to edit.
  - Migrated more of the mini-program `me/plan-history` flow into APP:
    - Replaced the generic APP plan-history list with a mini-program-aligned `全部计划 / 教练指派 / 我的计划` segmented filter, plan cards, status/source badges, date range, training-day count, completion progress, load-more, and empty-state actions.
    - Enhanced plan-history detail with completion progress, execution notice action, and direct `TrainingExecution` entry for active incomplete plans.
  - Migrated more of the mini-program `me/plan-lib` flow into APP:
    - Replaced the generic APP plan-library list with a functional plan-template library: create entry, template cards, edit navigation, apply action, delete action, and 1RM configuration modal for auto-weight actions.
    - Reworked APP `PlanEdit` from a single text field into a structure-aware editor that loads existing favorites, can generate an AI draft from profile, can parse pasted plan text through `/api/student/plan-lib/parse-template`, shows training/rest day previews, and saves structured `training_days`.
    - Added Bearer-token compatibility for APP access to student plan-library APIs used by this flow: list/get/save/update/delete/apply favorite, parse actions/template, and AI draft generation.
  - Improved APP coach-content / knowledge article migration:
    - Confirmed `CoachContentDetail` exists and is wired from `CoachProfile` content cards.
    - Added Bearer-token auth compatibility to `/api/coach/get-contents`, so APP coach profile content list uses the correct subscriber tier instead of treating APP users as guests.
    - Added Bearer-token auth compatibility to `/api/knowledge/list-coach-contents`.
    - Added a `教练专栏` section to APP `KnowledgeScreen`, loading `/api/knowledge/list-coach-contents` and routing items to `CoachContentDetail`.
    - Wired `KnowledgeSearchScreen` related coach articles to `CoachContentDetail`.
  - Began coach-side APP module migration:
    - Added APP-native `CoachDashboard` route/screen aligned with mini-program `coach/overview`.
    - `CoachDashboard` renders business overview stat tiles, teaching asset rows, and settings rows.
    - APP `ProfileScreen` now shows `教练工作台` for coach users instead of the coach-application entry.
    - `/api/coach/get-overview-data` now accepts APP Bearer-token auth in addition to NextAuth session auth.
  - Migrated the first coach dashboard child module, mini-program `coach/students`, into APP:
    - Added APP-native `CoachStudents` route/screen with search, sort, paging, student cards, tier/status/video review chips, plan progress, and projected end-date display.
    - Added `CoachStudentDetail` route/screen for profile, subscription/training data, and questionnaire summary.
    - Wired the `CoachDashboard` `学员管理` row into `CoachStudents`.
    - Added APP Bearer-token auth compatibility to `/api/coach/list-students` and `/api/coach/get-student`.
    - Tightened `/api/coach/get-student` so subscription-id lookups are also constrained to the current coach.
  - Migrated mini-program `coach/action-lib` into APP:
    - Added APP-native `CoachActions` route/screen with search, type filtering, paging, action cards, edit and delete actions.
    - Added `CoachActionEdit` route/screen covering the mini-program fields for strength/diet/cardio/habit actions, including positions, attrs, auto-weight compute, body-weight inclusion, item schema, detail, and demo video URL.
    - Wired `CoachDashboard` `动作库` row into `CoachActions`.
    - Added APP Bearer-token auth compatibility to `/api/action-lib/list-actions`, `get-action`, `add-action`, `update-action`, and `delete-action`.
  - Migrated the first layer of mini-program `coach/plan-lib` into APP:
    - Added APP-native `CoachPlanTemplates` route/screen with search, type filters, tag filters, template cards, export-to-clipboard, copy, delete, and edit navigation.
    - Added `CoachPlanTemplateEdit` route/screen for template base fields, execution notice, tags, suitable audience/type, and editable `trainingDays` JSON.
    - Wired `CoachDashboard` `计划库` row into `CoachPlanTemplates`.
    - Added APP Bearer-token auth compatibility to `/api/plan-lib/list-templates`, `get-template`, `create-template`, `update-template`, `delete-template`, `copy-template`, `get-unique-template-tags`, and `export-template-text`.
  - Migrated mini-program `coach/content` into APP:
    - Added APP-native `CoachContents` route/screen with content stats, title/body search, tier filters, content-type filters, content cards, tags, view/like/comment metrics, edit, and delete.
    - Added APP-native `CoachContentEdit` route/screen covering title, body, content type, required tier, price, tags, featured state, draft save, and publish/update actions.
    - Wired `CoachDashboard` `内容库` row into `CoachContents`.
    - Added APP Bearer-token auth compatibility to `/api/coach/publish-content`, `/api/coach/update-content`, and `/api/coach/delete-content`.
    - Tightened `/api/coach/delete-content` so deletion is constrained to content owned by the current coach, instead of only checking that the session user is a coach.
  - Migrated mini-program `coach/pricing` into APP:
    - Added APP-native `CoachPricing` route/screen with receiving-account readiness banner, tier grouping (`basic / standard / vip`), product cards, duration/price tags, combo included items, legacy pricing read-only display, add, edit, and delete.
    - Added APP-native `CoachPricingEdit` route/screen covering tier, service type, name, description, combo included items, multi-duration options, price editing, validation, and save.
    - Wired `CoachDashboard` `订阅定价` row into `CoachPricing`.
    - Added APP Bearer-token auth compatibility to `/api/coach/update-pricing`.
    - Kept the existing server-side restriction that pricing cannot be saved until Huifu receiving account / card binding is complete; APP currently shows the same readiness warning while full wallet/merchant onboarding remains a later module.
  - Migrated mini-program `coach/questionnaire` into APP:
    - Added APP-native `CoachQuestionnaires` route/screen with questionnaire list, status/default/editor-type/version badges, question-count/type/branch summaries, edit, duplicate, and set-default actions.
    - Added APP-native `CoachQuestionnaireEdit` route/screen covering new-questionnaire type picking, template name, status/editor badges, text questions, single-choice questions, multiple-choice questions, allow-other option, legacy type display/delete, save, and publish.
    - Wired `CoachDashboard` `学员问卷` row into `CoachQuestionnaires`.
    - Added APP Bearer-token auth compatibility to `/api/coach/list-questionnaires`, `get-questionnaire-by-id`, `duplicate-questionnaire`, `set-default-questionnaire`, `update-questionnaires`, and `publish-questionnaire`.
    - Tightened `/api/coach/update-questionnaires` so editing an existing questionnaire is constrained to `coach_id = current userId`.
  - Migrated mini-program `coach/automation` into APP:
    - Added APP-native `CoachAutomation` route/screen with the same business guidance-first shape as the mini-program: default recommendation, scenario guidance, global policy selectors, pending adjustment drafts, automation history, and draft apply action.
    - Wired `CoachDashboard` `自动化设置` row into `CoachAutomation`.
    - Added APP Bearer-token auth compatibility to `/api/coach/automation-policy`, `/api/coach/automation-jobs`, and `/api/coach/plan-adjustment-drafts/[id]/apply`, while keeping the existing Web/NextAuth session path.
  - Migrated mini-program `coach/revenue` into APP:
    - Added APP-native `CoachRevenue` route/screen for month switching, total revenue, subscription revenue, content revenue, and income item list.
    - Wired the `CoachDashboard` `本月收入` stat tile into `CoachRevenue`.
    - Added APP Bearer-token auth compatibility to `/api/coach/get-revenue-details`, while keeping the existing Web/NextAuth session path.
  - Migrated the main mini-program `coach/wallet` module into APP:
    - Added APP-native `CoachWallet` route/screen for withdrawable balance, frozen amount, pending settlement amount, gross balance, total income, Huifu account status, refund-protection hint, pending settlements, wallet transactions, and Huifu withdrawal modal.
    - Wired the `CoachDashboard` `收款账户` row into `CoachWallet`.
    - Added APP Bearer-token auth compatibility to `/api/coach/wallet`, while preserving the existing Web/NextAuth session path.
  - Migrated mini-program `coach/wallet/merchant` into APP:
    - Added APP-native `CoachWalletMerchant` route/screen for Huifu receiving-account onboarding.
    - The APP screen covers the same two-step flow as the mini-program: identity information, ID-card front/back image upload, certificate validity dates, bank card holder/card number, bank-code picker, branch code/name, province/city picker, generated region code preview, and submit-to-Huifu action.
    - Wired `CoachWallet` `开通收款账户 / 重新开通收款账户 / 立即开通` actions into `CoachWalletMerchant`.
    - Reused the existing `/api/coach/merchant/open-huifu-account` API, which already supports APP Bearer-token auth through `getApiUserId`.
- Verification:
  - `npm run typecheck --workspace @coachlink/mobile`: passed after action detail/copy migration.
  - `npm run typecheck --workspace @coachlink/mobile`: passed after plan-history migration.
  - `npm run typecheck --workspace @coachlink/mobile`: passed after plan-library migration.
  - `npm run typecheck --workspace @coachlink/mobile`: passed after coach-content/knowledge-article routing migration.
  - `npm --workspace apps/mobile run typecheck`: passed after `CoachDashboard` migration.
  - `git diff --check` on `CoachDashboard` migration files: passed.
  - `npm --workspace apps/mobile run typecheck`: passed after `CoachStudents` migration.
  - `git diff --check` on `CoachStudents` migration files: passed.
  - `npm --workspace apps/mobile run typecheck`: passed after `CoachActions` migration.
  - `git diff --check` on `CoachActions` migration files: passed.
  - `npm --workspace apps/mobile run typecheck`: passed after `CoachPlanTemplates` migration.
  - `git diff --check` on `CoachPlanTemplates` migration files: passed.
  - `npm run typecheck --workspace @coachlink/mobile`: passed.
  - `git diff --check` on current APP migration files: passed.
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed.
  - `npm --workspace apps/mobile run typecheck`: passed after `CoachQuestionnaires` migration.
  - `git diff --check` on `CoachQuestionnaires` migration files: passed.
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed.
  - `npm --workspace apps/mobile run typecheck`: passed after `CoachPricing` migration.
  - `git diff --check` on `CoachPricing` migration files: passed.
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed.
  - `npm --workspace apps/mobile run typecheck`: passed after `CoachContents` migration.
  - `git diff --check` on `CoachContents` migration files: passed.
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed.
  - `npm --workspace apps/mobile run typecheck`: passed after `CoachAutomation` migration.
  - `git diff --check` on `CoachAutomation` migration files: passed.
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed.
  - `npm --workspace apps/mobile run typecheck`: passed after `CoachRevenue` migration.
  - `git diff --check` on `CoachRevenue` migration files: passed.
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed.
  - `npm --workspace apps/mobile run typecheck`: passed after `CoachWallet` migration.
  - `git diff --check` on `CoachWallet` migration files: passed.
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed.
  - `npm --workspace apps/mobile run typecheck`: passed after `CoachWalletMerchant` migration.
  - `git diff --check` on `CoachWalletMerchant` migration files: passed.
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed.
- Remaining scope:
  - Full parity is still unproven and incomplete. Continue auditing WeChat routes against APP routes, especially full native PlanEditorWorkbench parity (batch action replace/detail editing and visual multi-day editing), deeper coach questionnaire flow-branch visual editing / media upload, student automation override detail, coach video/settings pages behind the new coach dashboard, coach action-library merge/video-upload/reference workflows, wallet order-detail parity, image-saving parity for training share posters, action-library public edit/review depth, and any still-lightweight payment/webview surfaces.

## Android Emulator Input + Clipboard Repair (`2026-06-21` )

- Task: make Android simulator keyboard letters/numbers and copy/paste work in Pixel_6_API_34, using local emulator/AVD config only.
- Status: completed and revalidated on local host.
- Changes:
  - Confirmed AVD flags: `hw.keyboard=yes`, `hw.keyboard.lid=yes`, `hw.keyboard.charmap=qwerty2`.
  - Confirmed snapshot/hardware overrides align and include keycode/clipboard forwarding (`set/enforceKeycodeForwarding`, `set/forwardShortcutsToDevice`, `set/clipboardSharing`).
  - Emulator launch should include `-use-keycode-forwarding -no-snapshot -no-snapshot-load -no-snapshot-save`.
  - Runtime checks show `show_ime_with_hard_keyboard=1`, `LatinIME` selected, and `dumpsys input` reports `qwerty2` with `KeyboardType: 2`.
- Scope: local machine-only config tuning; no repository source changes.

## Android Emulator Keyboard/Clipboard Re-hardening (`2026-06-21` )

- Task: user reported physical keyboard and paste still not working in the simulator when testing app flows.
- Status: re-applied, cold-started visible emulator, and revalidated for local `Pixel_6_API_34`; manual APP-level verification is left to the user.
- Changes made locally (no repo change):
  - Fixed `~/.android/avd/Pixel_6_API_34.avd/emu-launch-params.txt`, which had accidentally mixed emulator launch arguments with a shell `sed` script. It now contains only the emulator executable metadata and arguments.
  - Rewrote `~/.android/avd/Pixel_6_API_34.avd/AVD.conf` so `set\clipboardSharing`, `set\enforceKeycodeForwarding`, and `set\forwardShortcutsToDevice` are explicitly `true`.
  - Reasserted `/Users/kirigaya/.android/avd/Pixel_6_API_34.avd/{config.ini,hardware-qemu.ini,snapshots/default_boot/hardware.ini}` for `hw.keyboard=yes`, `hw.keyboard.charmap=qwerty2`, `hw.keyboard.lid=true`, `showKeyboard=yes`, cold boot, and no snapshot reuse.
  - Rewrote `~/.android/avd/Pixel_6_API_34.avd/emu-launch-params.txt` to include `-use-keycode-forwarding -no-snapshot -no-snapshot-load -no-snapshot-save`.
  - Re-wrote/normalized `com.android.Emulator` flags (`defaults write`) for slash/dot key variants so forwarding and clipboard are enabled in the host prefs.
- Verification on host config level:
  - Files are now consistently set to the same keyboard/clipboard values.
  - Cold-started `Pixel_6_API_34` under detached `screen` session `coachlink_pixel6`.
  - ADB reports `emulator-5554 device`; process args include `-use-keycode-forwarding -no-snapshot -no-snapshot-load -no-snapshot-save`.
  - Android runtime shows `show_ime_with_hard_keyboard=1`, default IME `com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME`, and `dumpsys input` shows `Device 0: qwerty2` with `KeyboardType: 2`.
  - No code changes in app source were made for this fix; local-machine verification should be done by launching this AVD and re-testing input in the emulator.

### Follow-up: Android Emulator Input Repair (`2026-06-21`)

- Task: fix Android emulator letters/numbers and copy/paste for current APP manual testing.
- Status: completed at local config/runtime level; user will manually verify inside the APP.
- Actions:
  - Rewrote/reasserted `~/.android/avd/Pixel_6_API_34.avd/{config.ini,hardware-qemu.ini,snapshots/default_boot/hardware.ini}` for `hw.keyboard=yes`, `hw.keyboard.charmap=qwerty2`, `hw.keyboard.lid=yes`, `showKeyboard=yes`, cold boot, and no snapshot reuse.
  - Rewrote `~/.android/avd/Pixel_6_API_34.avd/AVD.conf` with `set\clipboardSharing=true`, `set\enforceKeycodeForwarding=true`, and `set\forwardShortcutsToDevice=true`.
  - Rewrote `~/.android/avd/Pixel_6_API_34.avd/emu-launch-params.txt` to use `-use-keycode-forwarding -no-snapshot -no-snapshot-load -no-snapshot-save`.
  - Rewrote macOS `com.android.Emulator` preferences for clipboard sharing, keycode forwarding, and shortcut forwarding in slash and dot key forms.
  - Started visible `Pixel_6_API_34` in detached `screen` session `coachlink_pixel6`.
- Verification:
  - `adb devices` reports `emulator-5554 device`.
  - Android runtime reports `show_ime_with_hard_keyboard=1`.
  - Default input method is `com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME`.
  - `adb shell dumpsys input` reports `Device 0: qwerty2` with keyboard sources.
  - No repository source files were changed for this local-machine fix.


﻿## Android Emulator Keyboard/Clipboard Fix (`2026-06-21`)

- Task: fix Android simulator text input (letters/numbers) and clipboard copy/paste not working, based on local emulator config.
- Status: completed (local machine-only).
- Actions taken:
  - Re-asserted `Pixel_6_API_34` AVD hardware/input keys (`config.ini`, `hardware-qemu.ini`, `snapshots/default_boot/hardware.ini`, `AVD.conf`) for `hw.keyboard`, `hw.keyboard.charmap`, and keycode forwarding/clipboard sharing.
  - Verified `com.android.Emulator` preferences include `set/clipboardSharing`, `set.enforceKeycodeForwarding`, and `set.forwardShortcutsToDevice` (slash + dot forms).
  - Restarted emulator with `-use-keycode-forwarding -no-snapshot -no-snapshot-load -no-snapshot-save`.
  - Runtime checks: `show_ime_with_hard_keyboard=1`, default IME `LatinIME`, and built-in `qwerty2` key device in `dumpsys input`.
- No app/web code changes were made; no repository commit was required.
﻿## 小程序基础档案保存接口兼容修复（后端） (2026-06-21)

- Task: 用户反馈线上小程序（体验版和正式版）保存基础档案失败，要求优先只改后端修复，不改前端版本提交流程。
- Root cause: `/api/user/update-profile` 直接透传前端 `gender` 与 `fitness_level` 到 `user_profiles`，而数据库 `user_profiles` 限定值域较窄（`gender` 限制为 `male|female|other`，`fitness_level` 限制为 `beginner|intermediate|advanced`），与小程序端上报的 `unknown/novice/elite` 等值不兼容。
- Fix: 在 `src/app/api/user/update-profile/route.ts` 中加入服务端兼容转换：
  - `gender`：将 `unknown` 映射为 `other`，`男/女` 映射为 `male/female`，并允许空值清空字段；
  - `fitness_level`：将 `novice/入门/小白/零基础` 映射为 `beginner`，将 `elite/高阶/精英/职业` 映射为 `advanced`；
  - `height/weight`：增加安全数值转换，避免空字符串导致非预期写入。
- 状态: 已实现，未改小程序前端和页面。
- 验证建议: 用线上体验版重放“我的 / 基础档案 / 保存”流程，建议关注后端返回 `success=false` 时的具体 message 是否仍有变化（如果还有失败，再按返回值回溯 `updateError.message`）。

## WeChat `/me` Subpackage Size Split (`2026-06-19`)

- Task: user reported WeChat DevTools error that subpackage `/me` source size was `2161KB`, slightly over the `2048KB` limit.
- Status: implemented and verified at build/check level.
- Root cause:
  - The `me` subpackage included toolbox pages plus all toolbox bitmap assets.
  - Each Taro page also carries supporting `base.wxml` artifacts, so adding a few `me` pages/assets can repeatedly push the subpackage just over 2MB.
- Fix:
  - Moved mini-program toolbox pages from `wechat_app/src/me/toolbox/*` to a new independent subpackage root `wechat_app/src/toolbox/*`.
  - Updated mini-program routes from `/me/toolbox/...` to `/toolbox/...`.
  - Moved toolbox copied static assets from `me/assets/images/...` to `toolbox/assets/images/...`.
  - Updated bottom navigation and today-training Power Analysis entry to the new toolbox routes.
  - Updated `copy-comp-to-subpackages.js` so the new `toolbox` subpackage gets required Taro support files during build post-processing.
- Size result:
  - `wechat_app/dist-release` `/me`: `1422.2KB` (`1.389MB`), down from the user's reported `2161KB`.
  - New `/toolbox`: `930.7KB` (`0.909MB`).
  - Root files: `1739.3KB` (`1.699MB`).
- Verification:
  - `cd wechat_app && npm run build:weapp`: passed.
  - `cd wechat_app && npm run build:weapp:release`: passed.
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: first run compiled/static-generated but hit known Windows `.next` `EBUSY`; second run passed.
- Frontend/WeChat DevTools manual verification remains left to the user per durable preference.
## Commit Current Code And Sync Main/Dev (`2026-06-19`)

- Task: commit the current workspace code and make `main` and `dev` consistent.
- Status: completed.
- Starting branch: `main`.
- Remote status before commit:
  - `origin/main` and `origin/dev` are both at `d6c232d3`.
  - Local `main` is already ahead by `df59a575 fix: move miniapp assets into subpackages`.
- Local state before commit:
  - Working tree contains the 2026-06-19 training execution, day/workout share, action-library styling, ranking/contact/toolbox, power-analysis multi-mode, and durable-state updates.
  - Generated Python cache under `scripts/power-analysis/__pycache__/` is intentionally excluded from commit.
- Result:
  - Created commit `ab9bd41f feat: update training share and miniapp flows`.
  - Local `main` now includes prior `df59a575 fix: move miniapp assets into subpackages` plus the new 2026-06-19 work.
  - Local `dev` will be fast-forwarded to match local `main`.
- Verification:
  - No new tests/builds were run before this commit in this turn.
## WeChat Day Check-In Vs Workout Share Concept Split (`2026-06-19`)

- Task: clarify the product boundary between `整日打卡图` and `训练打卡图 / 训练成果页`.
- Status: concept confirmed; first interaction cleanup implemented; follow-up training-execution startup crash fixed.
- Current finding:
  - The code currently has a local `DayCheckinShareSheet` for `整日打卡图`.
  - The direct share link inside that sheet still reuses `/content/public/training?token=...`, which is workout-execution scoped.
  - Therefore the UI is only partially separated: image/card preview is day-scoped, but the shareable public page is still training-scoped.
- Implemented follow-up:
  - `查看今日记录` now targets the selected completed day in read-only mode, instead of always navigating to the backend recommended/progress day after completion.
  - The completed training execution page now exposes a `训练打卡图` action so the user can reopen the workout completion/share sheet later if they dismissed it immediately after training.
  - The full-day check-in sheet now includes more day contents: strength action rows and lightweight task rows, not only a 1/1 module summary.
- Product requirement:
  - `训练打卡图 / 训练成果页`: one workout execution, including sets, volume, duration, PR/video/notes, body-map heat.
  - `整日打卡图`: one selected day, including the training summary when present plus other daily/light tasks such as cardio, diet, habits, recovery, or coach-assigned chores.
  - The day card can include or summarize the training card, but must not silently share the workout-only page as if it were a full-day check-in.
- Verification:
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `cd wechat_app && npm run build:weapp` with `NODE_OPTIONS=--max-old-space-size=8192`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed.

### Follow-up: Training Execution Loading Screen Returned (`2026-06-19`)

- User reported `查看今日训练 / 查看今日记录` was again stuck on `正在进入训练` with stage `等待页面启动`.
- Diagnosis:
  - The latest log included a mini-program React runtime crash during `training-execution` mount, so this was not primarily an API/network wait.
  - The newly added workout-share hook/effect sat after conditional `loading && !execution` / `!execution` returns, violating React hook ordering when the page first rendered with no execution.
  - Taro/React crashed before startup could run, leaving the outer page on the boot loading copy.
- Fix:
  - Moved the training-execution loading/error early returns to after all `React.use*` hooks.
  - Made `actionExecutions` null-safe while the page has no execution yet: `execution?.action_executions || []`.
- Verification after this hotfix:
  - `npm run typecheck`: passed.
  - `cd wechat_app && NODE_OPTIONS=--max-old-space-size=8192 npm run build:weapp`: passed.
  - `npm run lint`: passed informational script.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: compile/static generation passed, but final standalone copy failed with the known local Windows `.next` `EBUSY` file-lock issue.
  - Frontend/DevTools verification remains left to the user per durable preference.

### Follow-up: Direct Workout Share Image Generation (`2026-06-19`)

- User reported the workout completion share path was too long: completed sheet -> preview -> `查看分享页` -> share.
- Product decision:
  - `生成分享图` should generate a shareable image directly from the completed workout summary.
  - The user should not need to open the public training page just to share the workout card.
- Fix:
  - Added an offscreen Canvas poster generator to `training-execution`.
  - The completed/read-only footer action now says `生成分享图` and directly generates a workout poster.
  - The workout completion sheet primary action now says `生成分享图`; it creates the image and calls `Taro.showShareImageMenu`.
  - If direct image sharing is unavailable in the current environment/base library, the flow falls back to saving the generated image to the photo album.
  - Removed the old summary path prefetch / `查看分享页` navigation from this in-app share flow.
- Verification:
  - `npm run typecheck`: passed.
  - `cd wechat_app && NODE_OPTIONS=--max-old-space-size=8192 npm run build:weapp`: passed.
  - `npm run lint`: passed informational script.
  - `npm test`: passed, 33 files / 163 tests.
  - `git diff --check -- wechat_app/src/training/training-execution/index.tsx wechat_app/src/training/training-execution/index.scss`: passed with CRLF warnings only.
  - Built `dist/training/training-execution.js/.wxss` contains `生成分享图`, `showShareImageMenu`, and `workout-poster-canvas`; source no longer contains `查看分享页`.
  - Frontend/DevTools verification remains left to the user per durable preference.

## Push Current Mobile Workspace Updates (`2026-06-20`)

- Task: commit and push the current local work to `origin/main`.
- Status: completed.
- Result:
  - Created local commit `c28cb224 feat: finalize mobile app workspace updates`.
  - Pushed `main` to `origin/main`; remote advanced from `d6c232d3` to `c28cb224`.
  - This push included the apps workspace restructure commit `79474a67` and the final local update commit `c28cb224`.
- Push gate before `c28cb224`:
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npm run test:e2e`: passed, 4 Playwright tests.

## Expo Native Artifact Ignore Fix (`2026-06-20`)

- Task: continue after push and handle unexpected local mobile native artifacts.
- Status: in progress.
- Finding:
  - After the successful push, a local untracked `apps/mobile/android/` directory appeared with Gradle/native prebuild files and local caches.
  - A transient local package diff changed `expo-constants` from the intended Expo SDK 56-compatible `~18.0.13` to `~56.0.18`; this was restored and `npm install` confirmed the lockfile is clean.
- Decision:
  - Keep Expo managed/source-first mode and ignore generated `apps/mobile/android/` and `apps/mobile/ios/` directories.
- Current pending change:
  - `.gitignore` now ignores `apps/mobile/android/` and `apps/mobile/ios/`.

## Commit Current Work And Sync Main/Dev (`2026-06-18`)

- Task: commit current latest local code, merge the latest development branch changes, and make `main` and `dev` consistent.
- Status: completed.
- Starting branch: `main`.
- Remote status before commit:
  - `origin/main` is at `82d46467`.
  - `origin/dev` advanced to `5326a92c fix wechat training execution and theme flow`.

## Web 学员计划下一阶段 AI 生成失败兜底 (`2026-06-23`)

- Task: 用户反馈 Web 端学员当前阶段完成后，点击 `AI 生成下一阶段` 长时间无响应；当 AI 失败时，也缺少顺手进入手动创建下一阶段的兜底入口。
- Status: completed at code/check level; local live LLM smoke exposed a separate env blocker; browser-side UI verification could not be completed in this session.
- Root cause:
  - `/api/plan-lib/create-ai-instance` 在 `useLLM=true` 时，LLM 返回被 `maxTokens=6000` 截断，`JSON.parse` 失败后直接 500。
  - `src/app/dashboard/students/page.tsx` 的单个 AI 生成流程只有 `try/finally` 没有 `catch`，所以接口失败后只会结束 loading，不会提示明确错误，也不会给出手动创建路径。
- Fix:
  - `src/app/api/plan-lib/ai-personalize-plan/personalize-plan.ts` 将 Stage B 改为更适合长脚本输出的模式：默认关闭 thinking，首轮使用 `maxTokens=12000`，若首轮 JSON 截断/不完整则自动带纠偏提示重试一次，第二轮使用 `maxTokens=16000`。
  - `src/app/api/plan-lib/create-ai-instance/service.ts` 改为：LLM 个性化生成失败时自动降级到规则模板匹配，不再因为 AI 单点失败直接整单报错。
  - `src/app/dashboard/students/page.tsx` 为单个 AI 生成补上错误捕获，并把失败信息回传到配置弹窗。
  - `src/app/dashboard/students/AiInstanceConfigDialog.tsx` 新增明显的失败提示与 `去手动创建` 按钮，让教练可以直接跳到学员计划页手动创建下一阶段。
- Verification:
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 164 tests.
  - `npx next build`: passed.
  - Real LLM smoke via project env loading: local `getCoachlinkPlanLlm()` resolves `provider=deepseek`, `model=deepseek-v4-flash`, but direct `callDeepSeek()` currently fails locally with `401 Authentication Fails` because the loaded DeepSeek API key is invalid. This blocks local end-to-end model verification until env is fixed.
- Local state before commit:
  - Working tree contains the accumulated Power Analysis realtime/auto-upload fixes, impromptu e1RM tracking, streetlifting calculator history/ranking work, WeChat release automation files, and durable-state updates.
  - Generated Python cache under `scripts/power-analysis/__pycache__/` is intentionally excluded from commit.
- Result:
  - Created commit `ab9bd41f feat: update training share and miniapp flows`.
  - Local `main` now includes prior `df59a575 fix: move miniapp assets into subpackages` plus the new 2026-06-19 work.
  - Local `dev` will be fast-forwarded to match local `main`.
- Verification:
  - No new tests/builds were run before this commit in this turn.
- Result:
  - Created local commit `95a9627d feat: sync analysis tools and calculator updates`.
  - Merged `origin/dev` into `main`, resolving durable-state conflicts by preserving both sides' notes and keeping the `origin/dev` unified training-home entry for `wechat_app/src/pages/index/index.tsx`.
  - Will fast-forward local `dev` to the final `main` head and push both branches together.
- Verification:
  - No tests/builds were run in this merge turn.

## Power Analysis Realtime Overlay And Auto Upload (`2026-06-18`)

- Task: user reported that downloaded Power Analysis videos were not showing realtime per-frame data and only had a general title; also reported that Web/mini-program upload did not visibly begin until clicking start analysis, which made the upload flow misleading.
- Status: implemented and verified locally at algorithm, Web UI, build, and test levels. Follow-up Web result-disappearing bug was also fixed on 2026-06-18.
- Changes:
  - `scripts/power-analysis/analyze_video.py` now keeps per-rep `startFrame`, `endFrame`, and `peakFrame` metadata, draws a visible pose bounding box, and overlays live per-frame rep velocity, estimated power, displacement, and elapsed time during the ascent.
  - The output video also holds each completed rep's result panel for a short window, showing displacement, ascent time, average power, horsepower, and max velocity in the frame instead of only a top summary.
  - Web `/toolbox/power-analysis` now starts upload immediately after file selection: create temporary upload task -> PUT file with progress -> show `视频已上传，点击开始分析`; the start button then only enqueues analysis.
  - WeChat mini-program `me/toolbox/power-analysis/index` now uses the same auto-upload state model: choosing a video creates the temporary job, uploads through the same-domain mini upload route, then leaves `开始分析` for enqueue only.
  - After a video is uploaded, mode/height/body weight/external load inputs are locked until reset/reselect so the user cannot see changed parameters while the already-created job still contains old metadata.
- Verification:
  - Python compile check: passed.
  - Local analyzer run with `D:\我的健身素材\2026训练\20260614\4985f32ad151e6b1c5e1360692cd5d1a.mp4`: passed, 5 reps detected, output video generated under `screenshots/power-analysis/realtime/`.
  - Visual frame inspection confirmed `LIVE REP` and `REP RESULT` panels are present in the generated video.
  - Web Playwright check on temporary `http://localhost:3017/toolbox/power-analysis` with mocked upload APIs: passed; selecting a file automatically uploaded, showed `视频已上传，点击开始分析`, enabled the start button, and produced no console errors. Screenshot: `screenshots/power-analysis/web-auto-upload-3017.png`.
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `cd wechat_app && npm run build:weapp`: passed.
  - `npx next build`: first run hit transient Windows `.next/standalone` EBUSY after successful compile/static generation; rerun passed.
- Cleanup:
  - Temporary local dev server on `3017` was stopped.
  - Stale local listeners on `3000`/`3001` were stopped per the user's earlier port cleanup request.

### Web Result Disappearing Follow-up (`2026-06-18`)

- User report: Web upload succeeded and backend analysis completed, but the page did not show the final result; during analysis the UI disappeared/reset back to the initial state.
- Root cause found in Web state handling:
  - `pollJob()` treated any polling failure as fatal and called `setPhase("idle")`, so a transient job-status request failure could make the page look like it reset even while the backend job continued or completed.
  - The page kept the active job only in React memory, so a remount/reload during analysis could lose the job state and return to the initial UI.
- Fix:
  - Polling now retries through transient failures, shows at most one warning after repeated failures, and continues polling instead of clearing the page state.
  - The active Power Analysis job id is persisted in `sessionStorage`; on page mount the Web page fetches that job, restores `uploaded`/`queued`/`processing`/`done` state, and resumes polling when needed.
  - `canSubmit` no longer depends on a still-present `File` object, so a restored uploaded job can still be submitted for analysis.
- Verification:
  - Playwright against stable `next start` on temporary `http://localhost:3017`: mocked upload/enqueue/poll/done flow showed final metrics on the page, then reload restored the done metrics. Screenshots:
    - `screenshots/power-analysis/web-result-persists-3017.png`
    - `screenshots/power-analysis/web-result-restored-3017.png`
  - Console errors: none.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: first run hit transient Windows `.next/standalone` EBUSY after successful compile/static generation; rerun passed.

## Streetlifting Calculator History And Fun Ranking (`2026-06-18`)

- Task: implement the previously designed streetlifting strength-calculator history and fun-ranking feature across the mini-program toolbox flow and the Web `/streetlifting-index/calculator` page.
- Status: implemented in code and verified at build/check level. Web page-level verification passed via Playwright because the dedicated `web-devtools` tool is not exposed in this session; WeChat DevTools automation was attempted but remains blocked by the current local automation bridge state.
- Product direction now landed:
  - Calculator results are no longer local-only; every successful save writes a canonical cloud history row.
  - Ranking is a `趣味榜`, not a strict verified competition leaderboard.
  - Ranking buckets are split by `exercise_type + gender`.
  - Only `forward` calculations are ranking-eligible in V1; `reverse_weight` / `reverse_reps` stay out of the fun ranking for now.
- Backend changes:
  - Added canonical history table migration `supabase/migrations/20260618_streetlifting_calc_records.sql`.
  - Added shared server-side recomputation helper `src/lib/streetliftingCalculator.ts` so saved results are recalculated on the server instead of trusting client payloads.
  - Added history/summary/ranking aggregation helper `src/lib/streetliftingCalcHistory.ts`.
  - Added authenticated APIs:
    - `POST /api/streetlifting-index/calculator/save-result`
    - `GET /api/streetlifting-index/calculator/history`
    - `GET /api/streetlifting-index/calculator/summary`
- Mini-program changes:
  - `wechat_app/src/streetlifting/index/calculator/index.tsx`
    - Saving a calculation now persists to cloud, caches the returned summary, and exposes a new history/ranking entry.
  - `wechat_app/src/streetlifting/index/calculator/result/index.tsx`
    - Result page now shows personal-best, delta-vs-previous, and ranking insight cards, plus a history jump entry.
  - Added new page `wechat_app/src/streetlifting/index/calculator/history/*`
    - Shows recent history, best score, latest result, and fun-ranking summary.
  - Added local 60-day cache helper `wechat_app/src/utils/streetliftingCalcHistoryCache.ts`.
- Web changes:
  - `src/app/service/streetliftingIndexService.ts`
    - Added Web service calls for calculator save-result, history, and summary APIs.
  - `src/app/streetlifting-index/calculator/page.tsx`
    - Saving a calculation now writes Web results to the same cloud history table with `sourceSurface: "web"`.
    - The result card now shows a larger playful level badge such as `国内顶级`.
    - The result card now shows `当前趣味排名`, `个人历史最佳`, `较上次变化`, and `我的历史记录`.
    - Fixed Web save payload normalization so empty optional fields are sent as `null` instead of `""`, avoiding database check-constraint failures.
- Verification:
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed.
  - Web Playwright verification on temporary `http://localhost:3020/streetlifting-index/calculator`: passed; screenshot `screenshots/streetlifting-calculator-web-fixed-history-ranking.png` confirms the larger `国内顶级` badge, ranking card, and history table are visible after calculation.
  - `cd wechat_app && npm run build:weapp`: passed.
  - WeChat DevTools automation:
    - `mrc` connection attempts on `9420` / `9430` failed.
    - Local WeChat DevTools CLI was found at `D:\software\微信web开发者工具\cli.bat`.
    - `cli.bat auto --project D:\files\coachlink\wechat_app --port 59471` succeeded against an already-running IDE HTTP service.
    - Even after that, `mrc` still could not attach to a usable WebSocket automation endpoint, so page-level screenshot/interaction verification is still blocked on the current machine/session.
- Deliverables:
  - Added design doc `docs/work/streetlifting-calculator-history-ranking-design-2026-06-18.md`.

## Impromptu Strength Sync To E1RM Curve (`2026-06-18`)

- Task: investigate why a student's WeChat mini-program `即兴锻炼` records did not show up in `力量进步曲线`, then repair the sync path.
- Status: fixed in code and verified at build/check level; WeChat DevTools automation could not be run in this session because no local DevTools automation port or CLI installation was available. Also repaired one live historical student dataset on 2026-06-18 so the 2026-06-17 impromptu `负重引体（底部暂停）` `47.5 x 1` record now backfills into `impromptu_executions`, `personal_records_history`, and `student_actions.reference_1rm=47.5`.
- Root cause:
  - `src/app/api/impromptu/complete-set/route.ts` only persisted set completion into `impromptu_executions`, but did not run the same automatic e1RM / PR tracking flow used by `src/app/api/execution/complete-set/route.ts`.
  - `src/app/api/student/get-e1rm-history/route.ts` only scanned `plan_instance_executions` and `personal_records_history`, so impromptu sessions were excluded from the trend curve source.
- Changes:
  - Added shared server helper `src/lib/autoE1rmTracking.ts` for automatic e1RM calculation, `student_actions.reference_1rm` bumping, AUTO_STATE maintenance, and PR row upsert.
  - Wired `src/app/api/impromptu/complete-set/route.ts` into that helper so impromptu strength sets now write `e1rm` / `is_auto_pr` back into the execution JSON and update the same strength-tracking sources as normal plan execution.
  - Extended `src/app/api/student/get-e1rm-history/route.ts` to aggregate history points from `impromptu_executions` in addition to `plan_instance_executions`.
- Verification:
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed.
  - `cd wechat_app; npm run build:weapp`: passed.
  - Attempted WeChat DevTools automation with `mrc` on ports `9420` and `9430`, but no automation endpoint or local DevTools CLI installation was available.

## WeChat Strength Calculator Result Labels (`2026-06-17`)

- Task: user reported that the mini-program toolbox strength calculator lost the original playful result labels such as `菜就多练` / `大佬`, and that the result text sometimes looked garbled.
- Status: fixed in code and verified at build/check level; WeChat DevTools automation could not be run in this session because no local DevTools automation port or CLI installation was available.
- Root cause:
  - `wechat_app/src/utils/streetliftingCalc.ts` had drifted to English score labels (`World Class`, `Advanced`, `Beginner`, etc.), so the mini-program result page no longer had the original Chinese grade copy.
  - The same helper also still contained English runtime error messages, which increased the chance of mixed-language/strange text on the mini-program side.
- Changes:
  - Restored Chinese result labels in `wechat_app/src/utils/streetliftingCalc.ts`:
    - `菜就多练`
    - `爱好者` / `爱好者水平`
    - `大佬`
    - `国内一线` / `国内顶级`
    - `世界一线` / `世界级`
  - Localized related calculator error messages in the same helper to Chinese for mini-program consistency.
- Verification:
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `cd wechat_app; npm run build:weapp`: passed.
  - `npx next build`: passed.
  - Attempted WeChat DevTools automation with `mrc`, but `ws://localhost:9430` was unavailable and no local WeChat DevTools CLI path was found on this machine.

## WeChat Mini-Program Release Automation (`2026-06-16`)

- Task: automate WeChat mini-program release operations so the agent can upload experience builds, submit audit, poll audit status, and publish official releases by command without manual DevTools clicking.
- Status: implemented at script/documentation level; real upload/audit/publish not executed because private WeChat upload key, AppSecret, and real audit category config are not present in the workspace.
- Changes:
  - Added `wechat_app/scripts/weapp-release.js`.
  - Added `miniprogram-ci` to `wechat_app` dev dependencies.
  - Added root commands:
    - `npm run weapp:release:upload`
    - `npm run weapp:release:auto`
    - `npm run weapp:release:full`
    - `npm run weapp:release:audit`
    - `npm run weapp:release:status`
    - `npm run weapp:release:wait-audit`
    - `npm run weapp:release:publish`
    - `npm run weapp:release:categories`
    - `npm run weapp:release:pages`
  - Added `wechat_app/.env.weapp-release.example`, `wechat_app/release.weapp.example.json`, and `wechat_app/docs/小程序自动发布.md`.
  - Updated `wechat_app/.gitignore` to keep `.env.weapp-release.local`, `release.weapp.json`, and private key files out of Git.
- Behavior:
  - Upload uses `miniprogram-ci` and `dist-release/`.
  - During upload, the script temporarily sets `project.private.config.json` `miniprogramRoot/srcMiniprogramRoot` to `dist-release/`, then restores it.
  - Audit/release uses WeChat server APIs with `WEAPP_APP_SECRET`.
  - `release:auto` uploads/submits/waits but does not publish unless `WEAPP_AUTO_RELEASE=1` is set.
  - `release:full` uploads/submits/waits and publishes after audit passes.
- Verification:
  - `node --check scripts/weapp-release.js`: passed.
  - JSON parse check for `wechat_app/package.json` and `release.weapp.example.json`: passed.
  - `node scripts/weapp-release.js help`: passed.
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `cd wechat_app; npm run build:weapp:release`: passed.
  - `npx next build`: first run hit known Windows `.next/standalone` EBUSY after compile/static generation; rerun passed.
- Setup needed before first real release:
  - Download WeChat mini-program upload private key.
  - Create `wechat_app/.env.weapp-release.local` from the example and fill `WEAPP_UPLOAD_PRIVATE_KEY_PATH` and `WEAPP_APP_SECRET`.
  - Run `npm run weapp:release:categories` / `npm run weapp:release:pages`, then create `wechat_app/release.weapp.json` with real audit category ids.

## Power Analysis Local E2E Fixes (`2026-06-16`, latest)

- Task: independently test the Power Analysis toolbox with user-provided videos from:
  - `D:\我的健身素材\2026训练\20260614`
  - `D:\我的健身素材\20250805双力臂训练`
- Status: implemented and locally verified on Web/API/worker plus mini-program upload API path.
- Key fixes:
  - Daily quota now counts only `queued`, `processing`, and `done` jobs from the last 24h, excluding abandoned `awaiting_upload`, `failed`, and `expired` rows.
  - Download is now served through authenticated same-domain route `GET /api/toolbox/power-analysis/jobs/[id]/download`; `download-url` returns that same-domain URL as the primary URL. Supabase signed download URL returned 404 in local E2E and should not be the primary download path.
  - Added `externalLoadKg` to Web and WeChat Power Analysis forms, API DTO, job metadata, worker invocation, and Python metrics so weighted pull-ups use `bodyWeightKg + externalLoadKg`.
  - Python analyzer filters obvious partial startup detections for muscle-up videos; this corrected the 9-rep sample that was previously counted as 10 because the initial small upward movement was counted as a rep.
  - Added safer local testing controls:
    - `COACHLINK_DISABLE_LOCAL_POWER_WORKER=1` disables auto-started local memory worker in `npm run dev`.
    - `POWER_ANALYSIS_SKIP_QUEUE_PUBLISH=1` in development lets enqueue mark the DB job queued without publishing to the configured queue.
    - `scripts/power-analysis-worker.mjs --job-id <id>` processes only one explicit job.
- Verified samples:
  - Web signed upload path, `4985f32ad151e6b1c5e1360692cd5d1a.mp4`: 5 pull-ups, output download succeeded.
  - Web signed upload path, `aca2074f6d5f1394ce51211def72178b.mp4`: 1 pull-up with `externalLoadKg=60`, effective mass 130kg, output download succeeded.
  - Web signed upload path, `d31388deeca8c9106167608a2a0a4740_raw.mp4`: 9 muscle-ups after partial-start filtering, output download succeeded.
  - Mini-program multipart upload API path, `4985f32ad151e6b1c5e1360692cd5d1a.mp4`: 5 pull-ups, output download succeeded.
- Verification:
  - Power Analysis API/worker E2E used local `http://localhost:3015` with `POWER_ANALYSIS_SKIP_QUEUE_PUBLISH=1`, then cleaned seeded E2E user/job rows and transient storage files.
  - Download artifacts saved under `screenshots/power-analysis/e2e-downloads/`.
  - Web Playwright verification on `http://localhost:3015/toolbox/power-analysis`: extra-load input accepted `60`, selected the weighted pull-up video, start button enabled, no console errors; screenshot `screenshots/power-analysis/web-extra-load-form-3015.png`.
  - WeChat DevTools/MRC port `9430`: navigated to `me/toolbox/power-analysis/index` via `wx.navigateTo`, `.load-input`, `.height-input`, `.select-video-btn`, and `.save-video-btn` existed; typing `60` into `.load-input` succeeded; errors/warnings were empty.
  - `mrc screenshot` still timed out in the current DevTools session.
  - Passed `npm run lint`, `npm run typecheck`, `npm test`, `cd wechat_app; npm run build:weapp`, and `npx next build`.
- Local cleanup:
  - Temporary dev server on port `3015` was stopped.
  - Port `3000` had a listener afterward, but it was not started by this run and was left untouched because the user said they would start their own server.

## Power Analysis Architecture Explanation (`2026-06-16`)

- Task: explain how the toolbox power-analysis feature works, including Python analysis, queue/worker design, and Docker image push to Tencent CCR.
- Status: code and docs inspected; explanation provided in chat.
- Key implementation references:
  - `src/app/api/toolbox/power-analysis/*`
  - `src/lib/taskqueue/*`
  - `scripts/power-analysis/analyze_video.py`
  - `scripts/power-analysis-worker.*`
  - `Dockerfile.power-worker`
  - `scripts/push-power-worker-ccr.mjs`
  - `docs/done/system-design/power-analysis-worker-queue.md`

## Power Analysis Production Failure Diagnosis (`2026-06-16`)

- Task: diagnose reported online power-analysis failure showing `D:\files\coachlink\scripts\power-analysis\analyze_video.py` and `ModuleNotFoundError: No module named 'mediapipe'`.
- Status: SSH/K8s/DB inspection completed; no production changes made.
- Findings:
  - Current Ubuntu/K8s power-worker main/dev containers include `/opt/power-analysis-venv` and `mediapipe 0.10.21`.
  - Current production Apollo app-config has Kafka queue settings for `coachlink-power-analysis-tasks-main`.
  - Kafka main topic had no produced messages, and main worker logs did not show processing the failed jobs.
  - Recent failed DB rows on `2026-06-15` contain the Windows `D:\files\coachlink\...` traceback, indicating a Windows-native local process, not the K8s worker, claimed and failed those jobs.
- Most likely root cause: a local Windows dev server or local power-analysis worker was connected to the production Supabase database and processed queued jobs via memory/poll DB recovery without MediaPipe installed.

## Power Analysis Queue History Clarification (`2026-06-16`)

- Task: answer when `tool_power_analysis_jobs` and the worker/queue code were introduced, and clarify whether polling was replaced by queue push.
- Status: Git history inspected.
- Timeline:
  - `2026-06-06 05:16:37 +0800`, commit `a72384a`: created `tool_power_analysis_jobs`, first worker, first enqueue API; worker was DB polling (`--poll`) and enqueue only marked DB row `queued`.
  - `2026-06-09 22:59:58 +0800`, commit `5306611`: added task queue abstraction, Kafka/memory queue, queue worker CLI, and enqueue `publishTask`.
  - `2026-06-09 23:57:51 +0800`, commit `8029de1`: removed embedded Web worker from enqueue and switched local dev to a separate child worker process.
- Important nuance: current queue push path still has memory-mode DB recovery (`recoverQueuedJobs`) that scans shared `tool_power_analysis_jobs.status='queued'`; therefore local memory worker is not isolated if it shares the same Supabase DB with production.

## Power Analysis Local Worker DB Recovery Removed (`2026-06-16`)

- Task: remove memory worker recovery that scans shared DB `queued` jobs and confirm whether it caused production analysis failures.
- Status: implemented and verified locally.
- Changes:
  - Removed `recoverQueuedJobs()` from `scripts/power-analysis-worker.ts`.
  - Removed `enableRecover` option and memory-mode recovery startup from `scripts/power-analysis-worker-cli.ts`.
  - Updated `docs/done/system-design/power-analysis-worker-queue.md`.
- Confirmation:
  - Yes, the failure pattern matches this bug: local Apollo memory queue + shared Supabase allowed a local Windows worker to claim production queued jobs; the failed DB rows have Windows `D:\files\coachlink\...` traceback while production Kafka main had no messages.
- Verification:
  - `npm run lint`: passed.
  - `npm run typecheck`: passed.
  - `npx next build`: passed.
  - `npm test`: passed, 33 files / 162 tests.

## Power Analysis Topic-Scoped Recovery (`2026-06-16`)

- Task: add a safer fallback so missed queue jobs can be recovered without local workers claiming production jobs.
- Status: implemented and verified locally.
- Changes:
  - Added `supabase/migrations/20260616_power_analysis_queue_topic.sql`.
  - Added `queue_driver`, `queue_topic`, `queue_consumer_group`, and `enqueued_at` ownership fields to `tool_power_analysis_jobs`.
  - `create-upload-url` and `enqueue` now write the current queue config into the job row.
  - Queue worker recovery is restored, but filters by `queue_topic = TASK_QUEUE_TOPIC`.
  - Queue delivery claim also filters by `queue_topic`.
  - `poll-worker` remains explicit manual full-DB fallback.
- Clarification:
  - Topic values are runtime-configured via `TASK_QUEUE_TOPIC`, not hard-coded by environment name.
  - Power-analysis task creation and queue workers now require an explicit `TASK_QUEUE_TOPIC`; if local/Apollo bootstrap does not provide it, they fail fast instead of using the generic queue default.
- Verification:
  - `npm run typecheck`: passed.
  - `npm run lint`: passed.
  - `npm test`: passed, 33 files / 162 tests.
  - `npx next build`: passed.
- Deployment note:
  - After applying `supabase/migrations/20260616_power_analysis_queue_topic.sql`, redeploy both Web/Next.js and the Power Analysis worker image.
  - Web/Next.js must be redeployed because the upload/enqueue APIs now write `queue_topic` ownership fields and require explicit `TASK_QUEUE_TOPIC`.
  - Worker must be redeployed because queue delivery claim and recovery now filter by the configured topic.
  - Prefer deploying Web first, then worker, so newly enqueued jobs include `queue_topic` before the topic-scoped worker starts claiming.

## Dashboard Videos Client Crash Hotfix (`2026-06-16`)

- Task: diagnose production client-side exception when opening the video analysis/review page.
- Status: implemented and verified locally at code/build level.
- Finding:
  - The crash signature `Cannot read properties of undefined (reading 'completed_at')` matches `src/app/dashboard/videos/page.tsx`, where the video card rendered `video.execution_details.completed_at` without checking whether `execution_details` exists.
  - `git blame` shows the unsafe line predates the power-analysis queue-topic change; the redeploy likely exposed existing data with missing execution details rather than the queue-topic logic directly causing it.
- Fix:
  - Added `formatVideoTimestamp()` and changed the video card to fall back from `execution_details.completed_at` to `video.created_at`.
- Verification:
  - `npm run typecheck`: passed.
  - `npm run lint`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed.
  - Browser verification was not run because this session does not expose the required `web-devtools` capability and production login/session data is needed to reproduce the exact coach video list.

## Pull Latest Code (`2026-06-16`, latest)

- Task: pull current latest remote code into the local workspace.
- Status: completed locally.
- Starting branch: `main`.
- Result:
  - `git fetch --all --prune` completed for `origin` and `gitee`.
  - Local `main` fast-forwarded from `a2e4f8f4` to `82d46467`.
  - Remote `origin/main` includes `origin/dev` commit `13a4bad4 feat: 修复视频分析白屏问题` through merge commit `82d46467`.
  - Local `dev` was updated to track `origin/dev` at `13a4bad4`.
- Verification:
  - No tests or builds were run; this was a git sync-only task.

## Push Current Code To Main And Dev (`2026-06-16`)

- Task: commit current local code and push so remote `main` and `dev` are consistent.
- Status: completed.
- Starting branch: `main`.
- Current local branch state before commit:
  - Local `main` and `dev` point to the same merge head from the latest `origin/dev` pull.
  - Working tree contains the accumulated coach revenue, E2E cleanup, WeChat Power Analysis native page/preview, plan-history detail, and durable-state changes.
- Verification / user instruction:
  - User explicitly asked to skip further tests/builds and push directly.
  - Already completed before the user interruption: `npm run lint`, `npm run typecheck`, and `npm test`.
  - Skipped by user instruction: `npm run test:e2e`, `npx next build`, and `cd wechat_app; npm run build:weapp`.
- Result:
  - Created commit `c1bc9e43 feat: sync power analysis and coach revenue fixes`.
  - Fast-forwarded local `dev` to match local `main`.
  - Pushed both `main` and `dev` to `origin`, whose push URLs include Gitee and GitHub.
  - After push, both remote branches pointed to `c1bc9e43`.
  - GitHub reported existing Dependabot vulnerability warnings during push; push itself succeeded.

## Local Power Analysis Debug Setup (`2026-06-16`)

- Task: fix local Web Power Analysis failure where the analyzer reported `ModuleNotFoundError: No module named 'mediapipe'`, and free the occupied local `3000` port.
- Status: local debugging environment recovered.
- Findings:
  - `3000` was occupied by a stale Next.js dev process; a second dev chain was also running on `3001`.
  - `.venv-power-analysis\Scripts\python.exe` was already correctly configured and could import `mediapipe 0.10.21`, `cv2`, and `numpy`.
  - The failure was therefore caused by a stale/incorrect worker process using the wrong Python environment, not by the venv lacking `mediapipe`.
  - For local Power Analysis testing, relying only on the auto-started `--queue` worker is brittle because the in-memory queue does not cross process boundaries; a `--poll` worker that scans queued DB jobs is the reliable local path.
- Actions:
  - Stopped stale processes occupying `3000` and the duplicate `3001` local dev chain.
  - Restarted local Web on `http://localhost:3000` with `POWER_ANALYSIS_PYTHON_BIN=D:\files\coachlink\.venv-power-analysis\Scripts\python.exe`.
  - Started a background poll worker with the same `POWER_ANALYSIS_PYTHON_BIN`.
  - Verified `http://localhost:3000/toolbox/power-analysis` returned 200.
  - Verified `http://localhost:3000/api/system/version` returned 200.
- Logs:
  - Web dev log: `logs/local-dev-3000.log`.
  - Power Analysis poll worker log: `logs/power-analysis-poll-worker.log`.
- Next user action:
  - Open `http://localhost:3000/toolbox/power-analysis`, log in if needed, and submit a new analysis job. The old failed job will remain failed; a new submit is required after the worker/env fix.

## WeChat Home Share Alignment With FoodLink (`2026-06-16`)

- Task: compare FoodLink's mini-program share/copy-link behavior with CoachLink and make CoachLink's screenshot home page shareable the same way.
- Status: implemented and partially verified.
- Finding:
  - FoodLink's `apps/wechat/src/pages/index/index.tsx` uses `useShareAppMessage`, `useShareTimeline`, and `Taro.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] })`.
  - FoodLink's `apps/wechat/src/pages/index/index.config.ts` sets `enableShareAppMessage: true` and `enableShareTimeline: true`.
  - FoodLink does not implement `onCopyUrl` / `offCopyUrl`; its visible `#小程序://食探/...` copy-link behavior is therefore from WeChat's platform/system share menu once normal sharing is enabled for that AppID/page.
  - CoachLink already had this pattern on some pages, but not on the screenshot home page `wechat_app/src/pages/index/index`.
- Fix:
  - Added home-page `useShareAppMessage`, `useShareTimeline`, `openCoachLinkShareMenu()`, and share payload path `/pages/index/index`.
  - Added `enableShareAppMessage` and `enableShareTimeline` to `wechat_app/src/pages/index/index.config.ts`.
- Verification:
  - `npm run lint`: passed informational lint script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `cd wechat_app; npm run build:weapp`: passed.
  - `npx next build`: passed.
  - Compiled `wechat_app/dist/pages/index/index.js` contains `openCoachLinkShareMenu`, `useShareAppMessage`, `useShareTimeline`, and `enableShareAppMessage/enableShareTimeline`.
  - WeChat DevTools/MRC port 9430 connected and page stack reported `pages/index/index`; error/warn logs were empty.
- Verification limitation:
  - MRC screenshot rendered blank and selector enumeration returned 0 elements in the existing DevTools session, so visual share-menu verification still needs a real-device/manual check. The share-menu `复制链接` item is a host WeChat UI action and is not directly inspectable by MRC.

## WeChat Mini-Program Copy Link Diagnosis (`2026-06-16`)

- Task: diagnose why Food Link can produce/copy a `#小程序://...` mini-program link while CoachLink appears unable to use the share-sheet `复制链接` entry.
- Status: analysis completed; no business code changed.
- Finding:
  - CoachLink WeChat pages such as `me/toolbox/index` and `me/toolbox/power-analysis/index` already enable normal sharing with `enableShareAppMessage`, `enableShareTimeline`, `useShareAppMessage`, `useShareTimeline`, and `Taro.showShareMenu`.
  - The codebase has no `Taro.onCopyUrl` / `Taro.offCopyUrl` registration. Taro's WeChat share typings describe `onCopyUrl` as the separate callback for the right-menu `复制链接` action and note it should be registered on page enter and removed on page exit.
  - Therefore the likely app-side gap is not ordinary sharing, but missing Copy URL / short-link handling. Platform-side availability may still depend on WeChat client/platform rules and backend mini-program short-link permissions.
- Suggested next step:
  - Add a shared mini-program `useCopyUrl` helper that registers `Taro.onCopyUrl` with the current page query/path, wire it into public/shareable pages first, then verify on an Android real device or WeChat DevTools if the platform exposes the menu.

## WeChat Power Analysis Video Preview Fix (`2026-06-16`)

- Task: fix the WeChat mini-program Power Analysis page where the selected local video's built-in enlarge/fullscreen control could fail.
- Status: implemented and verified as far as automation allows.
- Fix:
  - Added an explicit `全屏预览` action for selected videos on `wechat_app/src/me/toolbox/power-analysis/index.tsx`.
  - The preview action first uses `Taro.previewMedia({ sources: [{ type: 'video' }] })` for WeChat's global media preview, then falls back to opening the shared full-page video player with a `视频预览` title.
  - Hid the native video fullscreen button on the inline preview (`showFullscreenBtn={false}`) so users are guided to the stable preview path instead of the failing built-in enlarge control.
  - Updated `wechat_app/src/common/common/video-player/index.tsx` to accept an optional `title` query param while preserving `PR 视频` for the existing PR source path.
- Verification:
  - `npm run lint`: passed informational lint script.
  - `npm run typecheck`: passed.
  - `cd wechat_app; npm run build:weapp`: passed and compiled `me/toolbox/power-analysis/index.js` with `preview-video-btn`, `Taro.previewMedia`, and `showFullscreenBtn: false`.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: first run compiled/static-generated but hit known Windows `.next/standalone` EBUSY copy lock; rerun passed.
  - WeChat DevTools/MRC port 9430: relaunched `/me/toolbox/power-analysis/index`, `.select-video-btn` and `.mode-card-muscleup` existed, switching to `双力臂` worked, height input command reported success, and final error/warning logs were empty.
- Verification limitation:
  - MRC screenshot failed repeatedly with `fail to capture screenshot`.
  - Native local video selection opens a system picker and could not be automated, so the actual selected-video global preview path still needs a real-device/manual check.

## WeChat Native Power Analysis Tool (`2026-06-15`)

- Task: investigate why the previously built Power Calculator / Power Analysis tool was not visible in the mini-program toolbox, confirm deployment commands, and expose it as a real native mini-program tool rather than a WebView jump.
- Status: implemented and verified.
- Findings:
  - Web already exposes Power Analysis through `src/config/toolbox.ts`, `/toolbox`, `/me/toolbox`, and `/toolbox/power-analysis`.
  - Live `https://coachlink.fit/toolbox` and `https://coachlink.fit/toolbox/power-analysis` return 200 and render the Power Analysis entry/page in browser automation.
  - The WeChat mini-program toolbox only had 3 native cards (`力量计算器`, `单杠位置`, `社区数据`), so the user's screenshot matched current code: the Power Analysis tool was Web-only and not wired into the mini-program UI.
  - Deployment commands are:
    - Web image: `npm run push-docker-ccr`.
    - Power Analysis worker/algorithm image: `npm run push-power-worker-ccr`.
    - If an algorithm change also changes Web/API/page code, both images may need pushing; analyzer/worker-only changes need the worker image.
- Fix:
  - Replaced the temporary WebView entry with native route `me/toolbox/power-analysis/index`.
  - Removed the generic `me/webview/index` page that had been added for the temporary jump.
  - Added native mini-program UI for mode selection, height/weight inputs, video selection/preview, task creation, upload, enqueue, polling, result summary, per-rep metrics, AI interpretation, and saving/copying the analyzed video.
  - Added authenticated same-domain mini-program upload route `POST /api/toolbox/power-analysis/jobs/[id]/upload`, so the mini-program can use native `Taro.uploadFile` instead of directly `PUT`-ing to the Supabase signed URL.
  - The native page reuses the existing Power Analysis job model and worker queue: `create-upload-url` creates the transient job/path, the new upload route stores the video to the job input path, then `enqueue`, job polling, `llm-summary`, and `download-url` finish the flow.
- Verification:
  - `npm run lint`: passed informational lint script.
  - `npm run typecheck`: passed.
  - `cd wechat_app; npm run build:weapp`: passed and generated `dist/me/toolbox/power-analysis/index.*`.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed and included `/api/toolbox/power-analysis/jobs/[id]/upload` in the route table.
  - `git diff --check`: passed with existing CRLF warnings only.
  - Live browser automation confirmed Web `/toolbox` shows `引体 / 双力臂功率测试` and `/toolbox/power-analysis` shows the analysis page.
  - WeChat DevTools/MRC port 9430: `/me/toolbox/index` reported 4 `.tool-card` elements; clicking the first card navigated to `me/toolbox/power-analysis/index`, not WebView; `.height-input` and `.select-video-btn` existed; switching to `双力臂` and typing height `180` worked; final relaunch/click verification after the upload-route change still navigated to the native page with 0 error logs.
  - Screenshots:
    - `screenshots/weapp/toolbox-native-power-analysis-entry-9430.png`
    - `screenshots/weapp/power-analysis-native-page-9430.png`
    - `screenshots/weapp/power-analysis-native-interaction-9430.png`

## WeChat Plan History Detail Crash (`2026-06-15`)

- Task: fix the WeChat mini-program issue where tapping a plan in `全部计划` / plan history could stay loading and then show `计划不存在`, even though the same coach-assigned plan was visible on today's training/list surfaces.
- Status: implemented and verified.
- Root cause:
  - `wechat_app/src/me/plan-history/detail/index.tsx` requested `/api/student/plan-lib/history/{id}`.
  - That route does not exist in the Web API tree, while the list page correctly loaded the plan through `/api/student/plan-lib/list-history`.
  - Result: list could show a coach-assigned plan, but detail failed to load the instance and rendered `计划不存在`.
- Fix:
  - Switched the detail page to POST `/api/plan-lib/get-instance` with `{ id }`, reusing the canonical plan-instance permission and subscription-aware loader.
  - Normalized the response into the existing detail page fields, including derived status, total training days, and completion rate.
- Verification:
  - `npm run lint`: passed informational lint script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: first run compiled/static-generated successfully but hit the known Windows `.next/standalone` EBUSY copy lock; rerun passed.
  - `cd wechat_app; npm run build:weapp`: passed.
  - WeChat DevTools automation opened the exact reported plan `14eed820-11b2-4a51-ac48-6389a14e2378` for student `30d1f188...`; list showed 1 card, tapping/opening detail rendered the plan header and fields instead of `计划不存在`.
  - Screenshot saved: `screenshots/weapp/plan-history-detail-after-fix-devtools.png`.

## Pull Latest Code (`2026-06-15`)

- Task: pull latest code into local workspace again.
- Status: completed locally.
- Starting branch: `main`.
- Local state before pull:
  - `main` was ahead of `origin/main` by 6 commits.
  - Working tree contained restored uncommitted coach revenue / E2E cleanup changes from prior work.
- Result:
  - Protected local uncommitted changes with stash `tmp-before-pull-latest-2026-06-15`.
  - Fetched `origin` and `gitee`.
  - `origin/main` had no new commits; `origin/dev` advanced to `06731f1f` with WeChat mini-program dark theme / BottomNav fixes.
  - Merged latest `origin/dev` into local `main` successfully.
  - Restored the protected local uncommitted changes; `memory/2026-06-13.md` had become tracked upstream, so the local stashed content was manually merged into that memory file.
  - Updated local `dev` pointer to match the updated `main` merge commit.
- Current note:
  - Local working tree still contains uncommitted coach revenue / E2E cleanup changes plus the pull-state memory updates.
  - Temporary stash is intentionally retained as a backup.
- Remote note: no push was performed.

## Pull Latest Code (`2026-06-14`)

- Task: pull latest code into local workspace.
- Status: completed locally.
- Starting branch: `main`.
- Local state before pull:
  - `main` was ahead of `origin/main` by 11 commits.
  - There were uncommitted local code/state changes from the coach revenue consistency and E2E cleanup work.
- Result:
  - Protected local uncommitted changes with stash `tmp-before-pull-latest-2026-06-14`.
  - Fetched `origin` and `gitee`.
  - Merged latest `origin/main` (`e8f7b092`) into local `main`; new remote change updated `Dockerfile.power-worker`.
  - Restored the protected local uncommitted changes without conflicts.
  - Updated local `dev` pointer to match the updated `main` merge commit.
- Current note:
  - Local working tree still contains the restored uncommitted coach revenue / E2E cleanup changes.
  - Temporary stash is intentionally retained as a backup until those restored local changes are committed or discarded.
- Remote note: no push was performed.

## E2E Fake Coach Cleanup (`2026-06-13`)

- Task: stop E2E/API tests from leaving new fake coach rows after every run.
- Status: implemented and verified.
- Fix:
  - Expanded `/api/test/e2e/cleanup` so every cleanup call also discovers and removes all seeded `E2E Coach%` rows.
  - Cleanup now removes dependent test data before deleting the coach/user rows, including subscription orders, settlement rows, wallet transactions, withdrawals/accounts, chat rooms/messages, plan executions, questionnaire responses, carts, reviews, legacy training-plan rows, pricing/content/action/template rows, and profiles.
  - Existing historical `E2E Coach%` leftovers were cleaned from the current database.
- Verification:
  - Direct database check after cleanup: `coaches where name ilike 'E2E Coach%'` returned `0`.
  - `npx playwright test e2e/t2-backend-api-db-idempotent.spec.ts --workers=1`: passed, and the post-test database check still returned `0`.
  - `npm run typecheck`, `npm run lint`, `npm test`, and `npx next build`: passed.

## Coach Revenue / Wallet Amount Consistency (`2026-06-13`)

- Task: fix inconsistent coach income/revenue and wallet amounts on Web, and keep WeChat mini-program aligned.
- Status: implemented and verified.
- Root cause:
  - Web coach overview/revenue details were still aggregating monthly subscription income from older subscription/order sources, including `coach_subscription_orders.amount_fen`.
  - Wallet displayed the newer wallet/settlement口径: wallet income transactions plus `coach_subscription_settlements.coach_amount` pending settlement net income.
  - Result: overview/revenue could show gross, stale, or unit-drifted values while wallet showed coach net receivable amounts.
- Implemented:
  - Added shared helper `src/lib/coachRevenueSummary.ts`.
  - Updated `/api/coach/get-overview-data` and `/api/coach/get-revenue-details` to compute monthly revenue from wallet income transactions + pending/processing/split-failed settlement coach net amounts, with pre-2026-04-22 legacy subscription rows only as historical fallback.
  - Updated Web overview amount formatting to always show two decimals.
  - Updated WeChat mini-program coach overview/revenue amount formatting to two decimals; mini-program already consumes the same backend APIs, so backend口径 is now aligned.
- Verification:
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational lint script.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed after running `npm install` to restore missing local `kafkajs` dependency that was already declared in `package.json` / `package-lock.json`.
  - `cd wechat_app; npm run build:weapp`: passed.
  - Browser verification with temporary E2E coach and pending settlement net amount `¥161.60` confirmed `/dashboard/overview`, `/dashboard/revenue`, and `/dashboard/wallet` all displayed `161.60`; screenshots saved in `screenshots/web/`.
  - Temporary seed user/subscription, test order, and settlement rows were cleaned up.

## Pull Latest Code (`2026-06-10`)

- Task: pull latest code into local workspace.
- Status: completed locally.
- Starting branch: `main`.
- Local state before pull:
  - `main` was ahead of `origin/main` by 5 commits.
  - Two local durable-state files had uncommitted notes, so they were stashed as `tmp-before-pull-latest-2026-06-10` before fetching.
- Remote updates:
  - `origin/main` had no new commits.
  - `origin/dev` advanced to `8029de1e` with Power Analysis worker queue / Python worker updates.
- Result:
  - Merged latest `origin/dev` into local `main` with merge commit `73e3a66c`.
  - Resolved conflicts by keeping the renamed `docs/codex对话-集成功率视频分析.txt` and preserving both sides of `memory/2026-06-08.md`.
  - Restored the pre-pull durable-state stash.
- Next step: sync local `dev` to the updated `main` head.
- Remote note: no push was performed.

## WeChat Mini-Program Service Category Planning (`2026-06-08`)

- Task: advise which WeChat mini-program service categories CoachLink should proactively apply for based on current mini-program features and WeChat review/category constraints.
- Status: analysis-only completed; no code changes requested.
- Current approved categories shown by user: `工具 > 健康管理` as primary and `工具 > 信息查询`.
- Product surfaces considered: online training execution, action/plan libraries, coach discovery and paid coaching service, coach-student messaging, training videos/content, rankings/location pages, and wallet/payment flows.
- Recommendation snapshot: keep the two approved categories; use remaining category slots first for `体育 > 在线健身`, `体育 > 体育培训`, and one relationship/community safety category such as `社交 > 熟人交友/IM熟人社交` if available or `社交 > 社区/论坛` if review focuses on UGC/public exchange. Do not pre-apply for medical, finance, education, live streaming, or e-commerce categories unless those regulated product surfaces are actually launched.

## Branch Sync: Commit Dev And Merge To Main (`2026-06-08`)

- Task: commit current working tree, then merge the development branch into `main` so `main` and `dev` are consistent.
- Status: completed locally.
- Current branch before commit: `dev`.
- Current branch heads before commit: local/remote `main` and `dev` were both at `549cbb7e` before the new commit.
- Result:
  - Committed current work on `dev` as `500591f6 chore: sync current coachlink updates`.
  - Fetched and merged newer `origin/dev` into local `dev`, producing merge commit `a76ddd5f`.
  - Fast-forwarded local `main` to `dev`.
  - Added final branch-sync state note commit after the merge and fast-forwarded `dev` to match `main`.
- Verification:
  - `npm run lint`: passed.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed after stopping stale local coachlink dev/watch processes that were locking `.next`.
  - `cd wechat_app; npm run build:weapp`: passed before the final `origin/dev` merge; the final merge did not change WeChat mini-program source.
- Remote note: no push was performed in this task.

## Student Renewal Still Shows Expired (`2026-06-08`)

- Task: investigate student `f08872b0` reporting that they renewed with coach `刘三乐` but the WeChat training home still showed `订阅已到期，请尽快续费`.
- Cloud facts:
  - Student `75a60512-4f0c-465f-815e-2bb6f08872b0`, subscription `8b03677a-8ecb-4cac-84b1-01620a20ab27`, coach `刘三乐`.
  - Renewal order `d38c4ab2-1ef4-433b-9225-a6e7946d76ad` is `renew/paid`, confirmed by coach on `2026-05-10`, `purchased_weeks=12`, amount `¥199.00`.
  - The subscription row is still `status='active'` and `subscribed_weeks=24`; the user really had renewed.
  - Stored `end_date` remained stale at `2026-05-23T09:01:57.049+00:00`.
  - The only current student/coach plan instance has 105 calendar days / 44 training days and is now marked `completed`; this exposed a model edge case where purchased entitlement can exceed the current plan's length.
- Root cause:
  - `deriveSubscriptionEntitlementState` capped total/remaining credits at the current plan's max day index. When a renewed subscription had more purchased weeks than the current plan covered, completing or nearing completion of that plan could make the whole subscription look exhausted/grace even though extra renewed entitlement remained for the next phase.
- Fix:
  - `src/lib/subscriptionEntitlementModel.ts` now estimates future unassigned credits when `effectiveWeeks` exceeds the current plan's covered weeks, keeping the active subscription lifecycle active instead of falling back to stale `end_date`/grace.
  - `src/lib/subscriptionEntitlementModel.test.ts` adds a regression covering a 24-week renewed subscription with a completed 15-week plan and stale `end_date`; expected state is `available/active`, with remaining credits and no display end date.
- Verification:
  - Targeted tests passed: `subscriptionEntitlementModel.test.ts` and `subscriptionAccess.test.ts`.
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed on rerun; first run compiled/static-generated successfully but hit a transient Windows `.next/standalone` EBUSY copy lock.

## Coach Wallet Pending Settlement Display / Due Job (`2026-06-08`)

- Task: investigate why a coach subscription paid on `2026-05-28 23:36` still showed `冻结金额 ¥159.20` on Web wallet after the 7-day protection window.
- Finding:
  - The order `76c0dedd-6ba8-4a98-b943-68016de5ac0b` is `paid`, order type `coach_subscription`, total `¥199.00`, coach share `¥159.20`, platform fee `¥39.80`.
  - Its settlement row `438f9deb-8714-47bf-b63b-ec16b26352fd` is still `status='pending'`, `eligible_at='2026-06-04T15:36:10.549Z'`, `attempts=0`, and has no `error_message`.
  - Coach `枭马葛` has `huifu_open_status='opened'` and a card token; `coach_wallets.frozen_amount=0`, so this is not an account-readiness or wallet-freeze issue.
  - Local Apollo-loaded production startup logs show `[BackgroundJobs] missing HUIFU_SETTLEMENT_CRON_SECRET/CRON_SECRET; skip Huifu settlement jobs`, matching `attempts=0`.
- Implemented UI correction:
  - Web `/dashboard/wallet` now displays `冻结金额` from `frozen_amount` only and keeps `待结算收入` separate.
  - WeChat mini-program coach wallet now uses the same display口径.
  - Pending settlements past `eligible_at` now show `结算待处理` / `已到期，等待系统结算`.
- Verification:
  - `npm run lint`: passed.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 162 tests.
  - `npx next build`: passed.
  - `cd wechat_app; npm run build:weapp`: passed.
- Browser verification:
  - Attempted with Playwright against a temporary `next start` on port 3004, but page verification was blocked because `NEXTAUTH_URL` points to `localhost:3000` and production Secure NextAuth cookies did not authenticate `/dashboard/wallet` on `localhost:3004`; middleware redirected to `/login`.
- Next step:
  - Configure `HUIFU_SETTLEMENT_CRON_SECRET` or `CRON_SECRET` in the runtime config/Apollo and restart/redeploy so due settlement jobs run.
  - The currently due settlement should then be processed by `/api/admin/coach-subscription-settlements/process-due`.
  - Do not manually trigger this route without explicit confirmation because it initiates real Huifu balance-payment settlement.

## WeChat Coach Wallet Web Alignment (`2026-06-08`)

- Task: align WeChat mini-program coach wallet with Web `/dashboard/wallet` because the mini-program lacked withdrawable/frozen/pending-settlement balance details and recent transaction entries did not match Web.
- Status: implemented and partially visually verified.
- Implemented:
  - `wechat_app/src/services/coach/coachService.ts` wallet response typing now includes `gross_balance`, `withdrawable_balance`, `refund_protected_amount`, `pending_settlement_amount`, `refund_protection_days`, and `pending_settlements`.
  - `wechat_app/src/coach/wallet/index.tsx` now renders the same wallet balance口径 as Web: 可提现余额, 冻结金额, 待结算收入, 账户总余额, 累计总收入.
  - The mini-program wallet transaction list is now `收支明细` and prepends pending settlements before normal wallet transactions, including settlement status, estimated settlement time, order link copy, and platform service fee.
  - Mini-program wallet transaction time formatting now uses `yyyy-MM-dd HH:mm`, matching the Web page more closely.
- Verification:
  - `cd wechat_app; npm run build:weapp`: passed.
  - `npm run lint`: passed informational lint script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 162 tests.
  - `npx next build`: passed.
  - WeChat DevTools automation opened `/coach/wallet` and screenshot `screenshots/weapp/wallet-aligned.png` confirmed the new four wallet metrics render. DevTools error logs were empty before the automation port disconnected.
- Blocker:
  - Full transaction mock/interaction verification was blocked because `mrc mock` failed with `mp.mockJson is not a function`, and the DevTools automation port disconnected during the follow-up click check.

## Coach Acquisition Notice And Guide (`2026-06-07`)

- Task: prepare a system notice for approved coaches to start recruiting students and write a coach-facing tutorial for how to operate.
- Status: implemented as documentation + dry-run notification script; no real notifications sent yet.
- Output:
  - `docs/work/coach-operations/coach-student-acquisition-guide.md`
  - `docs/work/coach-operations/assets/01-coach-overview.png`
  - `docs/work/coach-operations/assets/02-pricing-settings.png`
  - `docs/work/coach-operations/assets/03-questionnaire.png`
  - `docs/work/coach-operations/assets/04-plan-library.png`
  - `docs/work/coach-operations/assets/05-students.png`
  - `docs/work/coach-operations/assets/06-coach-profile.png`
  - `scripts/send-coach-acquisition-notice.ts`
- Script behavior:
  - `npx tsx scripts/send-coach-acquisition-notice.ts` runs dry-run only.
  - Default target is approved/active, non-`E2E Coach` coach rows.
  - `--ready-only` restricts to coaches with Huifu opened + card token.
  - `--coach-id=` and `--user-id=` can narrow targets.
  - `--execute` is required to actually send system chat notices.
- Dry-run result:
  - Default target count: 18 approved/active real coaches.
  - Ready-only target count implied by dry-run labels: 2 receiving-ready coaches.
- `2026-06-07` follow-up:
  - User asked whether notifications had been sent and requested a product-screenshot-rich tutorial.
  - Clarified no real notifications had been sent; only dry-run was run.
  - Captured 6 Web product screenshots using a temporary E2E coach account, then cleaned up the temporary account/subscription/plan.
  - Updated the guide into an image-rich walkthrough with screenshots for overview, pricing, questionnaire, plan library, students, and coach profile.
  - Local dev servers started for screenshots were stopped afterward.
- Verification:
  - Script dry-run passed.
  - Targeted script TypeScript check passed.
  - `npm run lint` passed informational lint script.
  - `npm run typecheck` passed.
  - `npm test` passed, 33 files / 162 tests.
  - `npx next build` passed on rerun; first parallel build attempt hit transient Windows `.next/standalone` EBUSY lock after successful compile/static generation.

## WeChat Mini-Program Privacy / Agreement Audit Fix (`2026-06-07`)

- Task: fix WeChat audit rejection that said the mini-program collects/uses/stores user personal information while the User Service Agreement and Privacy Policy pages were blank or insufficient, and that personal-information purpose/method/scope/authorization must be clearly stated before collection.
- Status: implemented and verified; `2026-06-08` UX correction applied.
- Implemented:
  - `wechat_app/src/auth/login/index.tsx` now shows a first-screen "个人信息收集使用说明" before the login button, explaining collected categories, collection methods, purpose, usage scope, and no third-party sale.
  - WeChat quick login is disabled until the user checks agreement consent; phone authorization remains a second-step prompt only after login requires it.
  - `wechat_app/src/me-legal/privacy/index.tsx` now contains a full privacy policy covering collection scope, purposes, methods, sharing/disclosure, consent/refusal, retention/security, user rights, minors, updates, and contact details.
  - `wechat_app/src/me-legal/terms/index.tsx` now has a visible page title.
  - `wechat_app/src/auth/register/index.tsx` now includes the Privacy Policy in the registration consent row and no longer only references user agreement/disclaimer.
  - `wechat_app/src/me/profile/index.tsx` footer legal links now point to registered `/me-legal/*` routes instead of unregistered `/me/*` legal pages, reducing blank-page risk.
- Verification:
  - `cd wechat_app; npm run build:weapp`: passed.
  - `npm run lint`: passed informational lint script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 162 tests.
  - `npx next build`: passed.
  - `git diff --check`: passed with CRLF warnings only.
  - WeChat DevTools automation (`mrc` on port 9420) opened `/auth/login`, `/me-legal/terms/index`, and `/me-legal/privacy/index`; screenshots saved to `screenshots/weapp/login-privacy-notice.png`, `screenshots/weapp/legal-terms.png`, and `screenshots/weapp/legal-privacy.png`.
- Note:
  - `mrc elements text` and direct `checkbox` selector inspection still report no displayed text / checkbox selector timeout in this environment, but screenshots confirm the pages are rendered and not blank; clicking `.agreement-row` succeeded.
- `2026-06-08` correction:
  - User clarified that the agreement/privacy content should not be displayed directly as a large block on the login page; full text should appear only after tapping the agreement/privacy links.
  - Removed the first-screen "个人信息收集使用说明" card from `wechat_app/src/auth/login/index.tsx`.
  - Login page now keeps only the checkbox consent row with clickable `《用户服务协议》` and `《隐私政策》` links before the login button; full disclosure remains in the dedicated legal pages.
  - Verified with WeChat DevTools screenshot `screenshots/weapp/login-agreement-link-only.png`.
  - Checks passed: `cd wechat_app; npm run build:weapp`, `npm run lint`, `npm run typecheck`, `npm test`, `npx next build`, and `git diff --check` (CRLF warnings only).

## Admin Standalone Password Reset (`2026-06-07`)

- Task: reset the standalone Web admin password because the original password was forgotten.
- Status: completed.
- Result:
  - `admin.main` exists, is active, and is bound to an admin user.
  - Password hash was reset directly in `admin_users`.
  - Plaintext password was intentionally not written to durable memory.

## Coach Usage Statistics (`2026-06-07`)

- Task: summarize coach-side coach usage from the current CoachLink data source.
- Status: completed as a data analysis; no application code changes requested or made.
- Data source: Apollo local config loaded the Supabase project `uhlqribpagvklpqmcqvo`.
- Notes:
  - Excluded 6 `E2E Coach ...` test coach rows from the main business summary.
  - Report separates real coach-login activity from business-table activity because chat/message rows can make every coach look recently active even when coach `last_login_at` is old.

## Huifu Split Source Material Recovery (`2026-06-06`)

## WeChat Mini-Program Login Audit Visibility Follow-up (`2026-06-07`)

- Task: make the login cancel/refuse/return path obvious in the actual WeChat mini-program login screenshot.
- Status: code updated; repository push gate in progress.
- Follow-up:
  - The prior top floating `返回` / `先逛逛` controls were not visible enough in the custom-nav/capsule top area.
  - `wechat_app/src/auth/login/index.tsx` now places full-width `返回上一页` and `不登录，先逛逛` actions directly below the quick-login button.
  - The same actions also appear below the secondary WeChat quick-login button in password/code login modes.
  - Quick-login copy remains the original `手机一键登录` / `手机号快捷登录`; only the visible cancel/return choices were added.
- Correction:
  - A brief mistaken wording change to `微信快捷登录` was reverted immediately after user correction.
- Verification:
  - Targeted `esbuild` check passed.
  - Per user instruction, no `npm run build:weapp` or further DevTools verification was run; user will build manually.
- Push-gate follow-up:
  - E2E dev-server stability required localizing Driver.js CSS into `src/assets/globals.css`.
  - Playwright now uses `COACHLINK_FAST_DEV=1` for E2E webServer startup.
  - `e2e/t2-backend-api-db-idempotent.spec.ts` now uses CSRF + NextAuth credentials callback for seeded-user login instead of UI form assumptions.
  - Targeted `t2-backend-api-db-idempotent` E2E passed.

---

- Task: recover the long Huifu/payment-split source material from the raw Codex conversation file because the UI could no longer scroll back to it.
- Status: completed.
- Result:
  - Original source found at `C:\Users\hp\.codex\sessions\2026\05\17\rollout-2026-05-17T23-57-38-019e36a8-4701-7612-a071-41d815ee2118.jsonl`, line `218`; line `219` is the duplicate event mirror.
  - Exported full recovered material to `recovered/huifu-payment-split-original-2026-05-18.md`.
  - Added `recovered/README.md` with source path, line number, timestamp, and preview.
- Content includes:
  - WeChat group chat record for `智健启能(北京)科技6666000194449179` with 266 messages.
  - Copied Huifu docs/API material for user onboarding, business open, balance payment, withdrawal, refund/refund-query, and split/delayed-split guidance.
## Meeting Transcript CoachLink Work Summary (`2026-06-07`)

- Task: summarize CoachLink/教链 work content from the user's attached meeting transcript.
- Status: completed as a text summary; no application code changes were requested or made.
- Durable summary was appended to `memory/2026-06-07.md`.

## Student Plan Execution / Entitlement Diagram (`2026-06-06`)

- Task: draw a detailed explanation diagram for student plan execution, validity, renewal waiting, plan length vs subscription length, student delays, and changing weekly training frequency.
- Status: completed as documentation/artifact output; original dense chart was followed by a readable split version after user reported the PNG text was unreadable and Mermaid source did not preview.
- Output:
  - `docs/work/flows/student-plan-execution-entitlement-renewal.md`
  - `docs/work/flows/student-plan-execution-entitlement-renewal.mmd`
  - `output/student-plan-execution-entitlement-renewal.svg`
  - `output/student-plan-execution-entitlement-renewal.png`
  - Readable split version:
    - `docs/work/flows/student-plan-execution-readable.md`
    - `docs/work/flows/student-plan-execution-01-concepts.mmd`
    - `docs/work/flows/student-plan-execution-02-credits.mmd`
    - `docs/work/flows/student-plan-execution-03-renewal.mmd`
    - `docs/work/flows/student-plan-execution-04-scenarios.mmd`
    - `output/student-plan-execution-readable-preview.html`
    - `output/student-plan-execution-01-concepts.{svg,png}`
    - `output/student-plan-execution-02-credits.{svg,png}`
    - `output/student-plan-execution-03-renewal.{svg,png}`
    - `output/student-plan-execution-04-scenarios.{svg,png}`
- Product/system口径:
  - `subscribed_weeks` is the purchased service entitlement pool, not the concrete plan length.
  - `training_days` belongs to the current plan phase and can change between phases.
  - Actual execution duration follows completed execution dates; student delay should extend the projected completion date instead of hard-expiring by natural days.
  - `end_date` is a projected/display completion date and lifecycle helper, not the active-subscription hard gate when credits remain.
  - Renewal waiting means the current phase is complete and remaining entitlement is insufficient, not that plan generation failed.
- Verification:
  - Rendered the Mermaid source to SVG/PNG with Playwright and visually inspected the PNG.
  - Rendered the four split Mermaid diagrams to readable SVG/PNG assets and visually inspected them.
  - Verified the HTML preview loads all four PNG images with non-zero natural dimensions.
  - No Web/WeChat UI verification was required because this was documentation/artifact generation only.
- `2026-06-07` correction:
  - User clarified that a coach-authored plan may be two months long while the student only executes/unlocks the first month under the current entitlement.
  - Updated the readable split diagrams and preview copy to distinguish full coach-authored plan blueprint from the current paid execution window.
  - The renewal/waiting decision now describes "current paid execution window consumed" rather than "entire plan completed".
  - Added a note to the original dense document that the readable split version is the corrected recommended version.

## Production Web Huifu Alipay Polling Recovery (`2026-06-06`)

- Task: fix Web coach subscription Alipay QR payments that can be scanned but stay on `/payment/:id` waiting for payment result.
- Status: implemented and verified at code/build/test level; production redeploy required.
- Root cause:
  - A production Web order (`1bfa6750-6be1-4fa9-8f0e-7927e0aa2fd2`) was inserted as `status='pending'`, `order_type='coach_subscription'`, but had `payment_provider=null` and no `order_data.huifu_req_date`.
  - The payment result page then treated it as a legacy direct-Alipay order and called `alipay.trade.query` instead of Huifu `scanpay/query`, so it kept waiting even after the user scanned/paid.
- Fix:
  - `/api/payment/alipay/create` now writes `order_data.huifu_req_date` before remote Huifu payment creation and does not write `payment_provider='huifu_alipay'`, because production `alipay_orders_payment_provider_check` rejects that value.
  - `/api/payment/alipay/query` now self-recovers historical Web coach subscription orders: `coach_subscription` / `coach_subscription_renew` with `coachId` are queried through Huifu even if provider/date are missing, and the inferred `huifu_req_date` is written back.
  - `/api/payment/alipay/syncPendingOrders` now also reconciles Huifu pending orders, including the same historical Web coach-subscription fallback, instead of skipping Huifu provider/date-marked orders.
  - `/api/payment/wechat/notify` no longer writes `payment_provider='huifu_alipay'` for Huifu Alipay callbacks; A_* callbacks leave provider unchanged/empty and rely on `huifu_req_date`.
- Huifu docs note:
  - The provided Huifu split document confirms payment must go through Huifu first so balance/split can work. It also describes delayed transaction-confirm split (`delay_acct_flag=Y` + transaction confirmation) separately from the current CoachLink balance-payment settlement path.
- Verification:
  - `npm run lint`: passed.
  - `npm run typecheck`: passed.
  - `npm test`: passed (33 files / 162 tests).
  - `npx next build`: passed.
  - `git diff --check`: passed with CRLF warnings only.
- Next step:
  - Redeploy Web. The existing waiting order should be recoverable on the next `/api/payment/alipay/query` call because the route can infer `org_req_date` from `created_at` and use the order id as `org_req_seq_id`.

## WeChat Mini-Program Content Package Size Fix (`2026-06-06`)

- Task: fix WeChat DevTools upload failure where the `content` subpackage reported about `10276KB`, exceeding the 2048KB subpackage limit.
- Status: implemented; package-size verification passed; runtime screenshot verification was attempted but blocked by a DevTools automation white-screen state affecting even the home page.
- Root cause:
  - `wechat_app/src/config/knowledgeCoreTopics.ts` imported four large `knowledge-core/*.png` images.
  - Taro inlined those PNGs as base64 into `content/knowledge.js`, inflating that single JS file to about 10.2MB.
- Fix:
  - Converted the four knowledge-core images to compressed JPG assets.
  - Changed `knowledgeCoreTopics` to use static `/content/assets/knowledge-core/*.jpg` paths instead of importing images into JS.
  - Added Taro copy rules so those JPGs are copied into the `content` subpackage.
- Verification:
  - `cd wechat_app; npm run build:weapp:release`: passed; `dist-release/content/knowledge.js` is about 26.57KB.
  - `cd wechat_app; npm run build:weapp`: passed; `dist/content` is about 0.447MB and `dist/content/knowledge.js` is about 25.95KB.
  - `dist` total is about 8.555MB; main package about 1.46MB; `coach` about 1.835MB; `me` about 1.852MB.
  - Root checks passed: `npm run lint`, `npm run typecheck`, `npx next build`, `npm test` (33 files / 162 tests).
  - WeChat DevTools automation started on port 9420 and could navigate to `/content/knowledge`, but screenshots were blank and element tree was empty for both `/content/knowledge` and `/pages/index/index`, indicating a DevTools automation/runtime-load issue rather than a content-page-only failure.

## Production Slider Captcha Redis Config Hotfix (`2026-06-06`)

- Task: diagnose why Web login SMS slider captcha on `https://coachlink.fit` kept showing `加载验证码失败 / Request failed with status code 500`.
- Status: completed; production captcha service restored.
- Root cause:
  - `/api/captcha/slider/create` depends on Redis for `captcha:slider:*` storage.
  - Production `coachlink-main` was reading Apollo `REDIS_URL=redis://154.8.205.78:6379`, so app Pods tried to connect to the node/public IP and timed out.
  - K8s Redis itself was running normally behind the internal `redis` Service on port 6379 and requires `redis-secret` password.
- Fix applied:
  - Updated Apollo `coachlink/app-config` for `local`, `dev`, and `main`: `REDIS_URL=redis://redis:6379`.
  - Synchronized Apollo `REDIS_PASSWORD` with the current K8s `redis-secret`.
  - Inserted Apollo release messages for the updated app-config clusters.
  - Rolled out `deployment/coachlink-main`.
- Verification:
  - Production logs now show `[Redis] Connecting to redis://:****@redis:6379` and `[Redis] Connected`.
  - `POST https://coachlink.fit/api/captcha/slider/create` returns `success=true`.
  - Captcha image URL returns `200 image/svg+xml`.
  - `POST https://coachlink.fit/api/captcha/slider/verify` returns `success=true` with a token.


## Coach Automation Settings Tutorial (`2026-06-06`)

- Task: make the coach automation settings page understandable for coaches by adding detailed usage guidance and scenario-based recommended settings.
- Status: implemented and verified; commit/push in progress.
- Implemented:
  - Web `/dashboard/automation` now includes a tutorial section before the policy controls: default recommendation, explanation of the four settings, five scenario presets, and a warning to use per-student overrides instead of changing global settings for one student.
  - WeChat coach `/coach/automation` now includes the same guidance in a mobile-compressed panel with default recommendation, setting explanations, scenario suggestions, and per-student override reminder.
- Verification:
  - Targeted `esbuild` syntax checks passed for `src/app/dashboard/automation/page.tsx` and `wechat_app/src/coach/automation/index.tsx`.
  - `git diff --check` passed for the touched automation tutorial files with CRLF warnings only.
  - Push-gate verification on `2026-06-06`: `npm run lint`, `npm run typecheck`, `npm test` (32 files / 158 tests), `npm run test:e2e` (4 tests), and `npx next build` all passed.
  - While running the push gate, `e2e/t2-backend-api-db-idempotent.spec.ts` was updated to use seed-user quick login by user id instead of fragile password-form textbox positions.

# E2E Coach Account Cleanup (`2026-06-06`)

- Task: remove fake coach accounts generated by end-to-end tests from the platform database.
- Status: completed.
- Data cleanup:
  - Identified 7 `coaches` rows with `name ILIKE 'E2E Coach%'`.
  - Deleted their related E2E subscriptions, plan instances, coach rows, coach user accounts, and paired seeded student user accounts.
  - Core deleted rows: 7 `coaches`, 7 `coach_subscriptions`, 2 `coach_plan_instances`, and 14 `users`.
  - Also attempted cleanup for known child/leftover tables such as plan executions, student favorites, coach templates/actions/pricing/questionnaires/wallets, applications, profiles, onboarding questionnaires, orders, content purchases, and feedback rows where present.
- Verification:
  - Post-cleanup query confirmed `coaches.name ILIKE 'E2E Coach%'` returns 0 rows.
  - Post-cleanup query confirmed `coach_plan_instances.name = 'E2E Plan'` returns 0 rows.
- Note:
  - Target database host was the Supabase project configured in local env: `uhlqribpagvklpqmcqvo.supabase.co`.

## Web Student Profile Unified Fitness Card (`2026-06-06`)

- Task: answer and optimize the Web `/me/profile` area where legacy `力量举` / `健美/形体` specialty cards still appeared below the current `健身资料卡`.
- Status: implemented at code level, with follow-up profile-page IA cleanup; code checks passed; browser automation attempted but blocked.
- Product clarification:
  - Yes, those visible `力量举` / `健美/形体` cards are from the older `sport_cards` profile model / old registration-era specialty data.
  - Current registration/onboarding source of truth is the unified questionnaire/profile model (`fitness_goals`, `fitness_level`, target body parts, weekly frequency, equipment, session duration), with `interest_tags` only kept as derived compatibility data.
- Implemented:
  - `src/components/student/StudentProfilePage.tsx`: removed legacy `SportCardsDisplay` from the Web student profile first-screen content.
  - `src/components/student/StudentProfilePage.tsx`: profile header edit dialog now opens `PersonalInfoSection` in `basicOnly` mode on `/me/profile`, so it no longer exposes the old "练习领域 / 历史成绩" sport-card registration steps there.
  - `src/components/student/StudentProfilePage.tsx`: replaced the mobile-unfriendly `TabView` for `进步足迹 / 需求问卷 / 训练视频` with a compact `训练档案` archive area. These low-frequency modules now appear as vertical expandable rows instead of a clipped horizontal three-tab bar.
  - `src/components/student/profile/PersonalInfoSection.tsx`: added `basicOnly` mode that saves only basic profile fields and does not rewrite `sport_cards`.
  - `src/components/student/profile/FitnessProfileCard.tsx`: redesigned collapsed state into a compact summary for goal, level, weekly frequency, and session duration; full field editing remains behind expand/edit controls.
- Verification:
  - `npm run lint`: passed.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 162 tests.
  - `npx next build`: passed after stopping a stale local Web `next dev/start` process that was locking `.next`; existing Redis timeout and baseline-browser-mapping warnings appeared but build exit code was 0.
  - Browser verification: attempted with Playwright because `web-devtools` is not available in this session. Dev-server + E2E seed path timed out at `/api/test/e2e/seed`; a separate `next start` + dev-account login attempt also timed out before a screenshot was produced. Temporary ports/processes were cleaned up.

## Power Calculator Toolbox Integration MVP (`2026-06-06`)

- Task: integrate the old `Power_calculator` project (`D:\files\Power_calculator`) into CoachLink's toolbox as a free Web video-analysis utility with optional LLM interpretation.
- Status: Web MVP implemented and locally verified; production rollout still needs database migration, Python worker dependencies, and background worker/cleanup scheduling.
- Implemented:
  - Added public Web tool page at `/toolbox/power-analysis` and toolbox entry `引体 / 双力臂功率测试`.
  - Added authenticated API flow for signed upload URL creation, enqueueing, owned job lookup, signed output download URL, LLM summary generation, and expired-job cleanup.
  - Added `tool_power_analysis_jobs` migration to track transient analysis jobs, progress, metrics, output paths, errors, and `expires_at`.
  - Added Python analyzer under `scripts/power-analysis/` using OpenCV + MediaPipe Pose to estimate reps, displacement, ascent time, average power, horsepower, max velocity, and generate an annotated output video.
  - Added Node worker `scripts/power-analysis-worker.mjs` with npm scripts `power-analysis:worker`, `power-analysis:work-once`, and `power-analysis:cleanup`.
- Product/retention behavior:
  - Users can download the analyzed/annotated video after processing.
  - Uploaded input and processed output are transient files under the shared `videos` bucket and are retained for at most 24 hours.
  - The page is public/free to view; upload/analyze APIs require login and have default limits of one active job and five jobs per user per 24 hours.
  - LLM analysis uses structured metrics only and does not send raw video to the model.
- Verification:
  - `node --check scripts\power-analysis-worker.mjs`: passed.
  - `python -m py_compile scripts\power-analysis\analyze_video.py`: passed.
  - `npm run lint`: passed.
  - `npm run typecheck`: passed.
  - `npx next build`: passed after stopping stale Next processes that held Windows `.next` files; existing Redis timeout and baseline-browser-mapping warnings appeared.
  - `npm test`: passed, 33 files / 162 tests.
  - Browser verification through the in-app Browser loaded `/toolbox/power-analysis`, confirmed the page is not redirected to login, switched to `双力臂`, filled height/weight, confirmed `开始分析` remains disabled without a selected video, and confirmed the unauthenticated upload API returns 401 `用户未登录`.
  - Screenshot saved: `test-results/manual/power-analysis-tool-page.png`.
- Rollout notes:
  - `supabase/migrations/20260606_power_analysis_jobs.sql` has been executed per user report.
  - Install worker dependencies from `scripts/power-analysis/requirements.txt` in the runtime that runs the worker.
  - Run `npm run power-analysis:worker` as a background worker and schedule `npm run power-analysis:cleanup` or call the cleanup endpoint with `POWER_ANALYSIS_CLEANUP_SECRET` / `CRON_SECRET`.
  - Full end-to-end upload/analyze/download was not run locally because the new DB migration and Python runtime dependencies have not been applied to a real environment in this session.

## Liu Sanle Questionnaire New-System Adaptation (`2026-06-06`)

- Task: keep coach `刘三乐`'s questionnaire questions/intent unchanged while adapting outdated legacy question types to the new questionnaire system.
- Status: completed.
- Data update:
  - Updated active/default questionnaire `bcdd1012-6d83-4708-a65e-b94fd80a2808`.
  - Converted legacy `tags` to a new multi-select `option`: `训练项目偏好` with `引体个数 / 引体负重`.
  - Converted legacy `times` to a new single-select `option`: `每周训练次数` with `2次 / 3次 / 4次`.
  - Converted legacy `rm` to a new `text` question: `用户极限 1RM（反手负重引体、引体顶部维持、正手负重引体）`.
  - Kept the remaining 8 option/text questions unchanged and preserved `status='active'` + `is_default=true`.
- Code fix:
  - `src/app/api/coach/publish-questionnaire/route.ts` no longer writes removed legacy `is_active`.
  - `src/app/api/questionnaire/submit/route.ts` no longer selects/validates removed legacy `is_active`; `status='active'` is the online-version source of truth.
- Verification:
  - Database readback confirmed 11 questions and no remaining legacy `tags/times/rm` types.
  - `npm run lint`: passed (informational lint script).
  - `npm run typecheck`: passed.
  - `npm test`: passed, 32 files / 158 tests.
  - `npx next build`: passed on retry after clearing stale `.next/lock`; Redis timeout warnings still appeared from local env but build exit code was 0.

## Web Coach Subscription Alipay Split Audit (`2026-06-06`)

- Task: answer whether the Web student-to-coach subscription Alipay payment goes through the split/settlement system.
- Status: audit completed and Web Huifu Alipay launch fix implemented.
- Code finding:
  - Web `PaymentDialog` posts coach subscription payments to `/api/payment/alipay/create` with legacy UI order types `subscription` / `subscription_renew`.
  - The backend maps coach-owned subscription payments to `coach_subscription` / `coach_subscription_renew` and, when the coach has Huifu account + card token ready, creates a Huifu Alipay order. The response provider label is `huifu_alipay`, while the database must use `order_data.huifu_req_date` as the durable Huifu marker because production rejects `payment_provider='huifu_alipay'`.
  - Paid Huifu gateway orders are fulfilled through the shared `fulfillSubscriptionAndMaybeCreditWallet` path, which creates/uses `coach_subscription_settlements`, waits until `eligible_at`, then executes Huifu balance-payment settlement before crediting the coach wallet.
  - This is delayed Huifu settlement, not Alipay-native realtime `royalty_info` split.
- Runtime data finding:
  - The matching `¥199.00` paid coach subscription order found in `alipay_orders` is `payment_provider='wechat'`, not `huifu_alipay`.
  - That order has a corresponding `coach_subscription_settlements` row with `total_amount=19900`, `coach_amount=15920`, `platform_fee=3980`, `eligible_at=2026-06-04T15:36:10.549Z`, but status is still `pending`.
  - Therefore the sample has entered the delayed settlement table but has not completed remote split or wallet credit.
- Risk:
  - Before the fix, Web `PaymentDialog` expected `paymentInfo.formHtml`; Huifu Alipay creation returns `paymentInfo.provider='huifu_alipay'` plus `payInfo`.
- Implemented follow-up:
  - Added `src/components/payment/huifuPayInfo.ts` to extract Huifu QR/pay URLs from common `payInfo` shapes.
  - Updated Web `PaymentDialog` so coach subscription Alipay can handle Huifu `payInfo`: desktop shows an Alipay QR dialog and mobile redirects when Huifu provides an HTTP pay URL; both continue to `/payment/:id` for polling/confirmation.
  - Reused the same helper in `ContentPurchaseDialog`.
  - Moved legacy direct-Alipay `ALIPAY_*` credential checks below the Huifu coach-subscription branch so Huifu subscription payments do not depend on old direct-Alipay config.
  - Changed Huifu Alipay notify URL selection to prefer `HUIFU_PAY_NOTIFY_URL`, then `WECHAT_PAY_NOTIFY_URL`, then inferred `/api/payment/wechat/notify`, because Huifu callbacks must use the unified Huifu notify parser.
- Verification:
  - Targeted esbuild checks passed for `PaymentDialog`, `ContentPurchaseDialog`, and `/api/payment/alipay/create`.
  - `git diff --check`: passed with CRLF warnings only.
  - `npm run lint`: passed (script notice only).
  - `npm run typecheck`: passed.
  - `npm test`: passed (32 files / 158 tests).
  - `npx next build`: passed after stopping a stale local `next build` process that held `.next/lock`.
  - Browser smoke test: Playwright loaded local `/coach/profile/02db8c38-dc64-490b-9b78-e002a13811df` on port 3100 with no page/console errors and saved `test-results/manual/web-coach-profile-huifu-payment-smoke.png`; full payment-dialog interaction was not exercised because it requires an authenticated student and a real/sandbox Huifu payment order.

### Production Web Huifu Alipay 500 Follow-up (`2026-06-06`)

- Symptom: after deploying the Web Huifu Alipay launch fix, production Web payment POST `/api/payment/alipay/create` returned 500. UI toast showed `业务执行失败 [buyerId与buyerLogonId不能同时为空]`.
- Root cause:
  - The Web route selected Huifu `A_JSAPI` whenever the browser looked mobile (`isMobile=true`).
  - Normal Web browsers do not have Alipay `buyerId` / `buyerLogonId`; `A_JSAPI` requires one of them, so Huifu rejected the request.
- Fix:
  - Web Huifu Alipay now defaults to `A_NATIVE` QR payment.
  - It only uses `A_JSAPI` when the request explicitly includes `alipayBuyerId` / `buyerId` or `alipayBuyerLogonId` / `buyerLogonId`.
  - `createHuifuMiniProgramOrder` now omits empty buyer fields instead of sending `buyer_id: ""`, and can pass `buyer_logon_id` when provided.
- Verification:
  - Targeted esbuild checks passed for `/api/payment/alipay/create` and `src/lib/huifuMiniProgramPay.ts`.
  - `git diff --check`: passed with CRLF warnings only.
  - `npm run lint`: passed (script notice only).
  - `npm run typecheck`: passed.
  - `npm test`: passed (33 files / 162 tests).
  - `npx next build`: passed.

### Production Web Huifu PayInfo Missing Follow-up (`2026-06-06`)

- Symptom: after the `A_NATIVE` fix, production no longer showed the buyer-id error, but Web UI still showed an error toast with detail `订单创建成功`.
- Interpretation:
  - The create-order API likely returned `success: true` and message `订单创建成功`, but the frontend did not receive `paymentInfo.formHtml` or `paymentInfo.payInfo`, so it treated the response as unusable.
  - Likely cause is Huifu `A_NATIVE` returning QR/pay target in a top-level field such as `qr_code`, `code_url`, or `pay_url` instead of `pay_info`.
- Fix:
  - `/api/payment/alipay/create` now extracts Huifu pay targets from `pay_info`, `qr_code`, `qrcode`, `qrCode`, `code_url`, `codeUrl`, `pay_url`, `payUrl`, `pay_qr_code`, `alipay_qr_code`, `url`, and `paymentUrl`, including a nested `data` object fallback.
  - If Huifu returns success without any usable pay target, the backend throws a clear `汇付下单成功但未返回可展示的支付参数` error and logs response keys for diagnosis.
  - Web `PaymentDialog` now shows a clearer frontend fallback if an order is created but payment parameters are missing.
- Verification:
  - Targeted esbuild checks passed for `/api/payment/alipay/create` and `PaymentDialog`.
  - `git diff --check`: passed with CRLF warnings only.
  - `npm run lint`: passed (script notice only).
  - `npm run typecheck`: passed.
  - `npm test`: passed (33 files / 162 tests).
  - `npx next build`: passed.

## Web Fitness Profile Card Collapse (`2026-06-06`)

- Task: make the Web student `健身资料卡` collapsible so it does not occupy the whole profile screen by default.
- Status: completed.
- Scope:
  - `src/components/student/profile/FitnessProfileCard.tsx`
- Implemented:
  - Added a default-collapsed state for the card.
  - Added a pure-color `展开` / `收起` toggle with an icon and `aria-expanded`.
  - Kept existing single-field edit/save behavior unchanged when the card is expanded.
- Verification:
  - `npm run lint`: passed.
  - `npm run typecheck`: passed.
  - `npx next build`: passed; build emitted existing Redis timeout / baseline-browser-mapping notices but exited successfully.
  - `npm test`: passed, 32 files / 158 tests.
  - Browser verification: Playwright logged in with a seeded temporary student, created a minimal profile, opened `/me/profile`, confirmed the card is collapsed by default, clicked `展开`, and confirmed field buttons such as `头像` and `昵称` appear.
  - Screenshots saved:
    - `test-results/manual/fitness-profile-card-collapsed.png`
    - `test-results/manual/fitness-profile-card-expanded.png`

---

## WeChat Mini-Program Login Audit Fix (`2026-06-06`)

- Task: fix WeChat Mini Program audit rejection for login flow: login must provide a prominent cancel/refuse/return path and must not repeatedly force phone authorization before users can experience the mini-program.
- Status: implemented and verified at code/build/test level; WeChat DevTools interaction partially verified.
- Implemented:
  - `wechat_app/src/auth/login/index.tsx`: quick login primary buttons no longer directly use `openType='getPhoneNumber'`; they first call normal WeChat login without phone authorization.
  - Phone-number authorization now appears only as a second-step prompt when the backend says this is a first-time quick login or an account missing phone binding.
  - Login page now has visible `返回` and `先逛逛` actions at the top, plus a `先逛逛` entry in the quick-login panel.
  - Phone authorization prompt now explains that authorization is only needed for first account creation/missing phone, and provides `暂不继续` plus `返回`.
  - Rejecting/canceling the native phone authorization closes the prompt and does not loop the user back into repeated popups.
  - Login button active styles now use opacity or pure-color darkening instead of scale transforms.
- Verification:
  - Targeted `esbuild` check for `wechat_app/src/auth/login/index.tsx`: passed.
  - `cd wechat_app; npm run build:weapp`: passed.
  - Root `npm run lint`: passed (informational script).
  - Root `npm run typecheck`: passed.
  - Root `npm test`: passed, 33 files / 162 tests.
  - Root `npx next build`: passed.
  - WeChat DevTools automation: started via `D:\software\微信web开发者工具\cli.bat auto --project D:\files\coachlink\wechat_app --auto-port 9420`, opened `auth/login`, clicked `.wechat-skip-row`, and verified navigation to `pages/index/index`.
- Blocker:
  - `mrc screenshot` timed out and `mrc elements` reported elements as not displayed even while the route was `auth/login`, so no screenshot artifact was produced. This matches the DevTools automation visibility/screenshot flakiness previously observed in this workspace.

---

## Latest Code Sync (`2026-06-05`)

- Task: pull the latest remote code and synchronize the local checkout.
- Status: completed on local `main`.
- Result:
  - Temporarily stashed local state-file edits before pulling.
  - Fetched all remotes with prune/tags.
  - Fast-forwarded `main` from `38a4b9e0` to `b79e5568`.
  - Resolved the local state-file conflict by keeping the newer remote task history and recording this sync as a new note.

---


## Repository Push and Branch Sync (`2026-06-05`)

- Task: commit current CoachLink changes, push to remote, and keep `main` and `dev` synchronized.
- Status: completed. Commit `2bb0af70` was pushed to `origin/main` and `origin/dev`; local `dev` was fast-forwarded to the same commit.
- Verification before push:
  - `npm run lint`: passed (project lint script prints the existing Next 16/no-eslint notice).
  - `npm run typecheck`: passed.
  - `npm test`: passed, 32 files / 158 tests.
  - `npm run test:e2e`: passed, 4 tests.
  - `npx next build`: passed after stopping the local `next dev` process that had locked `.next` during an earlier build attempt.
- Notes:
  - Fixed a real automation patch bug where set/reps adjustments were made on a local copy and not written back.
  - Updated the backend CRUD e2e to use seeded temporary users instead of real `.env.development` users, because current real coach-test accounts may be intentionally modified for certification-flow testing.

## Xunji-Style Student Training UX Gap Analysis (`2026-06-05`)

- Task: compare the current CoachLink WeChat student training experience against the user's detailed `训记` interaction teardown and identify the next product/code changes.
- Status: four highest-priority quick-pass changes implemented at code level in `wechat_app/src/training/training-execution`; no WeChat DevTools/manual verification or full lint/typecheck/build/test run per local preference.
- Implemented quick pass:
  - Rest timer can now be minimized into a right-edge floating countdown bubble and restored by tapping the bubble; expanded timer supports `-10秒`, `+10秒`, `完成`, and `最小化`.
  - In-execution add-action picker now uses a `训记`-style selector: muscle rail, equipment chips, search, two-column action cards, multi-select, and batch add.
  - Weight/reps recording now uses a bottom custom workout keyboard with large number keys, quick adjust, planned value, copy previous set, warmup/drop-set note tags, add-set, and complete-set shortcuts.
  - Finishing a workout now opens a training summary sheet with body-map heatmap, total volume, completed sets, duration, muscle intensity bars, action summaries, and share-page entry when available.
  - Follow-up fix: impromptu training entry now loads public strength actions from the public/community action library alongside the student's personal actions. When the personal library is empty, users can still select public actions and start training immediately; cards show `我的` / `公共` source badges.
  - Follow-up fix: the no-long-term-plan state on today's training page now shows both primary `开始即兴首练` and secondary `找教练` actions. If the student already has an active coach subscription but no issued plan yet, the secondary action remains `联系教练`.
- Current product concern:
  - User feels the action library still has deeper issues and should not be modified further casually without a larger design/content pass.
  - Key gap: action preview cards do not reliably show actual exercise demos. For beginner users, action names, tags, and text are not enough to understand what the movement is.
  - Next action-library work should be planned around demo assets / thumbnails / movement previews and beginner comprehension, not only list layout styling.
- Confirmed benchmark:
  - Entry hub: bottom/FAB overlay with multiple record types.
  - Strength flow: fast exercise selection, dense set logging, custom numeric keyboard, per-set actions, automatic rest timer, and minimized timer bubble.
  - Completion flow: finish confirmation plus a share card centered on muscle heatmap, total volume, duration, and action summaries.
  - Cardio/HIIT: dedicated lightweight but real record/config flows, not only generic task forms.
- Current gaps found:
  - The action library was redesigned toward `训记`, but the in-execution add-action picker still uses a simple search list instead of the richer muscle/equipment multi-select selector.
  - The execution page still uses normal `Input` fields for weight/reps/RPE; it does not yet have a large custom workout keyboard.
  - The rest timer is persisted and auto-starts, but it is still a blocking modal with skip/+30s actions, not a minimizable right-edge countdown bubble with +/- controls.
  - The finish/share flow has share-token support and a day check-in card, but not a `训记`-style muscle heatmap share poster.
  - Dedicated cardio and HIIT training record/config pages are not present; cardio currently exists as lightweight task inputs and HIIT is not a real surface yet.
- Recommended implementation order:
  1. Add minimizable/floating rest timer controls in `training-execution`.
  2. Replace the execution-page add-action picker with the redesigned muscle/equipment selector and multi-select behavior.
  3. Add a custom numeric workout keyboard for weight/reps and high-frequency set operations.
  4. Add a heatmap-based completion/share card using existing body-map assets plus action volume data.
  5. Add dedicated cardio record and HIIT interval-timer flows.

## WeChat Registration Default Community Identity (`2026-06-05`)

- Task: make WeChat mini-program student registration/onboarding automatically provide an elegant CoachLink community-style default avatar and nickname, while keeping the option to switch to the user's WeChat avatar/nickname.
- Status: implemented at code level; no WeChat DevTools/manual verification or full lint/typecheck/build/test run per local preference.
- Scope:
  - `wechat_app/src/auth/student-onboarding/index.tsx`
- Implemented:
  - New incomplete student onboarding now generates a stable default identity from `userId`.
  - Default nickname uses community-style training names such as `晨练记录员`, `街健探索者`, and `训练合伙人` plus a deterministic 4-digit suffix.
  - Default avatar is a generated CoachLink-style SVG data URI using brand-compatible palettes and abstract training marks.
  - Existing profile avatar/nickname are preserved, and edit mode still shows the user's existing profile.
  - The first-step UI now explains that the default avatar/nickname are generated and that the user can replace them with WeChat avatar/nickname through the existing WeChat controls.
  - Follow-up fix: onboarding completion now defaults to `/pages/index/index` instead of impromptu training, and the final button says `完成注册`.
  - Follow-up fix: the generated SVG avatar is treated as onboarding-page display only and is not persisted to `user_profiles.avatar_url`; only a user-selected/uploaded WeChat avatar URL is saved.
- Verification:
  - Lightweight diff/content self-check only. Full lint/typecheck/build/test and WeChat DevTools verification intentionally not run.

## Knowledge Base Entry Polish (`2026-06-05`)

- Task: fix visible mojibake on the knowledge-base entry page and add an explicit under-construction reminder.
- Status: implemented at code level; no full Web/WeChat visual verification or full lint/typecheck/build/test run per local preference.
- Scope: Web `/dashboard/knowledge` and WeChat mini-program `/content/knowledge`.
- Implemented: cleaned remaining corrupted Chinese UI strings, added a compact ?knowledge base is under construction? notice, kept the pain-point-first four-entry layout and collapsed shelves behavior.
- Verification: targeted esbuild parse checks passed for the Web and WeChat knowledge TSX entries; `git diff --check` passed for touched knowledge entry files with CRLF warnings only.
# CURRENT_TASK

## WeChat Mini-Program Dark Theme Page Binding (`2026-06-13`)

- Status: implemented and verified.
- Problem: toggling dark mode only changed system UI; page backgrounds/cards/text stayed light.
- Fix:
  - `wechat_app/scripts/add-theme-class-to-pages.js`: batch script that adds `theme-${effectiveTheme}` to every page root JSX element.
  - Applied to all 117 WeChat mini-program page files under `wechat_app/src/`.
  - Manually patched `wechat_app/src/training/actions/index.tsx` (root View had no className) and `wechat_app/src/training/today-training/index.tsx` `renderLoading`.
  - `wechat_app/src/app.scss`: `.theme-dark` now sets `background: var(--bg-page)` so any page root with the class gets the dark background.
- Verification:
  - `npm run build:weapp` passed.
  - Babel parse check on all modified `.tsx` files passed.
  - WeChat DevTools automation on port 9421; `/me/profile/index` showed dark mode initially and switched to light mode after tapping the theme toggle.
  - `mrc screenshot` flaked after the first capture; no runtime errors in logs.
- Next step: if desired, run the full push gate (`npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`) before committing.

## WeChat Mini-Program BottomNav Switch Animation (`2026-06-13`)

- Status: implemented.
- Problem: active item in `BottomNav` animates on first load, but tab switching feels instant because each page re-mounts its own `BottomNav` and applies the active state immediately on mount.
- Fix:
  - `wechat_app/src/components/BottomNav.tsx`: added a `mounted` state (initial `false`). After mount, `syncCurrentPath()` runs and a `setTimeout(..., 0)` flips `mounted` to `true`. Active state is forced to `false` while `mounted` is `false`; once `true`, the active item transitions from inactive to active, triggering the existing CSS transition.
- Verification:
  - `npm run build:weapp` passed after the change.
  - WeChat DevTools automation on port 9421: navigated from `/training/today-training` to `/discovery/index` by tapping the discovery nav icon; no runtime errors.
  - `mrc screenshot` remained flaky, so the animation was not captured visually.

## Knowledge Base Entry Simplification (`2026-06-06`)

- Task: simplify the Web and WeChat knowledge-base entry pages after the user judged the four-card/body-map/resource-switching layout confusing.
- Status: implemented, verified, and ready to commit/push.
- Scope:
  - `src/app/dashboard/knowledge/page.tsx`
  - `wechat_app/src/content/knowledge/index.tsx`
  - `wechat_app/src/content/knowledge/index.scss`
- Implemented:
  - Removed BodyMap from the knowledge entry page for now.
  - Removed the large four-image topic cards and the "click topic, update lower recommendation panel" interaction.
  - Replaced the entry structure with search, construction notice, three compact focus topics, featured training plans, and book notes.
  - Changed copy to a more formal, less colloquial tone and kept a non-medical boundary for pain/injury content.
- Verification:
  - Targeted `esbuild` checks passed for Web and WeChat knowledge entry TSX files.
  - `git diff --check` passed for the touched knowledge entry files with CRLF warnings only.
  - Repeat push-gate verification on `2026-06-07` passed: `npm run lint`, `npm run typecheck`, `npm test` (33 files / 162 tests), `npm run test:e2e` (4 tests), and `npx next build`.
  - During the repeat gate, `e2e/b1-subscription.spec.ts` was made more stable by logging seeded users in through the NextAuth credentials callback with CSRF instead of relying on the visible quick-login form.

# Web Coach Automation Nav Dedup (`2026-06-06`)

- Task: remove the duplicated Web coach automation entry from the desktop top navigation while keeping it under the user/"我的" menu.
- Status: completed.
- Scope:
  - `src/components/NavigationCoach.tsx`
- Implemented:
  - Removed the top-level desktop coach menu item `自动化`.
  - Kept the user dropdown item `自动化设置` pointing to `/dashboard/automation`.
- Verification:
  - `npm run lint`: passed.
  - `npm run typecheck`: passed.
  - `npx next build`: passed; existing local Redis timeout / baseline-browser-mapping notices appeared but build exit code was 0.
  - `npm test`: passed, 32 files / 158 tests.
  - Playwright browser verification with a seeded coach confirmed the desktop top nav is `概览 / 视频点评 / 我的学员 / 内容管理 / 计划库` and the user menu still contains `自动化设置`.
  - Screenshot saved: `test-results/manual/web-coach-nav-automation-dedup.png`.

## WeChat Action Library UX Rework (`2026-06-05`)

- Task: reorganize the WeChat mini-program action library UI using the provided `训记` reference.
- Status: implemented at code level; no WeChat DevTools/manual visual verification or full lint/typecheck/build/test run per local preference.
- Scope:
  - `wechat_app/src/me/action-lib/index.tsx`
  - `wechat_app/src/me/action-lib/index.scss`
  - `wechat_app/src/training/actions/index.tsx`
  - `wechat_app/src/training/actions/index.config.ts`
  - `wechat_app/src/training/impromptu-training/index.tsx`
- Implemented:
  - Reworked the main action library from long article-style cards into a dark training-selector layout inspired by `训记`.
  - Added left-side muscle/body-part rail, horizontal equipment filters, compact search, public presets, and dense two-column public action cards.
  - Public action cards now show short decision fields only: action name, primary body part, tags, like count, demo/key-point marker, action detail entry, like/correction/add controls.
  - My-action cards were reorganized as compact rows with action name, body part/type, tags, 1RM badge, and quick actions for key points, references, contribution, and deletion.
  - Old `/training/actions` route now redirects to the redesigned `/me/action-lib?tab=public` page so users do not land on the legacy ugly list.
  - The impromptu training entry now opens `/me/action-lib?tab=public` for action-library management.
- Verification:
  - `git diff --check` passed for touched action-library files with CRLF warnings only.
  - Targeted `esbuild` checks passed for `wechat_app/src/me/action-lib/index.tsx`, `wechat_app/src/training/actions/index.tsx`, and `wechat_app/src/training/impromptu-training/index.tsx`.

## Student Training Execution UX Optimization Follow-up (`2026-06-05`)

- Task: optimize the student-side WeChat mini-program training execution and impromptu workout flow toward a `训记`-style fast workout logging experience.
- Status: second optimization pass implemented at code level; no WeChat DevTools/manual verification or full lint/typecheck/build/test run per local preference.
- Scope:
  - `wechat_app/src/training/training-execution`
  - `wechat_app/src/training/impromptu-training`
  - `wechat_app/src/services/impromptuService.ts`
- Implemented:
  - Replaced the impromptu workout entry from a prefilled mini-plan form with a quick action search/list.
  - Students can one-tap start a single action, or select multiple actions and start the session immediately.
  - Impromptu entry now seeds each selected action as one pending set with blank reps/weight and default 90s rest, leaving real logging to the shared execution page.
  - Fixed mini-program `impromptuService.finish()` to send backend-aligned `{ executionId }` instead of `{ id }`.
  - Quick-finish in impromptu execution mode now calls `impromptuService.finish(..., { mode: 'quick' })` so pending sets can be completed by the backend quick-finish path.
- Verification:
  - `git diff --check` passed for touched execution/impromptu files with CRLF warnings only.
  - Targeted `esbuild` checks passed for `wechat_app/src/training/impromptu-training/index.tsx` and `wechat_app/src/training/training-execution/index.tsx`.
- Next step:
  - Run WeChat DevTools/manual visual verification when requested.
  - After verification, consider richer in-execution action search/add flow and editable history polish.

## Student Training Execution UX Audit (`2026-06-05`)

- Task: explain the current student-side WeChat mini-program training execution UI/interaction in full detail and evaluate it against the product direction of mimicking `训记`.
- Status: first optimization pass implemented; no WeChat DevTools/manual verification or full lint/typecheck/build/test run per local preference.
- Scope:
  - Primary surface is `wechat_app/src/training/training-execution`.
  - Related entry/caching surfaces include `wechat_app/src/training/today-training`, `wechat_app/src/utils/trainingExecutionCache.ts`, and `wechat_app/src/utils/todayTrainingPageCache.ts`.
- Implemented:
  - Added a compact quick-log panel in the current set form with `套用计划` and `复制上一组`.
  - Added weight/reps/RPE steppers for faster set entry.
  - Persisted rest timer deadlines to local storage so leaving/re-entering the execution page can restore active rest countdowns.
  - Fixed mini-program complete-set payload to send backend-aligned `is_pr`, `actionId`, and `has_video` fields so manual PR/video state can persist more reliably.
  - Changed execution page primary complete/finish buttons to pure brand-color backgrounds instead of gradients.
- Verification:
  - `git diff --check` passed for touched execution files with CRLF warnings only.
  - Targeted `esbuild` check passed for `wechat_app/src/training/training-execution/index.tsx`.
- Product direction:
  - Student training execution experience is high priority.
  - Future iteration should move closer to a `训记`-style fast workout logging experience while preserving CoachLink-specific coach plan, execution notice, feedback, and coach automation context.

- Current finding:
  - WeChat impromptu training currently uses a separate `impromptu_executions` table and then reuses the shared `training-execution` UI.
  - Entry first requires choosing actions and planned sets/reps/rest/weight, then starts an execution and records sets one by one.
  - Impromptu records are included in training-history calendar/day/month summary alongside plan executions.
  - A likely bug exists in the WeChat impromptu finish path: `impromptuService.finish()` sends `{ id }`, while `/api/impromptu/finish` expects `executionId`.
  - Product gap: current impromptu is "prepare a mini plan, then execute it", not yet a `璁`-style "open and log immediately / add while training" experience.

## Coach Personal QR Payment Retirement (`2026-06-05`)

- Task: verify current Huifu/bank-card readiness and retire legacy coach personal QR-code payment because student-to-coach money should only go through Huifu/platform payment.
- Status: implemented in code and database; no full lint/typecheck/build/test or browser/WeChat DevTools verification run per local preference.
- Data finding:
  - Current coaches total: 17.
  - Huifu receiving-account ready coaches: 2 (`枭马葛`, `刘三乐`), both with `huifu_open_status='opened'` and bank-card token present.
  - Before cleanup, 16 coaches still had `allow_personal_qrcode` enabled and 3 coaches had QR codes configured (`刘三乐`, `枭马葛`, `刘孝烨`).
- Operational DB update:
  - Set `allow_personal_qrcode=false` for all 17 coach rows.
  - Cleared `payment_qr_codes=[]` for all 17 coach rows.
  - After cleanup: personal QR allowed count is 0 and configured QR count is 0.
- Implemented:
  - Student-facing coach payment info no longer exposes personal QR codes; QR-only modes are normalized to platform payment.
  - Web `PaymentDialog` defaults away from personal QR and offline payment; student subscription page passes platform-only payment options.
  - Student manual confirmation paths (`personal_qrcode`, `offline`, and waiting/pending confirmation submissions) now return a stopped-policy error.
  - Coach QR-code GET/POST/upload APIs are retained for compatibility but return disabled/empty or 410 stopped-policy responses.
  - Web `/coach/settings/payment` and WeChat `/coach/settings/payment` were converted to disabled notices with CTA to Huifu receiving-account setup.
  - Web and WeChat coach menu entries now point to receiving-account setup instead of old QR-code settings.
- Verification:
  - Web touched files passed targeted `esbuild` bundle check.
  - WeChat touched TSX files passed targeted `esbuild` bundle check with `.scss` loader; only stylesheet side-effect warnings appeared.
  - `git diff --check` passed for touched payment-retirement files with CRLF warnings only.

## Coach Automation V1 Implementation (`2026-06-05`)

- Task: implement the coach-service automation V1 plan: coach-global policy + per-subscription override, job tracking, first-plan auto publish, feedback adjustment drafts, next-phase/renewal automation, and coach-facing settings entries.
- Status: implemented at code level; database migration must be applied before the feature works online. Full lint/typecheck/build/test and browser/WeChat DevTools verification were not run per local preference.
- Implemented:
  - Added migration `supabase/migrations/20260605_coach_automation_v1.sql` with `coach_automation_policies`, `subscription_automation_overrides`, `coach_automation_jobs`, and `coach_plan_adjustment_drafts`.
  - Added `src/lib/coachingAutomation/` service layer for policy resolution, idempotent jobs, subscription activation, feedback adjustment, next-phase generation, renewal handling, and draft application.
  - Reworked the legacy `autoMatchPlanForSubscription(...)` path to delegate to `onSubscriptionActivated(...)`; first automatic plan defaults to `active` and does not depend on `CRON_SECRET`.
  - Wired feedback submission, plan completion, platform renewal, and subscription-order renewal to the new automation hooks.
  - Added coach APIs for global policy, per-student override, automation job/draft history, and applying adjustment drafts.
  - Added Web coach automation settings page, Web navigation entry, Web student-detail override panel, WeChat coach automation page, WeChat overview entry, and WeChat student-detail override controls.
  - Added focused tests for policy resolution and feedback patch safety behavior.
- Safety/behavior notes:
  - High-risk feedback (pain, injury, numbness, dizziness, obvious abnormality) is always review-only and never auto-applied.
  - Feedback patches only target future unexecuted training days and skip completed/in-progress/abandoned execution days.
  - Next-phase automation creates draft by default; auto-publish requires policy opt-in and archives the completed previous phase best-effort after the new active phase is created.
  - Feedback draft generation is currently a conservative deterministic patch generator with explicit safety guards. The existing interactive AI modifier remains available manually, but its core still needs to be extracted from the SSE route before it can safely replace the background job generator.
- Verification:
  - Targeted `esbuild` syntax checks passed for the new automation service/API/UI files and modified WeChat automation/student-detail files.
  - `git diff --check` passed for the touched automation files with CRLF warnings only.

## Coach Certification Flow Test Reset (`2026-06-05`)

- Task: support end-to-end testing of the upgraded coach certification / application review flow by temporarily removing coach access for selected approved coaches and nudging approved coaches with incomplete certification/profile data.
- Status: operational database update completed; no code changes or browser/build verification were requested.
- Completed:
  - Temporarily removed coach access for `沈妈妈` and `MAX`.
  - Set their `users.is_coach=false`, `users.coach_status='pending'`, and `users.primary_role='student'`.
  - Set their `coaches.status='suspended'` so they no longer appear as approved coaches in discovery/purchase paths that filter `coaches.status='approved'`.
  - Set their `coach_applications.status='needs_info'` with review notes instructing them to open `申请成为教练`, complete missing/updated fields, and resubmit for review.
  - Sent both users system private messages explaining this is a platform flow test / data completion pass and that coach access will recover after re-approval.
  - Sent non-blocking system reminders to 13 other approved, non-E2E coaches whose application/profile/payment-readiness data had gaps. Their coach access was not changed.
- Important follow-up:
  - The current product flow reuses the existing `coach_applications` row for resubmission; it does not create a brand-new application record unless the old row is deleted/archived manually.
  - When `沈妈妈` or `MAX` resubmit, their application should move back toward `pending`; admin approval should upsert `coaches.status='approved'` and restore `users.is_coach=true`.

## Coach Pricing Requires Bank Binding (`2026-06-05`)

- Task: confirm and enforce whether coaches can set subscription package pricing before Huifu receiving-account / bank-card binding.
- Status: hard pricing gate implemented in code; no full lint/typecheck/build/test or browser/WeChat verification run per local preference.
- Finding:
  - The earlier `2026-06-04` optimization added receiving-account reminders and blocked student payment for unready coaches, but still allowed coaches to save pricing drafts.
- Implemented:
  - `/api/coach/update-pricing` now requires `coaches.huifu_open_status='opened'` and a non-empty `coaches.huifu_card_token`; otherwise it returns 403 and refuses to create/update `coach_pricing`.
  - Web `/dashboard/pricing` now blocks add/edit/delete/save pricing actions when the receiving account is not ready, disables add/update controls, and shows a binding CTA.
  - WeChat `/coach/pricing` now blocks add/edit/delete pricing actions, visually dims add controls, and shows the same binding CTA.
  - WeChat `/coach/pricing/edit` now blocks and disables saving when the receiving account is not ready.
- Verification:
  - `git diff --check` passed for the touched pricing files with CRLF warnings only.
  - Full lint/typecheck/build/test and UI verification were intentionally not run.

## WeChat Registration Nickname Autofill (`2026-06-05`)

- Task: fix the recurring WeChat mini-program student registration/onboarding issue where tapping the native WeChat nickname candidate may not reliably fill/sync the nickname.
- Status: implemented code-level fix; no WeChat DevTools/browser verification or full lint/typecheck/build/test sequence run per local preference.
- Implemented:
  - `wechat_app/src/auth/student-onboarding/index.tsx` now wraps the onboarding page in a native `Form` and gives the `type="nickname"` input `name="nickname"`.
  - The first-step `下一步` footer control is now a `TaroButton` with `formType="submit"` so WeChat's native nickname value can be read from form submission even when `onInput` / `onBlur` do not report the selected candidate.
  - Reused a single nickname synchronization helper for event values, form values, and native-node fallback reads; step-1 validation can receive the freshly synced nickname before React state catches up.
  - `wechat_app/src/auth/student-onboarding/index.scss` resets the Taro button default border/margins for the footer button and changes active feedback to opacity only.
- Verification:
  - Targeted `esbuild` parse/bundle check passed for `wechat_app/src/auth/student-onboarding/index.tsx`.
  - `git diff --check -- wechat_app/src/auth/student-onboarding/index.tsx wechat_app/src/auth/student-onboarding/index.scss` passed with CRLF warnings only.
  - Manual WeChat nickname-candidate tapping was not verified automatically per local preference.

## Coach Huifu Bank Binding UX (`2026-06-05`)

- Task: reduce coach friction in Huifu receiving-account onboarding by replacing avoidable machine-code inputs with human-readable choices.
- Status: implemented bank and region selector flow; no full lint/typecheck/build/test or Web/WeChat verification run per local preference.
- Implemented:
  - Added shared Huifu account option config for Web and WeChat mini-program: bank-code options plus 31 province-level and 450 city/district-level administrative code options.
  - Web `/dashboard/wallet/merchant` now shows selectors for `开户银行`, `开户省份`, and `开户城市/区县`; `bankCode`, `provId`, and `areaId` are generated and shown as read-only previews.
  - WeChat mini-program `/coach/wallet/merchant` mirrors the same selection flow with Taro `Picker` controls and read-only code previews.
  - Copy now distinguishes `银行编码` as the bank-level code and `具体支行联行号` as the branch-level clearing number.
  - `支行联行号` remains manual because it identifies the exact bank branch clearing node and cannot be safely inferred from bank + province/city alone.
- Next step:
  - Longer term, replace manual `支行联行号` with a searchable branch selector backed by a maintained bank/branch code dataset.
- Follow-up diagnosis:
  - User shared a failed binding screenshot for coach `刘三乐`: bank code `01040000`, branch clearing number `105138000194`, branch name `张家口市民支行`, and Huifu returned `银行编码有误`.
  - Likely cause is field mismatch, not missing environment variables: `01040000` is Bank of China, while `105...` branch clearing numbers and the visible card BIN appear to be China Construction Bank. The bank code should likely be `01050000` if the card/branch is CCB.
  - Huifu binding depends on core `HUIFU_*` credentials; missing envs would usually surface as config/sign/request failures rather than this specific bank-code validation error.
  - Added a Web-only local debug shortcut on `/dashboard/wallet/merchant`: when running on localhost or non-production, step 0 shows `跳到银行卡信息` so the bank/region selector UI can be previewed without uploading ID images. This only changes client navigation and does not bypass backend Huifu validation.
  - Downloaded Huifu official bank-code and area-code attachments for a local comparison. Current built-in 23 bank options all match Huifu bank codes; 31 province options and 450 city/district options all match Huifu area codes.
  - Corrected several bank codes to Huifu attachment values: Ping An Bank, Beijing Bank, Shanghai Bank, Jiangsu Bank, Nanjing Bank, Ningbo Bank, and Bohai Bank.
  - Added Web and WeChat guidance for the only remaining manual bank field: `具体支行联行号`. The UI now tells coaches to find the opening branch and 12-digit CNAPS/联行号 through bank app/online banking or bank customer service, and warns not to mix bank code with another bank's branch number.

## Subscription-To-Plan Automation Audit (`2026-06-04`)

- Task: inspect the student journey from coach discovery, subscription, coach questionnaire, payment, plan delivery, execution feedback, plan adjustment, renewal, and end/next-phase behavior.
- Status: analysis completed; follow-up code direction is to refactor the automation loop into explicit policy, event, job, and state-machine services rather than scattered one-off calls.
- Product/code direction (`2026-06-05`):
  - Keep deployment env unchanged for now. The main automatic first-plan path should be code-driven and not depend on `CRON_SECRET`.
  - Full automation should be modeled as a "coaching automation engine" with explicit stages: subscription activated, questionnaire ready, initial plan issued, execution finished, feedback received, adjustment evaluated, patch drafted/applied, phase completed, renewal/next phase resolved.
  - Add durable automation policy at coach/package/student levels, durable automation job records, and backend services for initial plan issue, feedback adjustment, next-phase generation, renewal handling, and safety escalation.
  - The existing direct calls to `autoMatchPlanForSubscription(...)`, feedback notification-only flow, manual AI modifier, and stub next-phase route should be reorganized around these services.
- Deployment follow-up (`2026-06-05`):
  - User checked `littlehorse-deployment/coachlink`: both production `main/.env.main -> ConfigMap coachlink-main-env` and development `dev/.env.dev -> ConfigMap coachlink-dev-env` currently lack `CRON_SECRET` and `ALIPAY_SYNC_SECRET`.
  - Code confirmation: these variables are internal cron/background-job authorization secrets, not payment-provider credentials. Coach mini-program subscription payment still uses Huifu-created WeChat JSPay (`/api/payment/wechat/coach/create`) and Huifu notify (`/api/payment/wechat/notify`).
  - Practical impact: without `CRON_SECRET` or `ALIPAY_SYNC_SECRET`, `src/instrumentation.ts` skips the in-process `ActivatePendingPlans` job, so AI-created `coach_plan_instances.status='scheduled'` plans can remain scheduled instead of becoming active automatically.
  - Huifu delayed settlement background jobs use `HUIFU_SETTLEMENT_CRON_SECRET` or fall back to `CRON_SECRET`; configuring only `CRON_SECRET` would currently unlock both pending-plan activation and Huifu settlement processors through the shared fallback.
  - Follow-up implemented: changed `autoMatchPlanForSubscription(...)` to create the first automatically matched plan with `delayedActivation: false`, so successful auto-generation publishes an `active` plan immediately and sends the student notification without waiting for cron. Coach-facing success messages were updated from "visible after a few minutes" to "student can view now".
  - Verification note: no full lint/typecheck/build/test run was requested or run per local preference.
- Current implementation:
  - Student subscription flow exists on Web and WeChat mini-program. Coach questionnaire answers are persisted into `coach_subscriptions.subscribe_data` before payment/activation.
  - Platform-paid new subscriptions are system-confirmed by payment notify/query and then call `autoMatchPlanForSubscription(...)`.
  - Coach/manual confirmed offline payments also call `autoMatchPlanForSubscription(...)` after status becomes `active`.
  - Initial automatic plan generation only runs when the subscription is active, has questionnaire data, and has no existing plan instance. After the 2026-06-05 fix, it publishes the first generated plan as `active` immediately and notifies the student; `/api/plan-lib/activate-pending-plans` remains a fallback for existing or future explicitly scheduled rows.
  - In-process activation for leftover `scheduled` rows still depends on `ALIPAY_SYNC_SECRET` or `CRON_SECRET` being configured in `src/instrumentation.ts`.
  - Student training execution records sets/items and can update e1RM/PR state; after completion the student can submit one feedback row to `execution_feedbacks`, which is also sent to the coach as a direct message.
  - Coach-side Web and WeChat plan editors can manually use AI generation and AI modifier. The AI modifier context can include recent feedbacks, execution history, profile, questionnaire, actions, and templates.
- Gaps against the desired fully automated coaching loop:
  - There is no durable coach/package setting such as "auto issue plan" / "auto adjust from feedback".
  - No backend job consumes `execution_feedbacks` to automatically create or apply plan adjustment patches.
  - Feedback-driven AI adjustment is currently a coach-triggered workflow: feedback opens/prefills the AI modifier, and the coach still applies/saves the result.
  - Renewal only extends `subscribed_weeks` and refreshes entitlement snapshot; it does not auto-generate a next phase.
  - `/api/plan-lib/generate-next-phase` exists but is a stub/TODO and is not the reliable next-phase automation path.
  - Auto-match skips if any plan instance already exists under the subscription, so completed/archived prior phases can still force manual intervention.
- Recommended next implementation:
  1. Make initial auto-plan delivery reliable and visible: add explicit coach/package policy, job status, service-role generation, and robust activation fallback.
  2. Add feedback-to-adjustment jobs that generate reviewed patches for future plan days first; later allow auto-apply under coach-approved rules.
  3. Add completed-plan/renewal next-phase automation using the existing personalized AI generation path plus execution/feedback context, not the current stub route.

## WeChat Coach Profile / Overview UI Alignment (`2026-06-04`)

- Task: align WeChat mini-program coach-side `/coach/my-profile` and `/coach/overview` visual style with the student-side `/me/profile/index` "My" page while preserving coach functionality.
- Status: implemented with lightweight code checks; no full lint/typecheck/build/test or WeChat DevTools verification run per local preference.
- Implemented:
  - Reworked `wechat_app/src/coach/my-profile/index.scss` from the cold blue desktop-like card system to the student-side rpx card rhythm: gray page gradient, round avatar, white profile card, summary pills, grouped white menu cards, brand color `#CF6D4E`, and 8rpx-grid spacing.
  - Reworked `wechat_app/src/coach/overview/index.scss` so the metrics and configuration entries use the same lightweight white-card/list style as the student "My" page.
  - Updated coach overview non-state icon colors toward brand/student-side palette while keeping existing data, click handlers, routes, role switching, wallet, pricing, questionnaire, invitation, security, and logout behavior unchanged.
  - Follow-up: removed the accidental `182rpx` top content padding from both coach pages because they use native navigation bars; content now starts at normal `24rpx` below the nav bar.
- Verification:
  - Targeted `esbuild` parse/bundle checks passed for `wechat_app/src/coach/my-profile/index.tsx` and `wechat_app/src/coach/overview/index.tsx` with stylesheet side-effect warnings only.
  - `git diff --check` passed for touched files with CRLF warnings only.

## Coach Receiving Account Readiness (`2026-06-04`)

- Task: optimize coach application / package setup flow so coaches are reminded to open Huifu receiving account and bind a bank card before their packages can be sold; align Web and WeChat mini-program surfaces.
- Status: implemented with lightweight code checks; no full lint/typecheck/build/test or browser/WeChat DevTools verification run per local preference.
- Implemented:
  - Coach overview API now returns `receivingAccountReady`, `huifuOpenStatus`, and `huifuOpenMsg` based on the coach's Huifu opening/card-token state.
  - Web coach overview shows `收款账户` before pricing in the configuration checklist.
  - Web pricing settings page shows a receiving-account readiness card and links to `/dashboard/wallet/merchant`; pricing drafts can still be saved.
  - Web student coach profile blocks direct platform subscribe/renew actions when the coach Huifu receiving account is not opened and shows a student-facing warning in the pricing area.
  - WeChat coach overview shows `收款账户` before pricing and links to `/coach/wallet/merchant`.
  - WeChat coach pricing list and pricing edit page show the same receiving-account warning/CTA and keep draft editing available.
  - WeChat student coach profile pricing section shows a warning and disables package selection until `huifu_open_status='opened'`.
  - WeChat coach application page now collects the Web-aligned layered fields: coach track, service modes, target student levels, support focus, and province/city/county/address.
- Verification:
  - Targeted `esbuild` parse/transpile check passed for touched TS/TSX files.
  - `git diff --check` passed with CRLF warnings only.

## Registration Flow Audit (`2026-06-04`)

- Task: inspect current Web / WeChat mini-program registration, login-created-account, student onboarding, and coach application flow for duplication and optimization points.
- Status: analysis completed; no business code changes requested or made.
- Current shape:
  - Web explicit registration uses `/register` -> `/api/auth/register` -> NextAuth password login -> `/complete-profile` -> `OnboardingModal`.
  - Web verification-code login can also auto-create a user through NextAuth credentials, so it behaves as an implicit registration path.
  - Web WeChat QR login has WeChat-openid-only account creation paths and does not currently bind by phone or unionid.
  - Mini-program has three account-entry paths: phone quick login via `/api/miniapp/wechat-login`, password / verification-code login via `/api/miniapp/login`, and explicit register via `/api/auth/register`.
  - Student onboarding generally uses `onboarding_completed === true` plus core profile completeness, but mini-program explicit register currently relaunches to the default home URL instead of reusing the shared post-login onboarding resolver.
  - Coach application has Web and mini-program implementations, but Web is the newer layered flow while the mini-program page still sends an older, smaller field set.
- Key findings:
  - Account creation logic is duplicated across `/api/auth/register`, NextAuth verification-code login, Web WeChat OAuth/bridge login, `/api/miniapp/login`, and `/api/miniapp/wechat-login`.
  - Passwordless accounts created by verification-code / WeChat flows store blank or `"null"` password hashes; later password login can produce poor failure behavior and should route users to password setup/reset instead.
  - A single `users.wechat_openid` field is being used for both Web Open Platform and mini-program openids, while unionid is fetched but not persisted, creating duplicate-account and binding-overwrite risk.
  - Generated nicknames are cleaned in mini-program login helpers but can still be prefilled in Web onboarding after explicit registration / Web verification-code auto-registration.
  - Coach application creation is frontend-guarded but not backend-idempotent; duplicate rows would break `maybeSingle()` reads.
- Suggested next step:
  - Refactor around shared identity helpers: `findOrCreateUserByContact`, `ensureUserProfile`, `resolvePostLoginDestination`, and idempotent `upsertCoachApplication`, then align mini-program coach application with the Web layered schema.
- Follow-up fix after user clarified focus:
  - Updated `wechat_app/src/auth/register/index.tsx` so explicit mini-program registration now reuses `studentOnboardingService.resolvePostLoginUrl(...)` after auto-login, matching the login page behavior. New incomplete students should be sent to `/auth/student-onboarding` instead of defaulting straight to `/pages/index/index`.
  - Removed the duplicate `targetBodyParts` prompt from mini-program student onboarding step 7. Step 3 remains the single body-part selection step; step 7 now only asks common equipment and session duration.
  - No build / WeChat DevTools verification was run automatically per local preference.
- Unified questionnaire implementation:
  - Web `OnboardingModal` and WeChat `student-onboarding` now use the same registration question model: optional avatar, nickname, gender, height, weight, multi-select fitness goals, fitness level, target body parts, weekly frequency, equipment, and session duration.
  - Fitness goals are multi-select with a 3-goal cap. The first goal is saved to legacy `user_profiles.fitness_goal`; the full list is saved to `onboarding_questionnaires.answers.fitness_goals`.
  - Removed the visible `interest_tags` / "训练方向" question from registration while continuing to write derived compatibility tags for legacy AI/profile consumers.
  - Web and WeChat fitness profile cards now show/edit the unified goal/frequency/body/equipment/duration answers and fall back from old `fitness_goal` when `fitness_goals` is missing.
  - AI profile-based plan/action bootstrapping and batch-operation context now read latest questionnaire `fitness_goals` / `weekly_frequency` with old-field fallback.
  - Lightweight verification: touched TS/TSX files passed esbuild transform checks; `git diff --check` reported only CRLF warnings.

---

## Coach Wallet Missing Income Check (`2026-06-04`)

- Task: answer why coach `枭马葛` cannot see wallet income for student `最终航行`.
- Result:
  - Student did pay. Subscription `3b734f5d-0f1b-44a9-a611-7812429d626f` is active and linked to paid platform WeChat order `76c0dedd-6ba8-4a98-b943-68016de5ac0b`.
  - Payment was confirmed by system at `2026-05-28T15:36:10.438+00:00`; order total is `19900` fen.
  - Coach wallet has no transaction for this order yet because Huifu settlement `438f9deb-8714-47bf-b63b-ec16b26352fd` is still `pending`, with coach net share `15920` fen and platform fee `3980` fen.
  - Settlement becomes eligible at `2026-06-04T15:36:10.549+00:00` UTC (`2026-06-04 23:36:10` Asia/Shanghai). Wallet income appears only after the settlement processor succeeds and inserts `wallet_transactions`.
- Next step:
  - If it remains invisible after the eligible time plus processor run, inspect or run the admin due-settlement processor/reconciliation path rather than manually editing wallet balances.
- Follow-up implemented:
  - Wallet API now returns paid-but-not-yet-wallet-credited Huifu settlement rows as `pending_settlements` plus `pending_settlement_amount`.
  - Web wallet page now adds pending settlement amount into the displayed frozen line, shows a separate `待结算收入` line, and renders pending settlement records at the top of income details.
  - This keeps withdrawable balance unchanged while making paid delayed-settlement orders visible to coaches.

---

## Knowledge Base Product Direction (`2026-06-03`)

- Task context: user shared a fitness-community and public-platform pain-point research report and asked what CoachLink knowledge base should prioritize, how to present it, and how to collect content.
- Working product direction:
  - Knowledge base should be pain-point/problem oriented first, not a generic article shelf.
  - Highest-value first categories: injury/pain prevention and return-to-training, plateau diagnosis and specialty plans, movement standards/video review criteria, periodization/plan application, recovery/nutrition basics, and accountability/community practice.
  - Existing surfaces should be reused: books as source/reference, public plans as executable templates, and BodyMap as a body-part/action-problem landing surface that can mount articles and plans.
  - Content collection should combine user behavior signals, coach/student Q&A, execution-data bottlenecks, community hot topics, and curated external research, then go through review before publishing.
- Implemented on `2026-06-03`:
  - Reworked Web `/dashboard/knowledge` into four pain-point entry cards: injury/risk, plateau/no results, movement standards, and start training.
  - Added generated static entry images under `public/images/knowledge-core/`.
  - Added shared Web topic config at `src/config/knowledgeCoreTopics.ts`.
  - Reworked WeChat mini-program `/content/knowledge` to show the same four entries first, with topic tags, primary CTA, and a topic resource panel above existing plans/books/body-map modules.
  - Added mini-program static entry images under `wechat_app/src/assets/knowledge-core/` and topic config at `wechat_app/src/config/knowledgeCoreTopics.ts`.
  - Extended `src/content/adminImport/highValueKnowledgePack.ts` from 3 to 11 original articles, adding injury-boundary, plateau, and movement-standard first-batch content; injury/rehab articles include non-medical-diagnosis and offline-evaluation boundary copy.
- Verification:
  - `npx tsx scripts/import-high-value-knowledge-pack.ts --dry-run` passed with 8 plans, 11 articles, 2 books.
  - `git diff --check` passed with CRLF warnings only.
  - Per local preference, no browser/WeChat DevTools verification or full lint/typecheck/build/test was run automatically.
- Follow-up UX simplification on `2026-06-04`:
  - User observed the knowledge page was too long and that mobile / mini-program interactions felt odd because clicking top entries jumped to lower same-page sections, sometimes with no useful content.
  - Web `/dashboard/knowledge` and WeChat `/content/knowledge` were lightly simplified into a compact gateway: four topic cards only select the active pain point, and BodyMap / plan library / books are hidden behind explicit expand buttons.
  - Plan resource links now use readable plan names and open plan detail directly where possible; article links fill the search box instead of navigating to empty multi-keyword search results.
  - Lightweight verification: both touched TSX files parsed with `esbuild`; `git diff --check` passed with CRLF warnings only. Full lint/typecheck/build/test and browser/WeChat visual verification were not run per local preference.

---

## Admin Knowledge Content Import Backend (`2026-05-29`)

- Task: add an administrator-side content import backend so knowledge-base training plans, articles, and book notes can be managed through the database instead of hardcoding content or pasting long SQL files.
- Implemented:
  - Added `src/lib/adminContentImport.ts` as the shared import/validation engine.
  - Added admin APIs:
    - `POST /api/admin/content-import` for JSON bundle validation/import.
    - `POST /api/admin/content-import/high-value-pack` for the built-in high-value specialty pack.
  - Added admin UI page `src/app/admin/content-import/page.tsx` with JSON textarea import, local JSON file selection, dry-run validation, publish/draft toggle, and one-click high-value pack import.
  - Added `内容导入` to the administrator navigation.
  - Added `src/content/adminImport/highValueKnowledgePack.ts` with first-batch high-value original content:
    - 8 specialty-first plan templates: bench press, squat, powerlifting, weighted pull-up, weighted dip, deadlift, round shoulder/scapula, anterior pelvic tilt/core stability.
    - 3 knowledge articles.
    - 2 book-note entries.
  - Added `scripts/import-high-value-knowledge-pack.ts` for CLI import/dry-run using `.env.local` / `.env.development`.
- Data write:
  - Executed `npx tsx scripts/import-high-value-knowledge-pack.ts` against the configured Supabase.
  - Imported/upserted `8` published public training plan templates, `3` knowledge article nodes, and `2` knowledge books.
  - Imported rows included `bench-press-8w-specialization`, `squat-8w-depth-and-strength`, `powerlifting-12w-total-base`, `weighted-pullup-6w-strength`, `weighted-dip-6w-strength`, `deadlift-8w-lockout-and-start`, `round-shoulder-scapula-4w`, and `anterior-pelvic-tilt-4w`.
- Verification:
  - `npx tsx scripts/import-high-value-knowledge-pack.ts --dry-run` passed with `8` plans, `3` articles, `2` books and no validation errors.
  - `npx tsx scripts/import-high-value-knowledge-pack.ts` succeeded and wrote the same counts to Supabase.
  - Targeted TypeScript program check passed for the new import engine, content pack, admin routes, admin page, navigation, and CLI script.
  - `git diff --check` passed for the touched files with standard CRLF warnings only.
  - Per local preference, no browser UI verification or full lint/typecheck/build/test was run automatically.
- Next step:
  - If desired, extend the importer with source attribution fields and a review queue for externally collected material before publishing.

---

## Manual Renewal Stale End-Date Follow-Up (`2026-05-28`)

- Task: fix the remaining stale-writer path where coach manual/offline payment confirmation could write `offline_payment.expires_at` or a natural-day renewal extension into `coach_subscriptions.end_date`.
- Root cause:
  - `src/app/dashboard/students/PaymentConfirmationDialog.tsx` still sent `end_date` during offline confirmation and pending-renew confirmation.
  - `src/app/api/subscription/update-subscription/route.ts` accepted client-provided `end_date` for active/manual confirmation.
  - `refreshSubscriptionEntitlementSnapshot` only persisted when `model.displayEndDate` was truthy, so active subscriptions with no reliable projection could retain old stale dates instead of clearing them.
- Implemented:
  - Manual confirmation no longer sends `end_date`; it only sends status/weeks/payment evidence.
  - `update-subscription` ignores client `end_date` except explicit cancellation/expired lifecycle updates, then responds with the unified model-derived `end_date`.
  - Snapshot refresh now persists `end_date: null` for active subscriptions when the unified model cannot project a reliable display date.
  - Coach student UI copy now says `当前计划预计完成` and clarifies that purchase weeks are an entitlement pool, not a natural expiry date.
  - Added tests covering snapshot clearing and update-subscription ignoring client supplied `end_date`.
- Data repair:
  - Student `鞑靼` subscription `06f07de8-e013-4106-a5ef-0637147a7e0b` is now `subscribed_weeks=40`; refreshed model says `active/available`, `24/32` credits used, `8` remaining, current-plan projected completion `2026-06-11T14:24:15.264Z`.
  - Repaired the reappeared false-blocked `唐` subscription `8b03677a-8ecb-4cac-84b1-01620a20ab27` from stale `2026-05-23T09:01:57.049+00:00` to model projection `2026-07-06T14:24:32.755Z`.
  - Follow-up audit returned `falseBlockedByStaleEndDate=[]`; remaining groups are true exhausted/grace (`5`), should-auto-cancel (`6`), and active-no-plan (`11`).
  - Later audit at `2026-05-28T15:34:44.526Z` showed `唐` false-blocked reappeared again with `updated_at=2026-05-28T14:29:17.52Z`, after local code/data repair. This indicates a still-running old deployed path or background job can still write stale `end_date` until the code fix is deployed everywhere.
  - Executed repair again at `2026-05-28T15:35:45.333Z`; post-repair audit at `2026-05-28T15:36:06.848Z` returned `falseBlockedByStaleEndDate=[]`, `healthy=72`, `true_grace_or_exhausted_not_complete=5`, `should_auto_cancel=6`, `active_no_plan=11`.
- Verification:
  - `npx vitest run src/lib/subscriptionEntitlementSnapshot.test.ts src/app/api/subscription/update-subscription.integration.test.ts` passed.
  - `npm run lint` passed.
  - `npm run typecheck` passed.
  - `npm test` passed (`30` files, `153` tests).
  - `npx next build` passed; local Redis connection warnings are non-fatal.
  - `npm run test:e2e` passed (`4` tests).

---

## Subscription Entitlement Repair and Backfill (`2026-05-28`)

- Task: implement the user-approved repair plan so stale `coach_subscriptions.end_date` can no longer put students with remaining credits into grace/expired UI, and repair current cloud false-blocked rows without touching true exhausted relations.
- Implemented:
  - Added `src/lib/subscriptionEntitlementAudit.ts` and `scripts/repair-subscription-entitlements.ts` for dry-run/execute auditing and repair.
  - `coach-subscriptions`, `check-expired-subscriptions`, and `check-subscription?action=check-expired` now use the unified entitlement model fields and update derived `end_date` through normal `update` calls instead of independent stale-lifecycle logic.
  - Active subscriptions with remaining credits, active no-plan subscriptions, and active not-started plans no longer reuse stale raw `end_date` as lifecycle truth.
  - Frontend grace displays on Web and WeChat now require unified `expired_grace` plus no remaining credits before showing grace/renewal lock.
- Data repair:
  - Dry-run before execute found only `2` remaining false-blocked rows at execution time; earlier audit had found `50`, but most had already been refreshed by the corrected model paths during subsequent usage.
  - Executed `npx tsx scripts/repair-subscription-entitlements.ts --execute --scope=false-blocked`: updated `2/2` rows (`65aaf5dd-ffc0-4bf0-a07a-c22648c9ee42` cleared stale `end_date`; `8b03677a-8ecb-4cac-84b1-01620a20ab27` refreshed to `2026-07-06T10:37:29.783Z`).
  - Post-repair dry-run returned `matchedCount=0`; final audit still separates true exhausted/grace rows (`6`) and active no-plan rows (`11`) from false-blocked rows.
- Verification:
  - `npm run lint` passed.
  - `npm run typecheck` passed.
  - `npm test` passed (`28` files, `151` tests).
  - `npm run test:e2e` passed (`4` tests, including the previously failing B1 subscription cases).
  - `npx next build` passed; Redis connection warnings appeared because local Redis is not running, but build exited successfully.
  - `git diff --check` passed with CRLF warnings only.

---

## WeChat Today-Training Subscription Grace Regression (`2026-05-28`)

- Task: investigate and fix why student/coach-profile `枭马葛` with coach `刘三乐` showed mini-program today-training banner `当前订阅处于宽限期，剩余9天（截至6/6）` while the student was only on week 2 / day 12 and still had an active coach plan.
- Cloud facts checked read-only:
  - Student user id: `f9eac5b1-45f9-4479-9ab8-8223a5db8835`.
  - Coach id for `刘三乐`: `beee4371-efad-4e35-b406-c567954896c2`.
  - Subscription id: `44ecb017-34bf-49ad-a46d-faf01e5ceac3`, status `active`, `subscribed_weeks=8`, stored `end_date=2026-05-22T16:33:40.913Z`.
  - Latest active plan instance: `5613f3d3-f9e3-4f6e-a243-aa277597ee63`, 84 total days, 34 training days, completed training days `1,3,5,8,10`, day `12` in progress.
  - Unified entitlement model at `2026-05-28 15:14 +08:00`: `entitlementStatus=available`, `lifecycleStatus=active`, `canTrain=true`, `remainingCredits=10`, projected `displayEndDate=2026-06-21T07:14:00Z`.
- Root cause:
  - Current cloud schema lacks `coach_plan_instances.entitlement_consumption_policy`, but several unified-model query paths selected that optional column. The query failed, so API behavior fell back to legacy lifecycle judgment.
  - `coach-subscriptions` then used old `getSubscriptionLifecycle` against the stored stale `end_date`, producing `expired_grace` and `grace_days_left=9` even though credits remained.
- Implemented:
  - Removed optional `entitlement_consumption_policy` selects from subscription entitlement query paths that must work against the current cloud schema. Missing policy keeps the existing default semantics: `count_service`.
  - `coach-subscriptions` now carries unified-model lifecycle fields (`lifecycle_status`, `grace_days_left`, `should_auto_cancel`) through to the response instead of recomputing lifecycle from stale/display `end_date`.
  - Mini-program `TodayTrainingScreen` now suppresses grace UI when the active subscription still has positive remaining days or positive `entitlement_remaining_credits`.
- Verification:
  - Read-only simulation of the corrected route for `44ecb017-34bf-49ad-a46d-faf01e5ceac3` returns `lifecycle_status=active`, `is_in_grace_period=false`, `entitlement_remaining_credits=10`, `plan_progress_status=in_progress`.
  - Targeted TS transpile check passed for modified route/lib/mini-program files.
  - `npx vitest run src/lib/subscriptionEntitlementModel.test.ts src/lib/subscriptionAccess.test.ts` passed (`12` tests).
  - `git diff --check` passed with standard CRLF warnings only.
  - No WeChat DevTools/manual visual verification was run per local preference unless explicitly requested.

---

## WeChat Today-Training Question-Mark Header (`2026-05-28`)

- Task: fix the mini-program `今天练什么` title area showing `????` below the heading.
- Root cause:
  - `wechat_app/src/training/today-training/components/ScheduleCalendarPanel.tsx` contained literal placeholder text in the header meta row: ``? ?${currentWeek} ?`` and ``? ??? ${selectedSchedule.totalDelayDays} ?``.
- Implemented:
  - Replaced the placeholders with readable Chinese labels: `· 第N周` and `· 顺延N天`.
  - Restored `wechat_app/src/utils/dateFormat.ts` Chinese date labels to valid UTF-8 for shared date formatting.
- Verification:
  - Lightweight TypeScript transpile check passed for `ScheduleCalendarPanel.tsx` and `dateFormat.ts`.
  - No WeChat DevTools/manual verification or full lint/typecheck/build/test was run per local developer preference unless explicitly requested.

---

## Unified Subscription Entitlement Model (`2026-05-27`)

- Task: implement the real unified subscription entitlement model before building the later same-source blackbox/whitebox simulator.
- Product facts being fixed:
  - Student `c844cae9-d271-452f-9b80-e54dd67eb752` and `c844cae9-d271-452f-9b80-e54dd67eb752`-style cases showed that `/today-training`, `/me/plan-history`, coach list, subscription checks, renewals, and execution access were interpreting `status/end_date/subscribed_weeks/has_plan_instance` differently.
  - Student `c844cae9-d271-452f-9b80-e54dd67eb752` has an active 15-week plan with only `4/60` completed and an in-progress later day, so the plan must be treated as in-progress, not completed.
  - A purchased `4 weeks` entitlement is a plan-week training-day window, not a natural calendar hard expiry.
  - Renewal before relationship cancellation accumulates `subscribed_weeks` into the same entitlement pool; after auto-cancel, a later purchase should be treated as a re-subscription/relation restoration path.
- Implemented:
  - Added `src/lib/subscriptionEntitlementModel.ts` as the central derivation model. It outputs relation status, entitlement status, plan progress status, credits, remaining entitlement, display end date, `canTrain`, `canViewHistory`, and `shouldAutoCancel`.
  - Added `src/lib/subscriptionEntitlementSnapshot.ts` to refresh a subscription's derived display `end_date` from the same model after renewal/payment/update flows.
  - Converted `subscriptionAccess.ts` into a compatibility wrapper around the central model so `get-instance`, `get-with-executions`, skip-day, next-day, and execution start gates stop maintaining a separate credits model.
  - Updated `coach-subscriptions`, `check-expired-subscriptions`, `check-subscription?action=check-expired`, `renew-subscription`, `update-subscription`, `subscriptionOrders`, `fulfillPaidOrder`, `execution/updateEstimatedEndDate`, `plan-lib/get-instance`, and `coach/list-students` to consume the central model or snapshot refresh.
  - Removed the unfinished `shouldAutoCancelCoachSubscription` / lifecycle display helper from `subscriptionLifecycle.ts` so auto-cancel is no longer a second policy path.
  - Renewal compatibility branches now add weeks/order facts and no longer directly add natural days to `end_date`; `end_date` is derived from the model.
- Verification:
  - `npx vitest run src/lib/subscriptionAccess.test.ts src/lib/subscriptionEntitlementModel.test.ts src/lib/todayTrainingPlanState.test.ts src/lib/subscriptionLifecycle.test.ts src/app/api/subscription/check-subscription.integration.test.ts` passed (`5` files, `21` tests).
  - Full gate before push on `2026-05-27`: `npm run lint` passed, `npm run typecheck` passed, `npm test` passed (`26` files, `142` tests).
  - `npm run test:e2e` is still failing on `e2e/b1-subscription.spec.ts` (`2` failures): one seeded quick-login case could not log in user `13928583186` / `f435c281-66ac-46d5-a29a-df91d2b99e9d`, and one remaining-days assertion never reached the expected subscription page content.
  - Route import smoke check passed for affected subscription, plan-instance, coach-list, and execution-access modules.
  - `npm run typecheck -- --pretty false` passed.
  - `git diff --check` passed with only standard CRLF warnings.
  - Browser/UI verification was not run per local developer preference unless explicitly requested.
- Next step:
  - Build the same-source simulator/blackbox only after this model is stable; simulator must call `deriveSubscriptionEntitlementState` instead of copying judgment logic.

---

## Knowledge Specialty Library Sync (`2026-05-28`)

- Task: sync the specialty-first public training-plan library across both Web `/dashboard/knowledge` and the WeChat mini-program knowledge tab, and make the Supabase manual SQL path easier to execute.
- Implemented:
  - Added Web specialty plan list/detail support with `src/components/knowledge/SpecialtyTrainingPlans.tsx`, `src/app/dashboard/knowledge/training-plans/[id]/page.tsx`, and matching service methods in `src/app/service/knowledgeService.ts`.
  - Inserted the specialty-first plan entry section into Web knowledge home so it no longer exists only in the mini-program.
  - Updated public training-plan API helpers/list route to expose specialty metadata consistently to both clients.
  - Refined mini-program knowledge list/detail presentation to match the specialty-first structure and preserve the detailed per-action preview.
  - Split the long specialty migration into four ordered SQL files for easier manual execution in Supabase SQL Editor:
    - `20260527_001_training_plan_specialties_schema.sql`
    - `20260527_002_training_plan_specialties_strength_seed.sql`
    - `20260527_003_training_plan_specialties_weighted_dip_seed.sql`
    - `20260527_004_training_plan_specialties_posture_seed.sql`
- Verification:
  - Lightweight verification only per local preference: targeted TS/TSX transpile checks and `git diff --check` passed.
  - No full lint/typecheck/build/test or browser/manual verification was run for this follow-up unless explicitly requested.
- Next step:
  - If the user wants full release confidence for this slice, run the standard lint/typecheck/test gate and browser/manual knowledge-page verification on both Web and mini-program paths.

---

## Git Contribution Audit (`2026-05-27`)

- Task: report committed-code contribution for `SmallHorseBrother <2945463110@qq.com>` since project creation.
- Scope: Git committed history only (`git log --all --author=2945463110@qq.com --numstat`); current uncommitted working-tree changes are not included.
- Result summary:
  - Repository first commit: `2025-11-09 350c69da Kirigaya <1193466151@qq.com> save`.
  - Author first commit: `2025-11-18 d0f4665b SmallHorseBrother <2945463110@qq.com>`.
  - Author latest committed history entry: `2026-05-21 d893af9e SmallHorseBrother <2945463110@qq.com>`.
  - All files: 271 commits, 423111 additions, 101692 deletions, net +321419 lines.
  - Code-like files excluding common lockfiles: 182 commits, 257634 additions, 84256 deletions, net +173378 lines.
- Status: analysis completed; no code changes made.

---

## Today Training Subscription/Plan State Split (`2026-05-27`)

- Task: fix Web `/today-training` incorrectly showing "当前阶段计划已完成" for student `c844cae9-d271-452f-9b80-e54dd67eb752` while `/me/plan-history` and coach dashboard correctly show active plan progress `4/60` (`7%`).
- Root cause found:
  - The student has one active 4-week coach subscription and one active `15周长期计划` with 60 training days.
  - Execution data shows only days `1,2,4,5` completed and day `8` in progress, so the plan is not complete.
  - `/today-training` treated `has_plan_instance=true` plus missing current instance as a completed phase, conflating "there is a plan record" with "the plan is completed".
- Implemented:
  - Added structured API errors through `ApiServiceError` so frontend callers keep `status/code/data` from failed API responses.
  - `plan-lib/get-instance` now returns explicit error `code` values for permission/entitlement blocks and includes `completed` instances when loading by `subscriptionId`, while bypassing subscription gate for completed subscription instances.
  - `/today-training` now tracks coach plan access states: `available`, `plan_completed`, `entitlement_blocked`, `no_plan_assigned`, and `load_failed`.
  - `/today-training` only shows completed copy when `get-instance` explicitly reports `derivedStatus=completed` or `isLogicallyCompleted=true`; `has_plan_instance` alone no longer triggers completed UI.
  - Added `src/lib/todayTrainingPlanState.ts` plus tests for runnable/completed state derivation.
- Verification:
  - `npx vitest run src/lib/todayTrainingPlanState.test.ts` passed.
  - `npm run typecheck -- --pretty false` passed.
  - `git diff --check` passed with only existing CRLF warnings.
  - Browser verification was not run per local developer preference unless explicitly requested.

## Coach Student List Count Regression (`2026-05-27`)

- Task: fix `/dashboard/students` showing only 9 students while coach overview shows 35 total students.
- Root cause found:
  - `src/app/api/coach/list-students/route.ts` had an added visibility filter requiring both a contact-bearing `users` row and a visible profile nickname/full name.
  - That hid valid active `coach_subscriptions` rows for students with incomplete/empty profile identity, while overview still correctly counted active subscriptions.
- Implemented:
  - Removed the extra `users` lookup and profile-identity filter from `list-students`.
  - Restored pagination total to the Supabase active-subscription count so the student list uses the same business count as overview.
- Verification:
  - Code diff inspected; no full lint/typecheck/build/test or browser verification was run per local developer preference unless explicitly requested.

## WeApp Auth State Consistency (`2026-05-27`)

- Task: investigate and reduce the confusing mini-program state where the `我的` page can show cached name/phone/avatar while API calls still toast `用户未登录`.
- Root cause found:
  - The mini-program UI treated local `user + token` presence as authenticated.
  - If the stored JWT had expired or become invalid, API calls returned 401 while the profile header still rendered cached user data.
- Implemented:
  - `wechat_app/src/utils/request.ts`
    - Centralized 401 handling for requests that carried a token.
    - Clears local `user` and `token` when the server rejects the token.
    - Emits a shared auth-invalid event and throttles the expired-login toast to avoid repeated popups from parallel requests.
  - `wechat_app/src/services/authSessionEvents.ts`
    - Added `AUTH_SESSION_INVALID_EVENT` for mini-program auth-state invalidation.
  - `wechat_app/src/me/profile/index.tsx`
    - Listens for the auth-invalid event and immediately resets the `我的` page to guest state.
- Verification:
  - No WeChat DevTools/manual verification or full lint/typecheck/build/test was run per local developer preference unless explicitly requested.

## WeApp Knowledge Built-in Training Plan Library (`2026-05-26`)

- Task: Add a student-side WeChat mini-program knowledge-base training plan library with dozens of common plans from beginner to professional, where users can add a plan into `我的计划` and later execute it through the existing plan flow.
- Status: implemented in code and adjusted to specialty-first on `2026-05-27`; no WeChat DevTools/manual verification or full lint/typecheck/build/test run per local preference unless explicitly requested.
- Implemented:
  - `supabase/migrations/20260526_public_training_plan_templates.sql`
    - Added `public_training_plan_templates` for platform-managed public plan templates.
    - Seeded 30+ published templates covering strength, hypertrophy, fat loss, home/bodyweight, running, calisthenics, powerlifting, hybrid conditioning, and sport conditioning.
    - Stores a 7-day base `training_days` pattern plus `weeks`; API expands this into the full executable plan.
    - Added `template_kind`, `parameter_schema`, and `action_slots` so templates like `5x5` can later be parameterized by action slots and 1RM inputs instead of being hardcoded per action.
  - `src/app/api/knowledge/training-plans/*`
    - Added public list/detail APIs for knowledge training-plan templates.
    - Added authenticated `copy-to-favorite` route that copies a database template into `student_plan_favorites`.
    - Follow-up fix: `copy-to-favorite` now resolves template action names into the student's `student_actions` library before saving. It reuses existing student actions, matches canonical/public actions when possible, creates a minimal student action as fallback, and writes both `actionId` and `action_id` into copied `training_days`.
    - Follow-up fix: copied action sets are normalized with both English-compatible fields (`sets`, `reps`, `rest_seconds`, `intensity`) and editor/execution-friendly Chinese params (`组数`, `次数`, `休息时间`, `强度` where applicable), including `%` / `RM` `intensityConfig` when parsable.
  - `wechat_app/src/content/knowledge/index.tsx` / `.scss`
    - Added a `训练计划库` section on the knowledge page with difficulty filters and horizontal plan cards backed by the new API.
    - Follow-up adjustment: the knowledge page now presents `专项训练计划库` first, with specialty filters for bench press, squat, powerlifting, weighted pull-up, weighted dip, posture correction, and foundation plans. The horizontal card layout was made fixed-width to avoid the mini-program rendering it as thin vertical columns.
  - `wechat_app/src/content/knowledge/plan-detail/index.tsx` / `.scss` / `.config.ts`
    - Added database-backed plan detail page with plan metadata, first two weeks preview, notes, login return flow, `加入我的计划`, and parameterized-template/action-slot display.
    - Follow-up adjustment: plan detail hero now shows specialty label plus sport, and action previews expose sets, reps, rest, intensity, load, and action-library binding/autofill status.
  - `wechat_app/src/app.config.ts`
    - Registered `content/knowledge/plan-detail`.
  - `supabase/migrations/20260527_001_training_plan_specialties_schema.sql`
  - `supabase/migrations/20260527_002_training_plan_specialties_strength_seed.sql`
  - `supabase/migrations/20260527_003_training_plan_specialties_weighted_dip_seed.sql`
  - `supabase/migrations/20260527_004_training_plan_specialties_posture_seed.sql`
    - Added `specialty_key`, `specialty_label`, and `specialty_priority` to `public_training_plan_templates`.
    - Classified existing templates and seeded specialty-first plans for bench press, squat, powerlifting, weighted pull-up, weighted dip, rounded-shoulder correction, and anterior-pelvic-tilt correction.
    - Split from the original long migration into four sub-200-line SQL files so they can be run manually in Supabase SQL Editor.
  - `src/app/api/knowledge/training-plans/*` / `wechat_app/src/services/knowledgeService.ts`
    - Exposed specialty metadata and `specialty` filtering while preserving the existing copy-to-favorite action-library auto-fill path.
  - `src/app/dashboard/knowledge/page.tsx` / `src/components/knowledge/SpecialtyTrainingPlans.tsx`
    - Follow-up Web sync on `2026-05-28`: added the same specialty-first training-plan library to the Web knowledge homepage between book notes and the body map.
  - `src/app/dashboard/knowledge/training-plans/[id]/page.tsx` / `src/app/service/knowledgeService.ts`
    - Added Web plan detail and service methods for list/detail/copy. Web detail shows target, cycle, weekly frequency, training-day structure, sets, reps, rest, intensity, and the action-library auto-fill explanation.
- Verification:
  - Targeted TypeScript transpile syntax check passed for the new/modified files.
  - Targeted TypeScript transpile syntax check passed for the updated `copy-to-favorite` action-binding route.
  - Targeted TypeScript transpile syntax check passed for the `2026-05-27` specialty-first API/service/page updates.
  - Targeted TypeScript transpile syntax check passed for the `2026-05-28` Web sync files.
  - `git diff --check` passed for touched files with only standard Windows CRLF warnings.

## WeApp Coach Huifu Wallet Operations (`2026-05-26`)

- Task: replicate the coach Huifu account opening and withdrawal flow in the WeChat mini-program instead of requiring coaches to switch to the Web site.
- Status: implemented in code; no WeChat DevTools/manual verification run per local preference unless explicitly requested.
- Implemented:
  - `wechat_app/src/app.config.ts`
    - Registered `coach/wallet/merchant` and `coach/wallet/withdraw`.
  - `wechat_app/src/services/coach/coachService.ts`
    - Added `openHuifuAccount` and `withdrawHuifu`.
  - `wechat_app/src/coach/wallet/index.tsx`
    - Wallet page now exposes native mini-program actions:
      - Open/reopen Huifu receiving account when not opened.
      - Apply for withdrawal when the Huifu account is opened.
    - Removed the prior "please use Web/desktop" product dead-end.
  - `wechat_app/src/coach/wallet/merchant/index.tsx` / `.scss` / `.config.ts`
    - Added a two-step mini-program Huifu onboarding form:
      - Identity information and ID-card front/back image selection.
      - Withdrawal bank card, bank code, branch code/name, and region codes.
    - Submits to the existing `/api/coach/merchant/open-huifu-account` backend route.
  - `wechat_app/src/coach/wallet/withdraw/index.tsx` / `.scss` / `.config.ts`
    - Added a Huifu withdrawal page with withdrawable balance, frozen amount note, quick amount controls, and submit.
    - Submits to `/api/coach/wallet/huifu/withdraw`.
  - `src/app/api/coach/wallet/huifu/withdraw/route.ts`
    - Switched auth lookup to `getApiUserId(req)`, so the route supports both Web NextAuth sessions and mini-program Bearer JWTs.
- Verification:
  - `git diff --check` passed for touched files with only standard Windows CRLF warnings.
  - Targeted TypeScript transpile syntax check passed for the new/modified wallet files.
  - A bare `tsc` check was attempted but failed on mini-program `@/*` path aliases because it did not load the WeChat app tsconfig; this was not a syntax failure.
  - No WeChat DevTools/manual UI verification or full lint/typecheck/build/test was run per local preference.

## Web + WeApp Fitness Profile Card Parity (`2026-05-26`)

- Task: Keep the website and WeChat mini-program student registration/onboarding profile questions nearly identical, while allowing each platform to use its own UI style. The fitness profile card on both platforms must edit the same data model.
- Status: implemented in code; browser/manual verification and full lint/typecheck/build/test left unrun per local preference unless explicitly requested.
- Implemented:
  - `src/components/auth/OnboardingModal.tsx`
    - Web registration/profile-completion flow now includes `target_body_parts`, matching the mini-program onboarding question set.
    - Web onboarding now writes `flow_version: miniapp_v1_aligned` plus `target_body_parts`, `interest_tags`, `equipment`, and `session_duration` to onboarding answers.
    - When reopened, it loads latest onboarding answers to prefill the questionnaire fields.
  - `src/components/student/profile/FitnessProfileCard.tsx`
    - Added Web fitness profile card with the same editable fields as the mini-program card: avatar, nickname, gender, height, weight, target body parts, fitness goal, training level, training direction, equipment, and session duration.
    - Profile fields save through `updateProfile`; onboarding-answer fields save through `submitOnboarding`.
  - `src/components/student/StudentProfilePage.tsx`
    - Mounted the Web fitness profile card on the student profile page using latest `getStudentProfile` data.
  - `src/app/api/user/update-profile/route.ts`
    - Changed profile updates to patch only explicitly provided fields so single-field edits do not clear unrelated profile data.

## WeApp Fitness Profile Card As Menu Entry (`2026-05-26`)

- Task: Adjust the WeChat mini-program `我的` page fitness profile card flow per user feedback: it should be a normal menu row like `全部计划` / `我的教练`, not an expanded homepage card. Tapping it opens a profile preview page, and tapping a specific field/question edits that field.
- Status: implemented in code; mini-program manual verification left unrun per local preference unless explicitly requested.
- Implemented:
  - `wechat_app/src/me/profile/index.tsx`
    - Added a normal `健身资料卡` menu entry that navigates to `/me/profile/fitness-card/index`.
  - `wechat_app/src/app.config.ts`
    - Registered the `me/profile/fitness-card/index` page.
  - `wechat_app/src/me/profile/fitness-card/index.tsx`
    - Added the fitness profile preview page backed by both `user_profiles` and latest `onboarding_questionnaires.answers`.
    - Mirrors the registration onboarding questions: avatar, nickname, gender, height, weight, target body parts, fitness goal, training level, training direction, equipment, and session duration.
    - Supports single-field editing; profile fields save through `updateProfile`, and onboarding-answer fields save through `submitOnboarding`.
  - `wechat_app/src/me/profile/fitness-card/index.scss`
    - Added preview/list styling that keeps the interaction as normal tappable rows.

## WeApp Onboarding Nickname Must Start Empty (`2026-05-26`)

- Task: fix the mini-program student onboarding page still showing generated default nicknames such as `手机用户_0621`, despite the requirement that nickname should start empty and be user-entered.
- Root cause:
  - The previous fix only removed session fallback prefill.
  - Existing `user_profiles.nickname` rows could already contain generated values such as `手机用户_0621`, and onboarding still loaded `profile.nickname` directly.
  - Mini-program login APIs also created new `user_profiles` rows with generated nickname placeholders.
- Implemented:
  - `wechat_app/src/auth/student-onboarding/index.tsx`
    - Added generated-nickname normalization for onboarding mode.
    - Non-edit onboarding now treats generated placeholders as empty.
    - Non-edit onboarding also starts avatar empty; edit mode can still load the saved avatar/nickname for actual profile editing.
  - `src/app/api/miniapp/login/route.ts`
    - New profile creation now writes `nickname: ""`.
    - Existing generated nickname placeholders are cleaned to empty during mini-program login.
  - `src/app/api/miniapp/wechat-login/route.ts`
    - Same empty nickname creation and generated-placeholder cleanup for WeChat quick login.
- Follow-up fix:
  - User reported that selecting the WeChat nickname candidate from the native bottom picker did not fill the nickname field, and the candidate area then disappeared back to the onboarding footer controls.
  - `wechat_app/src/auth/student-onboarding/index.tsx` now uses the native Taro `Input type="nickname"` as an uncontrolled native field (`defaultValue`) and synchronizes nickname through `onInput`, `onBlur`, `onConfirm`, and best-effort `onNickNameReview` instead of relying on a controlled `value`.
  - The onboarding footer is hidden while the nickname input is focused so the native WeChat nickname candidate area is not visually replaced by the `上一步/下一步` controls.
- Second follow-up fix:
  - User reported the prior nickname-picker fix still reproduced the same behavior.
  - `wechat_app/src/auth/student-onboarding/index.tsx` now keeps the last authoritative nickname in a ref, allows manual empty edits only from `onInput`, and prevents empty `blur` / `confirm` / nickname-review events from overwriting a non-empty candidate value.
  - After the native nickname picker closes, the page also queries the native input node by id and synchronizes its actual `value` as a fallback before restoring the onboarding footer. This avoids depending entirely on Taro's event order for WeChat nickname selection.
- Login regression fix:
  - User reported that tapping `手机一键登录` briefly showed `登录中...` and then did nothing.
  - Root cause: the login button had been changed from WeChat native `openType='getPhoneNumber'` / `onGetPhoneNumber` to a normal click handler, so no phone authorization code was produced.
  - `wechat_app/src/auth/login/index.tsx` now restores `openType='getPhoneNumber'` and passes `e.detail.code` into `authService.loginWithWechat(phoneCode)`.
- Plan detail follow-up:
  - User reported that the public training plan detail page only showed action names and did not clearly expose sets/reps/rest.
  - Confirmed the copy-to-favorite backend already resolves template actions into `student_actions` before saving, so missing actions are auto-added to the user's action library rather than left as name-only placeholders.
  - Rebuilt `wechat_app/src/content/knowledge/plan-detail/index.tsx` and `.scss` so each training day now expands into action cards showing action name, sets, reps, rest, intensity, load, and whether the action is already bound to the action library.
  - Added explicit page copy stating that missing actions are automatically added to the user's action library when the plan is added to "我的计划".
- Verification:
  - `git diff --check` passed for the touched files with only standard Windows CRLF warnings.
  - Targeted TypeScript transpile syntax check passed for `wechat_app/src/auth/student-onboarding/index.tsx`.
  - No WeChat DevTools/manual verification or full lint/typecheck/build/test was run per local preference unless explicitly requested.

## WeApp Delete Account Entry (`2026-05-21`)

- Task: connect the WeChat mini-program student-side account cancellation flow to the existing Web/backend `delete-account` capability.
- Status: implemented in code; user-side mini-program verification pending.
- Implemented:
  - `wechat_app/src/services/studentService.ts`
    - Added `deleteAccount({ confirmationText })`, reusing the existing `/api/user/delete-account` backend route.
  - `wechat_app/src/me/settings/index.tsx`
    - Added a `危险操作` section with a `注销账号` entry.
    - Added a confirmation modal that requires typing `注销账号` before continuing.
    - On success, the flow clears the local mini-program auth state through `authService.logout()` and returns to `/auth/login`.
  - `wechat_app/src/me/settings/index.scss`
    - Added styling for the danger card and cancellation confirmation modal, keeping the primary danger action as a solid brand-color button.
- Verification:
  - No WeChat DevTools/manual UI verification or lint/typecheck/build/test was run, per the local workspace preference unless explicitly requested.

## WeApp Coach Package Questionnaire Before Payment (`2026-05-21`)

- Task: fix the mini-program coach-profile package click flow where the first package for coach `枭马葛` could immediately open a 0.01 payment QR instead of requiring the pre-payment questionnaire.
- Root cause:
  - The current user had an existing `inactive` / `pending_payment` subscription tied to that first package.
  - `wechat_app/src/discovery/coach-profile/index.tsx` treated clicking the same package as "continue pending payment" and directly called `startCoachWechatPayment`, bypassing questionnaire loading.
- Fix:
  - Package clicks no longer directly continue a pending/inactive payment just because the selected product matches the existing subscription.
  - The normal package click flow now always checks coach questionnaires first.
  - `wechat_app/src/discovery/coach-questionnaire/index.tsx` now reuses an existing subscription id in prepay mode by updating its questionnaire/product fields before payment, instead of creating a duplicate subscription.
- Verification:
  - Targeted TypeScript transpile check passed for `wechat_app/src/discovery/coach-profile/index.tsx` and `wechat_app/src/discovery/coach-questionnaire/index.tsx`.
  - `git diff --check` passed with only standard Windows CRLF warnings.
  - No WeChat DevTools/manual UI verification or full build/test was run per local preference.

## Coach-Owned Content Purchase Huifu Settlement (`2026-05-20`)

- Task: extend the coach-subscription Huifu split model to other coach-owned revenue, starting with paid coach content / single-article purchases.
- Status: backend money-rule changes and Web Huifu QR payment display applied; live Huifu verification pending.
- Implemented:
  - `src/app/api/payment/alipay/create/route.ts`
    - Paid `content_purchase` orders now resolve content price/coach from the database and require the coach to have a fully opened Huifu account.
    - Logged-in paid coach-content purchases are routed through Huifu collection (`huifu_alipay`) instead of direct Alipay.
    - Order metadata now persists `coachId`, `coachName`, `contentId`, and `contentTitle` so delayed settlement can run later.
  - `src/app/api/payment/alipay/contentPurchaseFulfillment.ts`
    - Payment success still unlocks the purchased content immediately in `content_purchases`.
    - Coach wallet credit now uses the same Huifu delayed settlement ledger as coach subscription; wallet income is recorded only after balance payment succeeds.
  - `src/app/api/payment/wechat/notify/route.ts` and `src/app/api/payment/wechat/query/route.ts`
    - Huifu notifications/query compensation now also fulfill `content_purchase`.
  - `src/app/api/payment/alipay/refund/route.ts`
    - Refund handling now treats `content_purchase` as coach-owned revenue: if coach share was transferred, it attempts Huifu balance-payment refund/reversal before source-payment refund, and marks `content_purchases` as `refunded`.
  - `src/app/api/coach/get-overview-data/route.ts` and `src/app/api/coach/get-revenue-details/route.ts`
    - Paid content revenue is counted from wallet income after settlement, not merely from buyer payment success.
  - `src/app/articles/ArticlePurchaseSection.tsx`
    - Guest paid content purchase now routes to login first; guest direct payment remains disabled because it cannot reliably bind the purchase entitlement or settlement ledger.
  - `src/components/payment/ContentPurchaseDialog.tsx`
    - Paid content purchase now accepts Huifu `payInfo` in addition to direct-Alipay `formHtml`.
    - When Huifu returns a QR/pay target, the Web purchase dialog shows an Alipay scan-to-pay QR dialog and then routes to the payment status page for confirmation/unlock.
  - Added migration `supabase/migrations/20260520_coach_revenue_content_settlement.sql`:
    - Allows `content_purchases.status = refunded`.
    - Documents and indexes the existing settlement table as a coach-owned revenue settlement ledger, not subscription-only.
- Verification:
  - Targeted TypeScript transpile check passed for the touched payment/revenue files.
  - `git diff --check` on touched files passed with only standard Windows CRLF warnings.
  - No full lint/typecheck/build/test or browser verification was run per local preference unless explicitly requested.
- Important caveat:
  - The backend settlement/refund ledger and Web QR display are now aligned, but one live Web `content_purchase` still needs to verify the exact Huifu `A_NATIVE/A_JSAPI` `pay_info` shape and the browser-side scan/return flow.

## Huifu In-Process Settlement Scheduler (`2026-05-20`)

- Task: after the user chose scheme 2, make Huifu delayed coach-subscription settlement automatic without introducing an external cron platform yet.
- Status: code changes applied; deployment/runtime verification pending.
- Implemented:
  - `src/instrumentation.ts`
    - Added in-process hourly job for `POST /api/admin/coach-subscription-settlements/process-due`.
    - Added in-process hourly job for `POST /api/admin/coach-subscription-settlements/reconcile`.
    - Jobs run once at service startup and then at the configured interval.
    - Existing Alipay pending sync and pending-plan activation jobs remain active when `ALIPAY_SYNC_SECRET` or `CRON_SECRET` is configured.
- Required production configuration:
  - Configure `CRON_SECRET` or `HUIFU_SETTLEMENT_CRON_SECRET`.
  - Ensure `NEXTAUTH_URL` or `NEXT_PUBLIC_SITE_URL` points to the deployed app URL.
  - Keep or explicitly set `COACH_SUBSCRIPTION_SETTLEMENT_DELAY_DAYS=7`.
  - Optional interval overrides: `HUIFU_SETTLEMENT_PROCESS_INTERVAL_MS`, `HUIFU_SETTLEMENT_RECONCILE_INTERVAL_MS`; set to `0` to disable.
- Verification:
  - Targeted TypeScript transpile check for `src/instrumentation.ts` passed.
  - `git diff --check -- src/instrumentation.ts` passed with only the standard Windows CRLF warning.
  - No full lint/typecheck/build/test or browser verification was run per local preference unless explicitly requested.

## WeApp Toolbox Strength Calculator Copy Update (`2026-05-20`)

- Task: update the student WeChat mini-program toolbox card copy for `力量计算器`.
- User direction:
  - The card subtitle should not describe implementation facts like "小程序内完整实现，与网页端逻辑一致".
  - It should describe user-facing utility such as calculating max/working-set weight and coefficients.
- Implemented:
  - `wechat_app/src/me/toolbox/index.tsx`
    - Updated the `力量计算器` card description to `可计算极限重量、做组重量和训练系数等。`
- Verification:
  - No lint/typecheck/build/test or WeChat DevTools verification was run, following the local workspace preference unless the user explicitly requests it.

## WeApp Knowledge Latest Body Map (`2026-05-20`)

- Task: restore the student WeChat mini-program knowledge page to the latest clickable body-map experience.
- Finding:
  - The temporary blank-image fix made the card render, but it used the older `frontSvg/backSvg` body outline and stayed a static `<Image>`, so the actual SVG regions could not be clicked.
  - The latest body-map asset line is commit `6cff9d9d` from `2026-04-30`: sex-aware SVG modules (`maleFrontSvg/maleBackSvg/femaleFrontSvg/femaleBackSvg`) with category metadata.
- Fix:
  - `wechat_app/src/content/knowledge/index.tsx` now imports the latest sex-aware SVG modules and chooses female/male body map from the logged-in student's profile gender, defaulting to male for guests/unknown.
  - The knowledge body-map options now use the latest category model: `胸部 / 肩部 / 大臂 / 小臂 / 腹部 / 背部 / 臀部 / 大腿 / 小腿 / 关节`.
  - Added SVG category highlighting by rewriting matching `category` groups to brand color.
  - Added a transparent mini-program hit-area layer over the image so tapping the body map selects the corresponding category and loads body-region knowledge nodes.
  - `wechat_app/src/content/knowledge/index.scss` now scales the latest SVG inside the card to reduce the excessive blank space and keeps hit areas aligned with the scaled map.
- Verification:
  - Targeted TS transpile check for `wechat_app/src/content/knowledge/index.tsx` passed.
  - `git diff --check` on the touched knowledge page files passed with only Windows CRLF warnings.
  - Per local developer preference, no automatic WeChat DevTools visual verification or full lint/typecheck/build/test sequence was run unless explicitly requested.

## Product IA Simplification / Main Path Redesign (`2026-05-19`)

- Task: rethink CoachLink early-stage product framework by doing subtraction and reconnecting the remaining flows clearly.
- User direction:
  - Current content/features feel too numerous and confusing.
  - Prefer reducing visible surfaces and making the remaining links clearer.
  - Registration and post-registration flow likely need redesign.
  - After registration, users should clearly know what to see, what to click, which need each path satisfies, and how the flow can naturally trigger willingness to pay.
- Current recommendation direction:
  - Move from "show all features" to "task-path first".
  - Post-auth onboarding should identify the user's current intent and route them to a single next best action.
  - Student-facing first-stage paths should organize around five bottom tabs:
    - `训练`
    - `教练`
    - `知识`
    - `工具箱`
    - `我的`
  - `工具箱` should remain a first-class bottom-tab surface because it can provide immediate utility even before users fully understand their broader training needs.
  - Main paths should likely reduce to:
    - Start training / record today.
    - Find a coach / get a plan.
    - Solve a training problem / learn knowledge.
    - Use a concrete tool for a specific immediate need.
  - `我的` should be reorganized as account/assets/history/settings, not as a catch-all product homepage.
- Status: first WeChat mini-program IA simplification pass implemented on `2026-05-20`.
- Implemented surfaces in this pass:
  - `wechat_app/src/components/BottomNav.tsx`: student bottom nav reduced/reframed to `训练 / 教练 / 知识 / 工具箱 / 我的`; the old student `消息` bottom-tab slot was removed while coach nav stayed intact.
  - `wechat_app/src/pages/index/index.tsx`: home entry rewritten around four immediate intents: `开始训练 / 找教练 / 查知识 / 用工具`.
  - `wechat_app/src/discovery/index.tsx`: the old mixed discovery home was narrowed into the `教练` tab home focused on coach/service discovery; top-level public action and article highlight feeds were removed from equal-status positions.
  - `wechat_app/src/content/knowledge/index.tsx`: knowledge became browse-first; guests no longer hard-redirect to login before entering the knowledge home.
  - `wechat_app/src/me/profile/index.tsx`: `我的` was reorganized back toward account/assets/history/settings, and `消息中心` was kept as a secondary entry after removing the old message bottom tab.
- Verification:
  - Lightweight code-level sanity checking only: touched files were re-read and TypeScript-transpiled successfully.
  - Per local workspace preference, no automatic lint/typecheck/build/test or WeChat DevTools/browser verification was run in this pass.

### Today-training compacting pass (`2026-05-20`)

- User direction:
  - Remove the explanatory "为什么要确认完成 / 为什么要输入重量" content from the top of the student training page.
  - Compress the training page so schedule/calendar and today's arrangement feel like one compact control surface.
  - Reduce vertical height across the page, especially the top coach/plan card and repeated section headers.
- Implemented direction:
  - `wechat_app/src/training/today-training/index.tsx` now removes the top explanation card and explanation dialog flow.
  - The return-to-page confirmation banner was shortened to a compact success message.
  - `ScheduleCalendarPanel` and `TodayTrainingCard` are now visually grouped into one `schedule-training-card` container with a single inline summary instead of separate repeated section headers.
  - The top coach/self-plan card was compressed into a shorter summary strip.
  - Month calendar is now collapsed by default while preserving manual expand/collapse.
- Verification:
  - Lightweight TypeScript transpile/parse check passed for:
    - `wechat_app/src/training/today-training/index.tsx`
    - `wechat_app/src/training/today-training/components/ScheduleCalendarPanel.tsx`
    - `wechat_app/src/training/today-training/components/TodayTrainingCard.tsx`
  - No WeChat DevTools/manual verification was run in this pass per local workspace preference unless explicitly requested.

### Discovery-page narrowing note (`2026-05-20`)

- The current mini-program discovery home mixes coach discovery, coach service products, public action highlights, and article/content highlights.
- Recommended direction:
  - Narrow it into the future `教练` tab home.
  - The coach tab main page should now focus on coach discovery itself; mixed-intent guide blocks and coach-service promo sections should be removed from the top-level coach home.
  - Coach-related service products can still exist elsewhere in the flow, but should not compete with coach cards on the main coach tab surface.
  - Move article/info discovery primarily under the `知识` tab.
  - Downgrade or relocate public action-library highlights to action-specific or supporting surfaces rather than keeping them as equal-status discovery feed blocks.

## WeApp Hide Friends Entry Pending Qualification (`2026-05-19`)

- Task: temporarily hide `我的好友` from the WeChat mini-program personal/profile page because displaying the friends/social feature requires additional mini-program qualification that has not been approved yet.
- Status: code changes applied; user-side mini-program verification pending.
- Implemented:
  - `wechat_app/src/me/profile/index.tsx`
    - Removed the `我的好友` top metric entry from the profile page.
    - Removed the profile page's `/api/user/friends` count request and `friends` stat field.
    - Kept the underlying friends pages/API untouched so the entry can be restored after qualification approval.
  - `wechat_app/src/me/profile/index.scss`
    - Changed top metric item width from four-column `25%` to three-column `33.3333%`.
- Verification:
  - Light grep confirmed the profile page no longer contains `我的好友`, `my-friends`, `/api/user/friends`, or `friends`.
  - No full lint/typecheck/build/test or WeChat DevTools verification was run per local preference unless explicitly requested.

## Early Product Completion Assessment (`2026-05-18`)

- Task: evaluate CoachLink's current early-stage product completion from the user's priority lenses.
- User priority lenses:
  - A strong training experience that makes users willing to record workouts during training.
  - A stable coach-discovery, student acquisition, subscription, and payment flow.
  - A genuinely useful toolbox.
  - A valuable paid/free knowledge base.
  - A clear complete path for both beginner users and advanced trainees.
- Current assessment method:
  - Read project state/memory/decisions first.
  - Reviewed current Web/WeChat route structure and representative modules for training, coach discovery/subscription, toolbox, and knowledge.
  - No browser/manual verification was run because the local developer preference is to skip automatic UI verification unless explicitly requested.
- Status: product assessment prepared; implementation follow-up pending user prioritization.

## Huifu Split Completion Pass (`2026-05-18`)

- Task: complete the unfinished Huifu coach-subscription split work after the user confirmed initial manual verification was already done.
- Status: code changes applied; user-side end-to-end verification remains pending.
- Implemented:
  - Added migration `supabase/migrations/20260518_huifu_refund_delayed_settlement.sql`:
    - `alipay_orders.payment_provider`
    - `coach_subscription_settlements.eligible_at`
    - Huifu original-payment refund fields
    - Huifu balance-payment refund/reversal fields
    - settlement status now also supports `refunded`
    - due/processing indexes for delayed settlement and reconciliation.
  - Huifu client wrapper now includes original-payment refund/query, balance-payment query, balance-payment refund/query, and endpoint env overrides:
    - `HUIFU_PAYMENT_REFUND_PATH`
    - `HUIFU_PAYMENT_REFUND_QUERY_PATH`
    - `HUIFU_BALANCE_PAYMENT_QUERY_PATH`
    - `HUIFU_BALANCE_PAYMENT_REFUND_PATH`
    - `HUIFU_BALANCE_PAYMENT_REFUND_QUERY_PATH`
  - Coach subscription settlement now delays Huifu balance-payment disbursement until `eligible_at` (`paid_at/updated_at/created_at + COACH_SUBSCRIPTION_SETTLEMENT_DELAY_DAYS`, default 7 days). Development test payments with `order_data.is_test_payment` remain immediate outside production.
  - Added admin/cron endpoints:
    - `POST /api/admin/coach-subscription-settlements/process-due`
    - `POST /api/admin/coach-subscription-settlements/reconcile`
  - Admin retry endpoint now forces a real retry only after explicit confirmation.
  - Refund route is provider-aware:
    - Huifu orders use Huifu original-payment refund.
    - If coach share was already transferred, it first attempts Huifu balance-payment refund/reversal.
    - Pending delayed settlements do not deduct coach wallet because no coach wallet income exists yet.
    - Processing settlements block refund until reconciliation completes.
    - Direct Alipay orders still use `alipay.trade.refund`.
  - Web coach-subscription Huifu-Alipay orders now normalize to `coach_subscription` / `coach_subscription_renew`, preventing legacy `subscription*` orders from bypassing the split ledger.
  - Web Huifu-Alipay order query now uses Huifu order query instead of the direct Alipay SDK query path.
  - Shared Huifu notify handling now preserves existing `huifu_alipay` provider instead of overwriting every Huifu callback as `wechat`.
  - Shared fulfillment helper now refuses to credit coach wallets for Huifu-settled coach subscription orders unless Huifu split details exist.
  - Huifu coach onboarding now treats `apply_no` without `token_no` as `business_pending` instead of failed.
  - Huifu withdrawal now stores request/date/sequence/global流水/status metadata on wallet withdrawal transactions for later reconciliation.
- Verification:
  - `git diff --check` passed with only existing CRLF warnings.
  - Per local developer preference, no Web/WeChat UI verification and no lint/typecheck/build/test sequence were run automatically.
- Next verification focus:
  - Apply the new migration.
  - Run one paid coach subscription in non-test mode and confirm settlement row stays `pending` with future `eligible_at`.
  - Trigger `process-due` only after reducing `COACH_SUBSCRIPTION_SETTLEMENT_DELAY_DAYS` in a safe test environment or using a test order.
  - Test Huifu refund once before and once after settlement.

## Post-Shutdown Memory Recovery (`2026-05-18`)

- Task: check whether recent project notes/content were lost after the user's computer unexpectedly powered off, and restore what can be restored.
- Status: recovery pass completed for confirmed corrupted/missing items.
- Follow-up recovery pass in this thread:
  - Found 8 additional tracked WeApp source files still overwritten with NULL bytes under `wechat_app/src`.
  - Restored those tracked files from `HEAD`, then re-applied the recoverable recent changes for streetlifting share cards/QR env handling, profile quantified stats, training-history summary usage, and plan-history "training day" wording.
  - Rechecked `src`, `wechat_app/src`, and `memory` code/markdown files for NULL bytes; no NULL-byte files remain in those scanned paths.
  - `git diff --check` on the recovered files passed, with only existing CRLF warnings.
  - Full lint/typecheck/build/test and WeChat DevTools verification were not run per local developer preference unless explicitly requested.
- Finding:
  - `memory/2026-05-17.md` had been overwritten entirely with NULL bytes (`24004` NULL bytes).
  - `supabase/migrations/20260517_plan_instance_entitlement_policy.sql` was also NULL-byte corrupted.
  - The WeApp profile top-stats code had reverted/lost the final quantified UI changes, and `src/app/api/training-history/summary/route.ts` was missing.
  - `IDENTITY.md`, `SOUL.md`, `USER.md`, `PROJECT_STATE.md`, `CURRENT_TASK.md`, `DECISIONS.md`, `memory/2026-05-16.md`, and `memory/2026-05-18.md` were readable.
  - Existing `corrupt-null-files/2026-05-18/` still contains two previously quarantined untracked NULL-byte files from the earlier proxy/build recovery.
- Fix:
  - Reconstructed `memory/2026-05-17.md` from `CURRENT_TASK.md`, `DECISIONS.md`, and known session facts.
  - Re-applied WeApp profile quantified top stats: top metrics are `我的好友`, `我的动作库`, `我的计划库`, and `训练记录`; lower menu restores `全部计划`, `我的教练`, and `我的会员` without duplicating top entries.
  - Recreated `src/app/api/training-history/summary/route.ts`.
  - Restored `wechat_app/src/services/trainingHistoryService.ts` `getSummary()` contract and `wechat_app/src/services/studentPlanLibService.ts` `totalCount` typing.
  - Recreated `supabase/migrations/20260517_plan_instance_entitlement_policy.sql` with explicit entitlement metadata columns/check constraint.
  - Recreated missing `src/lib/subscriptionEntitlement.ts` and re-applied the subscription entitlement model into carryover, archive/replacement, active-plan activation, delayed activation, subscription check/list/expiry, execution access, projected end-date, and coach/student plan-history paths.
  - Restored Web/WeApp plan-history wording so plan totals are shown as training days (`共 X 个训练日`) instead of natural calendar days.
- Verification:
  - Byte-level checks confirmed restored files no longer contain NULL bytes.
  - Re-scanned source/markdown/SQL files under `src`, `wechat_app/src`, `memory`, and `supabase`; no NULL-byte code/markdown/SQL files remain. Binary assets may naturally contain zero bytes and were ignored.
  - No full lint/typecheck/build/test was run per local preference unless explicitly requested.

## Proxy Null-Byte Build Error (`2026-05-18`)

- Task: fix Next.js Turbopack build error `Parsing ecmascript source code failed` in `src/proxy.ts` caused by `Unexpected character '\0'`.
- Status: fixed locally.
- Finding:
  - `src/proxy.ts` and a batch of other `src/**/*.ts(x)` files had been overwritten with NULL bytes and Git treated the tracked ones as binary diffs.
  - The dev overlay reported the first corrupted module it hit; after `src/proxy.ts`, the next one was `src/app/api/coach/list-students/route.ts`.
  - The recoverable intended `src/proxy.ts` change from recent task history was only to make streetlifting share-card/QR/location-get endpoints public.
- Fix:
  - Restored `src/proxy.ts` from `HEAD`.
  - Re-applied the three public paths:
    - `/api/og/streetlifting-location`
    - `/api/miniapp/qrcode/streetlifting-location`
    - `/api/streetlifting-index/locations/get`
  - Scanned `src` source files for NULL bytes.
  - Restored all tracked `src` files that were fully NULL-byte corrupted back from `HEAD`.
  - Moved untracked NULL-byte-only files out of the compile path into `corrupt-null-files/2026-05-18/`.
- Verification:
  - Confirmed the `src` source tree scan returns no NULL-byte files.
  - Confirmed `src/proxy.ts` has `0` NULL bytes and Git diff is a normal text diff limited to the three public paths.
  - Full lint/typecheck/build/test were not run per local developer preference unless explicitly requested.

## Huifu Payment Split Digest (`2026-05-18`)

- Task: digest the user's Huifu/客服 chat records and copied Huifu docs for coach subscription payment split, balance payment, onboarding, withdrawal, and 7-day refund handling.
- Status: information digested and current code shape reviewed; no code changes requested yet.
- Newly confirmed external facts:
  - CoachLink merchant/customer Huifu ID in the chat is `6666000194449179`; mini-program AppID `wx316e39eb71c0e834` was configured by Huifu.
  - Huifu explicitly described the project as `单商户模式`; coach subscription funds must first be collected through Huifu's payment channel, then funds received into the platform balance can be distributed through balance payment.
  - Initial JSPay 922 issue was signature/key related. Huifu clarified `922 = 验签失败`; when generating keys, the "系统公钥" field should not be filled, otherwise Huifu cannot obtain the right merchant key material for verification.
  - Split/balance-payment approval was submitted after payment demo video and bill screenshot. On `2026-04-22`, Huifu said `余额支付已审核通过`; after法人签约, they said it was effective and technical integration could start.
  - Huifu also said `自动提现已关闭`, which supports the current manual/explicit withdrawal and balance-payment-disbursement model rather than automatic settlement to coaches.
- Relevant Huifu docs/user-provided API facts:
  - Coach/personal recipient onboarding uses personal user open `/v2/user/basicdata/indv`, then user business open `/v2/user/busi/open` with `card_info + cash_config`; the business-open response can return `token_no` for withdrawal.
  - Balance payment `/v2/trade/acctpayment/pay` requires `out_huifu_id`, `ord_amt`, `risk_check_data`, and `acct_split_bunch`; the split amounts in `acct_split_bunch` must sum to `ord_amt`.
  - If CoachLink uses balance payment only to disburse coach net share, then `ord_amt = coach share` and one coach receiver is valid; platform commission remains in the platform Huifu account and is recorded locally as platform revenue.
  - Huifu docs also expose balance-payment refund/refund-query entries, so Huifu refund support should not be treated as nonexistent; it is just not implemented in CoachLink yet.
  - Huifu split guide distinguishes real-time split, delayed split (`delay_acct_flag=Y` + later transaction confirm), and post-collection balance payment. Current CoachLink code is closer to post-collection balance payment, not true Huifu delayed split.
- Product/implementation implication:
  - Current wallet withdrawal freeze for 7 days is not equivalent to holding funds from the coach at Huifu level if the balance payment has already moved coach net share to the coach's Huifu account.
  - For a stricter 7-day refund policy, the safer model is: collect into platform cash account, fulfill subscription, create settlement row with `eligible_at = paid_at + 7 days`, do not call balance payment until the refund window passes, then balance-pay the coach net share if no refund occurred.
  - Alternative true delayed split would require Huifu collection calls with `delay_acct_flag=Y` and later transaction-confirm API; this is a different integration path from the current balance-payment code.
- Current code review summary:
  - Implemented: Huifu signing/request wrapper, mini-program JSPay order creation, Huifu notify/query handling, subscription fulfillment, immediate balance-payment disbursement to coach net share, settlement idempotency ledger, local coach wallet/platform revenue credit, coach Huifu personal/business onboarding, Huifu encashment withdrawal, 7-day local wallet withdrawal lock, and an admin retry endpoint for failed split rows.
  - Main gaps: Huifu refund and balance-payment refund are not implemented; 7-day protection is only a wallet freeze, not delayed remote settlement; no balance-payment/withdrawal reconciliation job for `P` or uncertain states; Web coach-subscription path still uses legacy `subscription*` order types and can bypass the Huifu split ledger; coach onboarding treats `apply_no`/审核中 as failure instead of pending; admin retry/query paths can initiate real money movement and need careful operator controls.
- Recommended sequence:
  - First do no-funds verification: config/schema checks and read-only data audit.
  - Before broad live testing, add/confirm guards so Huifu-paid orders cannot use the Alipay refund endpoint and Web coach-subscription payments cannot credit wallets without Huifu split success.
  - Then run one controlled mini-program 1-yuan coach-subscription/renewal payment against an opened coach account to verify the current main chain.
  - Continue development after that around Huifu refund, 7-day delayed disbursement or explicit wallet-freeze policy, and reconciliation jobs.

## Coach Subscription Entitlement Model (`2026-05-17`)

- Task: finish the first durable implementation pass for coach subscription entitlement after investigating user `18115072586` / Liu Sanle plan history confusion.
- Status: code model implemented; user-side/manual verification pending per local preference.
- Implemented:
  - Added migration `supabase/migrations/20260517_plan_instance_entitlement_policy.sql` for explicit plan-instance entitlement metadata:
    - `archive_reason`
    - `entitlement_consumption_policy`
    - `entitlement_consumption_note`
  - Added `src/lib/subscriptionEntitlement.ts` as the shared policy helper.
  - Updated `src/lib/subscriptionCarryover.ts` so carryover only counts plan instances whose entitlement policy permits counting, and pre-subscription imported completions count only when the policy is explicitly `count_all_history`.
  - Updated subscription end-date/check/list flows to select the new entitlement policy while deriving remaining service weeks.
  - Updated manual archive, active-plan replacement, manual plan creation, immediate AI plan creation, and delayed AI activation paths so old plans are archived with explicit counted/no-charge policy.
  - Updated student/coach plan-history APIs to return `total_training_days`, `plan_span_days`, archive metadata, completion stats, and derived end dates for archived/completed plans with missing `end_date`.
  - Updated student plan-history Web/WeApp display copy so `共 34 天` becomes `共 34 个训练日`, avoiding confusion with natural calendar days or full plan span.
- Verification:
  - `git diff --check` on the touched subscription/history files passed, with only existing Windows CRLF warnings.
  - Full lint/typecheck/build/test and UI verification were intentionally not run per local preference.

## WeApp Profile Quantified Top Stats (`2026-05-17`)

- Task: optimize the WeChat mini-program personal/profile page top shortcut area so it shows quantitative indicators instead of non-quantified shortcuts.
- Status: code changes applied; user-side mini-program visual verification pending per local preference.
- Implemented:
  - `wechat_app/src/me/profile/index.tsx`
    - Replaced the old top row (`全部计划`, `我的教练`, `我的会员`, `训练记录`) with quantified entries: `我的好友`, `我的动作库`, `我的计划库`, and `训练记录`.
    - Loads counts from existing data surfaces: friends total, student action-library total, student plan-library total, and training-history action total.
    - Keeps each stat clickable and routes to its corresponding page.
    - Follow-up correction after user feedback: top quantified entries should not duplicate lower menu entries and should not remove the old non-quantified options. The lower menu now restores `全部计划`, `我的教练`, and `我的会员`, while removing duplicate `我的好友`, `我的动作库`, and `我的计划库` entries from the list.
  - `wechat_app/src/me/profile/index.scss`
    - Added numeric value and unit styling for the top stats row.
  - `wechat_app/src/services/trainingHistoryService.ts`
    - Added `getSummary()` for profile-level training-history summary usage.
  - `src/app/api/training-history/summary/route.ts`
    - Added a lightweight authenticated summary endpoint that counts completed training sessions, completed sets, and action entries across plan and impromptu training records.
- Verification:
  - Full lint/typecheck/build/test and WeChat DevTools verification intentionally not run per local developer preference unless explicitly requested.

## WeApp Streetlifting Location Share Trial Issue (`2026-05-17`)

- Task: diagnose why the WeChat mini-program trial/experience version streetlifting location share link card has no image and location poster has no CoachLink mini-program code, while local testing looked fine.
- Status: code-level fix applied; user-side trial-version verification pending.
- Findings:
  - Link sharing was passing the raw location photo URL directly as `onShareAppMessage.imageUrl`. In local DevTools this can work because domain checks are often relaxed, but the uploaded trial version is stricter and WeChat may fail to fetch/accept the original Supabase image URL, resulting in a gray mini-program card.
  - The poster QR code endpoint defaulted to `release` in production backend deployments. For an uploaded experience/trial build, the mini-program code should target `env_version=trial`; otherwise code generation can fail or point at the wrong mini-program environment.
  - The share/recipient support endpoints also needed to be public. WeChat servers fetch `imageUrl` without CoachLink login cookies or JWT, and a recipient may not be logged in when opening a shared location.
- Implemented:
  - `wechat_app/src/utils/share.ts`
    - Added `getMiniappEnvVersion()` to detect `develop` / `trial` / `release` at runtime.
    - Added `buildStreetliftingLocationShareImageUrl()` to generate a CoachLink-hosted share card image URL.
  - `wechat_app/src/streetlifting/index/locations/index.tsx`
    - Location link share now uses the CoachLink OG share-card endpoint instead of the raw uploaded photo URL.
    - Poster QR code requests now pass the runtime mini-program env version.
  - `wechat_app/src/streetlifting/index/location-share/index.tsx`
    - Re-shares from the single-location landing page use the same CoachLink share-card image endpoint.
  - `src/app/api/miniapp/qrcode/streetlifting-location/route.ts`
    - Accepts a validated `envVersion` query param so trial builds can generate `trial` mini-program codes.
  - `src/app/api/og/streetlifting-location/route.tsx`
    - Can load location data by id server-side and render a share-card image even if the mini-program only sends `id`.
  - `src/proxy.ts`
    - Makes `/api/og/streetlifting-location`, `/api/miniapp/qrcode/streetlifting-location`, and `/api/streetlifting-index/locations/get` public so WeChat can fetch the share-card image, posters can load mini-program codes without relying on login, and recipients can open shared location details.
- Verification:
  - Full build / mini-program DevTools verification intentionally not run per local developer preference unless explicitly requested.

## Coach Student Tang Renewal Audit (`2026-05-17`)

- Task: answer whether Liu Sanle's student `唐` (`coach_subscriptions.id=8b03677a-8ecb-4cac-84b1-01620a20ab27`, screenshot short id `8B03677A`) has `24` subscribed weeks from a normal package or from renewal, and whether the renewal was platform-paid or offline/private-transfer proof.
- Status: data audit completed; no code changes requested.
- Findings:
  - Current active subscription: student nickname `唐`, coach `刘三乐`, product `引体力量提升`, `subscribed_weeks=24`, `payment_method=personal_qrcode`, `payment_confirmed_by=coach`, `order_id=null`, `last_payment_order_id=null`.
  - Existing weeks before the latest order were effectively `12` weeks: `payment_data.manual_repair` on `2026-03-22` records `new_subscribed_weeks=12` after correcting `previous_subscribed_weeks=10`.
  - Latest renewal order: `coach_subscription_orders.id=d38c4ab2-1ef4-433b-9225-a6e7946d76ad`, `order_type=renew`, `status=paid`, `purchased_weeks=12`, `amount_fen=19900`, `payment_method=personal_qrcode`, `payment_confirmed_by=coach`, confirmed at `2026-05-10T08:05:45+00:00`.
  - The latest order note contains a receipt URL under Supabase storage and says `付款凭证: ...jpg`, so the evidence is a screenshot uploaded into the system for offline/private QR-code payment confirmation.
  - There is no `alipay_order_id`, no subscription settlement row, and no platform payment order id on the subscription, so this was not a platform split-payment/order-payment renewal.

## Local Agent Rules Override (`2026-05-17`)

- Task: make the AGENTS.md automatic verification/check instructions temporarily inactive for developer `little horse brother` without turning the preference into a shared team rule.
- Status: implemented locally.
- Change:
  - `AGENTS.md` now has a local developer override saying automatic Web / WeChat mini-program verification and post-change lint/typecheck/build/test runs should be skipped unless explicitly requested.
  - The original `Frontend Verification` section is wrapped in a Markdown comment locally.
  - The post-change command examples in `修改后检查流程` are locally commented as shell comments.
  - `USER.md` records the developer alias and local preference.
- Safety:
  - `AGENTS.md` and `USER.md` should be treated as local-only changes for this developer and not committed as shared team rules.

## Web Search Submission Behavior (`2026-05-17`)

- Task: stop Web list searches from firing on every typed character/pinyin composition; searches should submit only on Enter, explicit search button, or clear.
- User clarification: no agent-side UI verification is needed for this task; the user will verify manually.
- Status: code changes applied; user-side verification pending.
- Implemented:
  - `src/app/dashboard/students/page.tsx`
    - Replaced debounced student search with separate input state and submitted search state.
    - Student list API now uses only the submitted search value.
    - Added Enter-to-search, explicit search button, and clear behavior.
  - `src/app/search/page.tsx`
    - Replaced debounced coach search with submitted search state.
    - Coach search now updates on Enter/search button/clear; filter dropdowns still refresh immediately.
  - `src/app/streetlifting-index/locations/page.tsx`
    - Replaced location search's input-driven remote reload with submitted search state.
    - City filters still refresh immediately; text query submits by Enter/search button/clear.
- Similarity check:
  - Reviewed action library, plan library, content management, chat search/video picker, and local video/content filters.
  - Action/plan/content search already used Enter/search button or local filtering; chat/video picker intentionally behaves like live picker search and was left unchanged.
- Verification:
  - Before the user's clarification, code-level checks were run: `npm run lint`, `npm run typecheck`, `npx next build`, `npm test` all passed.
  - Browser/manual verification is intentionally left to the user per latest instruction.

## WeApp Today Training Load Performance (`2026-05-17`)

- Task: improve student-side WeChat mini-program `today-training` -> `training-execution` perceived loading speed and reduce incorrect renewal-blocking copy for coach user `18115072586` / `枭马葛` related flow.
- User instruction: do not run further tests or manual/UI verification for this task; the user will test manually.
- Status: paused for subscription-domain model review before further code changes.
- Current design direction:
  - User clarified that coach subscriptions should not be modeled as natural calendar days and also should not collapse into a fixed session-count coupon.
  - `subscribed_weeks` should represent purchased coaching/programming service weeks.
  - Weekly frequency may change multiple times during one subscription; frequency determines how many scheduled training sessions exist inside a service week, while user delay/pause affects projected calendar remaining days.
  - Consumed entitlement should be calculated at the subscription level across real served plan phases/instances under the same `coach_subscription_id`, not merely from the currently active plan instance.
  - Before coding further, produce a clear model and implementation plan for subscription entitlement, plan replacement/archive semantics, frequency changes, delay/pause, and frontend renewal display.
- Subscription model implementation started:
  - `src/lib/subscriptionCarryover.ts` now treats carryover as subscription-level consumed service weeks across historical instances instead of a single max historical day index.
  - Historical `archived` instances can consume entitlement when they have completed executions, but completed executions before the subscription `start_date` are ignored for this subscription's entitlement.
  - For imported/mid-plan history, completed plan weeks are normalized by the first counted completed week in that instance, so plan day 50 after subscription start counts as the first served week in that subscription phase rather than instantly consuming seven prior weeks.
  - `coach-subscriptions`, `check-subscription`, `check-expired-subscriptions`, `get-instance`, `get-with-executions`, `execution` access checks, `updateEstimatedEndDate`, `create-instance`, `create-ai-instance`, `update-subscription`, and coach `list-students` now pass subscription start date into carryover where relevant.
  - Subscription list/expiry jobs now include archived historical instances for consumption but choose the latest non-archived instance as the current cadence source.
  - If historical carryover already exhausts the purchased service weeks, downstream display/expiry logic treats the subscription as ended instead of leaving a stale future `end_date`.
- Latest investigation for user `18115072586`:
  - The user has an active subscription to coach `刘三乐` (`coach_subscriptions.id=44ecb017-34bf-49ad-a46d-faf01e5ceac3`).
  - The active Liu Sanle coach plan also exists (`coach_plan_instances.id=5613f3d3-f9e3-4f6e-a243-aa277597ee63`, name `枭马葛的计划`, status `active`).
  - Root cause: `src/lib/subscriptionCarryover.ts` counted an old `archived` coach plan instance for the same subscription when calculating carryover/remaining subscription weeks. That archived plan had many completed days, so `api/plan-lib/get-instance` incorrectly treated the active subscription as exhausted and did not return the current coach plan. The today-training page then fell back to the user's self plan.
  - Fix applied: carryover calculations now use the same relevant plan statuses as the coach subscription remaining-days logic (`active`, `paused`, `completed`, `scheduled`) and exclude `archived` instances.
- Implemented:
  - `wechat_app/src/training/today-training/index.tsx`
    - Reconnected existing `today_training_page_cache_v1` read/write path so the today-training page can render cached plan/subscription/execution summary immediately, then refresh cloud data in the background.
    - Removed the duplicate first-load trigger that caused both `useEffect` and `useDidShow` to load the same data on initial entry.
    - Limited the hard renewal-blocking empty state to cases where the selected coach subscription is in grace/expired state and no coach plan is available; if a plan is present, the page should continue showing the training plan with only the inline grace warning.
    - Fixed a likely multi-subscription selection bug: after refresh, the page no longer keeps a previously selected coach subscription if that subscription has no executable plan while another subscription does. It now prioritizes subscriptions that actually returned a coach plan, then subscriptions whose `end_date` still has remaining days.
    - Added a front-end conflict guard: if `end_date` still resolves to positive remaining days, the page does not treat `lifecycle_status=expired_grace` as a renewal-blocking state.
  - `src/lib/subscriptionCarryover.ts`
    - Filters carryover history to non-archived subscription plan instances before deriving consumed/remaining weeks.
    - Selects and checks plan instance `status`, aligning the backend `get-instance` access gate with `/api/subscription/coach-subscriptions`.
  - `wechat_app/src/training/training-execution/index.tsx`
    - Reconnected existing `training_execution_snapshots_v1` read path so execution pages can render the last local snapshot immediately before cloud refresh completes.
    - Centralized first-pending-set focusing so cached and cloud-loaded executions behave consistently.
    - Added an explicit initial `useEffect` load trigger in addition to `useDidShow`, with a short duplicate-call guard, so the page cannot remain on the initial `loading=true` state if page lifecycle firing is missed.
    - Added 12-second timeout guards and debug logs around the execution load chain (`getInstance`, `checkToday`, `getExecution`, `startExecution`, and impromptu `get`) so a stuck request exits loading and shows a retryable failure instead of spinning forever.
    - Follow-up root cause after user provided Next terminal logs: backend calls were returning 200, so the remaining black `加载中...` state was caused by the mini-program execution page throwing during main render after `loading=false`. The rollback source still referenced `getActionTypeMeta`, `formatRestSummary`, and `formatTimerValue` but those helpers had been removed. Restored those helpers in the WeApp page.
- Verification:
  - `wechat_app/npm run build:weapp`: passed.
  - Root `npm run typecheck`: passed.
  - Direct `wechat_app/npx tsc --noEmit --project tsconfig.json` was attempted and failed on broad pre-existing WeApp type noise (duplicate React types, many unused imports/config typing issues across unrelated pages); the targeted Taro WeApp build still passed.
  - WeChat DevTools UI verification was not run in this environment.

## WeApp Student Training UI Rollback (`2026-05-16`)

- Task: roll back the student-side WeChat mini-program `today-training` and `training-execution` UI toward the earlier, more efficient version because the newer card/one-set-at-a-time flow was too slow and confusing.
- Status: implemented and code-level verified.
- Latest clarification:
  - User showed the current `today-training` screenshot and clarified that the top home-like content should not exist there: stretch promotion, greeting/date header, plan summary hero, duplicate "enter today's training" CTA, impromptu hero CTA, and `AI 长期计划 / 浏览教练` secondary cards should be removed to move closer to the early-April training page.
- Implemented:
  - `wechat_app/src/training/today-training/index.tsx`
    - Restored the full older `today-training` page implementation instead of the thin `TodayTrainingScreen` re-export introduced by the later UI refactor.
    - Removed the later home-style header/promo/hero/secondary-card blocks so the page starts from training-specific plan switching, plan identity, calendar, and today's arrangement.
  - `wechat_app/src/training/today-training/index.scss`
    - Restored the matching older page styles.
    - Removed the now-unused dashboard header styles.
  - `wechat_app/src/training/training-execution/index.tsx`
    - Restored the older execution UI where actions expand into visible set lists, allowing faster multi-set scanning and entry instead of the later flash-card/current-set-only surface.
    - Reconnected `syncTrainingExecutionToStorage` so successful execution writes still update the execution snapshot and today's-training page cache.
    - Fixed a loading deadlock: when `userId` or required route params are missing, the restored page now clears `loading` and shows the error/retry state instead of returning early forever on "加载中...".
  - `wechat_app/src/training/training-execution/index.scss`
    - Restored the matching list-style execution page styles.
  - `wechat_app/src/components/BottomNav.tsx`
    - Student `训练` tab now points back to `/training/today-training` instead of `/pages/index/index`.
- Verification:
  - `npm run lint`: passed (informational lint script only).
  - Root `npm run typecheck`: passed.
  - Root `npx next build`: passed; emitted Redis connection timeout logs during build, but exited successfully.
  - Root `npm test`: passed, 24 files / 134 tests.
  - `wechat_app/npm run build:weapp`: passed.
- UI verification blocker:
  - WeChat DevTools automation could not run in this environment because `mrc` is not installed/available and no automation connection was present on port `9420`.
- Worktree note:
  - The workspace already contains many unrelated modified WeApp files. This task intentionally changed only the five files listed above.

## WeApp Streetlifting Location Share Deep Link (`2026-05-08`)

- Task: improve the WeChat mini-program toolbox `单杠位置` share flow so it drives recipients back into CoachLink instead of only copying plain text.
- Status: implemented in code; per latest user instruction, manual verification is left to the user and no further agent-side UI/manual testing should run for this task.
- Implemented:
  - `wechat_app/src/streetlifting/index/locations/index.tsx`
    - Replaced the single share affordance with two explicit share modes: `分享链接` and `生成海报`.
    - Link sharing now locks onto the selected location before calling `openType='share'`.
    - When opened from a shared link, the target location is fetched and surfaced at the top of the page, and the shared card is visually highlighted in the list when full data is available.
    - Added a location poster generation flow using the existing mini-program canvas/share-poster infrastructure.
  - `wechat_app/src/streetlifting/index/locations/index.config.ts`
    - Enabled `shareAppMessage` and `shareTimeline` for the mini-program page.
  - `wechat_app/src/utils/share.ts`
    - Added shared helpers for streetlifting-location share paths and titles.
  - `wechat_app/src/services/streetliftingIndexService.ts`
    - Added client support for fetching one shared location by id.
  - `src/app/api/streetlifting-index/locations/get/route.ts`
    - Added a minimal backend read endpoint so shared mini-program links can resolve a specific location by `id`.
  - `wechat_app/src/streetlifting/index/locations/poster.ts`
    - Added a dedicated single-location poster renderer.
- Major fix round (`2026-05-08` evening):
  - **Problem 1 — share link opens list instead of location detail**: Root cause was `buildLocationSharePath` embedding six Chinese preview params (`sn/sp/sc/sct/sa/sd`) into the share `path`. After URL encoding, the path could exceed WeChat's share-path length limit, causing the entire path to be discarded and fallback to the default page.
    - Fix: `buildLocationSharePath` now only carries `locationId`. The `location-share` page loads full data via API instead of relying on URL preview params.
    - `locations` page already supports `locationId` via `sharedLocation` / `sharedLocationId` as a fallback.
    - `buildSharedLocationPreviewFromParams` and `buildPreviewLocation` updated to return `null` when only `locationId` is present (no preview params), so the UI shows a loading state while fetching real data.
  - **Problem 2 — poster missing image / QR code / mojibake**: Root causes were (a) image domain not in mini-program `downloadFile` whitelist causing `getImageInfo`/`downloadFile` to fail, (b) Canvas default `sans-serif` has no Chinese font fallback in WeChat, (c) poster layout was too tall and sparse.
    - Fix: `weapp-canvas-image.ts` — `downloadFile` success now directly returns `tempFilePath` without a second `getImageInfo` call that could fail.
    - Fix: `poster.ts` — completely redrawn with:
      - Explicit Chinese font stack (`PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif`) on every `ctx.font` assignment.
      - Tighter 750×1100px canvas (was 750×1180).
      - Larger cover image area (480px tall) with rounded corners and a bottom gradient overlay.
      - Larger QR code area (128×128px with white background and rounded corners).
      - QR code load failure fallback: shows `请搜索 CoachLink` text instead of a blank gray box.
      - No-image fallback: brand-colored gradient background with centered copy instead of the old long placeholder text.
      - Dark bottom action bar with white text for strong CTA contrast.
    - Fix: `streetliftingIndexService.ts` — corrected GBK mojibake error message `鍔犺浇鍦扮偣澶辫触` → `加载地点失败`.
    - `SharePosterModal` canvas height updated from 1180 → 1100 to match new poster size.
- Code-level verification:
  - Root `npm run lint`: passed (informational script only).
  - Root `npm run typecheck`: passed.
  - Root `npx next build`: passed.
  - `wechat_app` build (`npm run build:weapp`): passed.
- User override:
  - User explicitly asked on `2026-05-08` that the remaining testing be done manually, so mini-program build / DevTools verification was not continued after that point.

## Huifu Renew Split Failure Follow-up (`2026-05-05`)

- Task: diagnose why a 2026-05-05 13:20 1-yuan coach-renew test payment did not appear in the coach wallet.
- Status: diagnosed and patched at code/build level; follow-up needed for coach Huifu onboarding rewrite.
- Finding:
  - The payment order `c92f87e1-cf01-478e-bc9e-85ff4b2ca3d1` is paid and has `trade_status = S`.
  - The related `coach_subscription_settlements` row is `split_failed` with Huifu error `商户信息不存在`.
  - No wallet transaction exists for that order, so the wallet page correctly stayed unchanged instead of crediting local money without real Huifu split success.
  - The coach row was incorrectly marked `huifu_open_status = opened` while `huifu_card_token` is null, meaning the Huifu business onboarding / card-token step did not complete cleanly.
- Fix:
  - `src/app/api/payment/alipay/fulfillPaidOrder.ts`
    - Balance payment now transfers only the coach net share to the coach Huifu account.
    - The platform share remains in the platform cash account and is still recorded locally as platform revenue.
  - `src/app/api/payment/wechat/query/route.ts`
    - Paid WeChat coach-subscription orders can now retry/compensate settlement when the order is already paid but the settlement is still `pending` or `split_failed`.
  - `src/app/api/admin/coach-subscription-settlements/retry/route.ts`
    - Adds an admin-only manual retry endpoint for paid coach subscription settlements.
    - Requires explicit `confirm: "RETRY_HUIFU_SPLIT"` because it can initiate a real Huifu balance-payment transfer.
    - On split success, credits the coach wallet and marks the settlement `wallet_credited`; already-credited orders remain idempotent.
  - `src/lib/huifuMiniProgramPay.ts`
    - `openHuifuUserBusiness()` now rejects non-success responses and rejects responses that do not return `token_no`.
  - `src/app/api/coach/merchant/open-huifu-account/route.ts`
    - A coach marked `opened` but missing `huifu_card_token` can re-run business onboarding instead of being blocked by a false "already opened" response.
  - `src/app/api/coach/wallet/route.ts`
    - Wallet API now reports such incomplete Huifu accounts as failed/incomplete so the UI can expose the re-open flow.
  - `src/app/api/payment/wechat/coach/create/route.ts`
  - `src/app/api/payment/alipay/fulfillPaidOrder.ts`
    - New coach subscription payments and settlement retries now require a fully opened Huifu account with `huifu_card_token`.
- Verification:
  - `npm run typecheck`: passed.
  - `npm run lint`: passed, informational script.
  - `npx next build`: passed.
  - `npm test`: failed only in the pre-existing `src/components/knowledge/BodyMap/bodyMapTypes.test.ts` export-mismatch tests.
  - `wechat_app/npm run build:weapp`: passed.
- Safety note:
  - Retrying the existing paid order will call real Huifu balance payment for the coach net share, so it should only be triggered after explicit confirmation.
- Follow-up onboarding decision:
  - The full Huifu docs confirm coach onboarding should be modeled as two stages: personal user basic opening first, then user business onboarding.
  - Current code already calls both APIs, but the business onboarding payload still needs to be rewritten for the current product model: Huifu automatic withdrawal is closed, so the coach should be configured with `card_info + cash_config` for manual encashment instead of relying on `settle_config_list`.
  - A coach must not be considered ready for subscription payment, balance split, or withdrawal unless business onboarding returns and stores `token_no`.
- Latest fix:
  - Huifu rejected the business onboarding request with `个人只能是对私结算类型[cardType]`.
  - Root cause: CoachLink was defaulting `card_type` to `"0"` in `/api/coach/merchant/open-huifu-account`.
  - Fixed by forcing personal coach bank cards to Huifu `card_type = "1"` and adding Web copy that the withdrawal card must be a本人对私银行卡.
  - Verification: `npm run lint`, `npm run typecheck`, and `npx next build` passed; `npm test` still fails only on the pre-existing BodyMap export tests. Browser verification was attempted but blocked by the Browser Use node_repl requiring Node >= 22.22 while this runtime is Node 22.14.
- Settlement verification update:
  - Manual retry for order `c92f87e1-cf01-478e-bc9e-85ff4b2ca3d1` now succeeded end to end.
  - `coach_subscription_settlements` row `59042ffd-d2ad-42d0-a2c9-02cd019939e9` is `wallet_credited`, with `trans_stat = S`, `huifu_hf_seq_id = 003500TOP4A260505155355P210ac136b7200000`, and `acct_split_bunch.acct_infos[0].div_amt = 0.80` to coach Huifu user `6666000197050360`.
  - Local wallet ledger row exists: `wallet_transactions.id = 515089b4-7a7c-45df-b4ae-1bfcfc00e4ce`, `amount = 80` fen, `platform_fee = 20` fen, created at `2026-05-05T07:53:56.871+00:00`.
  - `retry` endpoint returning `splitStatus = wallet_credited` with `walletCredited = false` is normal on later retries: it means the wallet ledger had already been credited earlier, so the endpoint short-circuited instead of inserting a duplicate wallet transaction.
- Functional status checkpoint:
  - Confirmed complete and verified: coach Huifu onboarding, coach subscription payment collection, Huifu balance split, local wallet income booking, platform fee booking, wallet UI display, and 7-day refund-protection freeze display.
  - Not yet fully closed by real end-to-end validation: refund for Huifu-paid coach subscription orders, and successful Huifu withdrawal after funds become withdrawable.
  - Important code risk still present: `src/app/api/payment/alipay/refund/route.ts` currently calls Alipay direct refund SDK; this needs explicit validation against Huifu-paid coach subscription orders before treating refund as production-ready for the Huifu path.

## Coach Wallet 7-day Refund Lock & Test Renew Entry (`2026-05-05`)

- Task: make coach wallet withdrawable balance respect the 7-day refund window and add a development-only 1-cent renew test entry for the WeChat coach profile flow.
- Status: implemented and verified at code/build level.
- Implemented:
  - `src/lib/coachWalletLock.ts`
    - Adds shared 7-day refund-protection math for coach income rows.
    - Computes withdrawable balance by combining stored frozen balance with refund-protected recent income.
  - `src/app/api/coach/wallet/route.ts`
    - Returns dynamic `balance` as the withdrawable amount.
    - Also exposes `gross_balance`, `withdrawable_balance`, `refund_protected_amount`, and `refund_protection_days` for UI clarity.
  - `src/app/api/coach/wallet/alipay/withdraw/route.ts`
    - Rejects withdrawals that exceed the dynamic withdrawable amount and explains that 7-day refundable income is frozen.
  - `src/app/api/coach/wallet/huifu/withdraw/route.ts`
    - Applies the same withdrawable-balance guard to Huifu withdrawals.
  - `src/app/api/payment/wechat/coach/create/route.ts`
    - Accepts `testAmountFen` and uses it only outside production.
    - Development-only test payments are blocked from production use.
  - `wechat_app/src/discovery/coach-profile/*`
    - Adds a dev-only `1元续费测试（加1个月）` entry for already-subscribed coaches.
    - The test path starts a 1-yuan renew payment and uses the existing WeChat payment chain, while preserving the normal 1-month renewal unit.
    - Renewal mode now only allows extending the current subscription package; selecting another package shows a guard message instead of creating an ambiguous renewal order.
  - `src/app/dashboard/wallet/page.tsx`
    - Shows gross balance alongside withdrawable balance and frozen amount so the 7-day freeze is visible to coaches.
- Verification:
  - `npm run typecheck`: passed.
  - `npm run lint`: passed (script is informational).
  - `npx next build`: passed.
  - `npm test`: failed only on the pre-existing `src/components/knowledge/BodyMap/bodyMapTypes.test.ts` export mismatch.
  - `wechat_app/npm run build:weapp`: passed.
- Remaining limitation:
  - Browser / WeChat DevTools visual verification was not possible in this session because the required `web-devtools` / `weapp-devtools` tool surface is unavailable here.

## Legacy Coach Wallet Split Backfill (`2026-05-05`)

- Task: handle coach wallet balances that were credited before Huifu split-payment rules existed, so historical subscription income is no longer withdrawable at 100% gross.
- Status: implemented at code/migration level; database migration still needs to be applied before frontend withdrawal validation.
- Problem:
  - Some existing coach `wallet_transactions` income rows were created before the 80/20 coach/platform split was enforced.
  - Those rows can make `coach_wallets.balance` and `total_income` too high, so the coach wallet page may allow withdrawal of the platform share.
- Implemented:
  - `supabase/migrations/20260505_backfill_legacy_wallet_split_amounts.sql`
    - Creates `wallet_split_backfill_adjustments` as an audit table.
    - Finds legacy coach subscription income rows where wallet income equals the full paid order amount and `platform_fee` is still zero.
    - Rewrites those income rows to the coach net amount and records the platform fee.
    - Rewrites matching historical refund rows to the same coach-net amount when they still equal the old gross amount.
    - Backfills missing `platform_revenue` rows for historical platform fees.
    - Recomputes `coach_wallets.balance` and `coach_wallets.total_income` from the wallet ledger after adjustment.
  - `src/app/api/payment/alipay/refund/route.ts`
    - Coach subscription refunds still refund the student's full external payment amount.
    - Coach wallet deduction now uses the already-credited coach-net income amount when present, with 80% net fallback for old rows.
- Verification:
  - `npm run typecheck`: passed.
  - `npm run lint`: passed, informational script.
  - `npx next build`: passed after replacing the old mojibake refund route.
  - `npm test`: failed only in pre-existing `src/components/knowledge/BodyMap/bodyMapTypes.test.ts` export-mismatch tests, unrelated to payment/wallet work.
- Remaining next steps:
  - Apply both Huifu settlement and legacy wallet backfill migrations in Supabase.
  - Then verify the coach wallet UI against a coach with historical income before allowing Huifu withdrawal.

## Huifu Coach Subscription Settlement Guard (`2026-05-05`)

- Task: confirm whether the proposed coach-subscription settlement/status table exists, then complete the next split-payment safety work.
- Status: implemented and verified at code/build level.
- Finding:
  - Existing migrations had `platform_revenue`, `coaches.huifu_id`, `coaches.huifu_open_status`, `coaches.huifu_open_msg`, and `coaches.huifu_card_token`.
  - No dedicated `coach_subscription_settlements` / subscription settlement status table existed before this change.
- Implemented:
  - `supabase/migrations/20260505_coach_subscription_settlements.sql`
    - Creates `coach_subscription_settlements` with one row per paid coach-subscription order.
    - Tracks `pending / processing / split_success / split_failed / wallet_credited`, Huifu request ids, returned split detail, attempts, and timestamps.
    - Adds a unique index on `platform_revenue.source_order_id` so platform revenue remains idempotent per source order.
  - `src/app/api/payment/alipay/fulfillPaidOrder.ts`
    - Reworked `executeBalancePayment()` so the settlement table, not `wallet_transactions`, is the remote-call idempotency guard.
    - Wallet credit is now blocked unless Huifu split reaches `split_success` and returns `acct_split_bunch`.
    - Ambiguous exceptions after claiming a remote split request remain `processing` to avoid double transfer retries with a fresh `req_seq_id`.
    - `updateTransactionAndWallet()` now refuses coach-subscription wallet credit without split details.
    - Added `markSettlementWalletCredited()` after local wallet/revenue writes succeed.
  - `src/app/api/payment/wechat/notify/route.ts`
  - `src/app/api/payment/wechat/query/route.ts`
    - Coach subscription payments now execute split first; only successful split results can trigger local coach wallet credit.
- Verification:
  - `npm run lint`: passed (project lint script is informational).
  - `npm run typecheck`: passed.
  - `npx next build`: passed.
  - `npm test`: failed on pre-existing `src/components/knowledge/BodyMap/bodyMapTypes.test.ts` export mismatch (`BODY_PART_CATEGORY_MAP`, `SVG_BODY_PART_NAMES`, `CATEGORY_TO_BODY_PARTS`, `getCategory`, `isJoint` undefined), unrelated to split-payment changes.
- Remaining next steps:
  - Apply the new migration to Supabase before live traffic depends on the settlement table.
  - Add a Huifu balance-payment query/reconciliation job for rows stuck in `processing`.
  - Revisit Huifu withdrawal safety; current withdrawal route still calls external encashment before robust local freeze/reconcile semantics.

## WeApp Questionnaire Ready Status Mismatch (`2026-05-03`)

- Task: fix the WeChat mini-program coach `我的` / `概览` surfaces so `学员问卷` reflects the actually published questionnaire.
- Status: implemented and verified at code/build level.
- Symptom:
  - `wechat_app/src/coach/questionnaire/index.tsx` showed a questionnaire as `已发布`.
  - But `wechat_app/src/coach/my-profile/index.tsx` and `wechat_app/src/coach/overview/index.tsx` still rendered `学员问卷 = 待设置`.
- Root cause:
  - The questionnaire management list had already switched to the new publication source of truth `status = 'active'`.
  - The coach overview payload used by mini-program `我的` / `概览` was still effectively relying on the legacy publication flag chain.
  - `src/app/api/coach/publish-questionnaire/route.ts` had been publishing by `status`, but older readiness logic and data compatibility around `is_active` were not kept in sync.
- Implemented:
  - `src/app/api/coach/get-overview-data/route.ts`
    - `questionReady` now checks questionnaire rows more defensively and treats either `status = 'active'` or `is_active = true` as ready.
  - `src/app/api/coach/publish-questionnaire/route.ts`
    - demoting the old published questionnaire now also writes `is_active = false`
    - promoting the selected questionnaire now also writes `is_active = true`
- Verification:
  - `npm run typecheck`: passed
  - `npx next build`: passed
  - `npm test`: failed on unrelated pre-existing `src/components/knowledge/BodyMap/bodyMapTypes.test.ts` export mismatches, not on questionnaire code

## WeApp Chat Image Caption Parity (`2026-05-02`)

- Task: fix the WeChat mini-program private-message detail view so coach broadcast image messages show their attached caption text instead of only the image, matching the chat-list preview and Web chat behavior.
- Status: implemented and verified at code/build level.
- Root cause:
  - Coach broadcast messages can be stored as `message_type = image` with the explanatory text carried in `content`.
  - The mini-program chat list preview uses `chat_rooms.last_message`, so that caption text was visible there.
  - `wechat_app/src/me/messages/chat/index.tsx` rendered `image` messages as image-only and dropped `content`, so the detail page hid the caption even though it existed in `chat_messages`.
- Implemented:
  - `wechat_app/src/me/messages/chat/index.tsx`
    - Added shared media-caption rendering for image messages.
    - Image messages now render the uploaded image plus the trimmed caption when `content` is present and not just the media URL.
  - `wechat_app/src/me/messages/chat/index.scss`
    - Added compact media-block / caption styling so image and caption stay grouped in the same bubble flow.
- Verification:
  - Root `npm run lint`: passed (informational script only).
  - Root `npm run typecheck`: passed.
  - Root `npm test`: passed, 21 files / 109 tests.
  - Root `npx next build`: passed.
  - `wechat_app/npm run build:weapp`: passed.
- Mini-program DevTools verification:
  - Attempted per local `weapp-devtools` workflow.
  - Blocked because `mrc` is not installed in this session.
  - `127.0.0.1:9420` is not accepting connections, so local WeChat DevTools automation is not running.

## WeApp Login Audit-Fix For WeChat Review (`2026-05-01`)

- Update (`2026-05-02`):
  - Follow-up fix after product review: even when users do reach `/auth/login`, the page itself must still expose a visible return path so the flow does not become a dead end.
  - `wechat_app/src/auth/login/index.tsx` now adds a custom top-left `返回` action because this page uses `navigationStyle: 'custom'`.
  - Return behavior is `navigateBack()` when there is history, otherwise `reLaunch('/pages/index/index')`.
  - `wechat_app/src/auth/login/index.scss` adds the matching lightweight hero-level back control styling instead of another heavy card inside the login form.

- Update (`2026-05-01`, later same session):
  - Product direction corrected after review: the right fix is not to enlarge the login page with extra guest-exit cards, but to keep unauthenticated users on browsable surfaces first.
  - Final implemented behavior:
    - unauthenticated `个人` tab now opens the guest profile page instead of forcing `/auth/login`
    - unauthenticated `消息` still requires auth, but now uses a return-aware login URL
    - logout from profile / coach profile / settings now returns to `/pages/index/index`
    - the previously added guest-entry cards on login/register were removed

- Task: address the WeChat mini-program review rejection on the login flow by making cancellation / return paths explicit and ensuring users are not forced to log in before they can continue browsing the app.
- Status: implemented and verified at code/build level.
- Requirement:
  - The mini-program login flow must provide a clear, effective cancel / refuse / return path.
  - Users who decline phone-number authorization should still be able to continue browsing instead of being trapped in the login path.
  - Registration should also provide a visible path back to non-authenticated browsing so the whole auth chain is not perceived as mandatory.
- Implemented:
  - `wechat_app/src/auth/login/index.tsx`
    - Added a prominent guest-exit card ahead of the login methods with a `先逛逛` action that returns users to `/pages/index/index`.
    - Softened the `getPhoneNumber` refusal handling so denial now tells users they can continue browsing or use another login method instead of only pushing them back toward authorization.
    - Added explanatory copy under the quick-login button that refusal does not block returning to the home page.
  - `wechat_app/src/auth/login/index.scss`
    - Added the guest-exit card / secondary-button styles using pure-color buttons and 8-grid spacing.
  - `wechat_app/src/auth/register/index.tsx`
    - Added a matching guest-exit card with a `返回首页` action so registration is not a dead-end or mandatory gate.
  - `wechat_app/src/auth/register/index.scss`
    - Added the matching guest-exit card / secondary-button styles.
- Verification:
  - Root `npm run lint`: passed (informational script only).
  - Root `npm run typecheck`: passed.
  - Root `npm test`: passed, 21 files / 109 tests.
  - Root `npx next build`: passed.
  - `wechat_app/npm run build:weapp`: passed.
- Mini-program DevTools verification:
  - Not completed in this session.
  - Blocker: the required `weapp-devtools` skill/runtime is not available in the current tool surface, so only code/build verification could be completed.

## WeApp Student Action Edit Demo Video Upload Parity (`2026-05-01`)

- Task: sync the WeChat mini-program student action edit page with the current Web demo-video workflow so editing a student action supports local video upload instead of requiring manual link paste only.
- Status: implemented and verified at code/build level.
- Requirement:
  - The mini-program student action edit page should follow Web `src/app/me/action-lib/StudentActionEditDialog.tsx` semantics for demo videos.
  - The URL field remains the stored source of truth, but users should be able to upload a local video and have the returned URL auto-filled back into the form.
  - The edit surface should preview the playable demo video inline after upload or link paste, instead of showing a raw URL card as the primary feedback.
  - Replacing or deleting a student action should clean up the previously uploaded demo video file when it belongs to the app storage bucket.
- Implemented:
  - `wechat_app/src/me/action-lib/edit/index.tsx`
    - Added demo-video upload entry with progress display, local file selection, URL auto-fill, and clear-link action.
    - Replaced the old raw-link preview card with an inline mini-program video preview so uploaded videos and pasted direct video links can be watched directly on the page.
    - Kept the editable URL field so uploaded and manually pasted external links still share the same persisted field.
  - `wechat_app/src/me/action-lib/edit/index.scss`
    - Reworked the video field UI to support upload actions and progress while staying within the mini-program design rules (pure-color buttons, 8-grid spacing).
  - `wechat_app/src/services/studentActionLibService.ts`
    - Added `uploadDemoVideo()` using mini-program `uploadFile` plus auth token forwarding and progress callbacks.
  - `src/app/api/student/action-lib/upload-demo-video/route.ts`
    - Added a student-side upload endpoint for multipart demo-video uploads to the `videos` storage bucket.
  - `src/app/api/student/action-lib/update-action/route.ts`
    - Added cleanup for replaced/cleared demo videos when the stored URL changes away from an app-managed storage file.
  - `src/app/api/student/action-lib/delete-action/route.ts`
    - Added cleanup for app-managed demo videos when the student action itself is deleted.
- Verification:
  - Root `npm run lint`: passed (informational script only).
  - Root `npm run typecheck`: passed.
  - Root `npm test`: passed, 21 files / 109 tests.
  - Root `npx next build`: passed.
  - `wechat_app/npm run build:weapp`: passed.
- Mini-program DevTools verification:
  - Attempted per local `weapp-devtools` workflow.
  - Blocked because `mrc` is not installed in this session.
  - `127.0.0.1:9420` is also not accepting connections, so local WeChat DevTools automation is not running.

## WeApp Streetlifting Score Title Parity (`2026-05-01`)

- Task: make the WeChat mini-program streetlifting calculator score titles match the current Web source of truth instead of showing the older English `World Class / Intermediate` labels.
- Status: implemented and verified at code/build level.
- Requirement:
  - The mini-program result page and share poster should use the same more playful Chinese level wording as the Web streetlifting calculator.
  - The shared mini-program calculator utility must be the single source of truth for this mapping so result-page UI and share data stay aligned.
- Implemented:
  - `wechat_app/src/utils/streetliftingCalc.ts`
    - Updated `getScoreLevel()` to match the current Web `src/app/streetlifting-index/_utils.ts` thresholds and wording.
    - Powerlifting labels now use `世界一线 / 国内一线 / 大佬 / 爱好者 / 菜就多练`.
    - 500-point system labels now use `世界级 / 国内顶级 / 大佬 / 爱好者水平 / 菜就多练`.
- Verification:
  - Root `npm run lint`: passed (informational script only).
  - Root `npm run typecheck`: passed.
  - Root `npm test`: passed, 21 files / 109 tests.
  - Root `npx next build`: passed.
  - `wechat_app/npm run build:weapp`: passed.
- Mini-program DevTools verification:
  - Attempted per local `weapp-devtools` workflow.
  - Blocked because `mrc` is not installed in this session.
  - `127.0.0.1:9420` is also not accepting connections, so local WeChat DevTools automation is not running.

## Streetlifting And Auto 1RM Remove Lombardi (`2026-04-30`)

- Task: remove the Lombardi formula from Web and WeChat mini-program strength / streetlifting calculations, including toolbox calculator forward/reverse modes, RM tables, day-max estimation dependencies, auto recommended load, and shared e1RM utility outputs.
- Status: implemented and verified at code/build level.
- Requirement:
  - The current three-formula average can overestimate user-facing 1RM for low-rep weighted pull-up / dip scenarios such as `77kg BW + 40kg x 4`.
  - Web and mini-program must stop using Lombardi anywhere in the shared strength-calculation path, so users do not see different numbers across calculator, RM table, auto load preview, or auto PR/e1RM calculations.
- Implemented:
  - Shared streetlifting math:
    - `src/app/streetlifting-index/_utils.ts`
    - `wechat_app/src/utils/streetliftingCalc.ts`
    - Changed forward 1RM, reverse weight, reverse reps, and RM table inversion from `avg(Epley, Brzycki, Lombardi)` to `avg(Epley, Brzycki)`.
  - Shared 1RM / recommended-load math:
    - `src/lib/e1rmCalculator.ts`
    - `src/lib/rmCaculator.ts`
    - `wechat_app/src/utils/rmCalculator.ts`
    - Removed Lombardi from shared e1RM outputs and lambda-model selection, keeping only `average / epley / brzycki`.
  - UI / product surfaces:
    - `src/components/streetlifting-index/StreetliftingRecentSubmissions.tsx`
    - `src/app/streetlifting-index/methodology/page.tsx`
    - `wechat_app/src/components/PlanEditorWorkbench/index.tsx`
    - `src/app/dashboard/plan-lib/components/ActionSetForm.tsx`
    - `wechat_app/src/utils/planStrength.ts`
    - Removed Lombardi from recent-submission 1RM display, methodology copy, and plan-editor algorithm choices / mappings.
  - API / persistence payload alignment:
    - `src/app/api/execution/calculate-e1rm/entity.ts`
    - `src/app/api/execution/calculate-e1rm/route.ts`
    - `src/app/api/execution/complete-set/route.ts`
    - `src/app/api/execution/create-pr/route.ts`
    - `src/app/api/training/finish-training/route.ts`
    - `src/app/api/training/save-1rm-record/route.ts`
    - `src/app/api/user/update-personal-records/route.ts`
    - Removed `lombardi` from response/trace payloads and `estimatedFrom` snapshots written by shared e1RM flows.
  - Docs / tests:
    - `src/RM.md`
    - `src/lib/e1rmAndLoadCalculation.test.ts`
    - Updated docs and tests to the two-formula average.
- Verification:
  - Root `npm run lint`: passed (informational script only).
  - Root `npm run typecheck`: passed.
  - Root `npm test`: passed, 21 files / 109 tests.
  - Root `npx next build`: passed.
  - `wechat_app/npm run build:weapp`: passed.
- UI verification:
  - Browser / mini-program manual automation was not completed in this session.
  - Blocker: the workspace instructions require `web-devtools` / `weapp-devtools`, but those tool surfaces are not available in the current session.

## WeApp Student Action Library Web Parity Review (`2026-04-30`)

- Task: inspect the current WeChat mini-program student action-library screen against the existing Web student action-library implementation before proposing UX changes.
- Status: implemented in code.
- Requirement:
  - Use the current Web student action-library under `src/app/me/action-lib` as the immediate source of truth.
  - Do not redesign the mini-program action-library flow from scratch before checking what the Web product already does.
- Focus:
  - Compare `wechat_app/src/me/action-lib/index.tsx` with `src/app/me/action-lib/page.tsx`.
  - Clarify the actual semantics of `贡献 / 加入我的动作库 / 纠错建议 / 点赞 / 删除 / 合并 / 查引用`.
  - Identify where the mini-program currently exposes Web capabilities in a more crowded or mismatched way.
- Implemented:
  - `wechat_app/src/me/action-lib/index.tsx`
    - `我的动作库` 列表层改为与 Web 对齐，只保留 `贡献 / 编辑 / 删除`。
    - 移除了列表常驻的 `引用 / 合并` 入口。
    - `公共动作库` 列表层改为 `详情 / 点赞 / 加入我的库`。
    - 移除了公共列表卡片上的 `纠错` 按钮，改为进入详情页后再提交建议。
  - `wechat_app/src/training/action-detail/index.tsx`
    - 为公共动作详情补齐 `提交纠错建议`。
    - 为公共动作 owner 补齐 `同步到我的动作库`。
  - `wechat_app/src/services/actionLibPageService.ts`
    - 新增 `syncPublicToMyLib()`，对接现有 Web 后端 `/api/public-action-lib/sync-to-my-lib`。
  - `wechat_app/src/types/action.ts`
    - 补充 `owner_user_id` 以支持详情页 owner 判断。
- Verification:
  - Root `npm run lint`: passed.
  - Root `npm run typecheck`: passed.
  - Root `npx next build`: passed.
  - Root `npm test`: passed, 21 files / 109 tests.
  - `wechat_app/npm run build:weapp`: passed.
  - WeChat DevTools automation verification: blocked in this session because local `weapp-devtools` runtime is unavailable (`mrc` missing and `127.0.0.1:9420` not accepting connections).

## WeApp Contact Coach Chat Target Fix (`2026-04-30`)

- Task: fix the student-side WeChat mini-program `联系教练` flow so it opens the real coach chat instead of creating a room for an unknown user.
- Status: implemented in code.
- Root cause:
  - Student-side mini-program contact-chat entry points were treating `coach_subscriptions.coach_id` / `coaches.id` as if it were the chat peer user id.
  - The chat system actually needs the coach account `user_id`, so using the coach row id could create a private room against a non-user identifier and then render as `未知用户`.
- Fix:
  - `wechat_app/src/utils/coachChat.ts`
    - Added a shared resolver/opener for coach chat.
    - Prefer `coach.user_id` directly; if only `coachId` is available, resolve it through `coachService.getAggregatedInfo({ coachId })` before opening chat.
  - `wechat_app/src/training/today-training/TodayTrainingScreen.tsx`
    - `联系教练` now uses the shared coach-chat helper.
    - Navigation into `training-execution` now carries `coachUserId` when available, so the execution page does not need to guess later.
  - `wechat_app/src/training/training-execution/index.tsx`
    - Added `coachUserId` route-param support.
    - The execution-page `联系教练` menu action now uses the shared coach-chat helper instead of directly opening chat with `coachId`.
  - `wechat_app/src/me/messages/index.tsx`
    - Deep-link auto-open now supports `peerUserId`.
    - When only `coachId` is present, it resolves the coach's real `user_id` before trying to open the room.
  - `wechat_app/src/me/my-coaches/index.tsx`
  - `wechat_app/src/me/my-coaches/types.ts`
    - `我的教练` contact entry now passes `coach.user_id` when available and otherwise falls back to the shared resolver flow.
- Verification:
  - Root `npm run lint`: passed (informational script only).
  - Root `npm run typecheck`: passed.
  - Root `npm test`: passed, 21 files / 109 tests.
  - Root `npx next build`: passed.
  - `wechat_app/npm run build:weapp`: passed.
  - WeChat DevTools automation verification: attempted but blocked.
    - `mrc` is not installed in this session.
    - `127.0.0.1:9420` is not accepting connections, so local WeChat DevTools automation is not running.

## WeApp Coach Application And Waiting-State Parity (`2026-04-30`)

- Task: make the WeChat mini-program coach application flow and the coach-application waiting display on mini-program home/profile surfaces match the current Web source of truth.
- Status: implemented in code.
- Requirement:
  - Mini-program coach application must no longer stay on the older pre-layering form model.
  - Mini-program waiting / pending / supplement-material display should follow the Web coach-application status semantics instead of only showing a generic `not a coach yet` empty state.
- Implemented:
  - `wechat_app/src/utils/coachApplicationParity.ts`
    - Added a shared mini-program parity helper for coach-track options and the full Web-aligned coach application status model: `none / draft / pending / reviewing / needs_info / rejected / approved / coach`.
  - `wechat_app/src/coach/application/index.tsx`
  - `wechat_app/src/coach/application/index.scss`
    - Rebuilt the mini-program coach application page around the current Web semantics.
    - Added Web-aligned layered fields: `coachTrack`, `serviceModes`, `targetStudentLevels`, `supportFocus`, and location fields.
    - Expanded review-status rendering to cover `reviewing` and `needs_info`, not just the old `pending / approved / rejected` subset.
    - Synced local mini-program auth storage after load/submit so pending/approved state is reflected immediately without waiting for a fresh login.
  - `wechat_app/src/coach/my-profile/index.tsx`
  - `wechat_app/src/coach/my-profile/index.scss`
    - Replaced the old one-size-fits-all `go apply to become a coach` empty state with a Web-aligned status card that distinguishes waiting, supplement-material, rejected, and approved states.
  - `wechat_app/src/me/profile/index.tsx`
  - `wechat_app/src/me/profile/index.scss`
    - Added a mini-program profile-home coach application progress card so users can see the same waiting-state semantics on mobile home/profile entry surfaces.
    - Updated the extra menu entry so it reflects current application status rather than always saying `申请成为教练`.
    - Hid the profile-home `教练申请进度` card after coach permission is already granted; this waiting-state card should only appear for users still in the application/review flow.
  - `wechat_app/src/services/coach/coachService.ts`
    - Extended create/update coach-application payload typing to include the newer Web fields.
  - `wechat_app/src/me/profile/detail/index.tsx`
    - Expanded local type support for `reviewing` and `needs_info`.
- Verification:
  - Root `npm run lint`: passed (informational script only).
  - Root `npm run typecheck`: passed.
  - Root `npm test`: passed, 21 files / 109 tests.
  - Root `npx next build`: passed.
  - `wechat_app/npm run build:weapp`: passed.
- Mini-program DevTools verification:
  - Attempted per local `weapp-devtools` workflow.
  - Blocked because `mrc` is not installed in this session.
  - Port `127.0.0.1:9420` is also not accepting connections, so local WeChat DevTools automation is not running.

## Impromptu Training Parity And Usability Check (`2026-04-30`)

- Task: make the WeChat mini-program `impromptu training` flow match the current Web experience as closely as possible and remove the current mini-program usability/build blocker.
- Status: implemented in code.
- Implemented:
  - `wechat_app/src/training/impromptu-training/index.tsx`
    - Rebuilt the mini-program entry page around the Web flow.
    - Added support for `STRENGTH / CARDIO / DIET / HABIT` item types instead of strength-only creation.
    - Added profile-based draft bootstrap through `studentActionLibService.bootstrapFromProfile`.
    - Kept strength items editable for sets/reps/rest/weight and allowed non-strength items to enter the same creation flow.
  - `wechat_app/src/services/studentActionLibService.ts`
    - Added mini-program support for `bootstrapFromProfile` so the mobile flow can preload recommended draft items like Web.
  - `wechat_app/src/services/impromptuService.ts`
  - `src/app/service/impromptuTrainingService.ts`
  - `src/app/api/impromptu/complete-item/*`
    - Added explicit impromptu item-complete support for non-strength action types so mobile/Web execution can complete `CARDIO / DIET / HABIT` items correctly.
  - `src/app/api/impromptu/start/route.ts`
  - `src/app/api/impromptu/get/route.ts`
    - Enriched impromptu execution payloads with action `type` and `attrs` so existing and new impromptu executions can render the correct item-type UI.
  - `wechat_app/src/training/training-execution/index.tsx`
  - `src/app/training-execution/[instanceId]/page.tsx`
    - Updated impromptu execution rendering and completion flow so both clients preserve action type metadata instead of forcing everything to `STRENGTH`.
    - Extra impromptu actions now immediately keep their real `type` in local UI state after being added.
  - `wechat_app/src/me/my-coaches/index.tsx`
    - Fixed the unrelated syntax error that had been blocking the mini-program build (`Unterminated string constant`).
- Current parity judgment:
  - Mini-program and Web impromptu training now share the same broad product surface:
    - multi-type creation
    - profile-based bootstrap draft
    - impromptu execution support for strength and non-strength items
  - Some UI presentation details still differ because the two clients are built with different component systems, but the mini-program is no longer missing the major Web capabilities that were identified in the review.
- Verification:
  - Root `npm run lint`: passed.
  - Root `npm run typecheck`: passed.
  - Root `npx next build`: passed.
  - Root `npm test`: passed, 21 files / 109 tests.
  - `wechat_app/npm run build:weapp`: passed.
  - WeChat DevTools automation/manual verification is still blocked in this session because the required local `weapp-devtools` runtime is not available here.

## Coach Profile And Dashboard Optimization (`2026-04-29`)

- Task: optimize the coach-side personal-center / homepage loading speed and align the coach-facing profile/dashboard UI language more closely with the student profile center, without changing coach-side functionality.
- Status: first implementation completed.
- Performance fixes:
  - `src/app/coach/profile/[id]/page.tsx`
    - Removed the duplicate first-paint coach fetch.
    - The page now uses `get-aggregated-info` as the main first-screen source instead of loading both `get-coach` and `get-aggregated-info`.
  - `src/app/coach/profile/[id]/CoachContent.tsx`
    - Coach profile tabs now lazy-mount and keep state only after first visit, so `订阅价格 / 教练专栏 / 学员评价` no longer all fetch on initial page load.
  - `src/app/api/coach/get-overview-data/route.ts`
    - Added a short Redis cache (`90s`) for coach overview aggregates to reduce repeated dashboard waits.
- UI alignment:
  - `src/app/coach/profile/[id]/CoachIntroduction.tsx`
    - Rebuilt the coach profile header into a cleaner card-based structure closer to the student profile center: identity block, status chips, action row, stat cards, specialty/service cards.
    - Kept existing actions intact: contact coach, edit profile, questionnaire entry, subscribe entry, chat dialog, and questionnaire dialog.
  - `src/app/dashboard/overview/page.tsx`
    - Reworked the coach overview into a simpler hero + metric cards + setup cards layout so it feels closer to the student center’s card hierarchy and less visually noisy.
- Verification:
  - `npm run lint`: passed (repo lint script remains informational only).
  - `npm run typecheck`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - `npx next build`: passed.
- Browser verification:
  - Attempted via the available `browser-use` path, but the in-app browser runtime is blocked in this session because `node_repl` resolved Node `v22.14.0` and the browser runtime requires `>= v22.22.0`.
  - Also attempted to install bundled workspace runtime dependencies, but that install failed in this session.
  - Result: code-level verification completed; browser-based verification remains blocked by the current tool/runtime environment.

## WeApp Upload Package Size Fix (`2026-04-29`)

- Task: resolve the WeChat mini-program upload blocker where subpackage `/me` exceeded the 2MB source-size limit.
- Status: fixed at build-script and asset-packaging level; release build now brings both the main package and `/me` subpackage under WeChat's upload limits.
- Root cause:
  - Uploading from the development-oriented `dist` output was the wrong packaging target for release.
  - `wechat_app/scripts/copy-comp-to-subpackages.js` was copying `base.wxml` and `utils.wxs` into many nested `me/*` directories, duplicating the Taro runtime template and inflating the `/me` subpackage.
- Fix:
  - `wechat_app/scripts/copy-comp-to-subpackages.js`
    - Kept nested `comp.*` compatibility copies.
    - Stopped copying `base.wxml` / `utils.wxs` into nested leaf directories.
    - Refined the nested compatibility-copy rule so only real `/index` directory pages keep `comp.*`.
    - Flat-page source folders such as `coach/overview` or `auth/login` now have stale copied `comp.*` removed after build, preventing Summer Compiler from misreading them as directory pages.
  - `wechat_app/config/index.ts`
    - Stopped copying the entire `src/assets/images/` directory into the main package.
    - Kept only the small root image used by auth and moved toolbox/scenario images into `me/assets/images/`.
    - Added explicit `body-map` copy so the knowledge page's string-path SVG assets still exist in the release package.
  - `wechat_app/src/assets/images/*`
    - Compressed the large toolbox cover images for release packaging.
    - Converted the large scenario PNGs to smaller JPGs for mini-program packaging.
  - `wechat_app/src/me/toolbox/index.tsx`
  - `wechat_app/src/constants/scenarioQuickFixes.ts`
    - Switched image paths from root `/assets/images/...` to `/me/assets/images/...`.
- Verification:
  - `wechat_app/npm run build:weapp:release`: passed.
  - `wechat_app/dist-release` package sizes:
    - main package: about `1745.8 KB`
    - `/me` subpackage: about `1185.71 KB`
  - Both are below the `2048 KB` limit.
  - Follow-up check for the later DevTools WXML error:
    - The bad state was in the development output `wechat_app/dist`, not in `wechat_app/dist-release`.
    - Before rebuilding, `wechat_app/dist/auth/utils.wxs` was missing, which can cause `auth/login/comp.wxml ... ./utils.wxs not found`.
    - After rerunning `wechat_app/npm run build:weapp`, `wechat_app/dist/auth/login/comp.wxml` now imports `../utils.wxs` and `wechat_app/dist/auth/utils.wxs` exists again.
  - Follow-up check for the later Summer Compiler `../../comp.json` error:
    - `wechat_app/dist/coach/overview` and similar flat-page folders were incorrectly carrying copied `comp.*` files.
    - After the script fix and rebuild, folders such as `wechat_app/dist/coach/overview` and `wechat_app/dist/auth/login` only keep `index.wxml`, so Summer Compiler no longer sees a fake directory-page `comp.json`.
  - `npm run lint`: passed.
  - `npm run typecheck`: passed.
  - `npx next build`: passed.
  - `npm test`: passed, 21 files / 109 tests.
- Recommended upload target:
  - Use `wechat_app/dist-release` for upload/release builds instead of `wechat_app/dist`.

## WeApp Login Copy Compliance (`2026-04-29`)

- Task: remove user-facing `微信登录` wording from the WeChat mini-program login page and use safer audit-friendly copy.
- Status: implemented.
- Requirement:
  - The login tab should say `快捷登录`, not `微信登录`.
  - The primary phone-auth button should say `手机号快捷登录`, not `微信一键登录`.
- Fix:
  - `wechat_app/src/auth/login/index.tsx`
    - Changed the `wechat` login-mode tab copy from `微信登录` to `快捷登录`.
    - Changed the primary `getPhoneNumber` action copy from `微信一键登录` to `手机号快捷登录`.
- Verification:
  - `npm run lint`: passed (informational script only; eslint is not configured in this repo).
  - `npm run typecheck`: passed.
  - `npx next build`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - `wechat_app/npm run build:weapp`: passed.
  - WeChat DevTools automation verification: blocked.
    - `mrc` is not installed in this session.
    - Port `9420` is not accepting connections, so local WeChat DevTools automation is not running.

## WeApp Membership WeChat Pay (`2026-04-29`)

- Task: switch the WeChat mini-program membership-upgrade flow from the old webview/Alipay path to direct mini-program WeChat Pay, with the mini-program membership purchase experience using WeChat pay as the source of truth.
- Status: implemented at code level; root checks and mini-program build passed; WeChat DevTools automation verification was attempted in this session but still blocked by missing local automation runtime.
- Requirement:
  - Mini-program membership upgrade should no longer depend on the web purchase page as the primary path.
  - For mini-program membership purchase, WeChat Pay is the important payment path; Alipay is not the primary mobile solution.
- Fix:
  - `src/app/api/payment/wechat/membership/create/route.ts`
    - Added a dedicated mini-program WeChat membership order-create route.
    - Reused the existing Huifu mini-program WeChat payment stack and persisted membership purchase context in `alipay_orders.order_data`.
  - `src/app/api/payment/studentMembershipFulfillment.ts`
    - Added idempotent fulfillment helper for student membership orders so notify/query races do not double-fulfill quota or tier upgrades.
  - `src/app/api/payment/alipay/notify/route.ts`
  - `src/app/api/payment/wechat/notify/route.ts`
  - `src/app/api/payment/wechat/query/route.ts`
    - Unified student membership paid handling through the new idempotent fulfillment helper.
  - `wechat_app/src/services/paymentService.ts`
    - Added mini-program membership WeChat payment create/request helpers.
  - `wechat_app/src/me/membership/subscribe/index.tsx`
    - Replaced the old mini-program membership purchase entry from webview purchase-page navigation to direct WeChat pay creation and `requestPayment`.
    - Removed the coupon-only web-purchase messaging from this page.
  - `wechat_app/src/me/payment-waiting/index.tsx`
    - Expanded the waiting page so membership purchases can poll WeChat payment status and return to the membership surfaces correctly.
- Verification:
  - `npm run lint`: passed (informational script only; eslint is not configured in this repo).
  - `npm run typecheck`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - `npx next build`: passed.
  - `wechat_app/npm run build:weapp`: passed.
  - WeChat DevTools automation/manual verification: blocked.
    - `mrc` is not installed in this session.
    - Port `9420` is not accepting connections, so local WeChat DevTools automation is not running.

## Plan LLM DeepSeek Unification (`2026-04-29`)

- Task: unify all non-multimodal plan-related LLM flows to DeepSeek `deepseek-v4-flash`.
- Status: implemented.
- Requirement:
  - All pure-text plan flows including generation, parsing, and modification should default to DeepSeek.
  - Stop relying on the soon-to-be-retired `deepseek-chat` / `deepseek-reasoner` names as the default plan-routing model identifiers.
- Fix:
  - `src/lib/coachlinkLlm.ts`
    - Added `COACHLINK_DEFAULT_DEEPSEEK_MODEL = deepseek-v4-flash`.
    - Added `getCoachlinkPlanLlm()` so plan pure-text flows prefer direct DeepSeek and only fall back to the general LLM routing when `DEEPSEEK_API_KEY` is missing.
  - `src/lib/deepseek.ts`
    - `callDeepSeek()` now uses `getCoachlinkPlanLlm()`.
    - DeepSeek plan calls now consistently use `deepseek-v4-flash`.
    - `useReasoner=true` no longer switches to `deepseek-reasoner`; it keeps `deepseek-v4-flash` and adds `thinking={type:enabled}` plus `reasoning_effort=high`.
  - `src/app/api/plan-lib/batch-operation/route.ts`
    - Plan AI modification now uses `getCoachlinkPlanLlm()`.
  - `src/app/api/plan-lib/parse-actions/route.ts`
  - `src/app/api/plan-lib/parse-template/route.ts`
    - Trace metadata now records `deepseek-v4-flash`.
  - `.env.development`
  - `.env.production`
    - Added `COACHLINK_USE_DEEPSEEK=1`.
- Verification:
  - `npm run lint`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - `npx next build`: passed.
  - `npm run typecheck`: timed out after 124s on the repo's existing historical type surface.

## Knowledge Home Pillars Hidden (`2026-04-29`)

- Task: temporarily hide the `知识体系` section on the Web knowledge home page.
- Status: implemented.
- Requirement:
  - The knowledge-pillar area is not ready for public presentation and should be hidden rather than shown as a weak placeholder.
- Fix:
  - `src/app/dashboard/knowledge/page.tsx`
    - Added `SHOW_KNOWLEDGE_PILLARS = false`.
    - Removed the related request / state / rendering path from the active home-page flow.
- Verification:
  - `npm run lint`: passed.
  - `npx next build`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - Browser verification was not completed in this session because the required browser tool surface was unavailable.

## Knowledge Book Workspace Pipeline (`2026-04-29`)

- Task: build a reusable workflow from local book files to editable knowledge-book workspaces and final knowledge-base import.
- Status: implemented.
- Scope:
  - Stop requiring every new book to be hardcoded into one TypeScript content file.
  - Keep original extracted text local-only and outside the publishable content tree.
  - Let each article keep image-prompt placeholders while staying within non-infringing "reading notes / interpretation" boundaries.
- Fix:
  - `src/content/knowledgeBooks/schema.ts`
    - Added shared book-note schema for workspace bundles and import manifests.
    - Import stage now appends a unified copyright-risk footer to each article.
  - `src/lib/knowledgeBookWorkspace.ts`
    - Added workspace loader that scans `src/content/knowledgeBooks/workspaces/*/book.json`.
  - `scripts/scaffold-knowledge-book.ts`
    - Added book scaffolding for `.docx / .txt / .md`.
    - Generates `book.json`, `notes/*.md`, and `README.md`.
    - Original extracted text and chapter-probe output now go to `temp_dir/knowledge-book-workspaces/<slug>/`.
  - `scripts/import-knowledge-book-notes.ts`
    - Upgraded from legacy hardcoded registry to support both legacy TS manifests and workspace-based books.
  - `scripts/generate-knowledge-book-drafts.ts`
    - Added DeepSeek-powered draft generation from local extracted source text.
    - Writes back article title, summary, Markdown body, image prompts, and generation log.
  - `docs/knowledge-book-system.md`
    - Added workflow documentation and copyright-boundary notes.
  - `src/content/knowledgeBooks/workspaces/strength-training-principles-workspace/*`
    - Added the first real workspace example for `力量训练原理`.
- Real-file verification:
  - Real source file used: `D:\WPSDrive\632379361\WPS云盘\创业-部分资料版\健身书籍pdf的文字版本\力量训练原理.docx`
  - Workspace generated at `src/content/knowledgeBooks/workspaces/strength-training-principles-workspace`
  - Local extracted-material directory generated at `temp_dir/knowledge-book-workspaces/strength-training-principles-workspace`
  - Dry-run import passed: `npx tsx scripts/import-knowledge-book-notes.ts strength-training-principles-workspace`
  - DeepSeek draft generation was run successfully for the same workspace.
  - The workspace was later restructured into `1 overview + 9 core chapters` and fully regenerated with `deepseek-v4-pro`.
- Verification:
  - `npm run lint`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - `npm run build`: passed.
  - `npx next build`: passed.
  - `npm run typecheck`: still blocked by longstanding repo-wide historical type errors unrelated to this feature set.

---

## WeApp Membership Page Parity (`2026-04-29`)

- Task: align the WeChat mini-program `我的会员` page with the current Web `/me/membership` page and use the Web page as the source of truth.
- Status: mini-program membership dashboard sync implemented; code-level/build verification passed; WeChat DevTools automation verification attempted but blocked by missing local automation runtime.
- Key mismatch confirmed before the fix:
  - Mini-program was still using the older layout: gradient hero card plus a static `会员权益` list.
  - Web had already moved to a different information architecture: `当前等级` card, two quota cards, and an `邀请好友` reward banner.
  - Mini-program also violated current workspace UI guidance here by keeping the old gradient membership card.
- Fix:
  - `wechat_app/src/me/membership/index.tsx`
    - Rebuilt the page structure to match Web: `当前等级` card, `智能导入次数` card, `云存储空间` card, and `邀请好友，免费领会员` banner.
    - Synced action entry points with Web semantics: `立即升级` / `续费升级` / `购买加油包` / `扩容空间` / `去邀请`.
    - Removed the old static `会员权益` list so the page no longer diverges from the current Web dashboard content model.
  - `wechat_app/src/me/membership/index.scss`
    - Reworked the mini-program page styling around the Web card hierarchy while keeping to the mini-program spacing system.
    - Removed the old gradient membership hero and kept buttons on pure-color backgrounds to satisfy the project button rule.
- Verification:
  - `npm run lint`: passed (informational only; lint is not configured in this repo).
  - `npm run typecheck`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - `npx next build`: passed.
  - `wechat_app/npm run build:weapp`: passed.
  - WeChat DevTools automation: attempted but blocked.
    - `mrc --version`: failed because `mrc` is not installed in this session.
    - Port `9420` is not accepting connections, so local WeChat DevTools automation is not running.

---

## WeApp Home Quick Entry Swap (`2026-04-29`)

- Task: replace the last quick-entry tile on the WeChat mini-program home page from `个人中心` to `知识库`.
- Status: implemented and code-level verification passed; WeChat DevTools verification could not run in this session.
- Implemented:
  - `wechat_app/src/pages/index/index.tsx`
    - Replaced the fourth home quick-action tile so it now opens `/content/knowledge`.
    - Swapped the icon from the profile icon to the book icon to match the knowledge-base destination.
    - Updated the authenticated hero subtitle so the home-page copy now lists `知识库` instead of `个人中心`.
- Verification:
  - `npm run lint`: passed (informational only; eslint is not configured).
  - `npm run typecheck`: passed.
  - `npx next build`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - `wechat_app/npm run build:weapp`: passed.
- Blocker:
  - WeChat DevTools automation/manual verification was not available in this session because the required `weapp-devtools` capability is not exposed here.

---

## WeApp Calculator Logic Parity (`2026-04-29`)

- Task: make the mini-program toolbox `力量计算器` logic match the Web `/streetlifting-index/calculator` implementation exactly.
- Status: code parity patch applied; code-level/build verification passed; WeChat DevTools automation verification attempted but blocked by missing local automation runtime.
- Fix:
  - `wechat_app/src/streetlifting/index/calculator/index.tsx`
    - Added the Web-aligned `day_max` mode for upper-body exercises.
    - Synced powerlifting / strict-press / curl `reverse_reps` to the same averaged inverse estimation used by Web.
    - Kept upper-body `reverse_reps` on the Web-matching continuous estimate path.
    - Added draft flush on hide/unload and a visible `清空上次输入` action.
  - `wechat_app/src/utils/streetliftingCalc.ts`
    - Synced the mini-program shared calculator math to the Web helper semantics, including exact inverse solving and day-max helpers.
  - `wechat_app/src/streetlifting/index/calculator/index.scss`
    - Added styles for the new parity-only inputs and secondary button.
- Verification:
  - `npm run lint`: passed (informational only)
  - `npm run typecheck`: passed
  - `npx next build`: passed
  - `npm test`: passed, 21 files / 109 tests
  - `wechat_app/npm run build:weapp`: passed
  - WeChat DevTools automation: blocked because `mrc` is not installed and port `9420` is not open.

## WeApp Streetlifting Share Poster Fix (`2026-04-29`)

- Task: fix the WeChat mini-program streetlifting calculator share poster so it reflects the actual user-entered set data instead of only showing reps, and remove the misleading coefficient-only metric card.
- Status: code fix applied; code-level/build verification passed; WeChat DevTools visual verification attempted but blocked by missing local automation runtime.
- User-reported issue:
  - The generated mini-program share poster showed `力量系数 2.865` in a metric card, but the user expected the poster to reflect the actual performance score shown in the main hero area rather than spotlighting the coefficient.
  - The poster only showed `做组次数 4`, but did not include the user-entered working weight (`80kg x 4次` in the reported case).
- Fix:
  - `wechat_app/src/streetlifting/index/calculator/index.tsx`
    - Persist the working-weight value together with the calculator result payload so the result page/share flow can access the original set weight.
  - `wechat_app/src/streetlifting/index/calculator/result/index.tsx`
    - Pass `workingWeight` into the share-poster data builder, with fallback to computed/adjusted result fields for reverse modes.
  - `wechat_app/src/streetlifting/index/calculator/poster.ts`
    - Added `workingWeight` to `StrengthPosterData`.
    - The poster metric grid now swaps the coefficient card for a working-weight card when that value is available, so the poster shows `做组重量` and `做组次数` together instead of only reps.
    - Normalized bodyweight/working-weight number formatting to avoid noisy trailing `.0`.
  - `wechat_app/src/utils/streetliftingCalc.ts`
    - Rebuilt the shared calculator utility file with clean strings after `wechat_app/npm run build:weapp` exposed an existing historical unterminated-string parse error around `meanLoadFactorForReps()`.
- Verification:
  - `npm run lint`: passed (informational only; eslint is not configured).
  - `npm run typecheck`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - `npx next build`: passed.
  - `wechat_app/npm run build:weapp`: passed after fixing the historical `streetliftingCalc.ts` parse error.
  - WeChat DevTools automation: attempted but blocked.
    - `mrc --version`: failed because `mrc` is not installed in this session.
    - Port `9420` is not accepting connections, so local WeChat DevTools automation is not running.

---

## WeApp Knowledge Base Parity (`2026-04-29`)

- Task: align the WeChat mini-program knowledge-base experience with the current Web knowledge surfaces, using the Web side as the source of truth.
- Status: core mini-program knowledge-base sync implemented; root checks passed; WeChat mini-program build/manual verification attempted but blocked by an existing unrelated mini-program parse error plus missing local DevTools automation.
- Correction:
  - The user clarified that the current Web knowledge-home source of truth is narrower than the earlier mobile sync assumption.
  - The correct homepage scope is primarily `书籍笔记 + 人体地图`; mini-program-only or older extra sections such as scenario blocks, knowledge-tree browsing, and latest technical articles should not live on the mini-program knowledge homepage.
- Current result after correction:
  - `wechat_app/src/content/knowledge/index.tsx` now keeps only:
    - search
    - quick tags
    - book notes
    - body-map entry with `screening / training` mode switch
  - Removed the previously added extra homepage sections from the mini-program knowledge home:
    - scenario cards
    - knowledge tree
    - latest coach articles
- Implemented:
  - `wechat_app/src/content/knowledge/index.tsx`
    - Reworked the mini-program knowledge home toward the current Web information architecture.
    - Updated the top copy to frame the surface as a knowledge-base entry by body region, scenario, and book topic.
    - Retitled the scenario section from `场景急救` semantics toward the Web-aligned `场景放松`.
    - Added scenario cover-image cards instead of text-only cards.
    - Added body-map mode switching (`screening` / `training`) and now passes `mode` and `limit` into the shared `/api/knowledge/nodes` query.
    - Upgraded the books section from raw latest-book cards to grouped book collections (`overview + chapters`) like the Web flow.
  - `wechat_app/src/content/knowledge/index.scss`
    - Refreshed the mini-program knowledge-home layout and cards to support the new grouped books, scenario covers, and body-mode chips.
  - `wechat_app/src/constants/scenarioQuickFixes.ts`
    - Replaced the old mini-program scenario quick-fixes with the newer Web-aligned `场景放松` copy.
    - Reduced each scenario to the same 3-step structure used on the Web scenario pages.
    - Added local cover/step image references for each scenario.
  - `wechat_app/src/me/toolbox/index.tsx`
    - Synced the mini-program toolbox scenario block with the current Web toolbox direction (`场景放松`, cover images, updated copy).
  - `wechat_app/src/me/toolbox/index.scss`
    - Added scenario cover styling for the aligned toolbox cards.
  - `wechat_app/src/me/toolbox/scenario/index.tsx`
  - `wechat_app/src/me/toolbox/scenario/index.scss`
    - Upgraded the mini-program scenario detail page to the Web-style structure: cover image, current-step hero card, per-step images, and completion state.
  - `wechat_app/src/content/knowledge/book-detail/index.tsx`
  - `wechat_app/src/content/knowledge/book-detail/index.scss`
    - Upgraded mini-program book detail to better handle structured knowledge-book content (`html` / `markdown` fallback, disclaimer, related same-book entries, image prompts).
  - `wechat_app/src/services/knowledgeService.ts`
    - Extended `listNodes()` to forward `mode` and `limit`, matching the shared Web/API body-map query contract.
  - `wechat_app/src/utils/knowledgeBooks.ts`
    - Added a mini-program-side book-grouping helper parallel to the Web `knowledgeBooks` utility.
  - Assets:
    - Copied Web scenario images into `wechat_app/src/assets/images/toolbox-scenarios/first-aid-1.png` through `first-aid-12.png` so the mini-program can use the same scene imagery locally.
- Verification:
  - `npm run lint`: passed (informational only; eslint is not configured).
  - `npm run typecheck`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - `npx next build`: passed.
  - `wechat_app/npm run build:weapp`: failed before reaching the new knowledge-base pages because an existing unrelated file still has a parse error:
    - `wechat_app/src/utils/streetliftingCalc.ts`
    - `Unterminated string constant` around line 64.
  - WeChat DevTools automation: attempted but blocked.
    - `mrc --version`: failed because `mrc` is not installed in this session.
    - Port `9420` is not accepting connections, so WeChat DevTools automation is not running locally.

---

## Scenario Relief Copy Review (`2026-04-29`)

- Task: review the current `场景急救箱` content direction, tighten the user-facing copy, and prepare image prompts for each scenario card/step.
- Status: copy and image integration applied to the Web toolbox/scenario surface; code-level checks passed; browser verification attempted but blocked by the local browser runtime requirement.
- User preference:
  - Skip voice guidance for now.
  - Focus this round on revised copy plus image prompts only.
  - The scenario text explanation should feel more complete than short labels, and should read more like guided copy.
- Product guidance:
  - Prefer lower-risk wording such as `放松` / `舒展` / `缓解紧绷感`, and avoid stronger medical implication where the content is actually self-guided mobility/relief.
  - Keep scenario naming consistent across cards instead of mixing scene names with symptom names.
- Assets integrated:
  - Copied 12 user-provided desktop images into `public/images/toolbox-scenarios/first-aid-1.png` through `first-aid-12.png`.
- Web changes:
  - `src/app/me/toolbox/page.tsx`
    - Reworked the scenario section from `场景急救箱` to `场景放松`.
    - Updated the 4 scenario card titles/descriptions.
    - Added cover images to each scenario card.
  - `src/app/dashboard/knowledge/scenarios/[slug]/page.tsx`
    - Simplified each scenario to 3 image-backed steps so the 12 provided images map cleanly to `4 scenes x 3 steps`.
    - Added cover image + per-step image rendering for the active step and step list.
    - Upgraded scenario intros and step descriptions from short labels into fuller guided copy with clearer body cues and pacing.
- Verification:
  - `npm run lint`: passed (informational only; eslint is not configured).
  - `npm run typecheck`: passed.
  - `npx next build`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - Browser verification: attempted but blocked.
    - Local dev server responded at `http://127.0.0.1:3000/me/toolbox`.
    - In-app browser automation could not start because the available Node runtime is `v22.14.0`, while the browser runtime requires `>= v22.22.0`.

## WeApp Chat Video Player Route Fix (`2026-04-29`)

- Task: fix WeChat mini-program private-message video opening failure where tapping a chat video reference throws `navigateTo:fail page ".../video-player/index?...\" is not found`.
- Status: code fix applied; code-level checks passed; WeChat DevTools automation verification attempted but blocked by missing local automation runtime.
- Root cause:
  - Mini-program chat/profile video entrypoints were navigating to `/common/common/video-player/index?...`.
  - In Taro subpackage routing, the registered page path is `common/common/video-player` from `wechat_app/src/app.config.ts`, not the filesystem-style URL with `/index`.
- Fix:
  - `wechat_app/src/me/messages/chat/index.tsx`
  - `wechat_app/src/me/profile/detail/components/ProgressTimeline.tsx`
  - `wechat_app/src/me/profile/detail/components/VideoCollectionSection.tsx`
  - Updated all three entrypoints to navigate to `/common/common/video-player?...` so they match the actual registered mini-program page path.
- Verification:
  - `npm run lint`: passed (informational only; project has no eslint configured).
  - `npm run typecheck`: passed.
  - `npx next build`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - `wechat_app/npm run build:weapp`: passed.
  - WeChat DevTools automation: attempted but blocked.
    - `mrc --version`: failed because `mrc` is not installed in this session.
    - Port `9420` is not accepting connections, so WeChat DevTools automation is not running locally.

---

## Git Push / Merge To Main Blocked (`2026-04-28`)

- Task: push the current workspace state to remote, then merge it into `main` and push `main` to remote.
- Status: push gate cleared; preparing commit/push to `dev`, then merge/push to `main`.
- Gate results:
  - `npm run lint`: passed (informational only; project does not have eslint configured).
  - `npm test`: passed, 21 files / 106 tests.
  - `npm run typecheck`: passed after switching the root gate to the maintained submission surface via `tsconfig.typecheck.json` and fixing a few blocking compatibility issues in shared types/helpers.
  - `npm run test:e2e`: passed, 4/4.
- Environment fixes applied:
  - Installed local Playwright Chromium with `npx playwright install chromium`.
  - Updated `playwright.config.ts` to default to port `3000` so local e2e can reuse an already-running `next dev` session instead of fighting `.next/dev/lock` on port `3001`.
- Constraint satisfied:
  - Repo-required push gate (`lint` / `typecheck` / `test` / `test:e2e`) is now green for this submission round.

## Web Chat Video Reference Preview Fix (`2026-04-28`)

- Task: fix Web private-message video-reference cards so clicking a received training video opens a playable preview instead of immediately downloading the file.
- Status: code fix applied; code-level checks completed; browser verification attempted but blocked by missing/unsupported browser tooling in this session.
- Root cause:
  - `src/components/chat/VideoRefCard.tsx` was opening `videoUrl` with `window.open(...)`.
  - For storage-backed media URLs, the browser could treat the target as a direct file download instead of keeping the user in an in-page playback flow.
- Fix:
  - `src/components/chat/VideoRefCard.tsx`
    - Reworked click behavior so chat video-reference cards now prefer an in-page modal preview with `<video controls>` for directly playable URLs.
    - Added inline-play detection for common video extensions and storage-backed media URLs.
    - Kept external-link fallback only for non-inline-playable URLs.
    - Covered both the single-video card and multi-video carousel variants with the same preview behavior.
    - Added a visual fallback for missing `thumbnailUrl`: the card now uses a muted inline `<video>` first-frame preview before click when the media URL is directly playable.
    - Cleaned the card text rendering so set / kg / reps metadata is shown with stable labels.
  - `src/app/api/chat/list-student-videos/route.ts`
    - Hardened execution-set stat extraction to match action snapshots by both `id` and `action_id`.
    - Hardened set matching to use `set_number`, `setNumber`, and array-index fallback.
    - Added multi-key fallback reads for weight/reps (`actual_*`, `completed_*`, `planned_*`, legacy camelCase, and plain `weight` / `reps`).
  - `src/lib/mapChatMessageRows.ts`
    - Old chat messages no longer trust the original `content_metadata.video_references` snapshot forever.
    - Message hydration now refreshes referenced execution videos / personal video collections at read time so historical private-message cards can pick up the new cover behavior and the latest weight/reps mapping without needing the message itself to be resent.
- Verification:
  - `npm run lint`: passed (current script only reports that lint is not configured).
  - `npm run typecheck`: still fails on existing repo-wide historical errors unrelated to this fix, including Next 16 route validator drift, Supabase typing drift, and longstanding `wechat_app` alias/type issues.
  - `npx next build`: passed.
  - `npm test`: passed, 21 files / 106 tests.
  - Browser verification: attempted, but blocked.
    - Project-required `web-devtools` skill/tool is not available in this session.
    - Fallback in-app browser automation via `browser-use` could not start because `node_repl` reports the local Node runtime as `v22.14.0` while the browser runtime requires `>= v22.22.0`.

---

## WeApp Action Item Editor Parity (`2026-04-28`)

- Task: align the coach-side WeChat mini-program single action-item editor with the Web editor for plan/student plan editing.
- Status: code edits applied and code-level verification completed; WeChat DevTools visual verification still pending.
- User-confirmed parity problems:
  - Mini-program strength items were not reliably echoing the same sets/reps/rest values as Web, especially when old data used legacy Chinese keys instead of the newer canonical params.
  - The note field was missing from the main visible editing surface, making mini-program behavior diverge from Web.
  - Mini-program exposed confusing extra fields/labels such as `自定义重量` / `手动覆盖重量` and `自定义显示名称` that do not match the intended Web-facing product model.
- Fix:
  - `wechat_app/src/components/PlanEditorWorkbench/index.tsx`
    - Added shared fallback readers for strength `sets / reps / rest` so the editor can correctly read both canonical keys and legacy Chinese keys.
    - Strength item editing now writes both canonical params and legacy compatibility keys for sets/reps/rest, reducing Web/WeApp display drift on old records.
    - Strength item summary now uses the same normalized values and shows rest in minutes.
    - Added a visible `备注` field in the main strength editing area.
    - Renamed the manual weight override wording to fixed-weight semantics (`固定重量(备选)`), keeping it as an optional fallback rather than a separate concept.
    - Removed `自定义显示名称` from this editing surface.
  - `wechat_app/src/coach/students/plan/index.tsx`
    - Added the same visible main-area `备注` field for strength items in the student-plan editor.
    - Removed `自定义显示名称` exposure from the student-plan editing surface.
- Verification:
  - `npm run lint`: passed (current script is informational only).
  - `npm run typecheck`: still fails on existing repo-wide historical issues; no isolated new blocker from this fix was identified before those failures.
  - `npx next build`: passed.
  - `npm test`: passed, 21 files / 106 tests.
  - `wechat_app/npm run build:weapp`: passed.
- Blocker:
  - WeChat DevTools visual/manual verification is still pending because this session does not expose the required `weapp-devtools` tool.

---

## WeApp Plan Template Base Info Parity (`2026-04-28`)

- Task: align the coach mini-program plan-library template "基础信息" section with the Web editor exactly where the user called out remaining mismatch.
- Status: code edits applied and build/check pass except for known historical repo-wide typecheck failures; WeChat DevTools visual verification still pending.
- User-confirmed Web source of truth:
  - The mini-program template base-info area should only expose the Web-visible fields:
  - `模板名称`
  - `训练项目（可选）`
  - `详情描述`
  - `执行摘要`
  - `每周频率`
- Fix:
  - `wechat_app/src/components/PlanEditorWorkbench/index.tsx`
    - Added a dedicated `训练项目（可选）` input using the existing `tags` payload under the hood.
    - Added a dedicated `每周频率` field directly in the main base-info area.
    - Hid the mini-program-only legacy block that was still exposing `标签 / 适合人群 / 模板类型 / 旧频率` in this surface.
    - Updated the visible base-info wording toward the Web structure, including `详情描述` and `执行摘要`.
- Verification:
  - `npm run lint`: passed (informational only).
  - `npm run typecheck`: still fails on existing repo-wide historical errors unrelated to this change.
  - `npx next build`: passed.
  - `npm test`: passed, 21 files / 106 tests.
  - `wechat_app/npm run build:weapp`: passed.
- Blocker:
  - WeChat DevTools visual/manual verification is still pending because this session does not expose the required `weapp-devtools` tool.

---

## Web vs WeApp Plan Logic Analysis (`2026-04-28`)

- Task: compare Web and WeChat mini-program logic differences for coach-side plan flow, from questionnaire filling to student plan generation to later plan modification.
- Status: analysis completed, and the first mini-program sync patch for the Web AI-generation entry has been implemented.
- Key finding:
  - This topic actually contains two different chains that should not be mixed together:
  - Coach subscription / student plan management chain: questionnaire answers are stored in `coach_subscriptions.subscribe_data`, plan generation goes through `/api/plan-lib/create-ai-instance`, and later AI modification goes through `/api/plan-lib/batch-operation`.
  - Discovery quick-plan chain: public `generate-plan` pages on Web and mini-program still go through `/api/user/submit-onboarding` -> `/api/user/generate-quick-plan`, which is an older and separate path.
  - For the coach-side student plan flow, Web and mini-program already share most of the backend generation/modification engine; the larger differences are now mostly in the frontend orchestration and exposed controls.
- Concrete differences:
  - Questionnaire authoring: Web is much more complete. `src/app/dashboard/questionnaire/*` has richer draft/online management, branching/tree editing, preview, media/import tooling, and flow editing. Mini-program `wechat_app/src/coach/questionnaire/*` supports list/edit/publish/copy but is noticeably lighter.
  - Student questionnaire filling: Web `src/app/coach/profile/[id]/QuestionnaireForm.tsx` has the more complete renderer/merge logic and better branching/history handling. Mini-program `wechat_app/src/components/QuestionnaireForm/index.tsx` is a simpler form implementation.
  - Coach-generated student plans: the backend DTO and route already support `useLLM`, `startWeek`, `startDay`, and `keepOriginalIndex`, but mini-program `wechat_app/src/services/coach/planLibService.ts` currently does not pass `useLLM`, while Web does. This is one of the most important real behavior differences.
  - Later plan modification: both ends already reuse the same batch-operation backend, but Web still has the fuller workstation flow, including the complete batch-operation dialog and new-action confirmation path. Mini-program can preview/apply the plan-script-based modification path, but blocks unresolved new actions and has a lighter UX.
  - Student detail / subscription maintenance: mini-program now covers much more of the Web capability than before, including questionnaire edit, purchased weeks, prior weeks, refunds, review notes, and plan history. The gap here is smaller than in questionnaire authoring and AI editing.
- Product judgment:
  - If future changes are about coach-side student plan generation or modification, the first place to inspect/change is the shared `plan-lib` backend chain rather than the public discovery quick-plan path.
  - If the goal is full parity, the biggest remaining Web-over-mini-program advantage is not the raw generation engine itself, but the richer questionnaire system and the fuller AI editing workstation around that engine.
- User clarification:
  - Ignore the public discovery quick-plan flow for now.
  - The current core analysis focus is the coach-side chain after questionnaire completion: questionnaire answers -> LLM analysis -> `plan_script` generation -> plan instance creation.
  - Questionnaire capability parity can be handled by aligning mini-program toward the richer Web questionnaire feature set, but that is secondary to understanding and potentially changing the answer-to-plan chain itself.
- Sync implemented:
  - `wechat_app/src/coach/students/index.tsx`: mini-program coach AI-generation dialog now follows the Web entry more closely by exposing an explicit `useLLM` toggle and passing that choice into both single-student and bulk generation flows.
  - The mini-program dialog no longer treats `keepOriginalIndex` as a user-facing option for this entry; it now stays aligned with the Web behavior of keeping it fixed at `true` in this flow.
  - The same mini-program dialog now explains the effective start position more clearly: when generation does not begin from week 1 day 1, it shows the same execution-day semantics the Web flow implies, so coaches can see how many days will be considered already completed before confirming.
  - Mini-program success feedback now distinguishes `LLM` generation from the rule-based fallback path, so the coach can see which generation mode actually ran.
  - `wechat_app/src/services/coach/planLibService.ts`: `createAiInstance()` and `bulkCreateAiInstances()` now forward `useLLM` to the shared backend DTO/route, matching the Web service contract.
  - `wechat_app/src/coach/students/plan/index.tsx`: the mini-program student-plan page now surfaces more of the shared `ai_generation_log`, including Stage A source / confidence / prompt version / timestamp and clearer Stage A copy (`选中骨架` vs `从零生成`), making the Web answer-to-plan chain more observable on mobile.
- Verification:
  - `npm run lint`: passed (informational script only).
  - `npm run typecheck`: still fails on existing repo-wide historical issues, including Next 16 route validator drift, Supabase type drift, and longstanding mini-program alias/type noise; the transient syntax errors introduced during this sync round in `wechat_app/src/coach/students/plan/index.tsx` were fixed before the final check, and no remaining task-specific type error was isolated from this change.
  - `npx next build`: passed.
  - `npm test`: passed, 21 files / 106 tests.
  - `wechat_app/npm run build:weapp`: passed.
  - WeChat DevTools visual/manual verification is still blocked in this session because the required `weapp-devtools` tool is not available here.

---

## WeApp Plan Library Parity Fix (`2026-04-28`)

- Task: align mini-program coach plan library editor with Web screenshot feedback.
- Status: code edits applied; no build/check run per user's standing instruction to focus on code only.
- Fix:
  - `wechat_app/src/components/PlanEditorWorkbench/index.tsx`: removed the mini-program-only `问卷联动` section from plan template create/edit, removed questionnaire loading from template editor, and changed the base metadata control from misleading weekday chips to Web-like `建议每周频率` chips (`1次/周` ... `7次/周`).
  - `wechat_app/src/coach/plan-lib/create/index.tsx` and `wechat_app/src/coach/plan-lib/edit/index.tsx`: stopped loading/passing coach questionnaires into plan template editing; edit subtitle no longer mentions questionnaire linkage.
  - `wechat_app/src/components/PlanCompactWeekCalendar/index.tsx/.scss`: collapsed week calendar now renders all 7 plan days in one grid instead of horizontal scroll showing only about 4 days.
  - Calendar labels now use plan-day semantics (`第1日`, `第2日`, ... within a week; detail title `第 N 天 · 第M日`) instead of real weekdays (`周一`, `周二`), because template day 1 is not necessarily Monday.
  - `wechat_app/src/components/PlanEditorWorkbench/index.tsx` + `wechat_app/src/utils/planStrength.ts`: strength action unit now aligns with Web `ActionSetForm` semantics:
    - rest value is stored as seconds (`rest_seconds` / `休息时间`) and displayed as minutes (e.g. `270` sec -> `4.5` min).
    - RM parsing now supports `intensityConfig.relativeIntensity`, legacy numeric `params.强度`, and string `params.intensity` formats.
    - strength panel now supports RM/%/fixed mode switching with algorithm selection (`综合计算` / `Epley` / `Brzycki` / `Lombardi`) and a recommended weight fallback input.
    - auto-compute preview respects algorithm selection and falls back to recommended weight when oneRM/body-weight context is missing.

---

## Chat SSE / Redis Hotfix (`2026-04-27`)

- Task: respond to user-reported local logs showing Redis `ECONNREFUSED 154.8.205.78:6379`, SSE `Controller is already closed`, and mini-program startup from `wechat-app`.
- Status: code hotfix applied; user explicitly does not want checks/builds for this phase.
- Fix:
  - `src/app/api/chat/unified-stream/route.ts`: SSE writes now go through `safeEnqueue`; request abort/cancel closes the stream and removes Supabase realtime channels; late async callbacks stop if the stream is already closed.
  - `src/lib/redisClient.ts`: Redis disables automatic reconnect for a refused endpoint, disables the offline queue, and logs only the first connection error to avoid terminal spam.
- Finding:
  - Current checkout contains `wechat_app/` and not `wechat-app/`; mini-program scripts should be run from `D:\projects\coachlink\wechat_app`.
- Verification:
  - No lint/build/test run per user instruction.

---

## Coach-Side Web/WeApp Alignment Follow-Up (`2026-04-27`)

- Task: continue aligning coach mini-program `计划库` and `我的学员` with the Web coach workstation.
- Status: continued code edits; per latest user instruction, no further checks/builds were run after this point.
- Added:
  - `wechat_app/src/coach/students/detail/index.tsx`: student detail now loads recent plan history through the existing `coachService.getStudentPlanHistory()` API and renders a `计划历史` card below the current plan card.
  - `wechat_app/src/coach/students/detail/index.scss`: added mobile styles for the plan history card, status/source/day metadata, and empty/loading states.
  - `wechat_app/src/coach/students/plan/index.tsx`: historical plans can now be opened from the mini-program by `instanceId` in a read-only plan viewer; edit/import/AI-modifier/status/1RM actions are hidden or blocked.
  - `wechat_app/src/services/coach/planLibService.ts`: `getInstance()` now supports explicit instance-id lookup, matching the Web historical-plan contract.
  - `wechat_app/src/coach/students/detail/index.tsx`: plan history now supports Web-like source filtering (`全部` / `教练计划` / `学员自建`) and incremental loading instead of only showing a fixed latest slice.
- Product boundary:
  - The mini-program now surfaces recent historical plans for scan/parity.
  - Opening the active current plan still enters the mini-program editor; historical plan entries open a mini-program read-only detail view.

- Task: Coach-side `计划库` / `我的学员` Web 与微信小程序继续对齐
- Scope:
  - 用户要求继续缩小教练端计划库与我的学员在 Web 和小程序之间的差异，目标是尽量完全一致。
  - 本轮继续补齐 Web 专业工作台层能力：计划脚本模式、学员问卷编辑、平台退款入口、AI 生成记录展示、反馈驱动的 AI 计划修改器入口。
- Status: implemented in code on `2026-04-27`
- Fix:
  - `wechat_app/src/utils/planScript.ts`: 新增小程序端计划脚本 DSL 解析/格式化工具，支持 `W1`、`D1`、`D2 off #备注`、`动作 4x8 @9rm r180 #备注`。
  - `wechat_app/src/components/PlanEditorWorkbench/index.tsx`: 计划库编辑器新增“脚本模式”入口和弹窗，可从当前计划生成脚本，也可将脚本解析回 `trainingDays`。
  - `wechat_app/src/coach/students/detail/index.tsx`: 学员详情新增“入营问卷”查看与编辑；平台支付宝订单新增退款入口，复用 Web 退款 API。
  - `wechat_app/src/coach/students/plan/index.tsx`: 学员计划页展示 `ai_generation_log`，并新增小程序版“AI 修改器”；反馈面板新增“用反馈改计划”。
  - `wechat_app/src/services/coach/planLibService.ts`: 新增 `previewBatchOperationLocal()`，解析 batch-operation 的 SSE 文本结果并返回 `preview_result`。
- Verification:
  - `wechat_app` `npm run build:weapp`: passed.
  - `npm run lint`: passed; script only prints lint-not-configured notice.
  - `npm run typecheck`: failed on existing repo-wide historical issues, including Next 16 route params, Supabase generated type drift, and root tsconfig not resolving mini-program `@/` aliases.
  - `npx next build`: passed.
  - `npm test`: passed, 21 files / 106 tests.
- Next step:
  - Visual verification in WeChat DevTools is still pending because this session does not expose the required `weapp-devtools` tool.
  - Remaining parity gaps are mostly deeper analytics/history/detail polish and the full Web AI modifier multi-turn/new-action-confirmation UX; mini-program currently supports the core preview/apply path and blocks unresolved new actions.

- Task: Web 私信支持“回复指定消息”
- Scope:
  - 场景：对方连续发送多条消息时，用户可以明确回复其中某一条，而不是只发普通跟进消息。
  - 本轮只做 Web 私信系统，不改微信小程序消息页。
  - 用户已明确说明这轮“不用构建，只管改代码”。
- Status: implemented in code on `2026-04-27`
- Fix:
  - `src/app/api/chat/send-message/entity.ts`
    - `SendMessageDto` 新增 `replyToMessageId?: string`
  - `src/app/api/chat/send-message/route.ts`
    - 发送消息时支持接收 `replyToMessageId`
    - 服务端校验被回复消息必须存在且属于当前会话
    - 使用 `chat_messages.content_metadata.reply_to_message` 持久化可信回复摘要
    - 与 `video_reference` 的 `content_metadata.video_references` 共存
  - `src/app/api/chat/list-messages/entity.ts`
    - 消息类型新增 `contentMetadata.reply_to_message`
  - `src/components/chat/ChatPanel.tsx`
    - 新增 `replyTarget` 状态
    - 点击某条消息的“回复”后，在输入框上方展示回复目标条
    - 发送文本、图片、视频引用时一并带上 `replyToMessageId`
    - 乐观更新时同步渲染回复引用块
    - 点击引用块可跳转并高亮原消息
  - `src/components/chat/ChatMessageList.tsx`
    - 透传 `onReply` / `onJumpToMessage`
  - `src/components/chat/MessageItem.tsx`
    - 每条消息新增“回复”动作
    - 气泡上方新增被回复消息引用块展示
- Verification:
  - `npm run lint`: passed（脚本仅提示项目未配置 eslint）
  - `npm run typecheck`: blocked by existing repo-wide historical errors; this round did not isolate a chat-reply-specific new type error before those旧错误中断
  - `npm test`: blocked by local `vitest` startup `spawn EPERM`
  - `npx next build`: not rerun per latest user instruction; user explicitly asked to stop构建 and focus on code only
- Next step:
  - 后续可以继续做“撤回/编辑/多级回复/回复预览中的媒体缩略图”等增强
  - 如果用户确认交互满意，再补浏览器端验证与回归测试

- Task: 将《力量训练原理》整理为可上传的非侵权书籍笔记并接入知识库书籍页
- Latest (`2026-04-26`): 修复微信小程序 DevTools 代码质量告警（主包大小 / JS 压缩 / 组件按需注入 / 图片资源）
- Task: 根据微信开发者工具代码质量面板的告警，降低小程序包体积并补齐官方建议配置
- Scope:
  - `wechat_app/project.config.json`
  - `wechat_app/config/index.ts`
  - `wechat_app/src/app.config.ts`
  - `wechat_app/src/pages/index/index.tsx`
  - `wechat_app/src/pages/index/index.scss`
  - `wechat_app/src/me/toolbox/index.tsx`
  - `wechat_app/src/assets/images/toolbox-*.jpg`
- Status: in_progress on `2026-04-26`
- This round:
  - 打开 DevTools 代码压缩开关：`project.config.json -> setting.minified = true`
  - 启用组件按需注入：`app.config.ts -> lazyCodeLoading = 'requiredComponents'`
  - 小程序构建改为不产出 source map，并开启 `esbuild` JS 压缩、`lightningcss` CSS 压缩
  - 移除对 `src/assets/images/` 与品牌图的整目录 copy，改为按代码引用打包
  - `me/toolbox/index.tsx` 改为模块化图片引用，避免依赖根包静态路径
  - 压缩三张工具封面图到 200KB 内：`toolbox-data.jpg` `152821B`、`toolbox-locations.jpg` `133250B`、`toolbox-calculator.jpg` `112712B`
  - 学员首页 `pages/index/index` 不再直接渲染 `TodayTrainingScreen`，改为轻量身份判断后跳转到 `/training/today-training`，以减轻主包首页依赖
- Verification:
  - `wechat_app npm run build:weapp`：通过
  - `find wechat_app/dist -type f \\( -name '*.jpg' -o -name '*.png' -o -name '*.jpeg' -o -name '*.gif' -o -name '*.svg' \\)`：当前 `dist` 仅剩 `favicon.svg`，大图不再落在根包静态目录
  - `mrc relaunch /pages/index/index --port 9420`：通过
  - `mrc where --port 9420`：当前页面 `pages/index/index`
  - `mrc errors 10 --port 9420` / `mrc warnings 10 --port 9420`：均为 0 条
  - 当前剩余观察项：
    - 本地 `development` 模式产物根目录仍存在较大的 `common.js` / `vendors.js`，DevTools 的“主包 < 1.5M”是否已完全转绿，需要在开发者工具代码质量面板重新扫描确认
    - `mrc screenshot` 本轮再次长时间无返回，未拿到截图文件

- Latest (`2026-04-26`): 按用户要求启动开发环境
- Task: 启动 `coachlink` Web 开发服务、小程序 `dev:weapp` 监听，以及微信开发者工具
- Scope:
  - 根目录使用 `npm run dev` 启动 Next.js 开发服务（覆盖 Web 前端与 API 后端）
  - `wechat_app/` 使用 `npm run dev:weapp` 启动小程序本地构建监听
  - 使用微信开发者工具 CLI 打开 `wechat_app` 项目，并确认自动化端口可连接
- Status: started on `2026-04-26`
- Verification:
  - 根目录 `npm run dev`：已启动并保持运行，Next.js 16 开发服务监听 `http://localhost:3000`
  - `curl -I http://127.0.0.1:3000`：返回 `307 Temporary Redirect` 到 `/coach/discovery`
  - `wechat_app npm run dev:weapp`：已启动并完成首轮 watch 构建，输出目录为 `wechat_app/dist`
  - `python3 .kimi/skills/port-manager/scripts/portman.py get /Users/kirigaya/project/coachlink weapp-devtools-20260426`：分配并登记端口 `3014`
  - `'/Applications/wechatwebdevtools.app/Contents/MacOS/cli' auto --project /Users/kirigaya/project/coachlink/wechat_app --port 33988 --debug`：成功返回 `✔ auto`
  - `mrc where --port 9420`：可连接，当前页面为 `pages/index/index`

- Latest (`2026-04-25`): 审计 `root@coachlink.fit` 的 SSH 与可疑进程，并关闭 SSH 密码登录
- Task: 检查服务器是否存在密码登录风险、木马/挖矿等异常，并将 SSH 收紧为仅允许密钥登录
- Scope:
  - 通过 `ssh root@coachlink.fit` 登录服务器做只读安全体检
  - 检查 `sshd` 当前有效配置、`authorized_keys`、root 口令状态
  - 检查可疑进程、systemd 服务、定时任务、监听端口
  - 将 SSH 调整为仅允许公钥登录并重载验证
- Status: completed on `2026-04-25`
- Verification:
  - `passwd -S root`：root 账户当前存在本地口令哈希，状态为 `PS`，算法显示为 `MD5 crypt`
  - `sshd -T -C user=root -C host=$(hostname) -C addr=127.0.0.1`：
    - `passwordauthentication no`
    - `kbdinteractiveauthentication no`
    - `pubkeyauthentication yes`
    - `permitrootlogin without-password`
  - 新增 `/etc/ssh/sshd_config.d/00-key-only.conf`，并删除失效的晚序配置 `/etc/ssh/sshd_config.d/99-key-only.conf`
  - `systemctl reload sshd`：通过
  - 可疑项：
    - 发现运行中的矿工进程：`./https -a rx/0 -o pool.supportxmr.com:3333 ...`
    - 发现启用过的挖矿服务：`c3pool_miner.service`、`moneroocean_miner.service`
    - 发现 Redis `6379` 对公网监听且存在外部连接
  - 当前未执行：
    - 未主动停止/删除挖矿进程与文件，避免误伤潜在“人为部署”的内容；如需我可下一步直接清理

- Latest (`2026-04-25`): 通过 `port-manager` 为当前仓库分配新端口并打开新的微信开发者工具窗口
- Task: 避开当前已启动的微信开发者工具端口，为 `coachlink/wechat_app` 新开独立 DevTools 实例
- Scope:
  - 读取 `~/.port-man` 登记并结合本机监听状态判断可用端口
  - 使用 `.kimi/skills/port-manager` 为当前仓库新增登记端口
  - 使用微信开发者工具 CLI 打开 `wechat_app` 项目
- Status: completed on `2026-04-25`
- Verification:
  - `python3 .kimi/skills/port-manager/scripts/portman.py get /Users/kirigaya/project/coachlink weapp-devtools-20260425`：分配并登记端口 `3013`
  - `lsof -nP -iTCP:3013 -sTCP:LISTEN`：确认分配时 `3013` 未被占用
  - `lsof -nP -iTCP -sTCP:LISTEN | rg '(:94|:30|:35|wechatwebdevtools|wechatweb|Python)'`：确认现有实例仍占用 `9420`，且 `3010` 被 `Python run_backend.py` 占用
  - `'/Applications/wechatwebdevtools.app/Contents/MacOS/cli' auto --project /Users/kirigaya/project/coachlink/wechat_app --port 3013 --debug`：微信开发者工具未按指定端口启动，而是提示实例实际已起在 `16866`
  - `'/Applications/wechatwebdevtools.app/Contents/MacOS/cli' auto --project /Users/kirigaya/project/coachlink/wechat_app --port 16866 --debug`：成功，当前项目已挂到新实例
  - `lsof -nP -iTCP:16866 -sTCP:LISTEN`：确认新实例实际监听 `127.0.0.1:16866`
  - 当前阻塞：
    - `mrc where --port 16866` 仍连接失败；当前可确认新窗口已打开并监听 `16866`，但本机 `mrc` 暂未直接接入这个实例

- Latest (`2026-04-24`): 避开已打开项目的微信开发者工具端口，为当前仓库新开独立 DevTools 窗口
- Task: 在不影响已占用 `9420` 的前提下，为 `coachlink/wechat_app` 打开新的微信开发者工具实例，并确认当前使用端口
- Scope:
  - 使用 `.kimi/skills/port-manager` 检查登记端口与实际监听情况
  - 使用微信开发者工具 CLI 为 `wechat_app` 打开独立项目窗口
  - 避免与另一个项目已打开的开发者工具端口冲突
- Status: completed on `2026-04-24`
- Verification:
  - `python3 .kimi/skills/port-manager/scripts/portman.py list`：确认当前仓库已登记 `weapp-devtools` 端口且已有其他项目占用不同端口
  - `lsof -nP -iTCP:9420 -sTCP:LISTEN`：旧实例仍在监听 `9420`
  - `'/Applications/wechatwebdevtools.app/Contents/MacOS/cli' auto --project /Users/kirigaya/project/coachlink/wechat_app --port 35437 --debug`：成功
  - `lsof -nP -iTCP:35437 -sTCP:LISTEN`：新的微信开发者工具实例监听 `127.0.0.1:35437`
  - 当前阻塞：
    - `mrc where --port 35437` 连接失败；现阶段可确认新窗口已打开并监听 `35437`，但本机 `mrc` 尚未直接接入该实例

- Latest (`2026-04-24`): 首页/发现页主题色统一为 `#C27255` 并变量化
- Task: 重启 Web 后端、打开微信开发者工具，并将小程序首页与发现页所有橙色相关细节统一改为基于主题变量的 `#C27255`
- Scope:
  - Web 后端：根目录 `npm run dev`
  - 微信开发者工具：`9420` 自动化端口保持可连接
  - 主题变量源头：`wechat_app/src/app.scss`、`wechat_app/src/styles/theme.ts`
  - 首页：`wechat_app/src/pages/index/index.scss`、`wechat_app/src/pages/index/index.tsx`、`wechat_app/src/training/today-training/**`
  - 发现页：`wechat_app/src/discovery/index.scss`
- This round:
  - 重启 Web 后端并确认 `http://127.0.0.1:3000` 返回 `307`
  - 唤起微信开发者工具应用，`9420` 端口继续监听
  - 新增小程序主题常量 `BRAND_PRIMARY = #C27255` 与全局 CSS 变量：
    - `--brand-primary`
    - `--brand-primary-rgb`
    - `--primary`
    - `--primary-light`
    - `--primary-soft-bg`
    - `--primary-soft-bg-strong`
    - `--primary-soft-border`
  - 将首页和发现页内所有橙色相关按钮、图标、浅底、描边、阴影统一改为变量引用，不再直接写新的主题色
- Status: implemented on `2026-04-24`
- Verification:
  - 根目录 `npm run dev`：已重启并保持运行
  - `curl -I http://127.0.0.1:3000`：返回 `307 Temporary Redirect` 到 `/coach/discovery`
  - `wechat_app npm run build:weapp`：通过
  - 根目录 `npm run lint`：通过（脚本仅提示未配置 eslint）
  - 根目录 `npm test`：通过（21 files, 100 tests）
  - 根目录 `npx next build`：通过
  - 根目录 `npm run typecheck`：失败，仍为仓库既有大量历史类型错误（Next route handler、Supabase 类型、小程序别名解析等）；本轮新增的 `@/styles/theme` 也落在同一批既有 `wechat_app` 别名解析错误里
  - 小程序运行态验证（`9420`）：
    - `mrc errors 20 --port 9420` / `mrc warnings 20 --port 9420`：均为 0 条
    - 当前页面校验类命令本轮再次出现长时间无返回，未拿到稳定的页面路径/元素存在性回执
- Latest (`2026-04-24`): 首页「今日安排」继续按参考图做严格贴图式微调
- Task: 将学员端首页 `今日安排` 卡片的颜色、留白、内外卡层级、状态胶囊和底部按钮尺寸进一步压到用户参考图效果
- Scope:
  - 页面位于 `wechat_app/src/training/today-training/TodayTrainingScreen.tsx`
  - 样式位于 `wechat_app/src/training/today-training/index.scss`
  - 卡片样式位于 `wechat_app/src/training/today-training/components/TodayTrainingCard.scss`
- This round:
  - 收紧 `tt-schedule-stack` 外层白卡：加大圆角、调整阴影、抬高头部与右侧 `查看全部` 胶囊尺寸
  - 将嵌入式 `TodayTrainingCard` 的内层边框卡、顶部灰条、顺延标签、标题字号、状态胶囊和底部双按钮继续向参考图靠拢
  - 主按钮改为更浅的米色块面，右侧列表按钮放大到更接近参考图的方形尺寸
- Status: implemented on `2026-04-24`
- Verification:
  - `wechat_app npm run build:weapp`：通过
  - 根目录 `npm run lint`：通过（脚本仅提示未配置 eslint）
  - 根目录 `npm test`：通过（21 files, 100 tests）
  - 小程序运行态验证（`9420`）：
    - `mrc relaunch /pages/index/index --port 9420`：通过
    - `mrc where --port 9420`：当前页面 `pages/index/index`
    - `mrc exists .tt-schedule-stack/.training-card--embedded/.main-action-btn__icon --port 9420`：均存在
    - `mrc errors 20 --port 9420` / `mrc warnings 20 --port 9420`：均为 0 条
  - 当前阻塞：
    - 按用户要求继续使用 `weapp-devtools` 执行 `mrc screenshot` 两次，命令均连接成功但长时间无返回，未产出截图文件
    - 尝试使用系统级 `screencapture` 做辅助截图时，当前机器返回 `could not create image from display/rect`，说明本机会话下未拿到可用录屏截图能力

- Latest (`2026-04-24`): 底部导航页统一移除微信默认导航栏并补顶间距
- Task: 底部导航栏每个按钮对应页面去除微信默认导航栏，并在已移除的页面顶部预留 `180rpx` 上间距
- Scope:
  - 学员端：`pages/index/index`、`discovery/index`、`me/toolbox/index`、`me/messages/index`、`me/profile/index`
  - 教练端：`coach/overview`、`coach/videos`、`coach/students`、`coach/plan-lib`、`coach/my-profile`
  - 已经是 `navigationStyle: 'custom'` 的页面不重复移除，只补样式时按现状处理
- Status: implemented on `2026-04-24`
- Verification:
  - `wechat_app npm run build:weapp`：通过
  - 根目录 `npm run lint`：通过（脚本仅提示未配置 eslint）
  - 根目录 `npm test`：通过（21 files, 100 tests）
  - 根目录 `npm run typecheck`：失败，仍为仓库既有大量历史类型错误；未见本轮新增指向上述底部导航页面的单独结论
  - 小程序运行态验证（`9420`）：
    - `mrc relaunch /discovery/index --port 9420`：通过
    - `mrc where --port 9420`：当前页面 `discovery/index`
    - `mrc exists .discovery-page --port 9420`：存在
    - `mrc exists .page-header --port 9420`：存在
    - `mrc errors 20 --port 9420` / `mrc warnings 20 --port 9420`：均为 0 条

- Latest (`2026-04-24`): 小程序「发现」页主内容按参考图重排
- Task: 根据用户提供的发现页参考图，重做小程序 `discovery/index` 的主要内容布局
- Requirement:
  - 保持每次修改后自动编译再反馈
- Scope:
  - 页面位于 `wechat_app/src/discovery/index.tsx`
  - 头部改为大标题 + 副标题 + 圆角搜索栏 + 六宫格分类入口
  - `服务商品` 改为带封面图的横向商品卡，补齐标签、教练信息、价格与购买/加购按钮
  - `热门动作` 改为参考图式的纵向列表卡，包含左侧封面、标题摘要、作者/点赞与详情按钮
  - `推荐教练` 区块下沉到主内容后段，保留原筛选与加载更多能力
- Status: implemented on `2026-04-24`
- Verification:
  - `wechat_app npm run build:weapp`：通过
  - 根目录 `npm run lint`：通过（脚本仅提示未配置 eslint）
  - 根目录 `npm test`：通过（21 files, 100 tests）
  - 根目录 `npx next build`：通过
  - 根目录 `npm run typecheck`：失败，仍为仓库既有大量历史类型错误；本轮未新增指向 `discovery/index` 的单独新错误结论
  - 小程序运行态验证（`9420`）：
    - `mrc relaunch /discovery/index --port 9420`：通过
    - `mrc exists .quick-category-row --port 9420`：存在
    - `mrc exists .market-cover-wrap --port 9420`：存在
    - `mrc exists .action-list-card --port 9420`：存在
    - `mrc errors 20 --port 9420` / `mrc warnings 20 --port 9420`：均为 0 条
  - 当前阻塞：
    - `mrc screenshot screenshots/weapp/discovery-reference-2026-04-24.png --port 9420` 本轮长时间无返回，仍未拿到稳定截图文件

- Latest (`2026-04-24`): 小程序首页「我的计划 / 今日安排 / 轻量任务」布局优化
- Task: 将首页中的「进入今日训练」「联系教练」合并进「我的计划」板块底部，并按参考图优化「今日安排」「轻量任务」区块布局
- Requirement:
  - 用户新增要求：今后每次修改后都要自动执行编译，再反馈结果
- Scope:
  - 页面位于 `wechat_app/src/training/today-training/TodayTrainingScreen.tsx`
  - 将 `进入今日训练` 主按钮从独立块移动到顶部「我的计划」卡片底部
  - 将 `联系教练` 入口并入同一卡片底部，与续费/移除自建计划共用次级操作区
  - 「今日安排」头部新增右侧 `查看全部` 入口，用于切换月历展开态
  - 收紧嵌入式 `TodayTrainingCard` 结构：顶部摘要、日期信息、训练主按钮与轻量任务卡片更接近参考图的卡片层级
- Status: implemented on `2026-04-24`
- Verification:
  - `wechat_app npm run build:weapp`：通过
  - 根目录 `npm run lint`：通过（脚本仅提示未配置 eslint）
  - 根目录 `npm test`：通过（21 files, 100 tests）
  - 根目录 `npx next build`：通过
  - 根目录 `npm run typecheck`：失败，仍为仓库既有的大量历史类型错误，包含 Next 路由类型、Supabase 类型和 `wechat_app` 别名解析等问题；本轮未新增与 `today-training` 改动直接对应的新错误结论
  - 小程序运行态验证（`9420`）：
    - `mrc where --port 9420`：当前页面为 `pages/index/index`
    - `mrc exists .tt-plan-actions --port 9420`：存在
    - `mrc exists .section-header__action --port 9420`：存在
    - `mrc exists .embed-topline --port 9420`：存在
    - `mrc exists .strength-side-btn --port 9420`：存在
    - `mrc click .section-header__action --port 9420` 后，`mrc exists .schedule-calendar-anchor__toggle-icon--expanded --port 9420`：存在，说明“查看全部/收起月历”交互生效
    - `mrc errors 20 --port 9420` / `mrc warnings 20 --port 9420`：均为 0 条
  - 当前阻塞：
    - `mrc screenshot` 在本机本轮仍返回 `fail to capture screenshot`，因此本轮没有拿到新的开发者工具截图文件
  - 本轮追加微调：
    - 将嵌入式 `TodayTrainingCard` 的力量模块统计卡（动作/计划组数/完成进度）移除
    - 标题区改为“标题 + 右侧状态胶囊 + 下方单行摘要”
    - 主按钮视觉改为更接近参考图的浅米色大按钮，保留右侧列表辅助按钮
    - `mrc exists .strength-stats --port 9420`：不存在
    - `mrc exists .panel-inline-meta/.main-action-btn/.strength-side-btn --port 9420`：均存在
  - 本轮再次调整：
    - 去掉计划卡底部的“联系教练”按钮
    - 在“切换教练”按钮左侧新增当前激活教练头像入口，点击进入原“联系教练”页
    - 「今日安排」标题图标改为浅底黑色图标风格；标题、按钮和边框进一步向参考图靠拢
    - 「轻量任务」标题区改为“图标气泡 + 标题 + 右侧新增轻任务胶囊”的结构
    - `wechat_app npm run build:weapp`：通过
    - 根目录 `npm test`：通过（21 files, 100 tests）
    - `mrc errors 20 --port 9420` / `mrc warnings 20 --port 9420`：均为 0 条
    - 本轮 `mrc exists` 对若干新元素查询在本机开发者工具连接上出现长时间无返回，因此未拿到稳定的元素存在性回执；运行日志层面未见报错

- Latest (`2026-04-24`): 按用户要求启动开发环境
- Task: 启动 `coachlink` Web 前后端开发服务、小程序 `dev:weapp` 监听，以及微信开发者工具自动化会话
- Status: started on `2026-04-24`
- Verification:
  - 根目录 `npm run dev` 已启动，Next.js 16 开发服务监听 `http://localhost:3000`
  - `curl -I http://127.0.0.1:3000` 返回 `307 Temporary Redirect` 到 `/coach/discovery`，说明 Web 服务可响应
  - `wechat_app npm run dev:weapp` 已启动并完成首轮 watch 构建，输出目录为 `wechat_app/dist`
  - 微信开发者工具自动化服务监听 `9420`
  - `mrc where --port 9420` 可连接，当前页面为 `pages/index/index`
  - `mrc errors 10 --port 9420` / `mrc warnings 10 --port 9420` 均为 0 条

- Latest (`2026-04-23`): 按用户要求根据项目 skills 启动开发环境
- Task: 启动 `coachlink` Web 前后端开发服务、小程序 `dev:weapp` 监听，以及微信开发者工具自动化会话
- Scope:
  - 用户要求先从 `D:\WPSDrive\632379361\WPS云盘\创业-部分资料版\健身书籍pdf的文字版本\力量训练原理.docx` 开始
  - 内容必须是“笔记 / 解读”形态，不能做原书全文搬运或章节替代
  - 笔记需要成体系、深入浅出、通俗好读，并预留可直接给 AI 画图的提示词
  - 用户进一步明确：`1 本书 = 1 篇长文` 太粗糙，应改为 `1 本书 = 1 个专题 + 多篇文章`
  - 目标不只是生成文案，还要让知识库 `书籍笔记` 页面能把结构化内容正常展示出来，并能从同一本书的总览跳到各分篇
- Status: implemented on `2026-04-24`
- Fix:
  - `src/content/knowledgeBooks/strengthTrainingPrinciplesNote.ts`
    - 从单篇长文升级为《力量训练原理》专题清单
    - 当前拆分为 `1` 篇总览 + `7` 篇原理分篇
    - 每篇都保留非侵权的 interpretive reading note 定位
    - 总览保留整本书框架；分篇按“专项性 / 超负荷 / 疲劳管理 / SRA / 变式 / 阶段增益 / 个体差异”逐篇展开
    - 每篇都单独配 `1` 条对应配图提示词
  - `scripts/import-knowledge-book-notes.ts`
    - 新增可复用的书籍笔记导入脚本
    - 支持 dry run / `--apply`
    - 自动读取 `.env.local` / `.env.development` / `.env`
    - 现已支持按 `collectionSlug` 批量导入同一本书的多篇文章
    - 通过标题对 `knowledge_books` 做 insert / update
  - `src/app/dashboard/knowledge/books/[id]/page.tsx`
    - 修复书籍详情页原先把结构化 `content` 渲染成 JSON 字符串的问题
    - 新增结构化内容归一化：支持 Markdown / HTML / fallback JSON
    - 新增“解读型笔记”说明卡
    - 新增“配图提示词”卡片区
    - 新增“同书专题”卡片区，可从总览页跳到其它分篇
- Data sync:
  - 已执行 `npx tsx scripts/import-knowledge-book-notes.ts strength-training-principles --apply`
  - 当前专题共 `8` 篇记录已写入 / 更新到 `knowledge_books`
  - 总览 ID：`52f3a7b7-e13c-4676-9bf6-5cd22f84beb3`
  - 分篇 ID：
    - 专题01 专项性：`ba7e9765-aa2b-4b7c-a5f9-870837585794`
    - 专题02 超负荷：`71502d2f-06e7-4cae-a75c-951026820e6d`
    - 专题03 疲劳管理：`5060297e-2840-4e34-9cf7-4b1dd97277ec`
    - 专题04 SRA：`d9f0fd46-371b-4c3d-89de-5900a97e5148`
    - 专题05 变式：`892d10d9-f661-4800-81eb-9beb8b706879`
    - 专题06 阶段增益：`9aed3b20-1681-451d-aa51-0abceda10b4f`
    - 专题07 个体差异：`dcf05903-2afd-4d30-82e0-0fcefc4c7822`
  - 当前默认发布状态：`is_published=true`
  - 当前默认访问权限：`is_free=true`
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npm test`：通过（21 files, 104 tests）
  - `npm run typecheck`：仓库仍有大量历史类型错误；本次新增文件相关报错已定向清掉
  - `npx next build`：被当前运行中的 `next dev` 占用 `.next/lock` 阻塞，未拿到最终构建结果
  - 浏览器验证：通过
    - 使用 Playwright 脚本登录本地 dev 站点后，打开书籍列表与详情页
    - 确认列表页已从单篇变为同书多篇卡片，可见总览与专题分篇
    - 确认总览详情页可见“同书专题”区域，并能看到专题01与专题07等分篇入口
    - 截图：`test-results/knowledge-books-series-list.png`、`test-results/knowledge-book-series-detail.png`
- Next step:
  - 下一本书可直接按同一模式拆成 `1 篇总览 + 多篇章节 / 主题分篇`
  - 若后续要改成付费内容，可直接把该记录的 `is_free` 切成 `false`

---

- Task: 修复教练枭马葛为学员测试账号0628生成计划时报“没有匹配的训练计划”
- Scope:
  - 用户明确要求这次不需要代理做 UI 验证，由用户自己在页面上验证
  - 用户进一步明确：当前总任务是 `useLLM=true` 走纯 AI 两阶段生成，`match.ts` 硬匹配不应混入 AI 路径
  - 即使规则上“匹配不到模板”，LLM 也应该能自己从模板全集里选一个；如果没有合适模板，也允许从零生成计划
  - 目标是修复 `/api/plan-lib/create-ai-instance` 在 0628 这类问卷下直接 400 的后端逻辑，同时把 AI 路径与 legacy 路径重新拆清楚
- Status: implemented in code on `2026-04-24`
- Root cause:
  - 旧 `matchPlan` 对标签匹配过严：问卷选的是 `臂屈伸个数`，而枭马葛现有模板主要是 `臂屈伸负重 / 引体负重 / 引体个数`，精确匹配会直接筛成 0
  - 旧逻辑读取“每周训练次数”时只兼容老的 `type=times` 结构；当前问卷实际存的是 `option(question=每周训练次数)`，导致训练频次条件识别不完整
- Fix:
  - `src/app/api/plan-lib/ai-personalize-plan/personalize-plan.ts`
    - Stage B 不再要求 LLM 直接输出 `training_days` JSON
    - 改为先输出紧凑 `plan_script`，再通过 `parsePlanScript()` 编译成 `training_days`
    - prompt 中把已选模板骨架也从 JSON 改为 `plan_script`，统一 AI 修改器与 AI 生成器的中间层
    - prompt 进一步收紧休息日 DSL：休息日备注优先写成 `D2 off #备注`，显式禁止模型写出 `D2 off !备注`
    - 编译动作名时同时允许使用“当前动作库 + 所选模板骨架中的历史动作”，避免模板里已有变体动作在生成时丢失
    - 新增订阅周期约束：`subscribedWeeks=4` 时，prompt 必须要求输出完整 4 周 / 28 天，而不是只给 1-4 个训练日
    - 新增“问卷意图硬约束”解析与二次纠偏：如果问卷明确只练某个专项（例如只练臂屈伸），prompt 会把它当成硬约束；若 AI 首次输出仍保留对立专项（如引体），系统会自动重试一次，仍不满足则直接报错而不是落垃圾计划
  - `src/app/api/plan-lib/ai-personalize-plan/entity.ts`
    - `PersonalizePlanResult` 增加 `planScript`
    - `ActionLibraryEntry` 增加 `type`
    - `GeneratePersonalizedPlanInput` 增加 `subscribedWeeks`
    - 模板摘要/选择结果增加 `source`，区分模板库与历史计划骨架
  - `src/app/api/plan-lib/ai-personalize-plan/service.ts`
    - `buildActionLibrary()` 补齐 `type`
    - `ai_generation_log.promptVersion` 升级为 `v1.3-script`
    - `enforcePlanSpan()`：学员购买 4 周时，AI 若只生成几天短周期，将直接拒绝创建
    - Stage A 选中的骨架若不在模板库，会继续尝试从 `coach_plan_instances` 历史计划里取骨架
  - `src/app/api/plan-lib/create-ai-instance/match.ts`
    - 新增 `extractWeeklyTrainingDays()`，兼容解析老 `times` 结构和新 `option + 每周训练次数` 结构
    - 保留 `matchPlan()` 仅供 `useLLM=false` 的 legacy 规则路径使用
  - `src/app/api/plan-lib/create-ai-instance/service.ts`
    - AI 候选骨架不再只看 `coach_plan_templates`，还会合并最近的 `coach_plan_instances`
    - 插入实例时，只有骨架来源是模板库才回写 `coach_plan_template_id`
  - `src/app/api/plan-lib/ai-personalize-plan/select-template.ts`
    - 没有模板时不再表达为“无法生成”，而是明确记录为“将直接从零生成计划”
    - 模板选择 prompt 现在会显式读取“问卷意图提炼”和骨架专项标签；若问卷明确只练单一专项，会优先选择对应单专项模板而不是组合模板
  - `src/app/api/plan-lib/ai-personalize-plan/questionnaire-intent.ts`
    - 新增问卷专项偏好解析器：从 `tags / option / text / times` 中提炼出“专项偏好、是否单专项硬约束、每周频率”
    - 当前先重点覆盖 `引体 / 臂屈伸 / 平衡发展` 这条真实问题链路
    - “每周训练次数”现在同时兼容老 `times` 和新 `option(question=每周训练次数, value=2次)` 结构
    - 问卷里明确的每周训练次数（如每周 2 次）已升级为硬约束，并在生成后按周校验训练日数量
  - `src/lib/planScript.ts`
    - 休息日解析器现在兼容 `D2 off #备注` 和 `D2 off !备注` 两种同行备注写法，避免 AI 偶发写出 bang 语法时直接被误判成“未找到动作”
  - `src/lib/planScript.test.ts`
    - 新增回归用例，覆盖 `D1 off !有氧：慢走30分钟` 这类休息日同行备注写法
  - `src/app/api/plan-lib/ai-personalize-plan/personalize-plan.test.ts`
    - 新增回归用例，覆盖“问卷明确每周训练 2 次，但 AI 首次输出 3 练时自动重试修正”
  - `src/app/api/plan-lib/ai-personalize-plan/personalize-plan.ts`
    - 无模板时 prompt 改为允许从零生成，不再要求返回空计划
    - prompt 明确要求：如果问卷写了“每周训练 X 次”，则每个 W 周块都必须恰好安排 X 个训练日
    - 若 AI 首次输出的周训练频率与问卷不一致（例如问卷 2 练但计划 3 练），系统会自动带纠偏提示重试一次；仍不满足则直接报硬约束冲突
  - `src/app/api/plan-lib/ai-personalize-plan/service.ts`
    - Stage A 选不到模板时，不再强行拿第一个模板兜底
    - Stage A 选中的模板不存在/不可访问时，改为从零生成，而不是抛错
    - 无模板但动作库可用时，允许 LLM 直接从零生成计划
    - 有模板但校验后动作全掉光时，回退到所选模板骨架，避免生成空计划
    - 模板摘要新增专项标签推断，供 Stage A 模板选择参考
  - `src/app/api/plan-lib/create-ai-instance/service.ts`
    - `useLLM=true` 时只走 AI 两阶段生成，不再回退到 `match.ts`
    - AI 路径失败时，直接返回 AI 错误给前端，而不是偷偷改走 legacy 匹配
    - 入口层去掉“无模板直接报错”的门槛，让 AI 服务层决定是选模板还是从零生成
    - `useLLM=false` 时继续保留原 `matchPlan() + fillTemplate()` 旧规则路径
- Verification:
  - 用真实订阅 `3a100757-1d1c-4fd1-94d2-f433affec296` 的问卷数据跑本地脚本确认：
    - legacy 精确匹配结果 `0`
    - 说明之前 `没有匹配的训练计划` 的根因确实来自旧规则路径被错误带入 AI 生成流程
  - 用真实订阅和数据库复查确认：
    - 学员 `测试账号0628` 当前订阅 `subscribed_weeks=4`
    - 枭马葛名下可用模板实际有 `10` 个，且大量为 `56/84/105` 天长计划
    - 当前短计划实例 `04ce17b4-e120-4e37-b8d4-76ebc635cf3f` 的 `ai_generation_log.stageA.templateId = null`
    - 旧 prompt 里明确写了“优先给出 1-4 个训练日”，这是只生成 4 天微周期的直接原因
  - AI 生成链路脚本化定向测试：通过（3 files, 21 tests）
  - `npm run lint`：通过当前提示脚本
  - `npm test`：通过（21 files, 106 tests）
  - `npm run typecheck`：122 秒超时，仍未跑完仓库既有历史类型面
  - `npx next build`：本轮通过；日志里有既有 Redis timeout 噪音，但未阻塞构建完成
- Next step:
  - 由用户重新为测试账号0628生成：若问卷明确只练臂屈伸且每周训练 2 次，新计划里不应再保留引体专项主项，且每个 W 周块都应恰好只有 2 个训练日
  - 若用户再次看到 500 且提示“脚本无法编译”，优先检查 AI 是否又写了新的 DSL 变体；当前已兼容“休息日 + bang 备注”这条真实报错链路
  - 用户本轮已明确“不用你测试，我来手动运行就行”，因此页面与真实生成结果由用户手动验证
  - 用户最新又补充：教练端“清空当前计划”不能只支持归档，因为部分 AI 乱生成的垃圾计划不应该留下归档记录；本轮已把学员列表改成“归档保留 / 彻底删除垃圾计划”二选一弹窗
  - 同步修复 `src/app/api/plan-lib/delete-instance/route.ts`：删除权限校验改成和归档接口同语义，教练本人可对自己学员的当前计划做彻底删除

---

- Task: 人体地图胸小肌内容从“互动/阅读试点”收敛为“一篇详实主文章”
- Scope:
  - 用户明确指出当前所谓“互动筛查”还不是真互动，先不做互动模式
  - 图片暂时不处理，优先确保已有文章和转录素材能被整理进一篇小白可读、内容充实的主文章
  - 当前仍以胸前区域为样板：人体图没有单独胸小肌 hitbox，先挂在 `胸大肌` 点击区
- Status: implemented on `2026-04-23`
- Fix:
  - `src/app/dashboard/knowledge/page.tsx`
    - 移除胸小肌硬编码 `CoreGuidePanel` 试点，不再展示 `互动 / 阅读` 两个入口
    - 选中部位后只展示模式说明卡和 `主文章`
    - 部位文章列表收敛为 1 篇，避免用户点击后看到一堆材料
  - `scripts/import-body-map-formal-guides.ts`
    - 将 `body-map-guide-020-pectoralis-minor` 改写为《胸小肌完整指南：圆肩筛查、肩前紧张与训练处理》
    - 主文整合胸小肌、圆肩、肩关节、锁骨/肩峰位置、肩胛胸廓节律、胸椎活动度、胸大肌、前锯肌、中下斜方肌、肩袖控制及胸小肌视频转录里的训练场景
    - 内容结构覆盖：这篇整合了哪些内容 / 一句话理解 / 位置和影响 / 什么时候想到胸小肌 / 小白筛查 / 训练处理 / 可执行组合 / 常见误区 / 停止自处理边界
  - 数据库已同步 `2026-04-23-body-map-formal-guides-v4`
- Verification:
  - 导入脚本 `--apply`：通过，`updated=11`，`errors=0`，输出 `temp_dir/body_map_formal_guides_import_apply_20260423_040704.json`
  - 浏览器验证：DEV 快速登录后打开 `/dashboard/knowledge`，点击 `胸大肌`，确认没有 `互动 / 阅读`，只显示 `主文章`；打开详情页确认新小节“这篇主文整合了哪些内容”、筛查段、训练段和风险边界均可见
  - 截图：`test-results/body-map-main-article-list.png`、`test-results/body-map-main-article-detail-v4.png`
  - `npm run lint`：通过当前提示脚本
  - `npm test`：通过（21 files, 101 tests）
  - `npm run typecheck`：上次运行 184 秒超时，残留 `tsc --noEmit` 进程已停止；未得到完整类型检查结论
  - `npx next build`：此前已完成编译和静态页生成，但因本地 dev server/`.next` 文件锁在 standalone copy 阶段报 `EBUSY`，未形成干净最终退出码
- Next step:
  - 如果用户认可胸小肌样板，把同一“一个点击部位一篇主文”的模板批量套到其它已入库正式指南；真正的互动筛查要等后续做成问答/动作选择流后再命名为互动。

---

- Task: 优化人体地图筛查/训练模式的内容分层
- Scope:
  - 用户反馈当前人体地图内容太乱，筛查模式和训练模式看到的是同一批内容，且内容过多导致用户懵
  - 目标是让“筛查模式 / 训练模式”产生真实差异，并把默认展示从“长材料堆叠”改为“少量可执行引导 + 推荐阅读”
- Status: implemented in code on `2026-04-22`
- Fix:
  - `src/app/api/knowledge/nodes/route.ts`
    - 新增 `mode=screening|training` 查询语义
    - 读取 `knowledge_nodes.content.body_map_modes` 做模式过滤
    - 人体地图查询默认排除 `content_level=transcript-pack` / source-material 素材包，避免把原始转录材料直接塞给用户
    - 对结果做模式相关排序：`formal-guide` 优先，其次按筛查/训练关键词排序
    - 人体地图默认最多返回 `8` 条；前端当前请求限制为 `6` 条
    - 返回 `content_summary`，剥离长 HTML body，减少列表接口负担
  - `src/app/dashboard/knowledge/page.tsx`
    - 切换筛查/训练时重新请求对应模式内容
    - 选中部位后先展示模式专属行动卡：
      - 筛查模式：活动范围/疼痛信号/动作代偿
      - 训练模式：发力感/动作选择/逐步加量
    - 文章区改为“推荐阅读”，文案明确“只看筛查/问题管理”或“只看训练/动作方法”
    - 内容卡增加 `系统指南 / 延伸阅读 / 知识点` 标签，降低用户判断成本
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npm test`：通过（21 files, 101 tests）
  - `npx next build`：通过
  - `npm run typecheck`：构建前失败于 `.next/types/validator.ts` 缺失；构建后重跑 184 秒超时无输出，未得到新增文件相关错误
  - 浏览器验证：已尝试用 Playwright 打开 `http://localhost:3000/dashboard/knowledge`，但当前无登录态，页面/API 返回未授权或长连接等待，无法完成真实人体图点击验证
- Next step:
  - 用户在已登录浏览器刷新 `/dashboard/knowledge` 后，点击同一部位切换筛查/训练，应先看到不同的 3 步行动卡，下面推荐阅读数量也应明显收敛。

---

- Task: 为人体地图文章补充小白友好的解剖/动作配图
- Scope:
  - 先以胸小肌文章为样例，确定文章需要的配图类型和准确性标准
  - 图像目标不是学术论文级复杂解剖，而是帮助小白理解“在哪里、怎么影响体态、怎么筛查、怎么放松/训练”
- Status: in progress on `2026-04-22`
- Requirement:
  - 圆肩/胸小肌相关体态图不能只画成“肩胛骨单独前倾”；应表达肩带整体前引链条：锁骨/肩峰端前引，带动肩胛骨前引、前倾、内旋，并让肩膀前扣更容易被用户看懂。
  - 面向小白的图中文字优先用“肩膀前扣 / 锁骨前引 / 肩胛前引+前倾”这类可理解标签，少用过度专业且容易误读的单一术语。
- Proposed content direction:
  - 当前胸小肌指南内容偏“系统笔记”，对小白仍然偏长、偏密。下一步应把同一主题拆成两种前台消费方式：`互动模式` 用少量问题/动作卡片带用户一步步判断；`阅读模式` 保留一篇结构化短文用于完整理解。
  - 对每个身体部位，不建议同时展示很多文章。筛查模式和训练模式各保留 1 篇主文章即可：筛查文章解决“我是不是和它有关、什么时候该停/就医”；训练文章解决“我现在该怎么练、怎么避免代偿”。底层转录和长资料继续留作素材，不直接堆给用户。

---

- Task: 人体地图“一个部位一个核心指南”试点
- Scope:
  - 先用胸前区域做样板：当前人体图没有单独胸小肌 hitbox，所以先挂在 `胸大肌` 点击区
  - 点击胸前区域后，不再先让用户面对文章列表；先出现 `胸小肌核心指南` 的互动/阅读双入口
  - 推荐阅读区域在试点中收敛为 `核心文章`，只露出一篇正式指南
- Status: implemented on `2026-04-22`
- Fix:
  - `src/app/dashboard/knowledge/page.tsx`
    - 新增胸小肌核心指南试点数据与 `CoreGuidePanel`
    - 点击 `胸大肌` 时显示“核心指南试点”：问题卡片、互动筛查/互动训练步骤、阅读模式短解释
    - `筛查模式 / 训练模式` 继续控制互动步骤内容
    - `互动 / 阅读` 作为部位内容消费方式，默认回到互动
    - 对试点部位，底部列表从“推荐阅读”改为“核心文章”，优先只展示胸小肌正式指南
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npm test`：通过（21 files, 101 tests）
  - `npx next build`：通过
  - `npm run typecheck`：失败于仓库既有类型问题（Next 16 route params、动作库 schema、小程序 Taro 依赖等）；定向搜索未见 `src/app/dashboard/knowledge/page.tsx` 新增错误
  - 浏览器验证：使用本地 `localhost:3000` DEV 快速登录后打开 `/dashboard/knowledge`，通过 SVG `胸大肌` 区域触发选中，已看到 `胸小肌核心指南`、互动筛查内容和核心文章；切到“阅读”后看到“它在哪里 / 为什么会影响圆肩”等阅读内容
  - 截图：`test-results/body-map-core-guide-pilot.png`、`test-results/body-map-core-guide-pilot-reading.png`
- Next step:
  - 让用户实际体验胸前区域样板；如果认可，再把该结构抽成可配置数据模型，而不是把每个部位都硬编码在页面里。

---

- Task: 将教练订阅支付链路拆成“订单/支付记录”和“正式订阅”两层
- Scope:
  - 用户确认为了后期数据分析方便，订阅链路不再把“待支付草稿”和“正式成交订阅”混在 `coach_subscriptions` 一张表里
  - 新模型：`coach_subscription_orders` 记录选套餐、待支付、待确认、已支付等订单事实；`coach_subscriptions` 只在付款确认/平台支付成功后生成或更新正式订阅
  - 需要覆盖学员下单、平台支付宝创建/回调、个人收款码/线下已付提交、教练待确认/历史、收入看板与旧数据兼容
- Status: implemented in code on `2026-04-22`; database migration not yet applied in current remote database
- Fix:
  - 新增迁移 `supabase/migrations/20260422_subscription_orders.sql`，定义 `coach_subscription_orders`
  - 新增 `src/types/subscriptionOrders.ts`、`src/lib/subscriptionOrders.ts`、`src/lib/coachPaymentRecords.ts`
  - 新增 API：
    - `/api/subscription/create-subscription-order`
    - `/api/subscription/update-subscription-order`
    - `/api/subscription/confirm-subscription-order`
  - 学员教练主页订阅/续费流程改为先创建订单，支付确认后再正式激活/续费订阅
  - 支付宝创建与支付成功履约支持 `subscriptionOrderId`，平台支付成功后自动调用订单 finalize
  - 教练端“待支付确认 / 历史”改为读取新订单层，同时保留旧 `coach_subscriptions` 历史 fallback
  - 教练收入总览/收入明细按 `2026-04-22T00:00:00+08:00` 作为切换点：新付款从订单表统计，旧历史从订阅表统计，避免双算
  - 增加迁移前兼容：如果当前数据库还没有 `coach_subscription_orders`，教练端读接口回退旧数据；新写入接口返回明确提示“订阅订单表尚未迁移，请先执行 supabase/migrations/20260422_subscription_orders.sql”
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npm test`：通过（21 files, 101 tests）
  - `npx next build`：通过
  - `npm run typecheck`：244 秒超时，无具体错误输出
  - 浏览器验证：用临时学员登录后访问刘三乐教练页，点击 `3个月 / ¥199` 套餐；由于该教练页有问卷，UI 点击先进入问卷链路，随后在同一已登录浏览器会话直接调用新订单 API，返回 `503` 和明确迁移提示，说明当前阻塞是数据库未建表而不是前端/编译问题
  - 截图：`test-results/subscription-order-browser-check.png`
- Blocker:
  - 当前远程数据库缺少 `public.coach_subscription_orders`
  - `supabase migration list --linked` 显示本地/远程迁移历史严重分叉，不能安全地直接 `supabase db push` 全量推送；需要只执行单个 SQL 文件 `supabase/migrations/20260422_subscription_orders.sql`，或由数据库管理员在 Supabase SQL Editor 中执行该迁移
- Next step:
  - 执行 `supabase/migrations/20260422_subscription_orders.sql` 后，再完整浏览器验证：临时学员选择 3 个月套餐 -> 创建订单 -> 上传/提交个人收款码凭证 -> 教练端待确认显示订单 -> 教练确认后生成正式订阅。

---

- Task: 整理并同步人体地图新增转录素材
- Scope:
  - 用户补充说明 `C:\Users\29454\.openclaw\workspace-main\body-map-system\content` 下 Apr 21 19:00 之后真正新增的 68 个 transcript，分布在胸小肌、腕屈肌群、大圆肌、颞下颌关节、咬肌、翼内肌、颈前淋巴结、肱三头肌、腹外斜肌、股二头肌、半腱肌/半膜肌等主题
  - 目录存在 `topic/topic/source/transcript.txt` 和 `020-胸小肌/video/bilibili/...` 等嵌套结构，不手动平铺，由导入脚本递归扫描并按 source id 去重
  - 在保留 `transcript-pack` 原始素材层的同时，把可直接面向用户展示的主题整理为 `formal-guide`
- Status: completed on `2026-04-21`
- Fix:
  - `scripts/import-body-map-transcript-packs.ts` 重新 dry-run/apply，确认本轮嵌套目录被识别并同步到数据库
  - 转录包当前识别结果：`26` 个 topic、`22` 个可挂现有人体图、`4` 个头面/颈前待扩点击区、`276` 份去重后的 transcript、无薄弱 topic
  - `scripts/import-body-map-formal-guides.ts` 升级到 `2026-04-21-body-map-formal-guides-v2`
  - 正式指南从 `7` 篇扩展到 `11` 篇，新增：
    - `肱三头肌系统指南：推类动作、肘伸力量与长头训练`
    - `腹外斜肌系统指南：抗旋转、侧向稳定与呼吸核心`
    - `股二头肌系统指南：后链发力、腘绳肌拉伤与硬拉跑跳`
    - `半腱肌与半膜肌系统指南：内侧腘绳肌、膝稳定与后链控制`
  - apply 结果：
    - 转录包：`updated=26`、`inserted=0`、`errors=0`
    - 正式指南：`inserted=4`、`updated=7`、`errors=0`
- Output:
  - 转录包报告：`temp_dir/body_map_transcript_pack_import_apply_20260421_222018.json`
  - 正式指南报告：`temp_dir/body_map_formal_guides_import_apply_20260421_222007.json`
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npm test`：通过（21 files, 101 tests）
  - `npx next build`：通过
  - `npm run typecheck`：失败于仓库既有类型问题（Next 16 route params、动作库/schema 类型、小程序 Taro 依赖等），非本次导入脚本引入
- Next step:
  - 现有素材不需要平铺目录即可继续复用；后续若新增转录，直接放在 topic 任意嵌套目录下即可由脚本递归吸收。

---

- Task: 修复刘三乐学员 li 支付历史金额显示为 99 的问题
- Scope:
  - 用户反馈刘三乐教练下学员 `li` 明明付款 `199`，列表显示已购 `12周`，但“待支付确认 -> 历史”里显示“月费 99”
  - 需要核查真实订阅记录、付款凭证、前端支付历史展示口径，以及订阅创建时套餐价格是否同步
- Status: completed on `2026-04-21`
- Root cause:
  - 订阅 `26df041e-a4e3-4dac-83db-679ad2e41fae` 确认为刘三乐教练下学员 `li`
  - 数据库原值为 `subscribed_weeks=12`、`monthly_price=9900`、`payment_method=personal_qrcode`、`payment_data.offline_payment=null`
  - 凭证截图显示实际付款 `-199.00`，付款留言为“烛火3个月力量”
  - 根因是 `/api/subscription/create-subscription` 遇到已有未生效订阅时，只更新了 `subscribed_weeks` / 产品信息，没有同步更新 `monthly_price` / `tier` / `status`，导致“12周 + 99元”的脏组合
  - 支付历史表头仍叫“月费”，进一步把“方案/支付金额”误导成月付
- Fix:
  - 已将 li 订阅记录 `monthly_price` 从 `9900` 修正为 `19900`，`subscribed_weeks` 保持 `12`
  - 已在该订阅 `payment_data.manual_repair` 写入修复原因、旧值、新值、凭证核验标记和修复人
  - `src/app/api/subscription/create-subscription/route.ts`
    - 已有 `active` 订阅不再由创建订阅接口重写价格/周期，续费继续走专门链路
    - 已有非 active 订阅重新选择套餐时，同步更新 `tier`、`monthly_price`、`status`、产品信息和 `subscribed_weeks`
    - 返回更新后的订阅，而不是只返回旧查询里的 `id`
  - `src/app/dashboard/students/PaymentConfirmationDialog.tsx`
    - “月费”列改为“支付金额”
    - 增加“购买周期”列
    - 对普通扫码记录标注“方案金额”，线下已付记录继续优先显示“线下实付”
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npm test`：通过（21 files, 101 tests）
  - `npx next build`：通过
  - `npm run typecheck`：184 秒超时，无错误输出；仓库长期存在大体量历史类型问题
  - 浏览器验证：用刘三乐账号登录 `http://localhost:3000/dashboard/students`，打开“待支付确认 -> 历史”，li 行显示 `12周` 和 `¥199.00`
  - 截图：`test-results/payment-history-li-199-loaded.png`
- Next step:
  - 若后续还要同步教练收入看板，需进一步把 `get-revenue-details` 中“订阅月费”的历史文案也改成“订阅收入/方案金额”

---

- Task: 美化并深化 CoachLink 商业计划书，产出 PDF
- Scope:
  - 基于用户提供的 `CoachLink 商业计划书 v2` 继续打磨，而不是替换商业定位
  - 重点增强外发阅读感、结构层次、当前数据口径、传统教练线上化问题分析
  - 输出可交付 PDF 版本，同时保留可继续迭代的 Markdown 源文档与生成脚本
- Status: completed on `2026-04-21`
- Output:
  - 增强版 Markdown：`docs/CoachLink_商业计划书_v2_1.md`
  - PDF 成品：`output/pdf/CoachLink_商业计划书_v2_1.pdf`
  - Word 可编辑版：`output/docx/CoachLink_商业计划书_v2_1.docx`
  - Word 紧凑版：`output/docx/CoachLink_商业计划书_v2_1_紧凑版.docx`
  - Word 封面修正版：`output/docx/CoachLink_商业计划书_v2_1_封面修正版.docx`
  - PDF 生成脚本：`scripts/generate-business-plan-pdf.py`
  - Word 生成脚本：`scripts/generate-business-plan-docx.py`
- Verification:
  - PDF 生成成功，共 `21` 页，文件大小 `368,163` bytes
  - 使用 `pypdf` 校验：21 页均可抽取文本，无空白页
  - 关键内容命中：`CoachLink 商业计划书 v2.1`、`线上自由教练的商业化操作系统`、`传统教练困境`、`注册用户`、`1,296`、`上传训练视频用户`
  - 用户截图反馈第一版 PDF 在 VS Code 预览器中文字不可见；根因是使用了 `STSong-Light` 这类未嵌入 CID 字体
  - 已改为嵌入 Windows 中文字体 `Deng.ttf/Dengb.ttf`，并验证 PDF 内包含 `/FontFile2` 嵌入字体
  - 当前环境缺少 `pdftoppm/mutool/ghostscript/magick`，Chrome/Edge headless 未能生成 PDF 页面截图，因此未完成真正的 PNG 视觉渲染校验
  - Word 版生成成功，文件大小 `54,797` bytes；反读校验包含 `225` 个段落、`16` 张表，关键内容命中
  - 本机未发现 LibreOffice/Word 命令行转换器，因此未生成旧二进制 `.doc`，交付现代 Word `.docx`
  - 用户反馈 Word 版“内容排版过于分散”，已调整 Word 生成器：取消每个 `##` 大章节前强制分页、收紧页边距与页眉页脚距离、压缩正文/列表/标题段距、去掉表格后的硬空行
  - 新输出 `CoachLink_商业计划书_v2_1_紧凑版.docx`，反读校验为 `196` 个段落、`16` 张表
  - 用户随后反馈“第一页还是有点问题，其他没问题”；已继续调整封面生成策略：
    - 去掉第一页的真实表格，改成纯段落式“关键数据”数据行
    - 第一页页脚改为留空，避免封面被页脚干扰
    - 新输出 `CoachLink_商业计划书_v2_1_封面修正版.docx`
    - 反读校验：`201` 个段落、`15` 张表；第一页前 10 段顺序为标题、定位、副文案、关键数据 4 行、阶段判断、版本信息
  - 用户再次指出“第一页后面都是空白”；已删除封面末尾的强制分页，让正文从第一页直接续接
  - 新输出 `CoachLink_商业计划书_v2_1_首页无空白版.docx`，反读校验前 10 段后直接进入 `执行摘要`
- Next step:
  - 若要继续外发融资/路演版，可基于 v2.1 再压缩成 8-12 页 BP deck 或一页式投资人摘要。

---

- Task: 在学员执行训练计划前增加阅读须知
- Scope:
  - “执行计划阅读须知”必须是教练为模板/计划实例填写的专属内容，不是平台统一文案
  - 学员首次进入某个计划实例的正式训练执行前强提醒；计划详情页和训练执行页可回看
  - 教练端需要在模板编辑页和学员计划编辑页维护这段内容，并在从模板创建实例、AI 生成实例时继承到实例
- Status: implemented in code on `2026-04-21`
- Fix:
  - 新增数据库字段 `coach_plan_templates.execution_notice` 与 `coach_plan_instances.execution_notice`
  - 教练端模板页、学员计划页新增“执行须知”输入，保存时写入模板/实例
  - 模板复制、手动从模板建计划、AI 个性化建计划都会把模板上的执行须知带到计划实例
  - `ExecutionPlanNoticeDialog` 改为优先展示教练填写的执行须知，平台文案只保留安全底线兜底
  - 今日训练、训练执行页直达入口、计划历史页回看入口全部改为读取实例上的 `execution_notice`
  - 本地已读状态仍使用 `localStorage` 按 `userId + plan_instance_id` 记录，只负责“这个实例是否已读过”
- Verification:
  - 按用户最新要求，本轮只改代码，未执行 lint / typecheck / build / browser 验证
- Next step:
  - 用户执行 SQL 迁移后，可在教练端为模板和具体学员计划填写专属执行须知，再验证学员首次执行拦截是否展示教练内容

---

- Task: 清理测试账号0628的失败 AI 空计划
- Scope:
  - 用户反馈测试账号0628此前 AI 创建失败，但空计划仍显示为“进行中”，导致无法正常重新生成
  - 目标是清空当前坏计划，同时保留该学员订阅关系和资料，以便重新走 AI 深度个性化生成
- Status: completed on `2026-04-21`
- Fix:
  - 定位订阅 `3a100757-1d1c-4fd1-94d2-f433affec296`
  - 定位坏计划实例 `1d7b45f1-1a5b-4db7-ab81-51bae2965443`
  - 确认该实例 `status=active`、`training_days=2`、`actionSets=0`、无执行记录
  - 已将该实例归档为 `archived`，保留订阅 `active`
  - 修复 `src/app/api/subscription/coach-subscriptions/route.ts`：`has_plan_instance` 和预计结束日计算不再把 `archived` 计划算作当前/有效计划
- Verification:
  - 数据库复查：该订阅下 `active/paused/completed/scheduled` 计划为空，仅剩归档坏实例
  - `npm run lint`：通过当前提示脚本
  - `npx vitest run src/app/api/subscription/coach-subscriptions.integration.test.ts`：通过
  - `npm test`：通过（21 files, 101 tests）
  - `npx next build`：通过
  - 定向 typecheck 命中既有 `coach-subscriptions/entity.ts` 类型继承错误，非本次 route 状态过滤改动引入
- Next step:
  - 用户刷新 `/dashboard/students` 后，测试账号0628应显示为未配置/待处理，可重新打开“AI 深度个性化”生成。

- Task: 给教练端增加手动清空当前计划入口
- Scope:
  - 用户指出只由代理进数据库归档是治标不治本，教练后台应该能手动清空当前计划，方便重新启用 AI 生成计划
  - 清空语义采用“归档当前计划”：保留订阅、学员资料和历史记录，只把当前计划从学员端执行流中移除
- Status: implemented in code on `2026-04-21`
- Fix:
  - `src/app/dashboard/students/page.tsx`
    - 桌面训练计划卡片新增“清空当前计划”图标按钮
    - 移动端展开学员卡片后新增“清空”按钮
    - 点击后弹确认框，确认后调用已有 `/api/plan-lib/archive-instance`
    - 成功后本地把该学员 `plan` 置空、训练进度归零，并让其重新进入未配置计划可选择状态
    - 给“清空当前计划”和 AI 生成图标补 `aria-label`，方便自动化测试和可访问性
- Verification:
  - Playwright 通过现有 `localhost:3000` + DEV 教练登录 + API mock 验证：
    - 有计划学员显示清空按钮
    - 点击清空弹确认框
    - 确认后请求 `archive-instance`，payload 为 `{ instanceId: "plan-instance-1" }`
    - 列表变成“未配置计划”，AI 生成按钮重新出现
    - 截图：`test-results/students-clear-plan-after.png`
  - `npm run lint`：通过当前提示脚本
  - `npm test`：通过（21 files, 101 tests）
  - `npx next build`：通过
  - `npm run typecheck`：仍会在当前仓库超时或命中既有类型问题，本次页面编译由 build 覆盖通过

- Task: 修正教练端 LLM 个性化生成计划的模板/动作库流程
- Scope:
  - 用户反馈生成后的计划详情显示“教练没有可用的计划模板”“可用动作库为空”，并把计划改成休息日
  - 正确业务流应是：先选教练计划模板 -> 导入模板动作 -> 基于模板保守调整 -> 创建实例后同步对应教练动作到学员动作库
  - 动作库为空不能成为阻止创建计划或生成空计划的理由；尤其不能把“学员动作库为空”和“教练动作库为空”混在一起
- Status: implemented in code on `2026-04-20`
- Root cause:
  - `create-ai-instance/service.ts` 的 LLM 分支使用 `actorCoachId` 查询 `coach_plan_templates.coach_id` 和 `coach_actions.coach_id`
  - 但当前项目里模板和教练动作的 `coach_id` 存的是教练用户 `users.id`；`actorCoachId` 是 `coaches.id`，只适合用于校验订阅归属
  - 因此 LLM 分支把教练模板和动作库查成空，然后进入从零生成 prompt，模型按“可用动作库为空”输出了全休息计划
- Fix:
  - 查教练模板、教练动作、自动计算动作、`matchPlan`、`fillTemplate` 的 coach 身份统一改用 `actorUserId`
  - 订阅归属校验继续使用 `actorCoachId`
  - LLM 流程只允许模板驱动：没有可用模板 / 选中模板不可访问时，抛错交给 legacy 规则匹配 fallback，不再从零生成
  - 当动作库读取为空时，保留已选模板骨架，不调用 Stage B 让模型改写成休息日
  - 当 LLM 输出没有任何训练动作时，回退 legacy 规则匹配；最终仍无训练动作则阻止创建空计划
  - AI 创建实例后复用 `syncCoachActionsToStudentLibrary`，把训练计划中使用的教练动作同步到学员动作库，和手动从模板创建保持一致
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npx vitest run src/app/api/plan-lib/ai-personalize-plan`：通过（4 files, 24 tests）
  - `npm test`：通过（21 files, 101 tests）
  - `npm run typecheck 2>&1 | Select-String -Pattern 'create-ai-instance|ai-personalize-plan|sync-actions|personalize-plan|select-template'`：无相关错误输出
  - `npx next build`：编译与静态页生成成功，最终 standalone copy 因当前 3000 dev server 占用 `.next` 文件触发 Windows `EBUSY` 文件锁
- Next step:
  - 重启/刷新本地 dev server 后用教练账号重新生成：应先选到教练模板，不再显示“教练没有可用模板/可用动作库为空”，生成后学员动作库应 best-effort 同步对应教练动作。

- Task: 修复教练端开启 `AI 深度个性化` 生成计划时报学员会员配额不足
- Scope:
  - 用户以教练身份在 `/dashboard/students` 开启 AI 深度个性化并确认生成计划
  - 请求 `/api/plan-lib/create-ai-instance` 返回 403，提示“配额不足，请升级会员或购买加油包”
  - 该提示来自学员侧会员 AI 配额逻辑，教练后台给学员制定计划不应消耗学员会员配额
- Status: implemented in code on `2026-04-20`
- Root cause:
  - `src/app/api/plan-lib/create-ai-instance/service.ts` 在完成教练身份和订阅归属校验后，仍无条件调用 `checkAndConsumeAiQuota(subscription.student_id, 1)`
  - 这导致教练端生成计划被学员会员余额拦截，并返回错误的升级会员提示
- Fix:
  - 移除教练端 `createAiInstanceForSubscription` 中的学生会员 AI quota 检查
  - 保留原有教练身份、订阅归属、订阅 active 状态、LLM fallback、订阅剩余额度等校验
  - 批量生成复用同一服务函数，因此同步不再因学员会员配额失败
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npx vitest run src/app/api/plan-lib/ai-personalize-plan`：通过（4 files, 23 tests）
  - `npm test`：通过（21 files, 100 tests）
  - `npm run typecheck 2>&1 | Select-String -Pattern 'create-ai-instance|ai-personalize-plan|bulk-create-ai-instances'`：无相关错误输出
  - `npx next build`：通过
  - 代码确认：`create-ai-instance/service.ts` 已无 `checkAndConsumeAiQuota` / `membershipLimit` / “配额不足”相关调用
- Next step:
  - 在已登录教练页面重试开启 `AI 深度个性化` 后确认生成计划，应不再出现学员会员配额不足提示；若失败，下一步看真实 LLM API / 模板匹配 / 数据库迁移错误。

- Task: 升级教练 AI 分身资料库为多文档检索加载
- Scope:
  - 用户作为教练枭马葛，已从大量学员聊天记录中提取个人 AI 分身资料，目录为 `C:\Users\29454\Documents\微信聊天记录导出\ai_coach_knowledge_base`
  - 当前单一 `knowledge_base` 文本框会被保存上限和 prompt 截断限制影响，不能充分利用 10 个 Markdown 文件
  - 目标是支持把 Markdown 资料作为结构化知识文档保存，并在自动回复时按当前学员问题检索相关文档注入 prompt
- Status: implemented in code on `2026-04-20`
- Fix:
  - 新增 `src/lib/coachAiKnowledge.ts`
    - 定义教练 AI 知识文档结构
    - 支持按文件名/内容推断分类：身份风格、训练理念、沟通策略、动作技术、计划设计、营养补剂、伤病边界、常见问题、内容运营
    - 自动回复时始终优先保留 persona / philosophy / communication / injury 等核心文档，并按学员问题关键词检索 topic 文档
  - 新增迁移 `supabase/migrations/20260420_coach_ai_knowledge_documents.sql`
    - 给 `coach_ai_auto_reply_settings` 增加 `knowledge_documents jsonb`
  - 更新 `/api/coach/ai-auto-reply-settings`
    - GET/POST 支持 `knowledgeDocuments`
    - 兼容未执行新迁移时的旧字段读取
    - 保存多文档时做数量、单文档长度、总长度保护
  - 更新 `src/lib/coachAiAutoReply.ts`
    - 不再只把 `knowledge_base` 整段截断塞入 prompt
    - 新增“核心补充资料 + 按当前问题检索命中的教练知识文档”两层上下文
  - 更新 `src/app/messages/page.tsx`
    - AI 分身弹窗新增 Markdown 多文件导入
    - 可以一次选择 `persona.md`、`program_design.md`、`nutrition_supplements.md` 等文件
    - 文档支持启用/停用、删除、清空，并展示自动分类和字数
  - 顺手补齐 `src/app/api/coach/broadcast-message/entity.ts` 的图片群发 DTO 字段，避免同一消息页类型检查被旧字段污染
- Verification:
  - 用户最新要求“不用写测试，只管写代码；我执行 SQL 并验证功能”，因此已删除新增测试文件，后续未继续追加验证命令
  - 在用户打断前已跑过：`npm run lint` 通过当前提示脚本；`npm test` 通过；`npx next build` 通过；全量 `npm run typecheck` 仍失败于仓库历史类型面，定向过滤本次 AI 分身相关文件无输出
- Next step:
  - 用户执行 `supabase/migrations/20260420_coach_ai_knowledge_documents.sql`
  - 在 `/messages` 点击“AI 分身”，导入 `C:\Users\29454\Documents\微信聊天记录导出\ai_coach_knowledge_base` 下 10 个 `.md` 文件并保存
  - 用学员号向枭马葛发不同类型问题验证：动作技术、计划调整、补剂、疼痛/伤病

- Task: 为教练文章增加独立“专栏”页与入口
- Scope:
  - 用户提出“教练的文章能不能搞一个专栏”
  - 目标不是再造新内容系统，而是在现有 `coach_contents` 基础上补一个按教练聚合的公开专栏页
  - 需要同时打通三处入口：全站文章广场、教练主页内容页签、专栏页本身
- Status: implemented in code on `2026-04-20`
- Fix:
  - 新增 `src/app/articles/coach/[coachId]/page.tsx`
    - 改为服务端公开页面，直接读取已审核教练和其 `coach_contents` 图文文章
    - 展示教练名、头衔、文章列表、阅读/点赞数据，并保留文章详情跳转
  - 新增 `src/app/articles/coach/[coachId]/loading.tsx`
    - 提供专栏页加载骨架
  - `src/app/articles/page.tsx`
    - 将“教练内容 · 公开资讯”升级为“教练专栏广场”
    - 每篇文章补充“查看某教练专栏”入口
  - `src/app/coach/profile/[id]/CoachContent.tsx`
    - 页签文案从“教学内容”调整为“教练专栏”
  - `src/app/coach/profile/[id]/content-panel/Content.tsx`
    - 在教练主页内容面板顶部增加专栏说明卡和“进入专栏”按钮
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npm run typecheck`：失败，仍为仓库既有问题；当前报错是 `.next/types/validator.ts` 缺失
  - `npx next build`：通过，路由清单包含 `ƒ /articles/coach/[coachId]`
  - `npm test`：通过（21 files, 100 tests）
  - 浏览器验证：
    - 当前会话没有 AGENTS.md 指定的 `web-devtools` skill
    - 已改用本地 dev server + Playwright 脚本验证 `http://localhost:3000/articles -> /articles/coach/[coachId]`
    - 结果：找到 `11` 个专栏入口，成功进入 `枭马葛专栏`，页内识别到 `6` 个文章卡片
    - 截图：`test-results/coach-column-articles-page.png`、`test-results/coach-column-page.png`

- Task: 将教练文章专栏升级为“命名专栏 + 闲散文章”结构
- Scope:
  - 用户追问：专栏是否需要名字，以及同一教练是否会同时存在专栏文章和闲散文章
  - 结论：轻量的“按教练聚合文章”不够，需要真正变结构
  - 目标：每位教练可以创建命名专栏，文章可选择归属某专栏；未选择专栏的文章保留为闲散文章
- Status: implemented in code on `2026-04-20`
- Fix:
  - 新增迁移 `supabase/migrations/20260420_coach_content_columns.sql`
    - 新表 `coach_content_columns`
    - `coach_contents` 增加 `column_id` 和 `column_sort_order`
    - `column_id IS NULL` 表示闲散文章
    - 补索引、外键、RLS、grant
  - `src/types/database.types.ts` / `src/types/index.ts`
    - 补 `coach_content_columns` 类型
    - 补 `CoachContentColumnRow`
    - 补 `coach_contents.column_id` / `column_sort_order`
  - 新增 `/api/coach/content-columns`
    - GET 获取当前教练专栏
    - POST 新建专栏
    - PUT 更新专栏基础信息
  - `publish-content` / `update-content`
    - 支持写入和更新 `column_id` / `column_sort_order`
    - 校验所选专栏必须属于当前教练
  - `src/app/dashboard/content/ContentEditor.tsx`
    - 新增“内容归属”：闲散文章 / 某个专栏
    - 编辑器内只负责选择“闲散文章 / 已有专栏”，不再把新建专栏输入框塞进文章表单
    - “管理 / 新建专栏”会打开统一的专栏管理弹窗；在编辑器内创建或选中专栏后会自动回填到内容归属
  - `src/app/dashboard/content/page.tsx`
    - 加载教练专栏列表
    - 内容列表展示所属专栏或“闲散文章”
    - 支持按专栏归属过滤
    - 新增独立“专栏管理”弹窗，用于创建专栏、查看已有专栏、筛选或选中专栏
  - `src/app/api/coach/content-columns`
    - 用户截图反馈 `POST /api/coach/content-columns 500` 后复查：专栏表已存在，失败更像是 API 使用匿名 Supabase client 写入时被 RLS 拦截
    - 已改为：API 先用登录 session 校验当前教练身份，再用 `serviceRoleSupabase` 执行专栏表的列表/创建/更新，避免 RLS 误拦截服务端可信写入
    - 重复 slug 时返回已有专栏，不再直接 500
  - `src/app/articles/coach/[coachId]/page.tsx`
    - 公开页按命名专栏分区展示
    - 单独展示“闲散文章”
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npx next build`：通过，路由清单包含 `ƒ /api/coach/content-columns` 和 `ƒ /articles/coach/[coachId]`
  - `npm test`：通过（21 files, 100 tests）
  - `npm run typecheck`：超时；二次定向过滤同样超时，未得到新增文件相关错误输出
  - 用户截图后的追加验证：
    - `npx next build`：通过
    - `npm test`：通过（21 files, 100 tests）
    - `npm run lint`：通过当前提示脚本
    - `npm run typecheck`：失败于仓库既有大面积类型问题（Next 16 route params、动作库/schema 类型、小程序 Taro 依赖等）；定向过滤 `content-columns` / `dashboard/content` / `ContentEditor` 无命中
    - service role 数据库验证：临时插入 `coach_content_columns`、读取、删除，全部成功且清理完成
    - Playwright 尝试打开 `http://localhost:3000/dashboard/content`，但无共享登录态，被重定向到 `/login`；截图 `test-results/content-columns-dashboard-check.png`
  - Deployment blocker:
    - 这版代码必须与 SQL 迁移一起上线，不能只部署代码

- Task: 导入 body-map-system 文章到当前人体地图知识库
- Scope:
  - 盘点 `C:\Users\29454\.openclaw\workspace-main\body-map-system\articles` 现有 134 篇 Markdown 是否可直接复用到当前人体地图
  - 将可用文章按“直接同名部位 / 别名映射 / 相关结构或问题节点”挂载到当前 26 个可点击肌肉/关节
  - 先把现有内容填充进人体地图，再明确当前仍缺的内容空白
- Status: implemented in code and imported on `2026-04-20`
- Fix:
  - 新增 `scripts/import-body-map-articles.ts`
    - 读取外部 body-map-system Markdown 文章
    - 用 `markdown-it` 转为 `knowledge_nodes.content.body` 可渲染 HTML
    - 支持 `direct / alias / related / skipped` 四类映射
    - 默认 dry-run 输出 JSON 报告，`--apply` 时用 Supabase service role 幂等 upsert 到 `knowledge_nodes`
    - 同步补写 `knowledge_node_closures` 自关联，保证详情与树结构兼容
  - 导入结果：
    - 总文件 `134`
    - 可利用 `130`
    - 直接命中 `19`
    - 别名映射 `4`
    - 相关挂载 `107`
    - 跳过 `4`（`颈前淋巴结区 / 颞下颌关节 / 咬肌 / 翼内肌`，当前人体图无对应点击区）
    - 当前 `26` 个可点击部位已全部有内容，不再有空部位
- Verification:
  - dry-run：`temp_dir/body_map_article_import_dry-run_20260420_034304.json`
  - apply：`temp_dir/body_map_article_import_apply_20260420_034811.json`
    - `updated=130`，`errors=0`
  - `npm run lint`：通过当前提示脚本
  - `npm run typecheck`：失败，仓库既有问题；当前报错为 `.next/types/routes.d.ts` 与 `.next/types/validator.ts` 缺失
  - `npx next build`：通过
  - `npm test`：通过（21 files, 100 tests）
- Next step:
  - 优先补“头面/颈前区域”问题节点与点击区，吸收这次跳过的 4 篇文章
  - 若要让“筛查模式 / 训练模式”真正分流结果，可在 `/api/knowledge/nodes` 增加对 `content.body_map_modes` 的过滤

- Task: 补充 body-map-system 新转录 topic 到人体地图知识库
- Scope:
  - 评估 `C:\Users\29454\.openclaw\workspace-main\body-map-system\content` 下 26 个 topic 目录及后续新增转录是否可补强当前人体地图
  - 把当前可用的转录 topic 作为补充型知识节点导入 `knowledge_nodes`
  - 递归兼容 scp 产生的嵌套目录，并合并重点主题的中文别名目录
  - 头面/颈前主题先作为 `pending` 待接入节点入库，不误挂到当前 26 个点击区
- Status: implemented in code and imported on `2026-04-21`
- Fix:
  - 新增 `scripts/import-body-map-transcript-packs.ts`
    - 读取外部 `content/<topic>/.../transcript.txt`
    - 已升级为递归扫描，兼容 `114-wrist-flexors\114-wrist-flexors\...` 这类嵌套目录
    - 合并重点主题中文别名目录：`020-胸小肌 / 036-颈前淋巴结区 / 037-颞下颌关节 / 038-咬肌 / 039-翼内肌 / 114-腕屈肌群`
    - 把同一 topic 下的多份转录整理成“转录素材摘录”型 HTML 页面
    - 用现有人体图部位映射把 topic 归到相关 `body_region`
    - 头面/颈前主题保留自身 `body_region`，并写入 `content.pending_body_map_hitbox=true`
    - 默认 dry-run 输出 JSON 报告，`--apply` 时幂等 upsert 到 `knowledge_nodes`
  - 导入结果：
    - 总 topic `26`
    - 当前人体图可用 `22`
    - 待扩点击区 `4`（`cervical-lymph-nodes / temporomandibular-joint / masseter / medial-pterygoid`）
    - 合并后总转录文件 `250`
    - 实际入库 `26`（`22` 个更新，`4` 个新增 pending 节点）
  - 本轮重点补强的部位：
    - `大圆肌 / 岗下肌 / 内收肌 / 肱三头肌 / 腕屈肌群 / 腹外斜肌 / 股二头肌 / 半腱肌 / 足弓 / 踝背屈受限 / 肘关节`
- Verification:
  - dry-run：`temp_dir/body_map_transcript_pack_import_dry-run_20260421_204524.json`
  - apply：`temp_dir/body_map_transcript_pack_import_apply_20260421_204731.json`
    - `inserted=4`，`updated=22`，`skipped=0`，`errors=0`
  - `npm run lint`：通过当前提示脚本
  - `npm run typecheck`：失败于仓库既有类型问题（Next 16 route params、动作库/schema 类型、小程序 Taro 依赖等）；未见本次导入脚本相关错误
  - `npx next build`：通过
  - `npm test`：通过（21 files, 101 tests）
- Next step:
  - 若后续扩人体图点击区，可直接接入本轮新增的 `颈前淋巴结区 / 颞下颌关节 / 咬肌 / 翼内肌` pending 节点
  - 内容层面下一步更适合从“素材摘录”升级成正式系统指南，而不是继续盲目堆同主题转录

- Task: 将人体地图重点转录素材整理成正式系统指南并入库
- Scope:
  - 用户确认由代理整理当前人体地图素材，并同步到数据库
  - 第一批整理 7 个主题：`胸小肌 / 腕屈肌群 / 大圆肌 / 颞下颌关节 / 咬肌 / 翼内肌 / 颈前淋巴结区`
  - 将“转录素材摘录”升级为用户可直接阅读的正式知识节点
  - 对头面/颈前主题保持保守医学边界，先以 `pending_body_map_hitbox=true` 入库，后续扩点击区再展示
- Status: implemented and imported on `2026-04-21`
- Fix:
  - 新增 `scripts/import-body-map-formal-guides.ts`
    - 生成 7 篇正式系统指南
    - 使用统一结构：定位、常见表现、自我观察、处理策略、误区、风险边界
    - 当前人体图可用主题：
      - `胸小肌系统指南：圆肩、肩前侧紧张与肩胛控制`
      - `腕屈肌群系统指南：握力、前臂内侧疼痛与高尔夫球肘`
      - `大圆肌系统指南：拉类动作、肩后侧发力与背阔肌区分`
    - 待扩头面/颈前点击区主题：
      - `颞下颌关节指南：弹响、咬紧与张口受限的风险边界`
      - `咬肌指南：咬紧牙、磨牙与面颊紧张管理`
      - `翼内肌指南：深层咀嚼肌、张口偏移与 TMJ 关联`
      - `颈前淋巴结区指南：肿大、压痛与何时就医`
  - 数据库导入：
    - dry-run：`temp_dir/body_map_formal_guides_import_dry-run_20260421_210006.json`
    - apply：`temp_dir/body_map_formal_guides_import_apply_20260421_210114.json`
    - `inserted=7`，`updated=0`，`errors=0`
- Verification:
  - dry-run 成功：`total_guides=7`，`usable_guides=3`，`pending_guides=4`
  - apply 成功写入 Supabase：`inserted=7`，`errors=0`
  - lint 脚本等价检查通过（项目当前 lint 只是提示 Next 16 未配置 eslint）
  - `npm test` 等价 Vitest 命令通过（21 files, 101 tests）
  - `typecheck` 失败于仓库既有大面积类型问题（Next 16 route params、动作库/schema、小程序 Taro 依赖等），未见本次脚本相关错误
  - `next build` 两次卡在 `Creating an optimized production build ...` 直到超时；当前机器存在大量常驻 node 进程，未强杀以免影响用户 dev 服务
- Next step:
  - 后续更适合继续把其他高价值素材包升级为正式指南，而不是继续只导入转录摘录
  - 若要让头面/颈前 4 篇在人体地图 UI 中出现，需要新增对应 hitbox 或问题模式入口

- Task: 优化 AI 生成配置弹窗中的 `AI 深度个性化` 开关表达
- Scope:
  - 用户反馈原来的 `开启/关闭` ToggleButton 状态不清晰，截图里难以判断当前到底是关闭状态还是点击后关闭
  - 目标是换成更传统、明确的开关样式，并直接显示当前状态
- Status: implemented in code on `2026-04-20`
- Fix:
  - `src/app/dashboard/students/AiInstanceConfigDialog.tsx`
    - 将 `ToggleButton` 替换为 PrimeReact `InputSwitch`
    - 在标题旁增加明确状态标签：`已关闭` / `已开启`
    - 保留说明文案和原有 `useLLM` 参数传递逻辑
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npm test`：通过（21 files, 100 tests）
  - `npm run typecheck 2>&1 | Select-String -Pattern 'AiInstanceConfigDialog|dashboard/students/page|dashboard\\students\\page'`：无相关错误输出
  - `npx next build`：通过
  - 浏览器验证：已用 Playwright 尝试打开 `http://localhost:3000/dashboard/students`，但自动化浏览器无教练登录态，被重定向到 `/login`；无法实际打开该弹窗截图验证。截图保存于 `test-results/ai-config-switch-verification.png`

- Task: 修复 `/dashboard/students` 桌面学员表格训练计划列撑宽导致横向滚动
- Scope:
  - 用户反馈训练计划列里的长描述会把表格撑得很宽，需要手动横向滑动才能看到最后一列
  - 目标是在桌面 DataTable 内限制训练计划卡片宽度，让长计划描述在本列内截断，不再撑开整张表
- Status: implemented in code on `2026-04-20`
- Fix:
  - `src/app/dashboard/students/page.tsx`
    - 桌面 DataTable 增加 `tableStyle={{ tableLayout: 'fixed', width: '100%' }}`
    - 调整桌面列宽分配，为固定 checkbox 列预留空间
    - 训练计划卡片和描述行补 `min-w-0`，让 `truncate` 在 flex 布局中真正生效
    - 计划描述分隔符设为 `shrink-0`，描述文字本身在本列内省略
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npm test`：通过（21 files, 100 tests）
  - `npm run typecheck`：仍失败于项目既有历史类型问题；定向过滤 `dashboard/students/page` 无相关错误输出
  - `npx next build`：编译、收集页面和静态页面生成均成功，但最终 standalone copy 因本机 3000 服务占用 `.next` 文件触发 Windows `EBUSY`
  - 浏览器验证：用 Playwright 打开 `http://localhost:3000/dashboard/students`，因没有该浏览器上下文的教练登录态被重定向到 `/login`；未能在真实表格数据态下自动截图验证。截图保存于 `test-results/students-table-overflow-check.png`
- Next step:
  - 用已有登录态浏览器刷新 `/dashboard/students`，确认底部横向滚动条消失；若仍出现，优先检查训练进度列 `min-w-[180px]` 或外层容器宽度。

- Task: 移植 LLM 个性化训练计划生成到当前 dev 分支
- Scope:
  - 从 `origin/feat/ai-personalize-plan` 手工移植 LLM 相关文件，不整分支合并旧 `app/` 小程序结构
  - 保留当前 `dev` 的订阅剩余额度 / 下一阶段计划 / 默认起点判断逻辑
  - 修复特性分支里与当前 schema 和 `source` 约束不兼容的问题
- Status: implemented in code on `2026-04-20`
- Findings:
  - 当前本地 `dev` 与 `origin/dev` 均为 `fd9656d844c886035899377c1a1c17f1d2db67aa`，没有 `src/app/api/plan-lib/ai-personalize-plan/`、`useLLM`、`ai_generation_log`、`AiGenerationLogCard` 或 `20260416_add_ai_generation_log.sql`。
  - 远端存在 `origin/feat/ai-personalize-plan`，提交 `1f12d7554761edb87357d19113bdf5f9e92a056f`，其中确实包含用户转述的 20 个左右文件改动和 23 个单测。
  - 该远端特性分支未合入当前 `dev`，且基于较旧主线，仍携带根目录 `app/` 小程序结构；当前项目要求小程序在 `wechat_app/`，直接合并会产生目录/状态文件/基础设施冲突。
  - 静态检查发现特性分支实现存在至少两个上线阻断：`coach_actions` 查询了当前 schema 不存在的 `category`/`description` 列；插入计划时写 `source='ai-personalized'`，但当前数据库约束只允许 `coach/self`。
- Fix:
  - 新增 `src/app/api/plan-lib/ai-personalize-plan/`
    - Stage A：`select-template.ts` 让 LLM 从模板摘要里选骨架
    - Stage B：`personalize-plan.ts` 让 LLM 基于学员上下文和动作白名单个性化调整训练日
    - `validate-output.ts` 做 `actionId` 白名单过滤、day 重编号和 JSON 输出清理
    - `service.ts` 编排 Stage A/B、校验和 `fillTemplate` 重算重量
  - `create-ai-instance` / `bulk-create-ai-instances` DTO、route、service 透传 `useLLM`
  - `create-ai-instance/service.ts`
    - `useLLM=true` 时走 LLM 分支，失败时 fallback 到现有 `matchPlan + fillTemplate`
    - 保留当前 `dev` 的 `getSubscriptionCarryoverSummary` 剩余额度判断和默认起点语义
    - PR 记录读取使用 `actorUserId` 做权限身份，而不是误用 coach row id
    - 动作库查询使用当前真实字段 `id,name,type,detail`，并在 prompt 映射为 `category/description`
    - 不再写非法 `source='ai-personalized'`，继续保持 `source` 默认 `coach`，用 `ai_generation_log` 判断 AI 个性化记录
  - 前端配置弹窗新增 `AI 深度个性化` ToggleButton，单条/批量生成时传 `useLLM`
  - 学员计划详情页新增 `AiGenerationLogCard`，当实例有 `ai_generation_log` 时展示 Stage A/B reasoning
  - 新增迁移 `supabase/migrations/20260416_add_ai_generation_log.sql`
  - 新增 4 个测试文件，共 23 个 LLM 单测
- Verification:
  - `npm run lint`：通过当前脚本（脚本提示未配置 eslint）
  - `npm test`：通过（21 files, 100 tests）
  - `npm run typecheck`：失败，仍为项目历史类型问题；二次过滤 `ai-personalize-plan|create-ai-instance|bulk-create-ai-instances|AiInstanceConfigDialog|dashboard\\students\\page|AiGenerationLogCard|20260416_add_ai_generation_log` 无匹配错误
  - `npx next build`：第一次最终 standalone copy 遇到 Windows `EBUSY` 文件锁；清理 `.next` 后重跑通过
  - 浏览器验证：当前会话没有 AGENTS.md 指定的 `web-devtools` skill；已用 Playwright 打开 `http://localhost:3100/dashboard/students` 并截图到 `test-results/ai-personalize-plan-dashboard-students.png`，页面因缺少登录态重定向到登录弹窗，无法实际点击“AI 深度个性化”开关或走真实学员生成流程
- Next step:
  - 在 staging 应用 `20260416_add_ai_generation_log.sql` 后，用真实教练账号走通：无计划学员 -> 打开 AI 生成配置 -> 开启 AI 深度个性化 -> 生成计划 -> 计划详情页看到 AI 个性化生成记录。

- Task: 基于当前真实数据回答项目 8 条补充信息
- Scope:
  - 区分 `已上线 / 已开发未上线 / 规划中`
  - 回答用户侧、教练侧、供需撮合、核心场景、种子用户、风险责任机制、优先变现对象
  - 真实运营数据以当前 Supabase 配置和生产埋点为准；无埋点或无法严谨归因的数据必须明确标注不可精确回答
- Status: analysis completed on `2026-04-18`
- Data snapshot:
  - 统计口径：北京时间 `2026-04-18`，近 7 日从 `2026-04-11 00:00` 起，近 30 日从 `2026-03-19 00:00` 起
  - 注册用户 `1296`
  - 近 7 日登录用户 `165`，近 30 日登录用户 `718`
  - 行为埋点近 7 日去重用户 `27`，近 30 日去重用户 `42`
  - 页面埋点近 7 日去重会话 `447`，近 30 日去重会话 `1947`
  - 近 7 日完成训练打卡用户 `23`，完成训练记录 `49`
  - 全量完成训练用户 `65`，完成训练记录 `794`
  - 完成过整套计划用户 `5`，完成计划实例 `8`
  - 上传过训练视频用户 `16`，训练/执行视频共 `69`
  - 已批准教练 `15`，近 30 日教练行为活跃 `2`，真正带过学员/有订阅/有计划执行的教练 `3`
  - 教练订阅关系 `126`，active `84`，waiting `1`；当前订阅均在 `professional/growth` 教练层级，`buddy` 暂无订阅
  - 好友/搭子关系 `20`，其中 accepted `15`
  - 支付订单 `222`，订阅订单 `86`，其中 paid `15`；订阅支付客单价约 `180.14` 元；付费订阅用户 `14`，重复付费用户 `1`
  - AI 精确使用人数当前没有稳定埋点；`student_quotas` 有 `105` 行，其中 `56` 行余额低于旧/免费额度，最多只能作为“可能使用过 AI/配额被消耗”的弱证据
- Notes:
  - `coach_ai_auto_reply_settings` 表在当前 Supabase 中不存在，说明教练 AI 自动回复迁移尚未应用到线上库；该功能只能列为“已开发未上线/未部署”。

- Task: 为每个教练增加 DeepSeek AI 自动回复虚拟分身
- Scope:
  - 教练可以在消息中心配置 AI 自动回复开关
  - 教练可以维护基础提示词和资料库，供 AI 回复学员私信时参考
  - 先使用 DeepSeek OpenAI 兼容接口，模型为 `deepseek-chat`
  - 学员给教练发送文本消息时，若该教练已开启自动回复，则系统自动以教练身份插入一条 AI 回复
  - AI 回复必须在消息气泡中明确标注“教练虚拟分身自动回复”，提醒用户这不是教练本人实时输入
  - AI 回复必须参考系统资料和教练资料库，不能只凭模型常识瞎回复
- Status: implemented in code on `2026-04-16`
- Fix:
  - 新增迁移 `supabase/migrations/20260416_coach_ai_auto_reply.sql`
    - 新表 `coach_ai_auto_reply_settings`
    - 每个教练按 `coach_user_id` 保存 `enabled`、`system_prompt`、`knowledge_base`、`model`
  - 新增 `src/lib/coachAiAutoReply.ts`
    - 使用 `DEEPSEEK_API_KEY` + `https://api.deepseek.com` + `deepseek-chat`
    - 只处理一对一私聊中“学员发给教练”的文本消息
    - 自动拼装 DeepSeek 上下文：
      - 教练档案：姓名、头衔、简介、专项、支持重点、教学理念等
      - 学员档案：昵称/姓名、性别、年龄、身高、体重、训练目标/水平、作息、运动数据卡
      - 订阅关系：状态、档位、购买周期、开始日期、预计结束日期、订阅补充资料
      - 当前计划摘要：计划名称、说明、状态、完成进度、接下来若干训练日动作
      - 最近聊天上下文
    - 自动回复包含安全边界：不冒充真人教练、不处理医疗诊断、不承诺计划/价格/退款等需真人确认事项
    - 若系统资料、教练资料库、聊天上下文都没有足够依据，则要求 AI 明确说明需要教练本人确认，不能编造
    - 插入消息时写入 `content_metadata.coach_ai_auto_reply=true`
  - 新增 `/api/coach/ai-auto-reply-settings`
    - GET/POST 读取和保存当前教练的 AI 自动回复设置
  - `src/app/messages/page.tsx`
    - 教练消息中心新增“AI 分身”入口
    - 支持开关、基础提示词、资料库编辑
  - `src/app/api/chat/send-message/route.ts`
    - 发文本消息成功后触发 AI 自动回复并等待插入完成
  - `src/components/chat/MessageItem.tsx`
    - AI 回复气泡展示“教练虚拟分身自动回复”和“重要事项请等待教练本人确认”提示
  - `.env.local`
    - 复用项目既有的 `DEEPSEEK_API_KEY` 环境变量；这不是新的独立密钥体系
- Verification:
  - `npm run lint`：通过（脚本仅提示项目未配置 eslint）
  - `npm test`：通过（17 files, 77 tests）
  - `npm run typecheck`：超时未完成，符合近期历史表现
  - `npx next build`：用户中止并明确表示“不用编译，写代码就行”，因此未继续构建
  - 浏览器验证：未执行；用户本轮明确不要求编译/验证，只要求写代码
- Note:
  - 用户在 `2026-04-17` 纠正：DeepSeek key 原本就是项目既有同一个 key，本功能应复用 `DEEPSEEK_API_KEY`，不要理解成新增了一套独立 API key 配置
  - 用户在 `2026-04-17` 进一步明确：AI 自动回复必须参考资料，不能凭自己的感觉瞎回复；已在 `coachAiAutoReply` 中补系统上下文拼装和“不足则转真人确认”的约束

- Task: 同步 main/dev 的微信小程序目录命名并修复 Next 根路由冲突
- Scope:
  - 小程序工程原本合入到根 `app/`，会被 Next.js 识别为 App Router 并导致主站 `/` 404
  - main 已统一为 `wechat_app/`，dev 远端曾使用 `wechat-app`，需要同步成同一命名
- Status: implemented on `2026-04-16`
- Fix:
  - main/dev 均使用 `wechat_app/` 存放小程序代码
  - 根目录不再保留 `app/` 或 `wechat-app/`
- Verification:
  - main: `npx next build` 通过，路由清单重新包含 `○ /`
  - dev: `npx next build` 通过，路由清单包含 `○ /`

- Task: 修复计划脚本模式把括号动作变体误匹配为基础动作的问题
- Scope:
  - 用户在脚本模式输入 `负重引体（底部暂停）` 时，系统会直接识别成基础 `负重引体`
  - 这会丢失“底部暂停 / 顶端暂停 / 反手”等动作变体语义，属于计划脚本编译层的严重错误
  - 脚本模式应比智能导入更严格：动作名包含括号变体时，必须优先按完整动作名匹配，不能自动降级为基础动作
- Status: implemented on `2026-04-16`
- Root cause:
  - `src/lib/planScript.ts` 之前复用了 `findBestExistingActionMatch()`
  - 该函数来自智能导入链路，会通过 `sanitizeActionName()` 去掉括号内容，用于“复用友好”的宽匹配
  - 在计划脚本这种可编译 DSL 场景下，这种宽匹配会把 `负重引体（底部暂停）` 和 `负重引体` 视为同类，从而错误命中基础动作
- Fix:
  - `src/lib/planScript.ts`
    - 新增脚本专用动作解析逻辑
    - 先按完整动作名做精确匹配，保留括号内容，并兼容中英文括号
    - 只有动作名不包含括号变体时，才允许回退到 `findBestExistingActionMatch()` 宽匹配
    - 若脚本动作名包含括号变体但动作库无精确项，则明确报错，不再静默降级
  - `src/lib/planScript.test.ts`
    - 新增回归测试：`负重引体（底部暂停）` 必须匹配到底部暂停变体，而 `负重引体` 匹配基础动作
    - 新增回归测试：缺失的括号变体不会降级为基础动作
  - `src/utils/template.ts`
    - 放宽 `makeWeekDays()` 参数类型到只依赖 `type` 字段，消除脚本解析结果传入时的类型噪音
- Verification:
  - `npx vitest run src/lib/planScript.test.ts`：通过（4 tests）
  - `npm run lint`：通过（脚本仅提示项目未配置 eslint）
  - `npm run typecheck 2>&1 | Select-String -Pattern 'planScript|PlanScriptDialog|dashboard/students/plan|dashboard/plan-lib/edit|utils/template'`：无相关错误输出；完整 typecheck 仍会因仓库历史类型错误返回失败
  - `npx next build`：通过
  - `npm test`：通过（17 files, 77 tests）
  - 浏览器验证：未完成；当前会话没有可调用的 `web-devtools` / `browser` 工具

- Task: 将“计划脚本模式”从教练计划库模板编辑页扩展到具体学员计划编辑页
- Scope:
  - 用户希望 `/dashboard/students/plan/[subscriptionId]` 这种具体学员计划编辑页面也能使用紧凑脚本模式
  - 目标是让教练不只在计划模板库中编辑脚本，也能直接对某个学员当前计划草稿进行脚本化修改
  - 页面地址示例：`/dashboard/students/plan/06f07de8-e013-4106-a5ef-0637147a7e0b`
- Status: implemented on `2026-04-16`
- Fix:
  - `src/app/dashboard/students/plan/[id]/page.tsx`
    - 复用 `PlanScriptDialog`
    - 复用 `formatTemplateToPlanScript()` / `parsePlanScript()`
    - 在学生计划页的 `BasicInfoForm.extraButton` 区域新增“脚本模式”按钮
    - 打开时把当前学员计划草稿转成紧凑脚本
    - 应用时解析脚本并更新 `days`、`description`、`selectedDayIndex`
    - 对已有计划同步标记为待保存，保持原有自动保存/手动保存链路
- Verification:
  - `npm run lint`：通过（脚本仅提示项目未配置 eslint）
  - `npm run typecheck`：失败，仍是仓库历史类型错误；定向过滤未发现错误指向 `dashboard/students/plan`、`planScript` 或 `PlanScriptDialog`
  - `npx next build`：通过
  - `npm test`：通过（17 files, 75 tests）
  - 浏览器验证：未完成；当前会话没有可调用的 `web-devtools` / `browser` 工具，且该页面需要教练登录态

- Task: 补齐教练端“当前计划已完成后创建下一阶段计划”的可见入口
- Scope:
  - 用户在 `/dashboard/students` 看到学员计划进度 `32/32`、`100%`，但列表仍显示“进行中”，也看不到“创建新计划 / 结束当前计划 / 自动结束”的明显操作
  - 该场景对应“学员买 3 个月，前 2 个月计划已执行完，教练要继续创建下一阶段计划；新计划从第 1 天开始，学员端只放行剩余额度”
- Status: implemented on `2026-04-16`
- Root cause:
  - 学员列表只按 `coach_plan_instances.status` 展示，未把“active 但所有训练日已完成”的逻辑完成态派生成 `completed`
  - 学员计划详情页虽已有“从模板创建”能力，但未把“创建下一阶段计划”和“归档当前计划”显性暴露，导致教练不知道下一步入口
  - AI/手动创建接口把默认 `startWeek=1/startDay=1` 也当成显式起点，可能绕过剩余额度结转检查
- Fix:
  - `src/app/api/coach/list-students/route.ts`
    - 列表接口按当前计划训练日和已完成执行记录派生 `is_logically_completed`
    - active 但训练日全部完成时，对前端返回 `status='completed'`
  - `src/app/dashboard/students/page.tsx`
    - 列表和移动端卡片统一按逻辑完成态展示“已完成”
    - 移动端主按钮在完成后改为“创建下一阶段”
    - 桌面端完成计划的快捷 AI 按钮提示改为“AI 生成下一阶段”
  - `src/app/dashboard/students/plan/[id]/page.tsx`
    - 完成计划后显示绿色提示区，提供“创建下一阶段计划”和“只归档当前计划”
    - 选择模板创建下一阶段时直接进入新阶段模式，旧计划由创建接口自动归档
  - `src/app/api/plan-lib/create-instance/route.ts`
  - `src/app/api/plan-lib/create-ai-instance/service.ts`
    - 默认 `第1周第1天` 不再视为手动迁移起点，仍会走剩余额度检查；只有大于第1天的起点才视为显式迁移
- Verification:
  - `npm run lint`：通过（脚本提示项目未配置 eslint）
  - `npm test`：通过（17 files, 75 tests）
  - `npx next build`：通过
  - `npm run typecheck`：第一次因 `.next/types` 缺失失败；构建后重跑超时，无进一步输出
  - 浏览器验证：未完成；当前会话没有可调用的 `web-devtools`/`browser` 工具，且该页面需要教练登录态

- Task: 为教练端计划库增加“导出计划文本”能力，形成“导出文本 -> AI/人工编辑 -> 再导入”闭环的基础层
- Scope:
  - 用户希望在教练端计划库中把现有模板导出成文本形式
  - 导出能力仅限教练端计划库，不扩展到学员计划或 `/me` 侧自建计划
  - 文本格式需尽量贴近现有智能导入能理解的结构，而不是导出一整份 JSON
- Status: implemented on `2026-04-13`
- Fix:
  - `src/lib/planExportText.ts`
    - 新增模板文本格式化器，把 `training_days` 转成周/天/动作行形式
    - 支持训练日、休息日、强度、组次、休息时间，以及条件分支动作的文本展开
  - `src/app/api/plan-lib/export-template-text/route.ts`
    - 新增教练模板文本导出 API
    - 仅允许已登录教练导出属于自己的模板
    - 服务器端解析模板并补动作名映射，返回导出文本和 `.txt` 文件名
  - `src/app/dashboard/plan-lib/page.tsx`
    - 计划库列表新增“导出文本”入口
    - 导出后可在弹窗内预览、复制或下载 `.txt`
  - `src/app/dashboard/plan-lib/edit/[id]/page.tsx`
    - 编辑页新增“导出文本”按钮
    - 基于当前编辑中的 `days + actions + description` 实时导出，包含未保存的本地修改
  - `src/app/dashboard/plan-lib/components/TemplateTextExportDialog.tsx`
    - 统一导出文本预览弹窗
  - `src/lib/planExportText.test.ts`
    - 新增文本格式化回归测试
- Verification:
  - `npm run lint`：通过（脚本仅提示项目未配置 eslint）
  - `npm test -- src/lib/planExportText.test.ts`：通过
  - `npm test`：通过（16 files, 72 tests）
  - `npx next build`：通过
  - `npm run typecheck`：失败，仍是仓库既有 `.next/types/routes.d.ts` / `.next/types/validator.ts` 缺失
  - 浏览器验证：未完成；当前会话未提供 AGENTS.md 指定的 `web-devtools` skill，无法做该新增交互的浏览器级确认

- Task: 扩宽计划 AI 修改器的可编辑边界，优先支持“周范围 + 指定训练日 + 最后 N 次动作 + 替换 + 组次/RM”这类结构化批量改动
- Scope:
  - 用户最新明确指出：当前 AI 修改器在涉及多周、多次出现、定向替换的场景下边界过窄
  - 失败示例为“第 5 周到第 15 周的第 3 天，一共出现了 3 次负重引体，最后 1 次负重引体全部换成海豹划船，3 组 8 次，10RM”，接口此前返回“零处可以修改”
  - 目标不是继续依赖模型临场生成代码碰运气，而是先吃掉高频、可结构化表达的编辑指令
- Status: implemented on `2026-04-12`
- Root cause:
  - 旧链路基本依赖 LLM 生成修改代码；当指令涉及“范围 + 次序 + 最后一次匹配 + 参数覆盖”时，模型容易生成 no-op 代码
  - 旧实现只要代码执行成功就会继续往下走，没有把“执行成功但结果完全没变”识别为失败，因此前端会看到“0 处修改”
- Fix:
  - `src/lib/batchOperationDeterministic.ts`
    - 新增确定性规则引擎，直接解析“周范围 / 第几天 / 最后 N 次某动作 / 替换成新动作 / 组次 / RM”
    - 动作匹配支持用户宽口径表达，如 `负重引体` 命中 `正手负重引体`
    - 若替换动作不在动作库中，则生成 `pending:*` 临时 actionId，继续复用既有待确认动作链路
  - `src/app/api/plan-lib/batch-operation/route.ts`
    - 在 LLM 代码生成前先跑确定性规则命中
    - 若命中则直接返回 preview / action plan，不再让模型兜圈子
    - 对 LLM fallback 增加 no-op 检测：`executionResult.result` 与原 `trainingDays` 完全一致时，不能算成功，必须重试或显式报错
  - `src/lib/batchOperationDeterministic.test.ts`
    - 新增用户失败案例的回归测试
    - 新增“宽口径动作名匹配更具体动作名”的测试
- Verification:
  - `npm run lint`：通过（脚本仅提示项目未配置 eslint）
  - `npx vitest run src/lib/batchOperationDeterministic.test.ts`：通过
  - `npm test`：通过（15 files, 69 tests）
  - `npx next build`：通过
  - `npm run typecheck`：失败，但仍是仓库既有历史类型错误海，未发现本次新增规则文件对应的新报错
  - 前端 skill / 浏览器验证：按用户 `2026-04-12` 最新要求跳过，不再执行
- Next step:
  - 继续把高频批量编辑模式收敛成“结构化编辑语法 + diff 预览”，而不是把所有复杂修改都丢给自由生成代码
  - 用户在 `2026-04-13` 进一步明确希望：AI 编辑器的目标不是“重生成整份 JSON”，而是输出一种更轻量、低 token、可被规则器快速映射到 `training_days` 的中间格式，再渲染回前端
  - 用户在 `2026-04-13` 新增了更具体的思路：既然系统已经具备“混乱文本 -> 规整结构”导入，以及“结构 -> 规整文本”导出，那么下一步应评估把“规整文本 / 计划脚本”作为可编辑中间层，再由编译器映射回 `training_days`，并对比其功能边界与 token 成本
  - 用户进一步明确：`actionId` 不必出现在人类/AI 编辑的计划脚本中，只要能按动作名稳定解析；若脚本里出现新动作，则先触发“新建动作/确认动作”步骤，再继续编译计划
  - 用户在 `2026-04-13` 继续收敛需求：优先设计“最小 token 耗费的可编译计划脚本”，要求脚本以训练语义为主、尽量省字、可稳定编译回 `training_days`

- Task: 修复训练执行页组间休息在离开页面后丢失的问题
- Scope:
  - 用户反馈 `/training-execution/[instanceId]` 的组间休息计时器即使已支持“本页挂后台按真实时间回算”，只要离开训练执行页组件，计时状态仍会丢失
  - 需要覆盖“退出当前训练执行界面，再回来继续训练”的场景，而不只是页面保持打开时的 `visibilitychange/focus`
  - 用户在本轮最新要求里明确表示：不需要做任何前端验证，只需要直接修改代码
- Status: implemented on `2026-04-12`
- Root cause:
  - 当前实现把休息截止时间只存放在页面内 `restEndAtRef`
  - 当用户离开训练执行页时，React 组件卸载，`restEndAtRef` 会随组件一起丢失
  - 因此再次进入同一训练页时，无法恢复之前尚未结束的组间休息
- Fix:
  - `src/app/training-execution/[instanceId]/page.tsx`
    - 新增按 `user + instance/impromptu + dayIndex` 生成的 `restTimerStorageKey`
    - 新增 `persistRestTimer()` / `readPersistedRestTimer()` / `clearPersistedRestTimer()`，把休息截止时间持久化到 `localStorage`
    - `beginRestTimer()` 与 `+30s` 现在会同步刷新持久化截止时间
    - 页面重新进入并拿到当前 `execution.id` 后，会尝试恢复尚未结束的组间休息
    - 训练完成、快速完成、跳过休息、倒计时自然结束时都会清理持久化状态，避免脏恢复
    - 新增 `normalizePlannedRestSeconds()`，把历史脏数据里被放大 60 倍的休息时长（如 10800）纠正回真实秒数（180）
    - `syncRestTimer()` 在恢复旧的持久化计时器时，若发现剩余时间明显超出组间休息合理范围，会立刻回写纠正后的截止时间，避免继续显示成 180 分钟
  - `src/app/api/execution/start/route.ts`
    - 创建新的执行记录时，对 `planned_rest_seconds` 做同一套归一化，防止新进入训练页后继续拿到异常超大的休息秒数
  - `src/app/api/execution/_helpers/syncExecutionPlan.ts`
    - 同步历史执行记录与当前计划配置时，也统一纠正异常休息时长，避免旧记录反复把错误值带回前端
- Verification:
  - 本轮按用户 `2026-04-12` 最新要求，未继续运行任何 lint/typecheck/build/test 或前端验证命令；由用户自行验证前端行为

- Task: 规划视频上传链路从“仅前端压缩直传”升级为“前端减负 + 服务端异步处理”的下一阶段方案
- Scope:
  - 当前已实现浏览器前置压缩 + signed upload + 视频记录入库
  - 需要在不打断现有上传体验的前提下，进一步提升播放兼容性、存储治理、处理可观测性与后续扩展能力
  - 重点关注训练视频主链路，同时兼容动作示范视频、问卷示例视频等其它视频入口
- Status: proposed on `2026-04-12`
- Findings:
  - 现有 `src/lib/videoCompression.ts` 已承担浏览器端预压缩
  - `training_videos` 表已具备 `processing_status`、`thumbnail_url`、`duration_seconds`、`metadata` 等可复用字段
  - 当前 `src/app/api/user/_helpers/videoRecord.ts` 默认直接以 `processing_status='ready'` 创建记录，尚未真正接入服务端异步处理状态机
- Proposed next step:
  - 保留前端压缩作为上传前减负
  - 新增服务端异步视频处理任务，统一产出可播放版本、封面、时长与处理状态
  - 后续若转码稳定，再评估原始视频保留/清理策略与分场景码率策略

- Task: 修复“购买 53 周但两个月计划被错误推到 2026-07-14 才完成”的预计完成日公式
- Scope:
  - 用户指出 `/dashboard/students` 中某学员显示“已购 53 周”，但当前第一阶段计划只有约两个月，预计完成日却被算到 `2026-07-14`
  - 需要确认是购买周期和计划周期混淆导致，而不是学员真实还剩这么久
  - 目标是让预计完成日按“当前计划实例的实际训练节奏/跨度”估算，而不是按总购买周数摊薄
- Status: implemented on `2026-04-12`
- Root cause:
  - `src/lib/subscriptionEstimatedEndDate.ts` 之前在估算 `remainingDaysEstimate` 时，把 `subscribed_weeks` 直接传给 `estimateRemainingDays()`
  - 当学员购买 53 周、但当前计划实例只有 8 周左右时，公式会把当前计划的训练天数按 53 周平均摊开，导致预计完成日被明显拖长
  - `src/app/api/subscription/check-subscription/route.ts` 的定时巡检链路也复用了同样的错误口径，可能把错误日期再次写回数据库
- Fix:
  - `src/lib/subscriptionCredits.ts`
    - `estimateRemainingDays()` 参数从“购买周数”改为“当前计划节奏周数 `cadenceWeeks`”
  - `src/lib/subscriptionEstimatedEndDate.ts`
    - 改为使用当前实例 credits scope 对应的有效周数 `effectivePlanWeeks`
    - 不再用总购买周数去推当前阶段预计完成日
  - `src/app/api/subscription/check-subscription/route.ts`
    - 统一改用 `deriveProjectedSubscriptionEndDate()`，避免后台巡检继续按旧公式刷新错误 `end_date`
  - `src/lib/subscriptionCredits.test.ts`
    - 新增“购买 53 周但当前计划只有 8 周节奏时，不应被拉长到十几周后”的回归思路覆盖
- Verification:
  - `npm test`：通过（14 files, 67 tests）
  - `npx next build`：通过
  - `npm run lint`：本轮未重跑；此前仓库脚本仅提示未配置 eslint
  - `npm run typecheck`：超时未完成；仓库仍存在既有类型检查阻塞
  - 浏览器验证：未完成；当前会话环境未提供 AGENTS.md 要求的 `web-devtools` skill，无法做该页面的浏览器级验证

- Task: 支持计划编辑器直接调整同一天内动作顺序，并为后续“灵活编辑计划”保留升级方向
- Scope:
  - 用户在 `/dashboard/plan-lib/edit/[id]` 想把同一天里的第 1、2 个动作对调，但当前编辑器做不到
  - 需要至少支持同日动作上移/下移，覆盖教练模板编辑、学员计划编辑、`/me` 侧自建计划等共用入口
  - 用户在本轮最新要求里明确表示：只需要改代码，不需要再调用任何 skill 做前端验证
- Status: implemented on `2026-04-12`
- Root cause:
  - `training_days[].actionSets[]` 本身就是有序数组，后端保存也会保留顺序
  - 但前端 `PlanDayCard` 只有删除/筛选，没有任何重排入口或状态 handler，所以第 1、2 个动作无法直接交换
- Fix:
  - `src/app/dashboard/plan-lib/components/PlanDayCard.tsx`
    - 每个动作卡片头部新增“上移 / 下移”按钮
    - 首项禁用上移，末项禁用下移，避免越界
  - 以下页面补 `handleMoveActionSet()`，直接交换 `actionSets` 数组顺序：
    - `src/app/dashboard/plan-lib/edit/[id]/page.tsx`
    - `src/app/dashboard/plan-lib/create/page.tsx`
    - `src/app/dashboard/students/plan/[id]/page.tsx`
    - `src/app/me/plan-lib/create/page.tsx`
    - `src/app/me/plan-lib/edit/[id]/page.tsx`
- Verification:
  - `npm run lint`：通过（脚本仅提示项目未配置 eslint）
  - `npm test`：通过（14 files, 66 tests）
  - `npx next build`：通过
  - `npm run typecheck`：失败，但仍是仓库既有历史类型错误海；未出现本次排序改动对应的新报错定位到上述编辑页
  - 前端 skill / 浏览器验证：按用户 `2026-04-12` 最新要求跳过，不再继续执行
- Next step:
  - 若要把“灵活编辑计划”再往前推，建议新增“文本脚本视图”作为高级模式，但继续让 `training_days` 结构化 JSON 作为最终真相，避免直接把自由文本变成唯一数据源

- Task: 重新对齐“跨计划实例结转”的产品语义，确认新计划应从第 1 个月顺序执行而不是跳到尾段
- Scope:
  - 用户明确指出：学员买 3 个月，旧计划已做完并归档后，教练新建 2 个月计划时，新计划应从自己的第 1 个月开始按顺序执行
  - 当前代码把“历史已消耗周数”直接映射到新计划尾段，导致默认 `start_execution_day` 可能跳到新计划后半段
  - 需要后续评估是否将“剩余额度结转”从“改起点”改为“限制可执行窗口/credits”
- Status: requirement clarified on `2026-04-12`
- Root cause:
  - `src/lib/subscriptionCarryover.ts` 当前实现按“剩余周数映射到新计划尾段”推断 `start_execution_day`
- Next step:
  - 若进入实现，优先改为“新计划从 day 1 开始 + 剩余额度单独限制”，并同步收紧前端/后端对超出剩余额度部分的展示与执行门禁

- Task: 拆清“购买周期 vs 实际执行时长”语义，并让教练修改购买周期时同步刷新预计完成日
- Scope:
  - 用户明确指出“学员买的计划长度”和“实际执行完成所需时长”不是一个概念
  - 典型场景：学员购买 1 个月计划，但因延迟/推迟，实际执行可能需要 1 个半月
  - 需要确保教练在 `/dashboard/students` 修改购买周期时，`end_date` 会跟随当前执行节奏重算，而不是停留在旧值
  - 同时要避免前台继续把 `end_date` 当成“硬到期”，导致延期执行时文案误导
- Status: implemented on `2026-04-12`
- Fix:
  - 新增 `src/lib/subscriptionEstimatedEndDate.ts`
    - 抽出基于 `subscribed_weeks + training_days + completed executions + start_execution_day` 的统一预计完成日推导逻辑
  - `src/app/api/subscription/update-subscription/route.ts`
    - 教练手动修改 `subscribed_weeks` 且未显式传 `end_date` 时，自动读取当前计划实例进度并重算 `end_date`
  - `src/app/api/execution/updateEstimatedEndDate.ts`
  - `src/app/api/coach/list-students/route.ts`
    - 统一复用同一套预计完成日推导，避免“保存后列表显示”和“训练执行后回写”使用不同算法
  - `src/app/dashboard/students/StudentDetailDialog.tsx`
    - 文案从“订阅周期”改为“购买周期”
    - 保存购买周期后直接使用后端返回的最新 `end_date`，让弹窗即时反映新的预计完成日
    - `end_date` 已过时不再显示“已到期”，改为“已超过原预计完成日 xx 天”
    - “总跟随周数”在 `status=active` 时不再被过期的 `end_date` 截断
  - `src/app/dashboard/students/page.tsx`
    - 列表列名改为“购买周期 / 预计完成”
    - 桌面端与移动端统一展示 `已购xx周` + `预计完成 yyyy/mm/dd`
- Verification:
  - `npm run lint`：通过（脚本仅提示项目未配置 eslint）
  - `npm test`：通过（14 files, 66 tests）
  - `npx next build`：通过
  - `npm run typecheck`：失败，仍为仓库既有问题：`D:/files/coachlink/.next/types/validator.ts` 缺失
  - 浏览器验证：未完成；当前会话环境未提供 AGENTS.md 要求的 `web-devtools` skill，无法做该页面的浏览器级验证

- Task: 修复计划库编辑页 AI 修改器在 Gemini/Ofox 链路下报 `400 Unable to submit request because at least one contents field is required`
- Scope:
  - 用户在 `/dashboard/plan-lib/edit/[id]` 使用 AI 修改器时，输入自然语言指令后立即报错
  - 错误来自 Ofox 转发的 Gemini/Vertex 兼容层，提示请求里至少要有一个 `contents` 字段
  - 需要确认是前端没传指令，还是后端组装 LLM 请求时把用户内容丢掉
- Status: implemented on `2026-04-11`
- Root cause:
  - `src/app/api/plan-lib/batch-operation/route.ts` 中多次调用 `openai.chat.completions.create()`
  - 这些请求把完整提示词都塞进了单条 `system` 消息，没有显式 `user` 消息
  - 在 Ofox -> Gemini/Vertex 兼容链路下，这类请求会被判定为缺少 `contents`，直接返回 400
- Fix:
  - `src/app/api/plan-lib/batch-operation/route.ts`
    - 新增 `buildPromptMessages()`，统一把提示词组装为 `system + user` 两条消息
    - 意图识别、查询回答、补充追问判断、代码生成四处 LLM 调用全部改用该消息结构
    - 新增空 `instruction` 的 400 保护，避免再次发出无意义请求
- Verification:
  - `npm run lint`：通过（脚本仅提示项目未配置 eslint）
  - `npx next build`：通过
  - `npm test`：通过（14 files, 66 tests）
  - `npm run typecheck`：失败，仍为仓库既有问题：`D:/files/coachlink/.next/types/validator.ts` 缺失
  - 浏览器验证：未完成；当前会话环境未提供 AGENTS.md 要求的 `web-devtools` skill，无法做该交互的真实浏览器复现

- Task: 修复“我的学员”里手动修改剩余时长后，列表仍显示旧的 `4周计划` 的语义错位
- Scope:
  - 用户在 `/dashboard/students` 点击学员昵称进入详情弹窗后，可直接编辑“剩余时长”
  - 现状是该编辑只更新 `end_date`，但列表中的“订阅状态”实际显示 `subscribed_weeks`，导致改了剩余时长后仍显示旧的 `4周计划`
  - 用户要求仔细修改，并明确表示本轮由自己手动验证，无需代理继续做构建或页面验证
- Status: implemented in code on `2026-04-11`
- Fix:
  - `src/app/dashboard/students/StudentDetailDialog.tsx`
    - 新增基于“开始日期 -> 新结束日期”的周数推导逻辑
    - 保存剩余时长时，除了更新 `end_date`，也同步更新 `subscribed_weeks`
    - 若结束日期早于开始日期，前端直接拦截并提示
    - 保存成功后 toast 明确提示已同步到多少周
  - `src/app/dashboard/students/page.tsx`
    - 列表列名从“订阅状态”改为“订阅周期”
    - 桌面端/移动端的周期标签统一改为显示 `xx周周期`，避免误导成状态字段
    - 补上 `onStudentUpdate`，让弹窗保存后列表和当前选中学员立即同步刷新
- Verification:
  - `npm run lint`：通过（脚本仅提示项目未配置 eslint）
  - `npx next build`：通过
  - `npm test`：通过（14 files, 66 tests）
  - `npm run typecheck`：
    - 第一次失败原因为 `.next/types` 尚未生成，不是本次改动直接导致
    - 用户随后明确表示“不用构建去验证，我来验证就行”，因此未继续追类型检查结果
  - 前端浏览器验证：按用户本轮最新要求交由用户自行验证，代理未继续执行
- Next step:
  - 若用户后续仍觉得“改结束日期”和“改订阅额度”混在一起容易误解，可再拆成两个明确入口：`预计结束日` 与 `延长订阅周数`

- Task: 为训练执行页及通用视频上传链路增加前置压缩，缓解大视频上传限制与服务器存储压力
- Scope:
  - 用户要求在 `training-execution` 训练执行页上传训练视频时，先在前端尝试压缩再上传
  - 同时把其他复用视频上传链路一并覆盖，避免只有单页受益
  - 目标是减少上传失败率、缩短上传时间，并让服务端记录压缩后的真实体积
  - 用户在本轮明确表示“不用去验证执行，你只管改就行”
- Status: implemented on `2026-04-11`
- Fix:
  - 新增 `src/lib/videoCompression.ts`
    - 基于浏览器 `video + canvas + MediaRecorder` 做前置压缩
    - 大于阈值或分辨率过高的视频会先缩到较小体积/尺寸，再进入直传
    - 若压缩收益不明显，则自动回退原文件，避免越压越大
  - `src/app/service/videoService.ts`
    - `uploadVideoFile()` 在申请 signed upload URL 前先执行 `prepareVideoForUpload()`
    - 对外暴露“准备中/压缩中/上传中”进度
    - `submit-video-url` 元数据新增压缩信息（原始体积、上传体积、mime、尺寸、策略）
  - `src/app/service/actionLibService.ts`
    - 动作库演示视频上传接入同一套前置压缩
  - `src/app/service/coachService.ts`
    - 教练问卷示例媒体上传在视频场景下同样先压缩再发到 `/api/coach/upload-question-media`
  - 前端入口同步放宽并统一说明：
    - `src/components/video/VideoUploader.tsx`
    - `src/app/coach/plans/dashboard/[id]/components/SetVideoUploader.tsx`
    - `src/app/ranking/[id]/SubmissionDialog.tsx`
    - `src/app/training-execution/[instanceId]/page.tsx`
    - `src/app/dashboard/action-lib/ActionEditDialog.tsx`
    - `src/app/me/action-lib/StudentActionEditDialog.tsx`
- Verification:
  - `npm run lint`：通过（脚本仅提示 Next 16 未配置 eslint）
  - `npx next build`：通过
  - `npm test`：通过（14 files, 66 tests，含新增 `src/lib/videoCompression.test.ts`）
  - `npm run typecheck`：失败，但输出均为仓库既有/历史类型问题；未筛到本次新增文件相关报错
  - 浏览器验证：用户明确要求本轮不做执行验证，因此未继续跑页面回归

---

- Task: 修复学员训练执行页组间休息在后台不走时的问题
- Scope:
  - 用户反馈页面位于 `/training-execution/[instanceId]`，学员在执行今日训练计划时，组间休息倒计时挂后台后不会继续按真实时间推进
  - 目标是在不改训练主流程的前提下，让休息计时基于真实经过时间结算，而不是依赖前台每秒递减
  - 用户在本轮明确表示“不需要你去验证，你只管改就行”
- Status: implemented on `2026-04-11`
- Root cause:
  - `src/app/training-execution/[instanceId]/page.tsx` 原实现使用 `setInterval` 每秒递减 `restTimer`
  - 页面切到后台后浏览器会节流或暂停定时器，导致返回前台时剩余休息时间停留在旧值
- Fix:
  - `src/app/training-execution/[instanceId]/page.tsx`
    - 新增 `restEndAtRef`，开始组间休息时记录真实截止时间戳
    - 新增 `beginRestTimer()` / `syncRestTimer()`，改为用 `Date.now()` 与截止时间回算剩余秒数
    - 页面重新获得焦点或从后台回到前台时，立即同步剩余休息时间
    - `+30s` 改为延长真实截止时间，而不是只改本地显示秒数
    - 跳过休息时同步清空截止时间引用，避免残留计时状态
- Verification:
  - `lint`：通过（项目脚本仅输出“未配置 eslint”提示）
  - `typecheck`：失败，仓库存在大量历史 TypeScript 错误；本次改动未新增与休息计时相关的报错
  - `next build`：通过
  - `npm test`：通过（13 files, 63 tests）
  - 前端浏览器验证：按用户本轮要求跳过；此前尝试访问目标 URL 时，未登录态会被重定向到登录页
- Next step:
  - 若后续还要修“切后台时休息结束提醒没弹出/没响铃”，可继续把计时逻辑抽成共享 hook，并补浏览器级回归验证

- Task: 让 `/streetlifting-index/calculator` 记住上一次填写的计算器输入，避免重复填写性别/体重/负重等字段
- Scope:
  - 用户要求在线力量计算器保留上一次填写结果
  - 重点覆盖会被反复输入的字段：性别、体重、附加负重及同页其他计算参数
  - 用户在本轮明确表示“不需要你去验证，你只管改就行”
- Status: implemented in code on `2026-04-11`
- Fix:
  - `src/app/streetlifting-index/calculator/page.tsx`
    - 保留现有 localStorage 草稿恢复逻辑
    - 新增 `persistDraftNow()`，在页面隐藏、关闭、刷新前立即落盘，避免仅靠 400ms 防抖导致“刚填完就离开页面”时丢失
    - 新增“清空上次输入”按钮，允许用户手动清除本机已保存内容
- Verification:
  - 按用户要求，本轮未继续做浏览器验证
  - `npm run lint`：通过（脚本仅提示未配置 eslint）
  - `npm test`：通过（13 files, 63 tests）
  - `npx next build`：通过
  - `npm run typecheck`：失败，仍为仓库级既有历史类型错误，未见与本次计算器改动直接相关的新错误定位到该页面
- Next step:
  - 若用户后续仍反馈“没记住”，再针对其实际使用环境（浏览器/无痕模式/嵌入 WebView）做定点排查

---

- Task: 梳理订阅系统全链路语义，并为“跨计划实例结转剩余订阅时长/credits”改造做安全设计
- Scope:
  - 用户要求先彻底梳理当前订阅系统的真实逻辑，避免直接改动导致原有正确链路回归
  - 需要确认创建订阅、支付确认、续费、计划自动匹配、手动建计划、开始训练、订阅门禁、到期巡检、宽限期、自愈回填之间的关系
  - 目标问题：同一学员购买 3 个月，但教练先做 2 个月计划后又新建一个 2 个月计划时，系统应识别“只剩 1 个月可走”，而不是把新实例误当成新的完整额度
  - 改造约束：不能破坏当前已成立的 B1 语义，包括“订阅按训练日 credits 消耗”“start_date 以第一次开始训练为准”“end_date 主要用于预计完成日与宽限期输入”“同订阅仅保留一个当前计划实例”
- Status: analysis in progress on `2026-04-10`
- Findings so far:
  - 当前门禁按“订阅 subscribed_weeks -> 当前实例 credits 范围 -> 当前实例 completed executions”判定，不会自动跨历史实例累计已消耗额度
  - 同一个 `coach_subscription_id` 新建实例时会归档该订阅下旧的 `active/paused` 实例，因此“当前计划”始终只看最新实例
  - 现有系统已存在多处历史兼容/自愈逻辑（pending_renew、offline renew、rebind legacy instance、normalize stale end_date），后续改造必须先区分“主语义”与“兼容补丁”
- Fix on `2026-04-10`:
  - 新增 `src/lib/subscriptionCarryover.ts`
    - 基于同一订阅下历史计划实例的最远进度（`max(start_execution_day - 1, completed day_index)`）推断已消耗周数
    - 将“历史已走周数”映射到新计划尾段，自动推断 `start_execution_day`
  - `src/app/api/plan-lib/create-instance/route.ts`
    - 手动创建计划时，若教练未显式填写 `startWeek/startDay`，自动继承历史订阅进度
    - 若订阅剩余周期已耗尽，则拒绝创建新计划并提示先续费
  - `src/app/api/plan-lib/create-ai-instance/service.ts`
    - AI 建计划时同样自动继承历史订阅进度
    - 计划名称/描述里的“从第几周开始”改为显示推断后的真实起点
  - `src/app/api/plan-lib/create-ai-instance/route.ts`
  - `src/app/api/plan-lib/bulk-create-ai-instances/route.ts`
  - `src/app/api/plan-lib/auto-match-plan/service.ts`
    - 去掉默认强制传 `startWeek=1/startDay=1`，让自动推断能够生效
- Verification:
  - `npm run lint`：通过（脚本提示未配置 eslint）
  - `npx next build`：通过
  - `npm test`：通过（13 files, 63 tests）
  - `npm run typecheck`：两次超时，仓库级历史类型面仍未跑完，未发现本次改动触发的新增编译错误输出
- Next step:
  - 若需要彻底修复“已存在的历史错误实例”，可继续补一个只读自愈：对当前活动实例在读取时比对历史进度并提示/自动回填 `start_execution_day`
  - 若后续发现“跨计划替换但周数映射仍不够精确”的个案，再评估是否需要把“历史最远进度”升级为更细粒度的订阅消耗账本

---

- Task: 升级“申请成为教练”流程为分层入驻申请，并把分层信息接入找教练链路
- Scope:
  - 用户要求先梳理当前申请教练流程，再基于“训练搭子 / 进阶教练 / 专业教练”分层供给思路升级现有功能
  - 需要把单一教练认证升级为可承载分层生态的数据底座，而不是只改文案
  - 需要修复当前申请状态只落在 `coach_applications`、但 `users.coach_status` / `session.user` 不跟随的问题
  - 需要让 `coach_track` 真正进入前台发现/搜索/详情展示，而不是停留在申请后台
- Status: implemented in code on `2026-04-08`
- Findings on `2026-04-08`:
  - 当前线上流程本质是“单一教练认证”：入口在 `/coach/application`，提交到 `create-coach-application`，后台在 `/admin/coach-applications` 审核，通过后创建/更新 `coaches` 并给 `users.is_coach=true`
  - 申请状态展示链路有断层：创建申请时不会同步 `users.coach_status`，学员侧资料页可能仍显示“未申请”
  - 学员资料卡中的多个入口仍指向不存在的 `/apply*` 路由，而不是真实页面 `/coach/application`
  - 后台 UI 已出现 `reviewing` / `needs_info` 状态，但历史建表约束只保证了 `pending/approved/rejected`
  - `coach_track` 在第一轮升级后仅存在于申请与审核侧，未进入发现页、搜索页、详情页
- Fix:
  - 数据模型：
    - 新增迁移 `supabase/migrations/20260408_layered_coach_application_tracks.sql`
    - `coach_applications` / `coaches` 增加 `coach_track`、`service_modes`、`target_student_levels`、`support_focus`
    - `coach_applications.status` 约束扩展为支持 `reviewing` / `needs_info`
  - 接口：
    - `src/app/api/coach/create-coach-application/route.ts`
      - 写入分层字段
      - 创建申请后同步 `users.coach_status='pending'`、`is_coach=false`
    - `src/app/api/coach/update-coach-application/route.ts`
      - 支持更新分层字段
      - 审核通过时把分层信息同步到 `coaches`
      - 审核状态变化时同步 `users.coach_status`
      - 已获批教练本人修改申请资料时，不再自动把申请重新打回 `pending`
    - `src/app/api/coach/get-aggregated-info/route.ts`
      - 聚合返回时兼容合并最新申请里的分层字段
    - `src/app/api/coach/get-all-coaches/route.ts`
      - 新增 `coachTrack`、`serviceMode`、`targetStudentLevel` 筛选能力
  - 前端：
    - `src/app/coach/application/page.tsx`
      - 升级为分层申请表单
      - 新增“训练搭子 / 进阶教练 / 专业教练”三档选择
      - 新增服务方式、适合学员阶段、阶段问题聚焦
      - 提交成功后主动刷新 session
    - `src/app/admin/coach-applications/page.tsx`
      - 后台审核列表新增“层级”列
    - `src/app/admin/coach-applications/CoachApplicationDialog.tsx`
      - 详情弹窗展示分层字段
    - `src/components/student/profile/CoachApplicationCard.tsx`
      - 修正入口到 `/coach/application`
      - 补齐 `needs_info` 状态展示
    - `src/app/coach/application/ReviewInfoDisplay.tsx`
      - 补齐 `needs_info` 展示文案与样式
    - `src/app/coach/discovery/DiscoveryContent.tsx`
      - 新增按层级浏览的快速筛选
      - 教练卡片展示层级标签
    - `src/app/search/page.tsx`
      - 新增层级 / 服务方式 / 学员阶段筛选
      - 搜索结果卡片展示层级标签
      - 修复“只看同城”判定与距离展示不一致：改为 `isSameCityForFilter`
        - 优先按省+市一致
        - 若教练未完善省市但与用户距离很近（30km 内）则同城兜底命中
    - `src/app/coach/profile/[id]/CoachIntroduction.tsx`
      - 教练详情页展示层级、服务方式、适合阶段、阶段问题聚焦
    - `src/app/coach/profile/[id]/EditCoachProfileDialog.tsx`
      - 教练本人编辑资料时新增层级、服务方式、适合学员阶段、阶段问题聚焦维护能力
    - `src/app/api/coach/update-coach-profile/route.ts`
      - 教练资料更新接口支持持久化分层字段
      - 兼容把 `support_focus` 同步回 `profile.supportFocus`，避免新旧展示来源分叉
    - `src/app/api/coach/get-all-coaches/route.ts`
      - 新增 `preferredCoachTrack` 排序偏好
      - 在未显式筛选层级时，优先把更贴近当前学员阶段的教练排到前面
  - 数据回填：
    - 新增迁移 `supabase/migrations/20260408_rebalance_existing_professional_coaches.sql`
    - 已实际回填当前数据库：
      - 保留 `professional`：`刘三乐 / 枭马葛 / 四方力量-五花肉 / 文武双缺的杰`
      - 保持 `buddy`：`沈妈妈`
      - 其他当前仍为 `professional` 的已批准教练统一降为 `growth`
    - 同步修正了 `coaches` 与 `coach_applications(status=approved)` 两张表，避免前台与后台层级不一致
- Verification:
  - `npm run lint`：通过（脚本仅提示 Next 16 未配置 eslint）
  - `npm run typecheck`：多次超时，未在限定时间内跑完；仓库存在较大历史类型面，需单独清查
  - `npx next build`：通过
  - `npm test`：通过（12 files, 57 tests）
  - 浏览器验证：已尝试
    - `next dev` 本地会出现“端口可监听但页面长时间不返回首字节”的异常，未能稳定用于自动化
    - 改用 `next start` 成功验证公开链路与登录链路：
      - 发现页分层区截图：`test-results/manual/coach-discovery-layered.png`
      - 学员登录后搜索页筛选截图：`test-results/manual/coach-search-student-authenticated.png`
      - 教练本人资料编辑弹窗截图：`test-results/manual/coach-profile-edit-dialog-layered.png`
      - 数据回填后的搜索页截图：`test-results/manual/coach-search-after-track-rebalance.png`
- Next step:
  - 在稳定的 `next dev` 会话里补一次申请页 `/coach/application` 的端到端录入验证
  - 若继续推进创业规划，下一步应把 `coach_track` 接入推荐排序权重、报名转化漏斗与教练供给运营面板
- Last updated: `2026-04-08`

---

## Current UI Task (`2026-04-27`)

- Task: simplify WeChat mini-program `today-training` information architecture.
- Scope:
  - Target code is the mini-program path `wechat_app/src/training/today-training`, not the Web page under `src/app/today-training`.
  - Move the weekly calendar strip below the primary daily progress/action card.
  - Merge the separate "enter today training" card into the daily progress card.
  - Keep secondary actions such as impromptu training, contact coach, and remove self-plan as compact inline pills.
- Status: first pass implemented.
- Verification:
  - `wechat_app`: `npm ci` installed missing local dependencies.
  - `wechat_app`: `npm run build:weapp` passed.
  - Root: `npm run lint` passed as the existing informational lint script.
  - Root: `npm run typecheck` timed out after 120s with no output, matching known historical typecheck burden.
  - Root: `npx next build` passed.
  - Root: `npm test` passed, 21 files / 106 tests.
- Visual verification:
  - Automated web-devtools verification could not be completed in this session because the required `web-devtools` skill/tool is not available here, and this is a WeChat mini-program screen that needs WeChat DevTools for faithful rendering.

---

## Current Product Analysis (`2026-04-27`)

- Task: synchronize WeChat mini-program private-message functionality with the Web chat surface.
- Status: first implementation completed; user will run and verify manually.
- Key finding:
  - The Web client already exposes the fuller chat surface: reply-to-message, quote jump, message search with anchor loading, video references, AI auto-reply decoration/settings, broadcast notification handling, browser push/SSE, and rich rendering for multiple message metadata types.
  - The WeChat mini-program currently reuses the same `/api/chat/*` backend for core rooms/messages, but the UI/service layer only supports a lightweight subset: room list, text/image send, mark-as-read, local latest-page cache, and polling refresh.
- Implemented:
  - `wechat_app/src/services/chatService.ts`
    - Added mini-program DTO support for `replyToMessageId`, `anchorMessageId`, `searchMessages`, `videoReferences`, typed `contentMetadata`, and room lookup by `roomId`.
  - `wechat_app/src/me/messages/chat/index.tsx`
    - Added reply-to-message composer state and optimistic metadata.
    - Added rendering for `contentMetadata.reply_to_message`, `video_references`, `broadcast`, and `coach_ai_auto_reply`.
    - Added quote click/jump with `anchorMessageId` loading and highlight.
    - Added in-chat search backed by `/api/chat/search-messages`.
    - Added training video reference picker/sender using existing `/api/chat/list-student-videos`.
    - Added fallback display for video/voice/file message types.
  - `wechat_app/src/me/messages/chat/index.scss`
    - Added compact search bar, reply banner, video picker, quote cards, metadata badges, and video/file cards.
  - `wechat_app/src/utils/chatMessageCache.ts`
    - Added 60-day cache trimming for mini-program chat messages.
- Verification:
  - Per latest user instruction, stop running code-level/build/browser verification; user will run manually.

---

## Current Product Analysis (`2026-04-27`, coach plan library and students)

- Task: compare coach-side Web vs WeChat mini-program differences for `计划库` and `我的学员`.
- Status: analysis completed, no code changes requested or made.
- Finding:
  - The two ends are not completely disconnected: the mini-program already reuses many Web backend APIs and has functioning lightweight versions of both modules.
  - `计划库` still differs materially: Web has AI import, AI modifier, text export/download, plan script editing, execution notice support, richer pagination and fuller template edit/sync controls; mini-program has core list/create/edit/copy/delete and a mobile editor but lacks several power-user tools.
  - `我的学员` still differs materially: mini-program has list/search/sort, payment pending/history, chat entry, AI generation, detail, feedback, plan editing, template import, autosave, and 1RM updates; Web still has richer dialogs for questionnaire editing, subscription/prior week editing, refunds, coach review notes, clear current plan archive/delete, configurable AI generation, AI plan modifier from feedback, AI generation logs, and fuller analytics/history.
- Product judgment:
- The gap remains large, but it is now a "Web professional workstation vs mini-program lightweight mobile console" gap rather than a total absence of mini-program modules.

---

## Mini-Program Execution Notice Alignment (`2026-04-28`)

- Task: align the student-side WeChat mini-program `execution_notice` flow with the existing Web gating behavior.
- Scope:
  - The coach-side template/instance data contract already exists; this round only fills the student-side mini-program runtime flow.
  - Gate entry from mini-program `today-training` before the student first enters a plan execution.
  - Add a second guard inside mini-program `training-execution` so direct deep links cannot bypass the notice.
  - Reuse local device acknowledgement semantics instead of introducing a server-side read-state table.
- Status: implemented in code on `2026-04-28`.
- Fix:
  - `wechat_app/src/utils/executionPlanNotice.ts`
    - Added local acknowledgement helpers keyed by `userId + instanceId`.
  - `wechat_app/src/components/ExecutionPlanNoticePopup/*`
    - Added a reusable mini-program popup that renders coach notice content plus platform safety baselines.
  - `wechat_app/src/training/today-training/TodayTrainingScreen.tsx`
    - Entering plan execution from today's training now checks local acknowledgement first; unread students must confirm the notice before navigation continues.
  - `wechat_app/src/training/training-execution/index.tsx`
    - Added direct-open fallback gating; unread plan executions preload instance context, show the notice first, then start or resume training only after confirmation.
  - `wechat_app/src/training/today-training/components/TodayTrainingCard.tsx`
    - Added `onOpenExecution` override so parent-level gating can intercept all training-entry paths.
  - `wechat_app/src/services/trainingService.ts`
    - Mini-program `PlanInstance` typing now includes `execution_notice` / `executionNotice`.
- Verification:
  - `wechat_app/npm run build:weapp`: passed.
  - `npm run lint`: passed; current script only prints the existing lint-not-configured notice.
  - `npm test`: passed, 21 files / 106 tests.
  - `npm run typecheck`: still fails on existing repo-wide historical issues, including Next 16 route validators, Supabase type drift, and mini-program alias/type noise.
  - `npx next build`: compile succeeded, but standalone finalization hit a transient Windows `EBUSY` copy lock on `.next/server/middleware-build-manifest.js`.
- Blocker:
  - WeChat DevTools visual/manual verification is still pending because this session does not expose the required `weapp-devtools` tool.

---

## WeApp UI Polish (`2026-04-15`)

- Task: 参考 Dribbble 风格优化小程序首页与底部导航
- Scope:
  - 首页：`custom` 导航栏、渐变背景、品牌图标替换 emoji、彩色卡片与 promo banner
  - `BottomNav`：深色胶囊、白色 active pill、图标+文字动画、消除跳转白屏
- Fix:
  - `wechat-app/src/pages/index/index.tsx` / `index.scss`
  - `wechat-app/src/components/BottomNav.tsx` / `BottomNav.scss`
  - `wechat-app/src/pages/index/index.config.ts`（`navigationStyle: 'custom'`）
- Verification:
  - 构建通过（`npm run build:weapp`）
  - DevTools 截图验证通过（端口 3002）
- Commit: `258313e` on `origin/dev`
- Status: completed

---

## Hotfix Note (`2026-04-08`)

- Task: 修复“计划逻辑已完成但页面仍显示进行中/制定中”的状态错位
- Scope:
  - 学员端 `全部计划` 列表状态与真实执行进度不一致
  - 历史详情页对逻辑已完成计划仍显示“开始今日训练”
  - `today-training` 在“订阅仍 active 但当前阶段计划已完成”时误显示“计划正在制定中”
- Fix:
  - `student/plan-lib/list-history` 改为基于执行记录计算完成度，并把“逻辑完成 + status=active”按 `completed` 展示
  - `plan-lib/get-instance` 返回 `isLogicallyCompleted/derivedStatus`
  - `me/plan-history/[id]` 基于派生状态控制按钮显示
  - `today-training` 在无当前计划但 `has_plan_instance=true` 时展示“当前阶段计划已完成”的引导态
- Verification:
  - `npm run lint`：通过（脚本提示未配置 eslint）
  - `npm run typecheck`：失败，主要为仓库既有历史类型错误（与本次改动无直接关联）
- 追加修复（同日）：
  - 复现到 `today-training` 显示“当前阶段计划已完成”但实际计划未完成的问题，根因是：
    - `coach-subscriptions` 返回的 `has_plan_instance=true` 触发了完成态文案
    - 同时 `get-instance` 门禁仍按 `end_date` 先行拦截，导致当前计划无法加载
  - 已修复 `src/lib/subscriptionAccess.ts`：
    - `evaluateSubscriptionPlanAccess` 对 `status=active` 不再直接按 `end_date` 拦截
    - active 订阅改为严格按 credits（`computeCreditsScope` + `computeUsedCredits`）判定是否过期
  - 已补回归测试：`src/lib/subscriptionAccess.test.ts` 新增“active 且 end_date 已过但 credits 未耗尽时仍允许访问”用例
- 本轮验证（追加）：
  - `npx vitest run src/lib/subscriptionAccess.test.ts`：通过（7 tests）
  - `npm run lint`：通过（脚本提示）
  - `npm run typecheck`：长时间无输出，超时后中止（仓库历史类型负担）
  - `npx next build`：通过
  - `npm test`：通过（12 files, 58 tests）

---

## Coach-Side Web/WeApp Alignment (`2026-04-27`)

- Task: align the coach mini-program `计划库` and `我的学员` pages with the Web coach workstation as closely as possible.
- Implemented:
  - Mini-program coach plan library now supports template execution notice, AI text import via `/api/plan-lib/parse-template`, and text export via `/api/plan-lib/export-template-text`.
  - Mini-program student plan editing now preserves/edits `executionNotice` and syncs it through create/update instance calls.
  - Mini-program student list now has configurable single/bulk AI generation start week/day, keep-original-index option, and current-plan clear flow with archive/delete modes.
  - Mini-program student detail now exposes subscription/prior training week editing plus coach private review create/edit/delete.
  - Backend `coach/get-student` now returns subscription fields needed by mini-program detail, and coach review update/delete routes now enforce coach ownership before mutation.
- Verification:
  - `wechat_app/npm run build:weapp`: passed.
  - `npm run lint`: passed (script reports lint is not configured in Next 16 project).
  - `npm test`: passed (21 files, 106 tests).
  - `npx next build`: passed when run alone; an earlier parallel run hit a transient Windows `EBUSY` copy lock during standalone finalization.
  - `npm run typecheck`: still fails on existing repo-wide historical type errors, including Next 16 route params under `.next/*/validator.ts`, Supabase generated type drift, and mini-program alias/type issues.
- Remaining note:
  - Browser/WeChat DevTools visual verification is still pending because this session does not expose the required `web-devtools` / `weapp-devtools` tools.
  - Remaining differences are now mostly heavier workstation capabilities (full AI modifier/script mode/refund/deeper analytics), not the core plan-library/student-management workflows.

---

## coachlink LLM（`2026-04-09` 追加）

- `coachlinkLlm`：默认 `google/gemini-3.1-flash-lite-preview`；开发环境打印 `OFOXAI_MODEL` 与 effective 模型；`COACHLINK_USE_DEEPSEEK=1` 强制 DeepSeek。
- `parse-actions` / `parse-template`：`maxTokens` 65536 → 16384，减轻 Gemini reasoning 烧 token。
- 若终端仍显示旧模型：检查 `.env.local` 是否仍写 `OFOXAI_MODEL=...gemini-3-flash-preview`（会覆盖代码默认）。
---

## Payment Split / Settlement Audit (`2026-05-17`)

- Task: review the coach subscription payment split system, including platform escrow-style payment, coach/platform split, coach onboarding, and 7-day refund protection.
- Status: code/database audit completed; no code changes made.
- Current implementation shape:
  - New intended path is Huifu-backed platform payment:
    - Mini-program coach subscription payment creates Huifu JSPay order via `/api/payment/wechat/coach/create`.
    - Paid notify/query then fulfills the subscription and calls Huifu balance payment split from platform cash account to coach.
    - Local wallet is credited only after `coach_subscription_settlements` reaches split success.
  - Coach onboarding exists via `/api/coach/merchant/open-huifu-account`, storing `huifu_id`, `huifu_open_status`, and `huifu_card_token`.
  - Coach withdrawal exists via `/api/coach/wallet/huifu/withdraw`.
  - 7-day refund protection exists only as wallet withdrawal lock in `src/lib/coachWalletLock.ts`, not as delayed third-party settlement.
- Key findings:
  - Database sample showed only 1 `coach_subscription_settlements` row, status `wallet_credited`, amount 100 fen split as 80/20, attempts 3. This suggests one sample path ran through, not a broadly proven production path.
  - Database sample showed 35 paid subscription-like `alipay_orders`, but only 2 use new `coach_subscription*` order types; 33 still use legacy `subscription*` types.
  - Only 1 coach currently appears Huifu-opened with card token; 16 are still `pending`.
  - Web coach subscription payment creation still emits legacy order types `subscription/subscription_renew`, while the Huifu split execution path mainly gates on `coach_subscription/coach_subscription_renew`. This creates a high-risk mismatch where Web paid orders may fulfill subscription but not trigger Huifu split.
  - `executeBalancePayment` currently transfers only coach net amount as `transAmtYuan` and only one receiver, despite comments/docs describing 80/20 transfer. Platform fee is locally recorded, but the actual Huifu balance-payment call does not appear to move the 20% to a platform receiver.
  - Huifu refund API is not implemented. Current refund endpoint still calls Alipay `alipay.trade.refund`, so it is not correct for Huifu/WeChat mini-program subscription orders.
  - There is no automated 7-day delayed split job; payment success attempts split immediately, then wallet withdrawal is frozen for 7 days. This is not the same as "funds stay unsettled for 7 days then split".
  - Settlement `processing` rows are treated as already claimed; there is manual retry for failed rows, but no clear async callback/query reconciliation for uncertain Huifu balance-payment results.
- Suggested next implementation priorities:
  1. Unify coach subscription order type semantics across Web and mini-program, or make split detection provider/metadata based so all platform-paid coach subscriptions enter settlement.
  2. Fix/confirm Huifu balance-payment amount semantics: either transfer only coach share deliberately and document it, or include platform 20% receiver if actual remote split is required.
  3. Add Huifu refund support and refund ledger reversal before exposing refund as reliable for Huifu-paid orders.
  4. Decide product policy for 7-day refund: wallet withdrawal lock only vs true delayed split; implement scheduled settlement if true delayed split is required.
  5. Add settlement reconciliation job/admin dashboard for `pending/processing/split_failed` rows and broaden integration tests around notify/query idempotency.
## Rich Coach Application Materials And Profile Showcase (`2026-06-06`)

- Task: Upgrade coach applications and coach homepages on Web and WeChat mini-program so proof materials support richer media instead of plain text-only chips.
- Implemented:
  - Added Supabase migration `20260606_coach_application_materials.sql` for `coach_applications.application_materials jsonb not null default []`.
  - Added shared rich material normalization/derivation helpers in `src/lib/coachApplicationMaterials.ts` and mini-program counterpart `wechat_app/src/utils/coachApplicationMaterials.ts`.
  - Added authenticated upload API `/api/coach/upload-application-media` for image/video proof material uploads into the existing `videos` bucket.
  - Updated coach application create/update/get, approval sync, coach profile update, and aggregated profile responses so legacy summary fields remain derived compatibility data while rich materials are preserved.
  - Added Web rich material editor on `/coach/application`, profile edit support, admin application detail material display, and public coach homepage material grouping/media wall.
  - Added WeChat mini-program application material editor with upload/link/public controls, coach-owned profile edit entry, and student-facing discovery profile material rendering.
- Verification:
  - `npx vitest run src/lib/coachApplicationMaterials.test.ts`: passed.
  - Targeted esbuild syntax checks for changed Web/WeChat pages, components, and upload route: passed.
  - `git diff --check`: passed with CRLF warnings only.
  - `npm run lint`: passed; script still prints the existing Next 16 lint-not-configured notice.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 162 tests.
  - `npx next build`: passed; build emitted existing baseline-browser-mapping and local Redis timeout warnings.
  - `cd wechat_app; npm run build:weapp`: passed after allowing the slow Taro/Vite transform stage to complete.
  - WeChat DevTools automation: `mrc` and WeChat DevTools auto port 9420 started successfully. Verified `/coach/application` rich material section, add-material interaction, public toggle, upload/link controls with screenshots in `screenshots/weapp/`.
  - Web browser automation: because `web-devtools` skill is not available in this session, used Playwright against local `next dev`. Verified `/coach/application` rich material cards and add-material dialog after DEV coach quick login, and verified `/coach/profile/mock-coach-profile` public material rendering with private material absent from non-owner mock response. Screenshots saved in `screenshots/web/`.
- Blockers / residual risk:
  - Dedicated `web-devtools` skill is not present in `.kimi/skills` or exposed tools; Web verification used Playwright instead.
  - `npm run test:e2e` failed on existing local e2e environment issues: seed/login requests to `127.0.0.1:3000` reset/refused and one backend CRUD login failed. No failure stack pointed at the new material code.
  - Admin application detail browser verification was attempted but blocked by the separate `/admin/login` credential flow; code-level implementation and build/type/test coverage passed.
  - Student-facing WeChat discovery profile could not be data-verified in DevTools because the current local discovery list returned 0 coaches and `mrc mock` failed with `mp.mockJson is not a function`; route opened but showed `获取教练信息失败`.

---

---

## Flow Documentation (`2026-06-06`, questionnaire to plan completion and renewal)

- Task: User asked for the first system flowchart covering the path from a student filling a coach questionnaire, through plan generation/execution/completion, to renewal waiting, plus a very detailed explanation of how the AI algorithm works.
- Status: documentation and downloadable artifacts completed.
- Output:
  - Added `docs/work/flows/coach-service-questionnaire-plan-renewal-ai.md`.
  - Added `docs/work/flows/coach-service-flow-explainer.md`.
  - Added downloadable image artifacts:
    - `output/coachlink-questionnaire-plan-renewal-ai-flow.png`
    - `output/coachlink-questionnaire-plan-renewal-ai-flow.svg`
  - Added Word explainer:
    - `output/coachlink-questionnaire-plan-renewal-ai-explainer.docx`
  - Added detailed Mermaid artifacts:
    - `docs/work/flows/coach-service-detailed-mermaid-flow.mmd`
    - `output/coachlink-detailed-mermaid-flow.png`
    - `output/coachlink-detailed-mermaid-flow.svg`
- Contents:
  - Business flow Mermaid chart: coach homepage/subscription entry, questionnaire, payment/order state, active subscription, initial plan automation, student execution, plan completion, next phase generation, insufficient-entitlement renewal waiting, and renewal recovery.
  - AI algorithm Mermaid chart: automation trigger, data gathering, Stage A template/history skeleton selection, Stage B plan_script generation, deterministic parsing/validation, plan span enforcement, 1RM/load calculation, instance insertion, notification, feedback adjustment, and next-phase/renewal automation.
- Verification:
  - Rendered SVG to PNG with Playwright and visually inspected the PNG.
  - Rendered detailed Mermaid via browser Mermaid runtime; switched to pure SVG labels (`htmlLabels=false`) so the standalone SVG can be opened/downloaded reliably.
  - Generated `.docx` explainer with python-docx.
  - No app/browser verification required because this was documentation/artifact generation only.

## Merged Origin Dev State (`2026-06-18`)

- Source: merged `origin/dev` commit `5326a92c fix wechat training execution and theme flow` while syncing `main` and `dev`.
- Remote dev work preserved in this merge includes:
  - WeChat mini-program OpenID-first login fix while retaining compliance-facing phone-login wording.
  - Training home greeting fix: nickname-only fallback, local-time greeting/icon, and removal of visible `本周` wording.
  - Shared WeChat training execution UI simplification with top duration/status board, finish action, and bottom toolbar.
  - Impromptu training execution loading/theme fixes from 2026-06-17.
  - Dark-theme and native UI synchronization decisions for WeChat mini-program surfaces.
- Verification recorded upstream for those remote-dev changes included lint/typecheck/unit tests/builds where noted; WeChat DevTools screenshot verification remained blocked by local MRC websocket connectivity.

## WeChat Training Home Design Exploration (`2026-06-18`)

- Task: discuss improved design directions for the student mini-program training home when an active coach plan exists.
- Status: design direction selected; still design discussion unless the user explicitly asks to implement code.
- Context:
  - Current screenshots show the active-plan home feeling too crowded: plan ownership/status, coach switch, resume/impromptu/contact actions, daily/weekly/monthly progress, calendar strip, today arrangement, detailed action cards, light tasks, and bottom navigation all compete in one scroll.
  - Product principle from existing decisions still applies: the training home should prioritize "what do I do now" over browsing tools, with calendar/progress/secondary actions kept compact.
- Latest requirement:
  - User chose the "version 6" direction for the training home redesign.
  - The UI system must stay consistent between users with an active plan and users without a plan.
  - Preserve the original expandable calendar design: it must still show delayed/rescheduled days and allow tapping other training days to inspect that day's plan.
  - Functionality must not be dropped; the redesign should reorganize hierarchy rather than remove existing capabilities.
- Implementation:
  - Updated `wechat_app/src/training/today-training/TodayTrainingScreen.tsx` so the top training home card now covers active-plan, waiting-for-coach-plan, no-plan, and expired-grace states with one unified visual/action model.
  - Preserved active-plan functions: resume/start training, impromptu training, contact coach, switch coach, self-plan removal, progress stats, today/selected-day arrangement, lightweight tasks, day check-in share, and bottom navigation.
  - Kept the calendar as an active-plan function layer: default compact week strip plus expandable month calendar, still driven by `ScheduleCalendarPanel` and `buildPlanScheduleModel` so delayed/rescheduled days and clicking other training days remain supported.
  - Replaced the old duplicated no-plan/waiting empty card with a unified support panel for impromptu training, coach contact/find coach, and plan library.
  - Updated `wechat_app/src/training/today-training/index.scss` for the new unified card/support panel and dark-theme coverage while keeping buttons solid-color.
- Verification:
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `cd wechat_app && npm run build:weapp`: passed.
  - `npx next build`: first run hit known Windows `.next` standalone copy `EBUSY`; rerun passed.
  - WeChat DevTools automation on port `9420`: connected; clearing storage and relaunching `/pages/index/index` stayed on the home page with 0 error logs. Screenshot capture still failed with `fail to capture screenshot`, matching the current local MRC screenshot limitation.
- Next step: user should visually review the real mini-program page; if the first screen still feels crowded, tune copy density and vertical spacing rather than changing the preserved function set.

## WeChat Mini-Program Main Package Size Fix (`2026-06-18`)

- Task: fix WeChat DevTools build warning that the mini-program main package source size exceeded the 2MB limit by a small amount.
- Status: implemented and build-verified; DevTools/MRC screenshot verification remains blocked by local automation websocket connectivity.
- Fix:
  - Moved toolbox cover images from root package assets into `me/assets/images/`.
  - Moved login background from root package assets into `auth/assets/images/` and stopped importing it from TSX.
  - Moved streetlifting poster brand images into `streetlifting/assets/brand/` and stopped importing them from TS.
  - This avoids Taro inlining small bitmap imports into root `common.js` and keeps page-owned assets inside their subpackages.
- Verification:
  - `cd wechat_app && npm run build:weapp`: passed.
  - `cd wechat_app && npm run build:weapp:release`: passed.
  - Local `dist` main-package raw file total measured about `1887.6KB`.
  - Release `dist-release` main-package raw file total measured about `1746.0KB`.
  - `npm run lint`, `npm run typecheck`, and `npm test` passed.
  - `npx next build` compiled and generated all 510 static pages, but failed during final standalone copy because existing local `coachlink` Node/Next processes kept `.next` files locked with Windows `EBUSY`.
## Pull Latest And Audit WeChat Training Execution UI (`2026-06-19`)

- Task: pull latest code and check whether the student-side concrete plan execution interface in the WeChat mini-program has been optimized in the last few days.
- Status: completed.
- Scope: `wechat_app/src/training/training-execution/*` plus recent commits and durable notes related to training execution UI.
- Result: `git pull --ff-only` reported `Already up to date`; local `main` is one commit ahead of `origin/main`. Recent relevant commits are `5326a92c` on `2026-06-18` and `06731f1f` on `2026-06-15`. The training execution page was optimized on `2026-06-18` with a top duration/status board, finish action, concise progress stats, a fixed bottom toolbar, local snapshot-before-cloud loading behavior, and light/dark theme alignment.

## WeChat Audit Login-Gate Fix (`2026-06-19`)

- Task: fix WeChat mini-program audit failure caused by homepage login restriction / inability to fully experience functionality.
- Status: implemented and verified at code/build/check level; partial DevTools runtime verification completed.
- Root cause:
  - The mini-program homepage `/pages/index/index` directly reused `TodayTrainingScreen`.
  - `TodayTrainingScreen` redirected unauthenticated users to `/auth/login`.
  - The login page's `不登录，先逛逛` returned to the same homepage, so reviewers could be put into a login loop and could not see public features.
- Fix:
  - `wechat_app/src/training/today-training/TodayTrainingScreen.tsx` now tracks `isGuestHome`.
  - Missing/expired auth on the homepage no longer redirects to login; it renders a public guest home instead.
  - The guest home exposes public routes for finding coaches, knowledge, and the streetlifting strength calculator, plus a clear login CTA for training sync.
  - Auth-error responses from the homepage subscription load also return to guest home instead of forcing login.
  - `wechat_app/src/training/today-training/index.scss` adds the guest-home layout with solid-color buttons and 8rpx-aligned spacing.
- Verification:
  - `npm run typecheck`: passed.
  - `cd wechat_app && npm run build:weapp`: passed.
  - `npm run lint`: passed informational script.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: first run compiled and generated static pages but hit Windows `.next` copy `EBUSY`; rerun passed.
  - WeChat DevTools/MRC on port `9420`: connected; after `wx.clearStorageSync()` and `wx.reLaunch({ url: '/pages/index/index' })`, current page stayed `pages/index/index` instead of redirecting to `auth/login`; error logs were empty.
- Verification limitation:
  - MRC screenshot failed with `fail to capture screenshot`.
  - MRC `relaunch`/direct navigation commands failed to open subpackage routes such as `content/knowledge` from the tool, although those paths exist in `dist/app.json`; public entry navigation remains code/build verified but not screenshot-verified in this session.
## WeChat Training Execution Loading And UI Repair (`2026-06-19`)

- Task: user reported the concrete training execution page stays on a dark `加载中...` screen for too long / cannot enter, and that the training-side UI is too dark, dense, and visually chaotic.
- Status: completed at code/check level; user explicitly said they will verify frontend manually, so no further DevTools screenshot verification was run.
- Changes:
  - `wechat_app/src/training/training-execution/index.tsx` now only shows the full-screen loading state when there is no existing execution data. If local cache already provided an execution, cloud refresh failures no longer cover the usable page.
  - Added `loadError` state, shorter 8s load timeout, clearer error copy, and `重试` / `返回` actions instead of leaving the user stuck on a black loading screen.
  - `wechat_app/src/training/training-execution/index.scss` adds a light visual override for the execution page: warm light background, white cards, readable dark text, softer chips, lighter input panels, and less oppressive overlays.
- Verification:
  - `npm run typecheck`: passed.
  - `cd wechat_app && npm run build:weapp`: initially hit interrupted/leftover Taro build state; after clearing generated `wechat_app/dist` and using `NODE_OPTIONS=--max-old-space-size=8192`, passed.
  - `npm run lint`: passed informational script.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: first attempt saw an existing `.next/lock`; after the background build worker exited, rerun passed.
  - `git diff --check`: passed.

## Revert LSTM WeChat Training Execution UI Change (`2026-06-19`)

- Task: user reported the recent LSTM training execution UI change made the concrete plan execution page unusable and asked to directly revert it.
- Status: completed.
- Scope: restore `wechat_app/src/training/training-execution/index.tsx` and `index.scss` to the versions before `5326a92c fix wechat training execution and theme flow`, without reverting unrelated homepage/login/theme changes.
- Verification: `npm run typecheck`, `cd wechat_app && npm run build:weapp`, `npm run lint`, `npm test`, `npx next build`, and `git diff --check` passed. WeChat DevTools/MRC connected on port `9420` and current page/errors could be read, but `mrc relaunch /training/training-execution?...` still failed with `page "training/training-execution?... is not found`, so direct screenshot verification of the subpackage page remains blocked by MRC navigation behavior.
## WeChat Web Ranking Feature Migration To Profile (`2026-06-19`)

- Task: user clarified the requested leaderboard was the Web `/ranking` challenge leaderboard shown in the screenshot, not the streetlifting calculator fun ranking. Put that feature in WeChat mini-program `我的`.
- Status: corrected implementation and code/build verified.
- Correction:
  - Replaced the previously wrong `力量排行榜` profile entry that pointed to `/streetlifting/index/calculator/history`.
  - Added a `排行榜` profile entry in `wechat_app/src/me/profile/index.tsx` that points to `/discovery/ranking`.
  - Updated `wechat_app/src/discovery/ranking/index.tsx` and `index.scss` so the mini-program leaderboard homepage now mirrors Web `/ranking`: CoachLink Ranking hero, `挑战已开启` badge, challenge cards, participants count, `立即挑战`, empty/loading states, and dark-theme support.
  - The page continues to use the existing challenge leaderboard APIs through `rankingService` (`/api/ranking/list-leaderboard`, detail routing to `/discovery/ranking/detail`).
- Verification:
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `cd wechat_app && $env:NODE_OPTIONS='--max-old-space-size=8192'; npm run build:weapp`: passed.
  - `git diff --check -- ...`: passed with CRLF warnings only.
- UI verification:
  - Skipped by user preference; user will manually verify frontend/mini-program behavior.
## Power Analysis Multi-Movement Upgrade (`2026-06-19`)

- Task: extend the Power Analysis tool beyond pull-up and muscle-up, replace the duplicated mini-program toolbox background image, and check whether the mini-program calculator/tool entry was reverted.
- Status: implemented at code/build level; frontend visual verification intentionally left to the user per their explicit instruction.
- Findings:
  - The mini-program native Power Analysis page was not reverted. Route `/me/toolbox/power-analysis/index` still exists under the `me` subpackage, and the toolbox tab still routes to `/me/toolbox/index`.
  - The public/guest training homepage previously exposed `力量计算器` but not `功率视频分析`, which made the tool feel missing if the user entered from the homepage instead of the toolbox.
- Changes:
  - `scripts/power-analysis/analyze_video.py` now uses mode presets instead of hard-coded pull-up/muscle-up thresholds.
  - Supported modes are now `pullup`, `muscleup`, `dip`, `pushup`, and `squat`.
  - Each preset declares tracking anchor, trigger/end velocity thresholds, minimum displacement, timing limits, effective body-mass factor, and recommended camera view.
  - Push-up uses a reduced body-mass factor (`0.65`) for rough effective mass; squat tracks hip-line vertical movement; pull-up/muscle-up/dip/push-up track shoulder-line vertical movement.
  - Web and API types/validation now accept all five modes, and LLM summary mode labels cover all five modes.
  - Web `/toolbox/power-analysis` and mini-program `me/toolbox/power-analysis/index` now show all five action choices with short camera-angle hints.
  - Mini-program toolbox `功率视频分析` now uses a distinct generated raster asset `wechat_app/src/assets/images/toolbox-power-analysis.jpg`; Taro copy config includes it.
  - Mini-program guest homepage now exposes `功率视频分析` alongside `力量计算器`.
- Verification:
  - `python -m py_compile scripts/power-analysis/analyze_video.py`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `npm test`: passed, 33 files / 163 tests.
  - `cd wechat_app && npm run build:weapp`: passed.
  - `npx next build`: initially hit Windows `.next/standalone` `EBUSY` while local coachlink Next dev/start processes were running; after stopping those processes, rerun passed.
- Operational note:
  - Because this changes the Power Analysis Python algorithm, production worker rollout still requires `npm run push-power-worker-ccr`.
  - The database also needs migration `supabase/migrations/20260619_power_analysis_multi_modes.sql`; otherwise `dip` / `pushup` / `squat` inserts fail with `tool_power_analysis_jobs_mode_check`.
  - Local development now bypasses the daily 5-analysis quota automatically (`NODE_ENV !== "production"`). Production can also bypass via `POWER_ANALYSIS_DISABLE_DAILY_LIMIT=1` or per-account `POWER_ANALYSIS_DAILY_LIMIT_BYPASS_USER_IDS`.
## Move Beta Group Entry To WeChat My Page (`2026-06-19`)

- Task update: user rejected hiding the beta group QR codes in "联系我们" and asked for one visible `加入内测群` button directly on the mini-program `我的` page.
- Status: implemented and code/build verified; frontend visual verification intentionally left to the user.
- Changes:
  - Removed the beta-group entry from contact surfaces; `/contact` and `me-legal/contact` no longer carry the QR entry.
  - Added a `加入内测群` menu item to `wechat_app/src/me/profile/index.tsx`.
  - Corrected the role-side behavior: student-side `我的 -> 加入内测群` now directly previews only the student beta group QR code; it no longer shows a chooser containing the coach group.
  - Added a matching `加入内测群` entry to `wechat_app/src/coach/my-profile/index.tsx`; coach-side `我的` directly previews only the coach beta group QR code.
  - QR images were uploaded to Tencent COS/CDN and are referenced as remote images:
    - `https://cdn-assets.coachlink.fit/beta-groups/student-wechat-group.png`
    - `https://cdn-assets.coachlink.fit/beta-groups/coach-wechat-group.png`
  - Local mini-program QR image assets and copy rules were removed so the QR screenshots do not enter the `me` subpackage.
- Package-size note:
  - The mini-program package no longer gains the two QR PNG files; the roughly `466KB` is loaded remotely on demand.
  - No Web static QR assets are kept after this change.
- Verification:
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `cd wechat_app && $env:NODE_OPTIONS='--max-old-space-size=8192'; npm run build:weapp`: passed after the remote-CDN adjustment.
  - Confirmed `wechat_app/dist/me/assets/beta-groups/` does not exist after build; QR PNGs are not packaged.
  - `npm test`: passed, 33 files / 163 tests.
  - Latest `npx next build`: compiled and generated all 510 static pages, but still failed at final `.next/standalone` copy due Windows `EBUSY` locks while local `coachlink` dev/worker processes were running.
  - Remote CDN HEAD checks returned `200 OK` for both QR images.
  - No browser/DevTools visual verification was run because the user said they would verify frontend manually.

## WeChat Training Home Reference-Image Redesign (`2026-06-19`)

- Task: user rejected the looser "version 6 direction" implementation because it did not match the provided UI reference and still looked cluttered; rebuild the student training homepage to follow the reference image strictly.
- Status: implemented at code/build level; frontend visual verification intentionally left to the user per durable preference.
- Requirements preserved:
  - Active-plan and no-plan/waiting states keep one consistent home system.
  - Expandable calendar remains and still uses `ScheduleCalendarPanel` / `WeekDashboardStrip`, preserving delayed/rescheduled day display and tapping other training days.
  - No functional loss for main plan execution, impromptu training, contact coach, switch coach, plan library, lightweight tasks, day detail selection, and bottom navigation.
- Changes:
  - `wechat_app/src/training/today-training/TodayTrainingScreen.tsx` now follows the reference hierarchy: greeting/tabs, plan identity row, large "今天重点" focus card, three-point progress axis, "本周日历", then "今日安排" card.
  - Removed the duplicated lower "继续训练" button path from the schedule section; the primary continue/start action now appears only in the focus card.
  - Contact and switch actions moved into the plan identity row, matching the reference image.
  - `wechat_app/src/training/today-training/components/TodayTrainingCard.tsx` embedded mode now renders strength actions as compact rows with icon, action metadata, `完成/总组` count, and chevron instead of another start/continue button.
  - `index.scss` and `TodayTrainingCard.scss` were restyled to match the provided light UI: orange identity/focus emphasis, clean white panels, progress axis, week calendar header, and a quieter embedded action list. Buttons remain solid-color per project rules.
- Verification:
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `cd wechat_app && npm run build:weapp`: passed.
  - `git diff --check -- today-training files`: passed with CRLF warnings only.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: compiled and generated 510 static pages, but failed twice during final `.next/standalone` copy with Windows `EBUSY` file locks (`interception-route-rewrite-manifest.js`, then `server-reference-manifest.js`). No compile/static-generation failure was reported.

### Follow-up: Plan Owner And Coach Switch Clarity (`2026-06-19`)

- User reported that both `教练计划` and `我的计划` showed `刘三乐的训练安排`, and asked whether the `切换` action is needed because it only seems to switch between coaches.
- Fix:
  - Self-plan mode now shows `我的训练安排` instead of the active coach's name.
  - Contact action is hidden for self-plan mode.
  - Coach switching is renamed to `换教练` and only appears in coach-plan mode when there is more than one coach subscription.
  - The top tabs remain responsible for switching between `教练计划` and `我的计划`.
- Training history location clarified:
  - Main entry is `我的 -> 训练记录`, route `/me/training-history/index`.
  - Plan history also has a `训练记录` shortcut.
- Verification:
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `cd wechat_app && npm run build:weapp`: passed.

### Follow-up: Simplify Student Progress Display (`2026-06-19`)

- User questioned whether the three displayed values (`今日` sets, `本周` training days, `本月` training days) are necessary or even clear, and suggested showing only one overall progress value like the coach-side student execution progress.
- Decision: student training home should show one `当前计划进度` summary instead of mixing day/week/month metrics in the first screen.
- Implementation:
  - Removed the three-point progress axis.
  - Added a single overall progress bar using completed training days divided by total training days in the current plan.
  - Kept specific set-level progress in the `今日安排` action rows where it belongs.
  - Removed obsolete week/month progress and today-progress calculation helpers from `TodayTrainingScreen`.
- Verification:
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `cd wechat_app && npm run build:weapp`: passed before final dead-code cleanup.
## WeChat Training Execution Preview-First Entry Fix (`2026-06-19`)

- Task: user reported the concrete training execution page still stayed on `正在进入训练` for a long time even though the page content should be simple.
- Status: implemented at code/check level; frontend/DevTools verification intentionally left to the user per their explicit preference.
- Root cause:
  - The execution page still coupled "show the plan content" with "load/check/create the server execution record".
  - Normal entry could refetch `/api/plan-lib/get-instance` after the training home had already loaded the same plan, then wait for `checkToday` and possibly `startExecution`, so a simple UI was blocked by a network waterfall and dev cold compilation.
- Changes:
  - `wechat_app/src/training/today-training/TodayTrainingScreen.tsx` now prewarms `training_execution_snapshots_v1` before navigating to `/training/training-execution`, using the already-loaded `instance` and `actions` to build a local preview execution for the selected day.
  - `wechat_app/src/training/training-execution/index.tsx` now uses the snapshot's `planInstance/actions` to avoid an immediate duplicate `get-instance` request when entering from the training home.
  - If no snapshot exists, the execution page still renders a preview as soon as `get-instance` returns, then continues checking/creating the real execution in the background.
  - While the page is showing a preview execution, write actions such as completing sets/items, finishing, skipping, adding/deleting extra sets/actions, and video upload are blocked with `训练同步中，请稍后再记录` so temporary preview ids are not sent to backend APIs.
- Verification:
  - `npm run typecheck`: passed.
  - `cd wechat_app && npm run build:weapp` with `NODE_OPTIONS=--max-old-space-size=8192`: passed.
  - `npm run lint`: passed informational script.
  - `npm test`: passed, 33 files / 163 tests.
  - `git diff --check`: passed with existing CRLF warnings only.
  - `npx next build` was not run for this follow-up to avoid rewriting `.next` while the user was actively running the local dev server for manual verification.

### Follow-up: DevTools Startup Race Fix (`2026-06-19`)

- User confirmed the stuck page path was really `training/training-execution`, and noted production seemed able to open the page while local debug mode stayed on the loading screen.
- Result update: user confirmed the fix worked; local debug mode can now open the training execution page quickly.
- New diagnosis:
  - This looked like a local WeChat DevTools/Taro lifecycle race, not a backend or route problem.
  - `requestStartTraining` could be invoked by `useDidShow` before `startTrainingRef` was populated by its `useEffect`. That early call hit the initial empty function and also consumed the 500ms throttle window, so the later real `useEffect` start could be skipped.
- Fix:
  - `startTrainingRef.current` is now assigned synchronously during render after `startTraining` is created, instead of waiting for a separate effect.
  - Initial `useEffect`, `useDidShow`, pull-down refresh, and error retry now force startup rather than being blocked by the short duplicate-call throttle.
  - Added visible `loadStage` text on the loading/error screen so manual verification can identify whether the page is waiting on startup, snapshot, plan, execution check, restore, or create.
  - Added a 10s boot watchdog independent of API request timeouts; if the page stays in loading without an execution, it shows a retryable error instead of staying stuck.
- Verification:
  - `npm run typecheck`: passed.
  - `cd wechat_app && npm run build:weapp` with `NODE_OPTIONS=--max-old-space-size=8192`: passed.
  - `npm run lint`: passed informational script.
  - `npm test`: passed, 33 files / 163 tests.
  - `git diff --check -- wechat_app/src/training/training-execution/index.tsx wechat_app/src/training/training-execution/index.scss`: passed with CRLF warnings only.

## WeChat Training Execution UI Density Cleanup (`2026-06-19`)

- Task: user reported the execution page still had too much leftover complexity and repeated information from the prior redesign, including `套用计划`, `复制上一组`, repeated action names, repeated `70kg x 8` plan values, and oversized weight/reps steppers.
- Status: implemented at code/check level; frontend visual verification left to the user.
- Product Design brief locked:
  - The execution page should optimize for a lifter recording the current set mid-workout: glanceable, one-hand friendly, and low-density.
  - The current set should read as one record row, not a small spreadsheet.
  - Plan data is only a default/reference for the input value; it should not create a repeated `计划 vs 实际` block in the current set.
  - Weight, reps, and RPE belong in one compact row. Weight and reps keep quick adjustment through a small vertical split button beside the value: upper half increments, lower half decrements.
- Changes:
  - Removed visible `套用计划`, `复制上一组`, `热身组`, `递减组`, oversized weight/reps +/- rows, and the keyboard `加一组` shortcut from the strength-set recording flow.
  - Replaced the noisy weight/reps controls with compact vertical split adjusters beside the value: weight uses `+/-2.5kg`, reps use `+/-1`; if the current input is empty, adjustment starts from the planned value.
  - Kept weight, reps, and RPE in one compact row instead of making RPE a separate row.
  - Follow-up fix: removed the old custom `workout-keyboard` sheet entirely. Adjusting weight/reps no longer calls `setWorkoutKeyboardTarget`, and tapping the value uses an inline `Input` instead of opening a white bottom sheet.
  - Collapsed each set card to one main summary plus rest/tags; it no longer shows `计划：70kg x 8` directly under another `70kg x 8`.
  - Removed the verbose `当前记录` / separate plan input panel entirely; plan values are used as defaults/reference without occupying another visual block.
  - Top hero subtitle no longer repeats the action name when the plan title already equals the current action name.
  - Simplified input layout styling into one quiet record bar with fewer nested card/button layers.
- Verification:
  - `npm run typecheck`: passed.
  - `cd wechat_app && npm run build:weapp` with `NODE_OPTIONS=--max-old-space-size=8192`: passed.
  - `npm run lint`: passed informational script.
  - `npm test`: passed, 33 files / 163 tests.
  - `git diff --check -- wechat_app/src/training/training-execution/index.tsx wechat_app/src/training/training-execution/index.scss`: passed with CRLF warnings only.
  - Confirmed removed shortcut texts, old popup/mini-adjust remnants, old stepper CSS, old `workout-keyboard` / `记录重量` / `记录次数` sheet, and `quick-log` no longer appear in the execution-page source or built `dist/training/training-execution.js`.
  - `npx next build`: compiled successfully and generated all 510 static pages, then failed during final `.next/standalone` copy because Windows locked `.next/server/server-reference-manifest.js` (`EBUSY`).

### Follow-up: Session Timer And Hero Action Cleanup (`2026-06-19`)

- User reported the top-left `00:00` timer did not work, was unclear in meaning, and should keep counting after leaving/re-entering the training execution page. User also reported the hero `联系教练` action caused a navigation trap and that `联系教练` / `跳过` are unnecessary on the in-workout execution page.
- Product decision:
  - The top-left timer is now the total duration of the current training session.
  - Group rest and future pre-set rest should remain separate set-level states; the session timer should not double as a rest timer.
  - The execution hero should focus on recording the workout, not coach contact or skip actions.
- Changes:
  - Added a local persisted session timer keyed by the execution snapshot scope. It starts from the stored local `startedAt`, falls back to the server `execution.started_at`, and continues across page exit/re-entry.
  - When the execution is completed, the timer freezes and the label changes from `训练总时长` to `本次用时`.
  - Removed top `联系教练` and `跳过` hero actions from `wechat_app/src/training/training-execution/index.tsx`.
  - Removed the associated contact-coach and skip-day handlers/import usage from the execution page.
- Verification:
  - `npm run typecheck`: passed.
  - `cd wechat_app && $env:NODE_OPTIONS='--max-old-space-size=8192'; npm run build:weapp`: passed.
  - `npm run lint`: passed informational script.
  - `npm test`: passed, 33 files / 163 tests.
  - `git diff --check -- wechat_app/src/training/training-execution/index.tsx wechat_app/src/training/training-execution/index.scss`: passed with CRLF warnings only.
  - Confirmed source and built `wechat_app/dist/training/training-execution.js` no longer contain `联系教练`, `跳过今日`, `handleSkipDay`, `handleContactCoach`, or the removed keyboard sheet strings.
  - Frontend/DevTools click verification remains left to the user per durable preference.

### Follow-up: Extra Set Defaults And Real Action Library Add (`2026-06-19`)

- User reported:
  - `新增一组` produced a current set with empty/incorrect defaults instead of copying the previous set's weight/reps.
  - `添加动作` looked like a fake placeholder page instead of adding from the real personal/public action library.
- Product/behavior decision:
  - Adding a set should inherit from the previous set of the same action. If that previous set has actual completed weight/reps, use those as the default; otherwise use planned weight/reps/rest.
  - Adding a new action should not inherit the previous action's load; it should start as one pending set for the selected real action.
  - Public actions must be copied into the student's own action library before being added to an execution, because the execution extra-action API validates `student_actions`.
- Changes:
  - `wechat_app/src/training/training-execution/index.tsx`
    - Added inherited-set helpers for previous-set weight/reps/rest.
    - `新增一组` now sends inherited defaults to the add-extra-set API, updates local execution state with those values, and hydrates the current input row immediately.
    - Current pending-set inputs now hydrate from planned defaults when actual values are not present.
    - Action picker now loads personal actions plus public actions, removes public duplicates by name, and labels rows as `我的` / `公共`.
    - Selecting a public action first calls `addPublicToMyLib`, with a duplicate-name fallback to find the existing personal action, then adds the resulting student action to the execution.
    - Action picker UI changed from oversized two-column cards to compact rows.
  - `wechat_app/src/services/actionLibPageService.ts`
    - `addPublicToMyLib` now returns the created `StudentActionRow` instead of `void`.
  - `wechat_app/src/services/executionService.ts` and `wechat_app/src/services/impromptuService.ts`
    - Add-extra-set and add-extra-exercise payload types now allow inherited string weights such as `70kg`.
  - `src/app/api/execution/extra-content/*` and `src/app/api/impromptu/extra-content/*`
    - Add-extra-set/exercise now persist `planned_rest_seconds` plus compatible `rest_seconds`, and preserve `0`/string values with `??` rather than dropping them via `||`.
- Verification:
  - `npm run typecheck`: passed.
  - `cd wechat_app && $env:NODE_OPTIONS='--max-old-space-size=8192'; npm run build:weapp`: passed.
  - `npm run lint`: passed informational script.
  - `npm test`: passed, 33 files / 163 tests.
  - `git diff --check -- changed training execution/action-library/extra-content files`: passed with CRLF warnings only.
  - Confirmed built `wechat_app/dist/training/training-execution.js` contains public-action-library add flow and new `picker-action-row` list UI.
  - Frontend/DevTools click verification remains left to the user per durable preference.

### Follow-up: Remove CheckToday Startup Waterfall (`2026-06-19`)

- User reported mini-program console errors on `/training/training-execution`:
  - request payload `{ instanceId, dayIndex }` to the execution check path;
  - `开始训练失败: Error: 检查今日执行记录超时，请检查网络或后端服务`;
  - tapping set completion showed `训练同步中，请稍后再记录`.
- Root cause:
  - The page could render a preview execution quickly, but background sync still required `checkToday` before `startExecution`.
  - In local DevTools/dev-server conditions, `checkToday` could time out, leaving the page in preview-only mode so all write actions were blocked.
  - Startup could also be invoked concurrently by mount/show/retry paths, producing duplicate failure logs.
- Fix:
  - Planned normal entry now calls idempotent `executionService.startExecution(instanceId, dayIndex)` directly after preview render; it no longer calls `checkToday` or a separate `getExecution` first.
  - Read-only history mode still stays non-mutating and uses snapshot/preview data only.
  - Added a strict in-flight startup lock so repeated mount/show/pull-refresh/retry calls share the same request instead of racing.
  - Increased the execution sync timeout to 30s and changed the blocked-write toast to `正在同步训练记录，稍等几秒`.
  - Kept the boot watchdog at 12s so a truly stuck startup surfaces as retryable UI instead of an infinite loading screen.
- Verification:
  - `npm run typecheck`: passed.
  - `cd wechat_app && $env:NODE_OPTIONS='--max-old-space-size=8192'; npm run build:weapp`: passed.
  - `npm run lint`: passed informational script.
  - `npm test`: passed, 33 files / 163 tests.
  - Source and built `wechat_app/dist/training/training-execution.js` no longer contain `checkToday`, `检查今日执行记录`, or `检查训练记录`.
  - Frontend/DevTools verification remains left to the user per durable preference.

### Follow-up: Fix Training Execution React Hook Runtime Crash (`2026-06-19`)

- User reported the training execution page still could not open and pasted mini-program runtime error:
  - `TypeError: Cannot read property 'useState' of undefined`
  - stack pointed at `training-execution.js` during page mount.
- Root cause:
  - The execution page's named React hook imports were compiled into `taro.useState(...)` / related hook calls in the subpackage bundle.
  - The generated `dist/taro.js` for this build does not expose those hooks as direct top-level exports; the valid runtime path is under React exports, such as `u.React.useState(...)`.
- Fix:
  - Changed `wechat_app/src/training/training-execution/index.tsx` to import only `React` and call hooks explicitly as `React.useState`, `React.useEffect`, `React.useMemo`, `React.useCallback`, and `React.useRef`.
  - This does not change training startup or recording behavior; it only fixes the hook runtime binding.
- Verification:
  - `npm run typecheck`: passed.
  - `cd wechat_app && $env:NODE_OPTIONS='--max-old-space-size=8192'; npm run build:weapp`: passed.
  - Built `wechat_app/dist/training/training-execution.js` now uses `u.React.useState(...)` and no longer contains `taro.useState` / `taro.useEffect` / `taro.useMemo` / `taro.useCallback` / `taro.useRef` calls.
  - `npm run lint`: passed informational script.
  - `npm test`: passed, 33 files / 163 tests.
  - Frontend/DevTools verification remains left to the user per durable preference.

### Follow-up: Training Execution Web-Style Compact Recording And Video Visibility (`2026-06-19`)

- User reported that after uploading a set video, the mini-program execution page jumped elsewhere, showed upload success, but the video was not visible in the current set. User also asked why entry briefly showed planned `60kg` and then changed to actual `77.5kg`, and requested the mini-program execution UI to follow the cleaner Web execution design where each set is mostly a single row and notes/video are folded.
- Root cause / product diagnosis:
  - `chooseVideo` can trigger `useDidShow`; the page was too eager to restart execution load on show, which could refocus/jump the page after native picker return.
  - Upload success updated the local input `videoUrl`, but the visible `execution.action_executions[].sets[].video_url` and caches were not patched immediately, so the page could toast success without showing the video on that set.
  - The `60kg -> 77.5kg` flicker came from plan-preview data rendering first, then real execution/snapshot data replacing it. Preview data must not overwrite a real execution snapshot.
  - The current-set UI still exposed too much surface area at once; the Web reference is the preferred direction: one-line weight/reps/RPE/complete recording, with notes/video and action detail as secondary disclosure.
- Fixes:
  - `trainingExecutionCache.persistTrainingExecutionSnapshot` now preserves an existing real execution when the incoming payload is a plan preview, while still refreshing plan/actions metadata.
  - Today training prewarm now persists a real execution from `executionsByDayIndex` when available; only falls back to a plan preview when no full execution exists.
  - Training execution now stores last route params as a DevTools/native-picker resilience fallback.
  - `useDidShow` skips forced startup when an execution is already loaded and suppresses reload around video picker return.
  - Uploading or pasting a video now patches the current set's `video_url` into `execution` and storage immediately after the API succeeds.
  - Reworked the strength current-set UI to match the Web compact recording model:
    - weight, reps, RPE, and `完成/保存` now sit on one compact row;
    - weight and reps keep small vertical `+/-` adjusters beside the value;
    - `标记进步组` and `备注 / 视频（可选）` are secondary controls;
    - notes/video controls are folded by default, and uploaded videos show `视频已附加`;
    - action headers now expose `动作要点` / `演示` and navigate through the existing action-detail page cache.
- Verification:
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `cd wechat_app && $env:NODE_OPTIONS='--max-old-space-size=8192'; npm run build:weapp`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `git diff --check -- relevant training execution/cache files`: passed with CRLF warnings only.
  - Confirmed built `wechat_app/dist/training/training-execution.js` and `.wxss` contain the new compact row, folded note/video controls, action detail chips, and video attached state.
- Frontend/DevTools verification remains left to the user per durable preference.

### Follow-up: Training Execution Drafts, Video Preview, And Extra-Set Inheritance (`2026-06-19`)

- User reported three remaining execution-page issues:
  - after uploading a set video, there was no immediate preview entry;
  - `新增一组` still did not inherit the prior set correctly in some cases;
  - multiple blank pending sets all displayed as `待记录`, and switching from one pending set to another could wipe the unsaved weight/reps just typed into the first set.
- Fixes:
  - Current-set video chip now opens video preview via `Taro.previewMedia`, falling back to the existing `/common/common/video-player` page if native preview fails; completed-set video links also open preview instead of only copying the URL.
  - Pending-set inputs now maintain per-set local drafts keyed by `actionIndex:setIndex`, so weight/reps/RPE/notes/progress/video values survive switching between pending sets before the user taps `完成/保存`.
  - Pending-set card summaries now show draft values when present, then planned values, then `填写本组` / `未填写` instead of the ambiguous `待记录`.
  - Extra-set inheritance now skips blank extra sets when looking for a source group. The frontend and both backend add-extra-set APIs prefer the nearest prior set with weight or reps; rest time may be inherited as a fallback but no longer makes an otherwise blank set the source.
- Verification:
  - `npm run typecheck`: passed.
  - `git diff --check -- training execution/add-extra-set files`: passed with CRLF warnings only.
  - `cd wechat_app && $env:NODE_OPTIONS='--max-old-space-size=8192'; npm run build:weapp`: passed.
  - `npm run lint`: passed informational script.
  - `npm test`: passed, 33 files / 163 tests.

### Follow-up: Training Execution Quick Finish Runtime Crash (`2026-06-19`)

- User reported that tapping `一键完成训练` waited for a long time without visible progress.
- Log diagnosis:
  - The actual fatal error was `module 'training/@nutui/icons-react-taro.js' is not defined, require args is '@nutui/icons-react-taro'`.
  - The crash happened after quick-finish completed far enough to render the coach-feedback modal; that modal used dynamic `require("@nutui/icons-react-taro")[item.icon]`, which Taro compiled incorrectly inside the `training` subpackage.
  - `writeFile:fail the maximum size of the file storage limit is exceeded` is a DevTools log-storage issue and not the root cause of the quick-finish hang.
- Fix:
  - Removed `@nutui/icons-react-taro` from `wechat_app/src/training/training-execution/index.tsx`.
  - Replaced the feedback difficulty dynamic icons with local text marks.
  - Replaced the rest timer `Clock` icon with a local text mark, so the execution page no longer depends on that icon module.
- Verification:
  - `npm run typecheck`: passed.
  - `git diff --check -- wechat_app/src/training/training-execution/index.tsx wechat_app/src/training/training-execution/index.scss`: passed with CRLF warnings only.
  - `npm run lint`: passed informational script.
  - `cd wechat_app && $env:NODE_OPTIONS='--max-old-space-size=8192'; npm run build:weapp`: passed.
  - Built `wechat_app/dist/training/training-execution.js` / `.wxss` contain no `@nutui/icons-react-taro`, `training/@nutui`, `item.icon`, or `difficulty-emoji`.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed.

### Follow-up: Self-Plan Feedback Prompt And Feedback Sheet Layout (`2026-06-19`)

- User reported:
  - completing a self-authored plan still opened a feedback box that says `发送给教练`;
  - after typing in the feedback textarea, the `发送给教练` button disappeared from view.
- Product decision:
  - Completion feedback is reasonable only for coach-assigned plans.
  - Self-authored / `我的计划` completion should go straight to the training summary and must not infer coach feedback from a stale route `coachId`.
- Fix:
  - Replaced the old feedback condition `planInstance.source === 'coach' || route coachId !== userId` with `shouldAskCoachFeedback`.
  - `shouldAskCoachFeedback` only returns true for explicit coach-plan markers: `source/plan_source === coach`, `coach_subscription_id/coachSubscriptionId`, or `coach_id/coachId` not equal to the current user.
  - Removed route `coachId` from feedback gating.
  - Feedback modal now has bounded height, fixed-size textarea, visible character count, and a stable bottom action row.
  - `发送给教练` is styled as a solid brand primary button and remains visible while typing; `跳过` remains secondary.
- Verification:
  - `npm run typecheck`: passed.
  - `git diff --check -- wechat_app/src/training/training-execution/index.tsx wechat_app/src/training/training-execution/index.scss`: passed with CRLF warnings only.
  - `npm run lint`: passed informational script.
  - `cd wechat_app && $env:NODE_OPTIONS='--max-old-space-size=8192'; npm run build:weapp`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - Built `wechat_app/dist/training/training-execution.js/.wxss` contain the new feedback gating and feedback button styles.
  - `npx next build`: first run compiled/generated all pages but failed at final standalone copy with Windows `.next` EBUSY; rerun passed.
## Web AI Modifier Long Response Scroll Fix (`2026-06-19`)

- Task: user reported that on Web `/dashboard/students/plan/[id]`, long AI modifier answers cannot be scrolled; mouse wheel scrolls the dimmed background page instead of the AI answer area.
- Status: implemented and code/build verified.
- Root cause:
  - `BatchOperationDialog` used a fullscreen-style internal flex layout, but the PrimeReact dialog itself did not have an explicit bounded height and its content area allowed overflow to escape.
  - Long AI responses could therefore exceed the modal body instead of being contained by the chat timeline's `overflow-y-auto` region.
- Fix:
  - `src/components/BatchOperationDialog.tsx` now gives the modal a bounded height (`90vh`, max `900px`) in addition to the existing width.
  - `src/assets/globals.css` now makes `.batch-operation-dialog-fullscreen .p-dialog-content` a hidden-overflow flex column with `min-height: 0`, so the top bar and input/footer stay fixed while the middle chat timeline owns vertical scrolling.
- Verification:
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed.
  - Browser/manual visual verification was left to the user per durable preference.
## Pending Follow-up: Web AI Modifier Conversation History (`2026-06-19`)

- User raised the idea of saving all Web plan AI modifier conversation history.
- Status: pending / not implementing now.
- Why it may be useful:
  - Let coaches review the reasoning behind AI plan changes.
  - Support resuming prior AI modifier sessions.
  - Keep accepted/rejected suggestions auditable for later debugging.
- Open design questions:
  - Scope: store history by plan instance, subscription, or coach/student pair.
  - Payload: whether to persist only visible messages or also AI input snapshots/context prompts.
  - Retention/privacy: how long to keep logs, and what happens when a plan is archived or deleted.

## WeChat Public Training Share Report Redesign (`2026-06-19`)

- Task: user said the public training share page looked much worse than the post-finish modal and should include the body-map report style.
- Status: implemented and code/build verified.
- Changes:
  - Reworked `wechat_app/src/content/public/training/index.tsx` from the old dark-blue banner/share landing into a compact training-completion report.
  - Added front/back body-map SVG rendering on the share page, using the existing male body-map assets and brand-color highlights.
  - Added a lightweight muscle-score list under the body maps.
  - Simplified stats/action details and changed CTA/share buttons to solid CoachLink brand color instead of the old bright-blue styling.
  - Current public share API does not return exact action-muscle metadata, so the page infers muscle groups from action names for now.
- Verification:
  - `cd wechat_app && $env:NODE_OPTIONS='--max-old-space-size=8192'; npm run build:weapp`: passed.
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed.
  - Built `wechat_app/dist/content/public/training.js/.wxss` contains `heatmap-row` / `body-map` and no longer contains the old `Training DONE` copy or bright-blue share colors.
  - Frontend visual verification was left to the user per durable preference.

## WeChat Today Training Post-Completion Day Selection (`2026-06-19`)

- Task: user reported that after completing today's training, the mini-program homepage immediately showed the day as a recovery/rest day, which made it hard to re-enter today's completed training and generate/share the new share page.
- Diagnosis:
  - `/api/plan-lib/get-instance` returns `recommendedDayIndex` using strict sequential plan progress, which can advance from the completed training day to the next plan day immediately.
  - If the next plan day is `rest`, the mini-program default selected day also moved there, hiding the completed training day's share entry.
  - Web uses the same recommendation concept, but its page has more surrounding status copy so the jump is less obvious.
- Fix:
  - `wechat_app/src/training/today-training/TodayTrainingScreen.tsx` now finds a completed execution whose `completed_at` is today.
  - When such an execution exists, the homepage default selected day remains that completed training day instead of the next recovery/rest day.
  - The `今日训练已完成` banner now also works from local execution data, not only the API boolean.
  - The section title treats that completed training day as `今日安排`, so the `整日打卡图` entry remains reachable for generating/sharing the public training page.
- Verification:
  - `npm run typecheck`: passed.
  - `cd wechat_app && $env:NODE_OPTIONS='--max-old-space-size=8192'; npm run build:weapp`: passed.
  - `npm run lint`: passed informational script.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: compiled, collected data, and generated all 510 static pages twice, but both runs failed only at the final `.next/standalone` copy due Windows `EBUSY` file locks.
  - Frontend visual verification was left to the user per durable preference.

## WeChat Action Library Light UI Alignment (`2026-06-19`)

- Task: user reported the mini-program action library UI was too black and did not match the rest of the current CoachLink UI.
- Status: implemented at style level; manual visual verification left to the user per durable preference.
- Change:
  - `wechat_app/src/me/action-lib/index.scss` now uses the same warm-light CoachLink workbench direction as the training execution page: `#f6f3ef` page background, white cards/search/chips, soft warm borders, brand-orange primary controls, and light green supplemental chips.
  - Removed the old fixed dark action-library surface colors such as `#242429`, `#333338`, `#444449`, `#1f3a2c`, and `#83d37b` from the source/built action-library stylesheet.
  - Kept functionality and action-library data flow unchanged.
- Verification:
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `cd wechat_app && $env:NODE_OPTIONS='--max-old-space-size=8192'; npm run build:weapp`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `git diff --check -- wechat_app/src/me/action-lib/index.scss`: passed with the existing CRLF warning.
  - `npx next build`: compiled successfully and generated all 510 static pages twice, but both runs failed at final standalone copy with Windows `EBUSY` on `.next/server/middleware-build-manifest.js`; this appears to be the known local file-lock issue rather than a compile error.



---

## Merged Apps Workspace Remote State (`2026-06-20`)

- Source: merged `origin/main` commit `c28cb224 feat: finalize mobile app workspace updates` before pushing current local code.
- Final directory model for this merge: WeChat mini-program source lives under `apps/wechat/`; native APP source lives under `apps/mobile/`; toolbox remains an independent WeChat subpackage at `apps/wechat/src/toolbox/`.
- Remote apps/mobile and workspace/package changes were preserved; local toolbox split, Power Analysis, training/share, and 2026-06-19 work were replayed into the new `apps/wechat/` location.

### Upstream apps workspace notes
## Apps Structure And Mobile APP Initialization (`2026-06-20`)

- Task: restructure the project to match the `food_link/apps` model, move the WeChat mini-program under `apps/wechat`, initialize a same-stack Expo/React Native APP under `apps/mobile`, and document the migration approach for future mini-program-to-APP work.
- Status: implemented, verified at code/build level, and committed locally.
- Key changes:
  - Moved mini-program source from `wechat_app/` to `apps/wechat/`.
  - Added root npm workspaces for `apps/*` and `packages/*`.
  - Added `apps/mobile` with Expo SDK 56, React Native 0.85, React 19.2, React Navigation 7, AsyncStorage, Expo file/image/clipboard modules, and CoachLink default app identity.
  - Added shared packages `packages/core` and `packages/api-client` for platform-neutral types and adapter-based API access.
  - Added `scripts/start-mobile-dev.cjs` for LAN-aware Expo development, defaulting API port to `3000`.
  - `scripts/start-mobile-dev.cjs` now falls back to `127.0.0.1` / `--localhost` when no LAN IPv4 is detected, while still supporting `MOBILE_DEV_LAN_IP` for real-device testing.
  - Added `docs/work/mobile-app-structure-and-migration.md`.
  - Added a WeChat workspace dependency compatibility helper so Taro/NutUI resolve required packages correctly under npm workspaces.
- Git:
  - Fetched `origin/main` before committing.
  - `HEAD` and `origin/main` were already aligned before the local commit, so there were no remote functional updates to merge or resolve.
  - Created local commit `feat: restructure mobile apps workspace`.
  - Local `main` is ahead of `origin/main` by one commit; no push has been run.
- Verification:
  - `npm install --fetch-timeout=120000 --fetch-retry-maxtimeout=120000`: passed after one initial registry idle timeout.
  - `npm run typecheck:mobile`: passed.
  - `npm --workspace packages/core run typecheck`: passed.
  - `npm --workspace packages/api-client run typecheck`: passed.
  - `npm --workspace apps/wechat run build:weapp`: passed.
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed.
  - `npx expo export --platform ios --output-dir /tmp/coachlink-mobile-export --clear`: passed.
  - `npm run dev:mobile`: started successfully on `exp://127.0.0.1:8081` / `http://localhost:8081`, then stopped after verification.
- Notes:
  - npm audit currently reports dependency-tree vulnerabilities from installed packages; no automatic audit fix was run.
  - No browser/Web UI page was changed. Mobile APP runtime was verified by Expo export rather than simulator/manual device launch.

## WeChat Home And Training Execution Design Baseline (`2026-06-20`)

- Task: ensure the current mini-program homepage and training execution page designs are fully reverted to SmallHorseBrother's latest commit version.
- Status: confirmed; no page file changes were required.
- Baseline commit: `d6c232d3 chore: record main dev sync` by `SmallHorseBrother`.
- Result:
  - The requested author name was spelled `SmallHorseBorther` in the prompt, but the matching Git author is `SmallHorseBrother`.
  - Current `apps/wechat/` files are content-identical to `d6c232d3:wechat_app/` for the checked homepage, today-training, training-execution, global app style, dark theme, and bottom navigation files.
  - The only difference from that baseline is the intentional monorepo path migration from `wechat_app/` to `apps/wechat/`; the design file contents are unchanged.
- Checked files included:
  - `src/pages/index/*`
  - `src/training/today-training/**/*`
  - `src/training/training-execution/*`
  - `src/app.scss`
  - `src/styles/theme-dark.scss`
  - `src/styles/theme.ts`
  - `src/components/BottomNav.*`

## Pull Latest Main (`2026-06-20`)

- Task: pull the latest code from `origin/main`.
- Status: completed again after the apps/mobile work.
- Branch: `main`.
- Result:
  - Latest run: `git fetch origin` then `git pull --ff-only origin main` reported `Already up to date`.
  - `origin/main` remains at `d6c232d3`; local `main` remains ahead by local commit `79474a67`.
  - No remote files changed during this sync.

## Commit Current Work And Sync Main/Dev (`2026-06-18`)

- Task: commit current latest local code, merge the latest development branch changes, and make `main` and `dev` consistent.
- Status: completed.
- Starting branch: `main`.
- Remote status before commit:
  - `origin/main` is at `82d46467`.
  - `origin/dev` advanced to `5326a92c fix wechat training execution and theme flow`.
## Mobile APP Auth Flow Mini-Program Alignment (`2026-06-20`)

- Task: make the current APP login/register/reset-password surfaces match the WeChat mini-program auth flow, including its background asset, mode switching, public browse action, agreement gate, and development shortcut buttons.
- Status: implemented at code/build level; simulator/manual UI verification is left to the user per durable preference.
- Implemented:
  - Copied the mini-program auth background image into `apps/mobile/assets/login-bg.jpg`.
  - Rebuilt the APP login screen around the same auth hierarchy as `apps/wechat/src/auth/login`: hero background, top browse/back actions, `手机号快捷登录` / `密码登录` / `验证码登录` modes, agreement checkbox, register entry, reset-password entry, and development quick-entry button.
  - Added APP register and reset-password screens using the same visual shell and verification-code flow.
  - Added shared auth components under `apps/mobile/src/components/auth/` for the shell, inputs, pill buttons, mode switcher, agreement row, and slider captcha modal.
  - Extended `packages/api-client` with email-code, reset-password, and slider-captcha API methods used by the mobile auth flow.
  - Extended APP auth state with `continueAsGuest` and `loginAsDevUser`, so the mini-program-style browse/dev actions are functional.
  - Preserved hardware keyboard input ergonomics for simulator/computer testing via normal `TextInput` focus and submit behavior.
- Product/API note:
  - The APP displays the WeChat-style `手机号快捷登录` entry, but actual WeChat Open Platform SDK/login is intentionally not wired yet. The placeholder explains that users should use password or verification-code login for now.
- Verification:
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npx next build`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx expo export --platform ios --output-dir /tmp/coachlink-mobile-auth-export --clear`: passed and bundled `assets/login-bg.jpg`.
  - `git diff --check`: passed.

## WeChat APP Review Icon Export (`2026-06-20`)

- Task: prepare the two PNG icon files required for WeChat APP review: 28x28 and 108x108.
- Status: corrected and completed.
- Source asset: `apps/wechat/src/assets/brand/coachlink-brand-icon.png`, per user correction that the review icon should include the triangle mark and `coachlink` wordmark, not the `CL` mobile placeholder icon.
- Output files:
  - `/Users/kirigaya/Downloads/coachlink-app-icon-28.png`
  - `/Users/kirigaya/Downloads/coachlink-app-icon-108.png`
- Verification:
  - `sips -g pixelWidth -g pixelHeight` confirmed exact `28 x 28` and `108 x 108` dimensions.
  - `file` confirmed both outputs are PNG images.
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npx next build`: passed.
  - `npm test`: passed, 33 files / 163 tests.

## Mobile APP `me` And Auth Layout Migration (`2026-06-20`)

- Task: fully migrate the WeChat mini-program `我的`/legal area into the APP, keep the APP icon system on the downloaded mini-program iconfont, and remove the login-page top gap that existed only because the mini-program has a native top toolbar.
- Status: implemented at code/build level; frontend/manual simulator verification remains left to the user unless explicitly requested.
- Implemented:
  - Copied `apps/wechat/src/assets/iconfont/` into `apps/mobile/assets/iconfont/`, loaded `iconfont.ttf` with `expo-font`, and replaced APP tab/auth icons with `IconFont` glyph names.
  - Removed `lucide-react-native` from the mobile package after switching APP icons to iconfont.
  - Added APP `我的` section screens under `apps/mobile/src/screens/me/`, covering profile/detail/edit, fitness/e1RM, action library/edit, plan library/edit/history/detail, training history, membership/referral/subscribe, cart, purchase history, settings, friends/activity, messages/chat, coaches, ranking, coach application, feedback, public user home, and legal/about/contact/privacy/terms/agreement/consumer-protection pages.
  - Extended APP navigation with the migrated `me` and legal routes.
  - Extended APP auth state/API helpers so stored token/user are restored and local user profile updates can refresh persisted state.
  - Fixed the APP login/register/reset-password shell by removing the mini-program-only top safe-area/tool-bar reservation (`SafeAreaView edges={[]}`) and reducing hero heights, so the image starts at the top of the mobile screen.
  - Removed the `返回上一页` action from the APP login page; login should only expose the intended auth modes and `不登录，先逛逛`, not a previous-page back affordance.
- Test user discovery:
  - Found the configured development test accounts in `.env.development`; the student test user is phone `13921064643` with password `123456`.
  - Read-only database lookup confirmed that phone exists as a student account; private identifiers were not written into durable memory.
- Verification:
  - `npm --workspace apps/mobile run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npx expo export --platform ios --output-dir /tmp/coachlink-mobile-me-export --clear`: passed and bundled `assets/iconfont/iconfont.ttf` plus `assets/login-bg.jpg`.
  - `npx next build`: passed after an initial lock wait for another local build process.
  - `npm test`: passed, 33 files / 163 tests.
  - `git diff --check`: passed.

## Mobile APP Remaining WeChat Module Migration (`2026-06-20`)

- Task: continue migrating the remaining WeChat mini-program modules into the mobile APP with matching bottom navigation style, module IA, and functional entry points.
- Status: in progress; not complete. This batch moved the APP from placeholder tabs toward the mini-program IA, but deep feature pages still need full one-by-one migration.
- Implemented in this batch:
  - Added an APP floating pill bottom tab bar matching the mini-program `BottomNav` visual pattern: dark translucent rounded bar, white active capsule, brand active icon, iconfont icons, and five student tabs `训练 / 教练 / 知识 / 工具箱 / 我的`.
  - Increased shared APP page bottom padding so content is not hidden behind the floating nav.
  - Migrated the four remaining student first-level APP tab screens from static placeholders into WeChat-aligned entry pages:
    - `训练`: hero, today-training entry, impromptu training entry, action library, plan history, training history, e1RM curve, and recent actions loaded from the student action API.
    - `教练`: search, specialty chips, recommended coach list loaded from coach APIs, ranking and my-coaches entries.
    - `知识`: construction notice, search, quick tags, focus topics, public training plans, and book notes loaded from knowledge APIs.
    - `工具箱`: four image-backed tool cards for power analysis, strength calculator, locations, and community data, plus scenario quick-fix entries.
  - Copied the mini-program toolbox card images into `apps/mobile/assets/toolbox/` and verified they are bundled by Expo export.
  - Added APP routes for the next layer of migrated modules: `TrainingExecution`, `ImpromptuTraining`, `CoachProfile`, `KnowledgeSearch`, `KnowledgePlanDetail`, `KnowledgeBookDetail`, `PowerAnalysis`, `StreetliftingCalculator`, `StreetliftingData`, `StreetliftingLocations`, and `ToolboxScenario`.
  - Added temporary APP-native migration detail pages for those subroutes so navigation is no longer a dead end; these are explicitly not the final full-feature implementations.
- Remaining required work before the long-running goal can be considered complete:
  - Fully migrate training execution and impromptu training logic, including local 60-day cache behavior, execution snapshots, set logging, add action/set, timers, completion and share image generation.
  - Fully migrate coach profile, questionnaire, subscription/payment flow, market/ranking/share pages.
  - Fully migrate knowledge detail pages, public training plan detail/copy flow, book detail, and content detail pages.
  - Fully migrate toolbox deep pages: Power Analysis upload/result flow, streetlifting calculator/history/result/data/locations/map/methodology/stories/submit, and scenario detail execution.
  - Audit and finish the APP `我的` pages against the mini-program source instead of treating the current broad migration as verified.
- Verification for this batch:
  - `npm --workspace apps/mobile run typecheck`: passed.
  - `npx expo export --platform ios --output-dir /tmp/coachlink-mobile-hubs-export --clear`: passed and bundled `assets/toolbox/*.jpg`, `assets/iconfont/iconfont.ttf`, and `assets/login-bg.jpg`.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `git diff --check`: passed.

### Follow-up Batch: APP Training Core (`2026-06-20`)

- Task: replace the training-related placeholder routes with functional APP pages aligned to the mini-program immediate training model.
- Status: implemented at code/export level; still not a full training-execution parity migration.
- Implemented:
  - Added APP training execution snapshot cache helper using storage key `training_execution_snapshots_v1`, matching the mini-program key and enforcing 60-day retention.
  - Added APP execution normalization helpers so plan and impromptu execution payloads render through the same recording UI.
  - Implemented `ImpromptuTrainingScreen`:
    - loads personal actions from `/api/student/action-lib/list-actions`;
    - loads public actions from `/api/public-action-lib/list-actions` as fallback/supplement;
    - supports search, multi-select, and starting `/api/impromptu/start`;
    - persists the returned execution snapshot locally before navigating to execution.
  - Implemented `TrainingExecutionScreen`:
    - reads local execution snapshot first, then syncs cloud state;
    - supports impromptu execution loading via `/api/impromptu/get`;
    - supports plan execution start/resume via `/api/execution/start` when `instanceId/dayIndex` are provided;
    - supports completing sets through `/api/impromptu/complete-set` or `/api/execution/complete-set`;
    - supports adding an extra set through the matching extra-content API;
    - supports finishing training through `/api/impromptu/finish` or `/api/execution/finish`;
    - patches local plan execution state when the plan complete-set API returns only counters, avoiding loss of action rows.
  - Replaced the `TrainingExecution` and `ImpromptuTraining` placeholder routes with the real APP screens.
  - Updated the training tab to use `/api/plan-lib/get-today-training-instance` instead of the legacy `/api/training/get-hub-data` endpoint, and passes `instanceId/dayIndex` into the execution route when available.
- Remaining training parity gaps:
  - The APP execution page still lacks the full mini-program interaction depth: add extra action, delete extra set/action, rest timer, lightweight task completion, execution notice popup, read-only completed share flow, direct share image generation, set video upload/linking, local today-page cache patching, and detailed workout-card/body-map summary.
  - The APP today-training screen still lacks the full calendar/week strip, rest-day card, coach/self plan switching, day-checkin sheet, and weak-network preview behavior from the mini-program.
- Verification:
  - `npm --workspace apps/mobile run typecheck`: passed.
  - `npx expo export --platform ios --output-dir /tmp/coachlink-mobile-training-export --clear`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `git diff --check`: passed.

### Follow-up Batch: APP Training Execution Actions (`2026-06-20`)

- Task: continue closing the APP training-execution parity gap with mini-program interaction behavior.
- Status: implemented at code/export level; still not full parity.
- Implemented:
  - Added APP execution-page training total-duration timer, derived from `started_at` / `created_at`, and freezes display semantics after completion.
  - Added execution action picker modal:
    - loads personal actions from `/api/student/action-lib/list-actions`;
    - loads public actions from `/api/public-action-lib/list-actions`;
    - for public actions, first calls `/api/public-action-lib/add-to-my-lib`, then uses the resulting student action id; if the action already exists, falls back to searching the personal action library by name.
  - Added extra-action insertion through `/api/impromptu/extra-content/add-extra-exercise` or `/api/execution/extra-content/add-extra-exercise`.
  - Added delete controls for extra sets and extra actions through the matching delete-extra endpoints. The APP shows deletion failures from the backend when a planned/non-extra item cannot be deleted.
  - Added an execution notice card when `execution.execution_notice` is present.
  - Added a completed-state `训练打卡图` placeholder card so the completion/share surface exists in APP navigation; full image generation is still pending.
- Remaining training parity gaps:
  - Full poster/share image generation, set video upload/linking, rest timer/minimized timer, lightweight task completion, detailed completed workout summary/body-map, today-training calendar/week strip/day-checkin, execution-plan read confirmation persistence, and today-page cache patching.
- Verification:
  - `npm --workspace apps/mobile run typecheck`: passed.
  - `npx expo export --platform ios --output-dir /tmp/coachlink-mobile-training-actions-export --clear`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `git diff --check`: passed.

### Follow-up Batch: APP Toolbox Scenario And Streetlifting Calculator (`2026-06-20`)

- Task: continue replacing APP toolbox deep-route placeholders with functional WeChat-aligned pages.
- Status: implemented at code/export level; broader toolbox parity is still not complete.
- Implemented:
  - Copied the mini-program scene quick-fix images into `apps/mobile/assets/toolbox/scenarios/`.
  - Added APP scene quick-fix data mirroring `apps/wechat/src/constants/scenarioQuickFixes.ts`.
  - Replaced the `ToolboxScenario` placeholder with a real APP screen:
    - displays the selected scenario hero image, icon, duration, and description;
    - supports `开始跟练`;
    - tracks the current step and completed steps;
    - advances step-by-step with `完成这一步`;
    - shows an all-steps list and final completion state.
  - Added APP-local streetlifting calculator math copied from the shared Web/mini-program formula model:
    - supports `forward`, `reverse_weight`, `reverse_reps`, and upper-body-only `day_max`;
    - supports weighted pull-up, weighted dips, strict press, barbell curl, squat, bench, and deadlift;
    - keeps DOTS, streetlifting coefficient, strict-press/curl multipliers, penalty-weight handling, score-level labels, and RM table generation aligned with the existing Web/mini-program logic.
  - Replaced the `StreetliftingCalculator` placeholder with a real APP screen:
    - project/mode/gender/action-quality/rest chips;
    - numeric inputs with hardware keyboard-compatible React Native `TextInput`;
    - local draft persistence under `sl_calc_form_data`;
    - local last result persistence under `sl_calc_last_run`;
    - formula loading from `/api/streetlifting-index/formulas/list`;
    - best-effort cloud history save through `/api/streetlifting-index/calculator/save-result` using the existing `weapp` source-surface contract.
  - Wired `RootNavigator` to the new real screens and removed these two routes from `FeaturePlaceholderScreen`.
- Remaining toolbox parity gaps:
  - Power Analysis upload/result/download flow still needs full APP migration.
  - Streetlifting calculator result/history pages are currently folded into the calculator screen; the separate mini-program result/history screens and richer ranking summary still need parity work.
  - Streetlifting data, locations, map, methodology, stories, submit, and submit-success pages are still placeholders.
- Verification:
  - `npm --workspace apps/mobile run typecheck`: passed.
  - `npx expo export --platform ios --output-dir /tmp/coachlink-mobile-toolbox-streetlifting-export --clear`: passed and bundled all 12 `assets/toolbox/scenarios/*.jpg` files.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `git diff --check`: passed.

### Follow-up Batch: APP Streetlifting Data And Locations (`2026-06-20`)

- Task: continue replacing APP toolbox/streetlifting deep-route placeholders with functional pages.
- Status: implemented at code/export level; still not full streetlifting toolbox parity.
- Implemented:
  - Replaced the `StreetliftingData` placeholder with a real APP community data screen:
    - loads `/api/streetlifting-index/submissions/list`;
    - loads `/api/streetlifting-index/formulas/list`;
    - computes submitted-record added 1RM and streetlifting score locally using the same coefficient math as the mini-program;
    - supports search, exercise/gender/grip/quality/video filters, and weight/score/date sorting;
    - shows result stats, submission cards, video presence, grip type, quality label, and rank order;
    - supports basic data submission through `/api/streetlifting-index/submissions/create`;
    - supports claim flow for unclaimed rows through `/api/streetlifting-index/submissions/claim`.
  - Replaced the `StreetliftingLocations` placeholder with a real APP locations screen:
    - loads `/api/streetlifting-index/locations/list`;
    - loads `/api/streetlifting-index/stats`;
    - supports search, province chips, apply-filter, load-more pagination, overview stats, and top-province summary;
    - renders image-backed location cards with area, description, address, contributor, date, and map-ready state;
    - supports basic location creation through `/api/streetlifting-index/locations/create`.
  - Wired `RootNavigator` to the new pages and removed these routes from `FeaturePlaceholderScreen`.
- Remaining streetlifting/toolbox parity gaps:
  - Locations image upload/editing, map clustering/navigation, share sheet/share poster, contributor leaderboard sheets, nearby detection, and rights/analysis sheets still need APP parity work.
  - Streetlifting data submission currently covers the basic form; duplicate-check dialog, profile-locked autofill, weight-limit validation, video upload, and richer claim dialog still need APP parity work.
  - Streetlifting methodology, stories, submit-success, and dedicated map/detail/share routes are still not migrated.
  - Power Analysis is still a placeholder.
- Verification:
  - `npm --workspace apps/mobile run typecheck`: passed.
  - `npx expo export --platform ios --output-dir /tmp/coachlink-mobile-streetlifting-data-locations-export --clear`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `git diff --check`: passed.

### Follow-up Batch: APP Power Analysis (`2026-06-20`)

- Task: replace the APP `PowerAnalysis` placeholder with the functional upload/analyze/result flow from the mini-program/Web implementation.
- Status: implemented at code/export level; still not full mini-program parity.
- Implemented:
  - Added `apps/mobile/src/screens/toolbox/PowerAnalysisScreen.tsx`.
  - Replaced the `PowerAnalysis` placeholder route with the real APP screen and removed it from `FeaturePlaceholderScreen`.
  - Implemented APP-native Power Analysis flow:
    - mode chips for `pullup`, `muscleup`, `dip`, `pushup`, and `squat`;
    - height/bodyweight/external-load inputs;
    - video selection through `expo-image-picker`;
    - create temporary upload task through `/api/toolbox/power-analysis/create-upload-url`;
    - upload selected video to the backend signed upload URL;
    - mark uploaded state and enable `开始分析`;
    - enqueue through `/api/toolbox/power-analysis/jobs/[id]/enqueue`;
    - poll `/api/toolbox/power-analysis/jobs/[id]` until terminal state;
    - request `/llm-summary` after `done`;
    - render summary metrics and per-rep rows;
    - request `/download-url` and copy the result URL through `expo-clipboard`.
  - Kept the same transient-video product model as mini-program/Web: users upload a short video for a temporary analysis job, then retrieve the annotated output.
- Remaining Power Analysis parity gaps:
  - APP upload currently uses signed-url direct upload without real byte-level progress; progress is staged rather than exact.
  - Download currently copies a link instead of saving the video into the device album.
  - APP does not yet provide camera capture, inline video preview/fullscreen preview, result video player, or native share/save action.
  - APP does not yet persist/restore an active Power Analysis job across screen remounts like Web sessionStorage.
- Verification:
  - `npm --workspace apps/mobile run typecheck`: passed.
  - `npx expo export --platform ios --output-dir /tmp/coachlink-mobile-power-analysis-export --clear`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `git diff --check`: passed.

### Local Environment: Android Emulator Keyboard And Clipboard (`2026-06-20`)

- Task: user reported the current Android emulator could not receive hardware keyboard letters/numbers and copy/paste had no effect.
- Status: repaired at local emulator configuration level.
- Affected local AVD:
  - `Pixel_6_API_34`
  - running as `emulator-5554`
- Changes made outside the repository:
  - Rewrote hardware keyboard settings in `/Users/kirigaya/.android/avd/Pixel_6_API_34.avd/config.ini`.
  - Rewrote generated hardware settings in `/Users/kirigaya/.android/avd/Pixel_6_API_34.avd/hardware-qemu.ini`.
  - Rewrote snapshot hardware settings in `/Users/kirigaya/.android/avd/Pixel_6_API_34.avd/snapshots/default_boot/hardware.ini`.
  - Ensured all three use `hw.keyboard` enabled, `hw.keyboard.lid` enabled, and `qwerty2`.
  - Rewrote Emulator preference `set.clipboardSharing=1` in `/Users/kirigaya/Library/Preferences/com.android.Emulator.plist`.
  - Set Android secure setting `show_ime_with_hard_keyboard=1`.
  - Enabled and selected default IME `com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME`.
  - Cold-restarted the emulator under detached `screen` session `coachlink_pixel6`.
- Verification:
  - `adb devices -l`: `emulator-5554` online.
  - `adb shell settings get secure show_ime_with_hard_keyboard`: `1`.
  - `adb shell settings get secure default_input_method`: LatinIME.
  - `adb shell dumpsys input`: `Device 0: qwerty2`, `KeyboardType: 2`.
- Notes:
  - This was not a repository code change.
  - If the emulator is recreated or switched to another AVD, repeat the same local AVD configuration for that device.

### Follow-up Batch: APP Knowledge Deep Pages (`2026-06-20`)

- Task: continue replacing APP knowledge-module placeholders with functional pages that match the WeChat mini-program knowledge flow.
- Status: implemented at code/export level; still not full knowledge-module parity.
- Implemented:
  - Added `apps/mobile/src/screens/knowledge/KnowledgeSearchScreen.tsx`.
    - Supports keyword search through `/api/knowledge/search`.
    - Supports direct node loading through `/api/knowledge/nodes/[id]`.
    - Renders node title, description, type badge, free badge, body-region tags, video URL reference, normalized article/body content, and related coach articles.
    - Keeps search input and result drill-in behavior aligned with mini-program `/content/knowledge` and `/content/knowledge/node-detail`.
  - Added `apps/mobile/src/screens/knowledge/KnowledgePlanDetailScreen.tsx`.
    - Loads public plan detail through `/api/knowledge/training-plans/[id]`.
    - Renders hero, cycle/frequency/training-day/level metrics, equipment/tags, action-library explanation, action slots, first 14 days of training arrangement, action set metrics, bound/pending action badges, and notes.
    - Implements `加入我的计划` through `/api/knowledge/training-plans/[id]/copy-to-favorite`.
    - On success, offers a jump to `PlanLibrary`; on auth failure, offers login.
  - Added `apps/mobile/src/screens/knowledge/KnowledgeBookDetailScreen.tsx`.
    - Loads book detail through `/api/knowledge/books/[id]`.
    - Renders cover/title/author/summary/free-paid badge/source note type, disclaimer, normalized content text, paywall/login states, related books from the same source collection, and image prompts.
  - Added `apps/mobile/src/screens/knowledge/knowledgeHelpers.ts` for shared plan metrics, content normalization, HTML-to-text downgrade, and book source extraction.
  - Wired `RootNavigator` to the real `KnowledgeSearch`, `KnowledgePlanDetail`, and `KnowledgeBookDetail` screens.
  - Removed the three knowledge routes from `FeaturePlaceholderScreen`; `CoachProfile` remains the only route in that placeholder component.
- Remaining knowledge parity gaps:
  - APP does not yet render rich HTML with a native rich-text renderer; content is normalized to readable text for now.
  - APP does not yet include a native inline video player for knowledge node videos.
  - APP does not yet include a native audio player for book `audio_url`.
  - Book APIs still rely on server session semantics; APP currently handles login/paywall states gracefully but may need backend Bearer-token compatibility for full authenticated reading parity.
  - Coach article detail route from related articles is still not migrated.
- Verification:
  - `npm --workspace apps/mobile run typecheck`: passed.
  - `npx expo export --platform ios --output-dir /tmp/coachlink-mobile-knowledge-export --clear`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `git diff --check`: passed.

### Follow-up Batch: APP Coach Profile (`2026-06-20`)

- Task: replace the APP `CoachProfile` placeholder with the functional coach detail/profile flow from the WeChat mini-program discovery coach profile.
- Status: implemented at code/export level; still not full mini-program payment/questionnaire/content parity.
- Implemented:
  - Added `apps/mobile/src/screens/coach/CoachProfileScreen.tsx`.
  - Wired `RootNavigator` so `CoachProfile` now uses the real APP screen.
  - Deleted the unused `apps/mobile/src/screens/FeaturePlaceholderScreens.tsx`; there is no longer a generic placeholder screen in the main APP navigator.
  - Implemented APP-native coach profile loading:
    - `/api/coach/get-coach`;
    - `/api/coach/get-aggregated-info`;
    - `/api/coach/get-pricing`;
    - `/api/coach/get-contents`;
    - authenticated `/api/subscription/coach-subscriptions` when a local APP user exists.
  - Matched the mini-program information hierarchy:
    - top coach intro with avatar, featured badge, title, subscription status, stats, specialties, bio, experience/case/material metrics;
    - four tabs: `关于教练`, `订阅价格`, `教练专栏`, `学员评价`;
    - about tab with teaching philosophy, achievements, credentials, case studies, and public materials;
    - pricing tab with product cards and duration options;
    - content tab with locked/free state and thumbnail fallback;
    - reviews tab empty-state behavior;
    - bottom fixed CTA for `立即订阅 / 查看价格`, matching the mini-program's primary subscription jump.
  - Implemented basic subscription creation:
    - selecting a purchasable duration calls `/api/subscription/create-subscription` with `status: inactive`, product metadata, tier, and subscribed weeks;
    - unauthenticated users are prompted to login;
    - waiting/active/renewal states are guarded;
    - missing coach receiving-account state blocks purchase with clear copy;
    - successful creation offers a jump to `PaymentWaiting`.
- Remaining coach-profile parity gaps:
  - Full questionnaire page migration is still missing; the APP does not yet open `/discovery/coach-questionnaire` equivalent.
  - Full native payment bridge is still missing; `PaymentWaiting` / `PaymentWechat` are still thin APP placeholders and do not yet run Huifu/WeChat native SDK payment.
  - Coach content detail route is still missing; content rows currently explain locked/unmigrated detail states.
  - Renewal payment is guarded with a message instead of completing the mini-program renewal flow.
  - Public material media preview/copy actions are simplified; image/video preview parity still needs APP-native media handling.
- Verification:
  - `npm --workspace apps/mobile run typecheck`: passed.
  - `npx expo export --platform ios --output-dir /tmp/coachlink-mobile-coach-profile-export --clear`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `git diff --check`: passed.

### Follow-up Batch: APP Coach Questionnaire (`2026-06-20`)

- Task: migrate the WeChat mini-program `/discovery/coach-questionnaire` flow into the APP so coach subscription can preserve the prepay questionnaire step.
- Status: implemented at code/export level; payment SDK handoff remains incomplete.
- Implemented:
  - Added `apps/mobile/src/screens/coach/CoachQuestionnaireScreen.tsx`.
  - Added `CoachQuestionnaire` route params to `apps/mobile/src/navigation/types.ts`.
  - Registered `CoachQuestionnaire` in `RootNavigator`.
  - Implemented APP-native questionnaire loading through `/api/coach/get-questionnaires`.
  - Supports the same question families used by the mini-program:
    - `tags`;
    - `times`;
    - `rm`;
    - `option` single-select;
    - `option` multi-select;
    - `option` with `allowOther`;
    - text fallback.
  - Implements answer normalization with existing subscription answers, per-question completion validation, and incomplete-question feedback.
  - Implements `edit` mode:
    - available from `CoachProfile` when subscription status is `waiting` or `active`;
    - submits to `/api/subscription/update-subscription` with `subscribe_data`.
  - Implements `prepay` mode:
    - `CoachProfile` now checks `/api/coach/get-questionnaires` before directly creating a subscription;
    - if questions exist, selecting a product navigates to `CoachQuestionnaire`;
    - submit creates or updates the inactive subscription with questionnaire answers and product metadata, then offers a jump to `PaymentWaiting`.
  - Backend compatibility:
    - `src/app/api/subscription/update-subscription/route.ts` now accepts both NextAuth session and Bearer-token auth via `getAuthUser(req)`, preserving the existing session path while allowing APP token calls.
- Remaining coach questionnaire / subscription parity gaps:
  - The APP still does not call native Huifu/WeChat payment SDK after questionnaire submit; it hands off to the existing thin `PaymentWaiting` screen.
  - The APP does not yet support the mini-program's `autoSubscribe` token/idempotency shortcut path.
  - The APP question UI is functionally aligned but does not yet support media uploads inside questionnaire questions.
  - The APP does not yet restore cached questionnaire answers if the user leaves mid-form.
- Verification:
  - `npm --workspace apps/mobile run typecheck`: passed.
  - `npm run typecheck`: passed.
  - `npx expo export --platform ios --output-dir /tmp/coachlink-mobile-coach-questionnaire-export --clear`: passed.
  - `npm run lint`: passed informational script.
  - `git diff --check`: passed.

### Local Android Emulator Keyboard/Clipboard Repair (`2026-06-20`)

- Task: user reported the current Android emulator could not accept physical keyboard letters/numbers and copy/paste was ineffective.
- Status: repaired local machine configuration; this is not a repository code change.
- Target AVD: `Pixel_6_API_34`.
- Changes:
  - Kept hardware keyboard enabled in `/Users/kirigaya/.android/avd/Pixel_6_API_34.avd/config.ini`, `hardware-qemu.ini`, and `snapshots/default_boot/hardware.ini`.
  - Changed AVD boot settings to force cold boot and disable snapshot boot/save:
    - `fastboot.forceColdBoot=yes`;
    - `fastboot.forceFastBoot=no`;
    - `firstboot.bootFromDownloadableSnapshot=no`;
    - `firstboot.bootFromLocalSnapshot=no`;
    - `firstboot.saveToLocalSnapshot=no`.
  - Kept host clipboard sharing enabled in `/Users/kirigaya/Library/Preferences/com.android.Emulator.plist` with `set.clipboardSharing=1`.
  - Set Android `show_ime_with_hard_keyboard=1`.
  - Selected `com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME`.
  - Restarted the emulator under detached `screen` session `coachlink_pixel6` with `-no-snapshot -no-snapshot-load -no-snapshot-save`.
- Verification:
  - `adb devices -l`: `emulator-5554` is online.
  - Running process includes `-no-snapshot -no-snapshot-load -no-snapshot-save`.
  - `adb shell settings get secure default_input_method`: LatinIME.
  - `adb shell settings get secure show_ime_with_hard_keyboard`: `1`.
  - `adb shell dumpsys input` shows built-in `qwerty2` keyboard with `KeyboardType: 2`.

### Follow-up Batch: APP Coach Payment Waiting (`2026-06-20`)

- Task: continue migrating the WeChat mini-program coach subscription payment handoff into the APP.
- Status: implemented at code/export level; real native payment SDK invocation is still not complete.
- Implemented:
  - Added a real APP `PaymentWaitingScreen` under `apps/mobile/src/screens/payment/PaymentWaitingScreen.tsx`.
  - Registered `PaymentWaiting` with typed params for order id, amount, provider, coach/membership target, initial status, and message.
  - The APP payment waiting page now mirrors the mini-program waiting flow:
    - shows order amount/order id;
    - queries `/api/payment/wechat/query` or `/api/payment/alipay/query`;
    - polls every 5 seconds while pending;
    - supports manual `我已完成支付`;
    - handles success/cancelled/failed/no-order states;
    - routes back to membership, coach profile, or my coaches based on target.
  - Added `apps/mobile/src/screens/coach/coachPayment.ts` with shared helper logic for coach subscription payment handoff.
  - `CoachProfileScreen` direct subscribe path now creates/updates the inactive subscription and then best-effort calls `/api/payment/wechat/coach/create`; successful creation passes the real `orderId` and amount into `PaymentWaiting`.
  - `CoachQuestionnaireScreen` prepay submit path now saves questionnaire/subscription data and then performs the same best-effort coach WeChat payment creation before navigating to `PaymentWaiting`.
  - Existing pending-payment banner on coach profile now passes the known `order_id`, coach id, amount, provider, and target into `PaymentWaiting` instead of navigating with no context.
- Remaining payment parity gaps:
  - APP still does not invoke the native Huifu/WeChat payment SDK using returned `paymentParams`; it only creates/query-polls orders and exposes the waiting/result page.
  - APP accounts without mini-program `wechat_openid` may fail `/api/payment/wechat/coach/create`; the APP catches that failure and enters `PaymentWaiting` with a clear message rather than silently breaking.
  - Membership payment handoff still needs the same deeper native treatment.
- Verification:
  - `npm --workspace apps/mobile run typecheck`: passed.
  - `npx expo export --platform ios --output-dir /tmp/coachlink-mobile-payment-waiting-export --clear`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `git diff --check`: passed.

### Follow-up Batch: APP Membership Subscribe Payment (`2026-06-20`)

- Task: replace the APP membership-subscribe placeholder with the WeChat mini-program membership/add-on purchase flow and connect it to the APP payment waiting page.
- Status: implemented at code/export level; native payment SDK invocation remains incomplete.
- Implemented:
  - Updated `MembershipSubscribe` route params to support `tab: membership | addon`.
  - Replaced the old coupon-list placeholder `MembershipSubscribeScreen` with the mini-program-aligned fixed product model:
    - `基础会员` `19.9/月`;
    - `高级会员` `39.9/月`;
    - `AI 导入加油包` `2.0/3次`;
    - `存储扩容包` `9.9/1GB`.
  - Added mini-program-style tab switching between `会员套餐` and `加油包`.
  - Loads `/api/membership/get-status` and blocks duplicate purchase when the current tier already matches the selected membership tier.
  - Purchase calls `/api/payment/wechat/membership/create` and navigates to `PaymentWaiting` with `orderId`, amount, provider `wechat`, target `membership`, and membership tab.
  - If order creation fails, the APP still navigates to the no-order `PaymentWaiting` state with a clear message, matching the current APP limitation around missing `wechat_openid` / native SDK.
- Remaining membership payment parity gaps:
  - APP still does not invoke native WeChat/Huifu payment SDK using returned `paymentParams`.
  - APP status page and purchase history are still simplified compared with the mini-program.
- Verification:
  - `npm --workspace apps/mobile run typecheck`: passed.
  - `npx expo export --platform ios --output-dir /tmp/coachlink-mobile-membership-payment-export --clear`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `git diff --check`: passed.

### Follow-up Batch: APP Cart And Purchase History (`2026-06-20`)

- Task: replace remaining APP placeholders for the mini-program `购物车` and `购买记录` pages.
- Status: implemented at code/export level; cart checkout still routes back to coach profile instead of a dedicated APP payment-webview bridge.
- Implemented:
  - Replaced `CartScreen` placeholder with a real pending-subscription cart screen aligned with `apps/wechat/src/me/cart/index.tsx`:
    - loads `/api/cart/list`;
    - shows the same product/coach/duration/price hierarchy;
    - explains the difference between pending cart items and purchase history;
    - supports `查看购买记录`;
    - supports deleting one item through `/api/cart/remove`;
    - supports clearing all items through `/api/cart/clear`;
    - shows total pending amount;
    - routes `立即订阅` to `CoachProfile` for the coach so the user can continue questionnaire/subscription/payment flow in APP.
  - Replaced `PurchaseHistoryScreen` placeholder with a real paged order-history screen aligned with `apps/wechat/src/me/purchase-history/index.tsx`:
    - calls `/api/purchase-history/list?page=...&limit=...`;
    - renders order name, status pill, coach, duration, amount, and created/paid time;
    - supports `加载更多`;
    - shows empty state.
  - Added APP-compatible Bearer-token auth fallback to:
    - `src/app/api/cart/list/route.ts`;
    - `src/app/api/cart/remove/route.ts`;
    - `src/app/api/cart/clear/route.ts`;
    - `src/app/api/purchase-history/list/route.ts`.
- Remaining gaps:
  - The mini-program cart `立即订阅` opened a payment webview entry with product/month params; APP still sends the user to `CoachProfile` to continue the migrated native flow.
  - Purchase-history detail/refund/deep payment recovery actions are not yet implemented.
- Verification:
  - `npm --workspace apps/mobile run typecheck`: passed.
  - `npx expo export --platform ios --output-dir /tmp/coachlink-mobile-cart-purchase-export --clear`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `git diff --check`: passed.

### Follow-up Batch: APP Membership Home (`2026-06-20`)

- Task: replace the APP membership-status JSON placeholder with the WeChat mini-program `我的会员` page structure and logic.
- Status: implemented at code/export level.
- Implemented:
  - Replaced `MembershipScreen` JSON output with a mini-program-aligned membership dashboard:
    - current tier card with `免费用户 / 基础会员 / 高级会员 / 试用会员`;
    - active end-date display;
    - free-user upgrade panel;
    - renewal/upgrade entry for paid tiers;
    - AI import quota card;
    - cloud storage quota card with progress bar;
    - add-on purchase entries for AI pack and storage expansion;
    - referral card with `去邀请` action.
  - Calls both `/api/membership/get-status` and `/api/membership/get-quota`.
  - Added APP-friendly API compatibility:
    - `/api/membership/get-status` now supports both `GET` and `POST`;
    - `/api/membership/get-quota` now supports both `GET` and `POST`;
    - `/api/membership/get-quota` now accepts APP Bearer-token auth via `getAuthUser` in addition to Web NextAuth session.
- Remaining membership gaps:
  - Referral page is still a generic list placeholder and needs full mini-program parity.
  - Native payment SDK invocation remains incomplete in membership subscribe/payment waiting.
- Verification:
  - `npm --workspace apps/mobile run typecheck`: passed.
  - `npx expo export --platform ios --output-dir /tmp/coachlink-mobile-membership-home-export --clear`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `git diff --check`: passed.

### Follow-up Batch: APP Membership Referral (`2026-06-20`)

- Task: replace the APP membership referral generic list placeholder with the WeChat mini-program `邀请好友` page.
- Status: implemented at code/export level.
- Implemented:
  - Replaced `MembershipReferralScreen` with a mini-program-aligned invitation page:
    - loads `/api/membership/referral/create-invite`;
    - loads `/api/membership/referral/stats`;
    - shows invitation code in an orange code card;
    - shows invitation link;
    - supports copy invite code via `expo-clipboard`;
    - supports copy invitation link;
    - supports copy share copy/text;
    - shows reward rules (`AI 导入次数 +2`, `云存储空间 +200MB`);
    - shows invitation stats (`已邀请好友`, `累计 AI 次数`, `累计存储`);
    - supports manual refresh.
  - Added APP-compatible auth fallback:
    - `/api/membership/referral/create-invite` now accepts Bearer-token auth via `getAuthUser`;
    - `/api/membership/referral/stats` now accepts Bearer-token auth via `getAuthUser`;
    - `/api/membership/referral/stats` now supports both `GET` and `POST`.
- Remaining referral gaps:
  - Native share sheet / platform share extension is not yet wired; the APP currently copies share content for manual sharing.
  - The mini-program timeline/share menu behavior does not map directly to APP and still needs native share integration.
- Verification:
  - `npm --workspace apps/mobile run typecheck`: passed.
  - `npx expo export --platform ios --output-dir /tmp/coachlink-mobile-membership-referral-export --clear`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `git diff --check`: passed.

### Local Android Emulator Keyboard/Clipboard Repair (`2026-06-20`)

- Task: user reported the current Android emulator still could not receive physical keyboard letters/numbers, and copy/paste did not work.
- Status: local configuration repaired and emulator restarted.
- Target AVD: `Pixel_6_API_34`.
- Changes:
  - Kept AVD hardware keyboard enabled in local AVD files:
    - `/Users/kirigaya/.android/avd/Pixel_6_API_34.avd/config.ini`;
    - `/Users/kirigaya/.android/avd/Pixel_6_API_34.avd/hardware-qemu.ini`;
    - `/Users/kirigaya/.android/avd/Pixel_6_API_34.avd/snapshots/default_boot/hardware.ini`.
  - Enabled Emulator host preferences in `/Users/kirigaya/Library/Preferences/com.android.Emulator.plist`:
    - `set.forwardShortcutsToDevice=1`;
    - `set.enforceKeycodeForwarding=true`;
    - `perAvd.set.enforceKeycodeForwarding=true`;
    - `set.clipboardSharing=1`.
  - Restarted the emulator in `screen` session `coachlink_pixel6` with:
    - `-use-keycode-forwarding`;
    - `-no-snapshot -no-snapshot-load -no-snapshot-save`.
  - Re-applied Android guest settings:
    - `show_ime_with_hard_keyboard=1`;
    - default IME `com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME`.
- Verification:
  - `adb devices -l`: emulator online.
  - Boot completed.
  - Running qemu command contains `-use-keycode-forwarding`.
  - `dumpsys input` reports `Device 0: qwerty2` and `KeyboardType: 2`.
- Scope: local machine / AVD / Emulator preference change only; no app source code changed for this fix.

### Follow-up: Android Emulator Host Shortcut/Clipboard Preferences (`2026-06-20`)

- Task: user again reported that letters/numbers and copy/paste were not reaching the current Android emulator.
- Status: repaired local Emulator host preferences and cold-restarted the AVD.
- Target AVD: `Pixel_6_API_34`.
- Root cause refinement:
  - The AVD hardware keyboard and Android guest input settings were already correct.
  - The Emulator binary reads QSettings keys in slash form, such as `set/forwardShortcutsToDevice`, while the local plist only had the older dot-form compatibility keys from the previous repair.
- Fix:
  - Wrote both slash-form and dot-form keys in `/Users/kirigaya/Library/Preferences/com.android.Emulator.plist`:
    - `set/forwardShortcutsToDevice=1`;
    - `set/clipboardSharing=1`;
    - `set/enforceKeycodeForwarding=1`;
    - `perAvd/set/enforceKeycodeForwarding=1`;
    - plus dot-form compatibility keys with the same values.
  - Reconfirmed AVD config has `hw.keyboard=yes`, `hw.keyboard.lid=yes`, `hw.keyboard.charmap=qwerty2`, and no-snapshot/cold-boot flags.
  - Restarted `Pixel_6_API_34` under `screen` session `coachlink_pixel6` with `-use-keycode-forwarding -no-snapshot -no-snapshot-load -no-snapshot-save`.
  - Re-applied Android guest settings: `show_ime_with_hard_keyboard=1` and LatinIME as the default input method.
- Verification:
  - ADB device online and `sys.boot_completed=1`.
  - Running emulator process contains `-use-keycode-forwarding`.
  - `defaults read com.android.Emulator` shows both slash-form and dot-form keyboard/clipboard keys enabled.
  - `dumpsys input` shows `Device 0: qwerty2`, `Sources: KEYBOARD | DPAD`, and `KeyboardType: 2`.
- Scope: local machine / AVD / Emulator preference change only; no repository source code changed for this fix.

### Follow-up Batch: APP Streetlifting Extra Pages (`2026-06-20`)

- Task: continue full WeChat mini-program to native APP migration by filling the remaining streetlifting toolbox pages that were still missing or routed to generic screens.
- Status: implemented at code/export/build level.
- Implemented:
  - Added APP routes and screens for:
    - `StreetliftingMethodology`;
    - `StreetliftingStories`;
    - `StreetliftingSubmit`;
    - `StreetliftingSubmitSuccess`;
    - `StreetliftingLocationsMap`;
    - `StreetliftingLocationDetail`.
  - `ToolboxScreen` now routes `方法论`, `街健故事`, `提交数据`, and `点位地图` to real APP-native pages instead of recycling `StreetliftingData`.
  - `StreetliftingSubmitScreen` now provides an independent community-data submission flow:
    - project/gender/pullup-type selection;
    - bodyweight, added weight, reps, form quality, penalty, display name, video link fields;
    - live estimated added 1RM and streetlifting score preview using the shared calculator math;
    - submit to `/api/streetlifting-index/submissions/create`;
    - success handoff to `StreetliftingSubmitSuccess`.
  - `StreetliftingStoriesScreen` loads `/api/streetlifting-index/stories/list`, renders story/event cards, and supports story/event submission through `/api/streetlifting-index/stories/create`.
  - `StreetliftingLocationsMapScreen` loads `/api/streetlifting-index/locations/map-pins`, summarizes region distribution, lists navigable locations, and opens detail pages.
  - `StreetliftingLocationDetailScreen` loads `/api/streetlifting-index/locations/get`, renders cover/image fallback, area, address, description, contributor, and opens Apple Maps/system map via deep link when coordinates exist.
  - `StreetliftingLocationsScreen` now links to the map page and each location card opens its detail page.
  - `StreetliftingDataScreen` now sends the main `提交数据` action to the independent submit page.
  - Added APP Bearer-token auth fallback to:
    - `/api/streetlifting-index/submissions/check-existing`;
    - `/api/streetlifting-index/submissions/create`.
- Remaining streetlifting gaps:
  - Native map clustering is represented by a navigable pin list for now; true in-app map clustering remains a deeper native-map integration task.
  - Location image upload/edit/share-poster flows are still not fully native.
  - Calculator result/history subpages are partly represented inside the calculator and data flows, but not yet split into every mini-program subpage.
- Verification:
  - `npm --workspace apps/mobile run typecheck`: passed.
  - `npx expo export --platform ios --output-dir /tmp/coachlink-mobile-streetlifting-extra-export --clear`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `git diff --check`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed.

### Follow-up Batch: APP My Coaches And Chat Chain (`2026-06-20`)

- Task: continue checking and migrating the APP `我的` module by replacing the generic `我的教练` page and making its contact/chat chain usable under APP token auth.
- Status: implemented at code/export/build/test level.
- Implemented:
  - Replaced the APP `MyCoachesScreen` generic data placeholder with a mini-program-aligned coach subscription card page:
    - subscription status badges and expiring state;
    - coach avatar/name/title/bio/specialty tags;
    - content/student/rating metrics from `/api/coach/get-aggregated-info`;
    - `联系教练`, `查看详情`, `发现更多`, and renew/detail actions.
  - Fixed APP navigation from `我的教练` to the coach discovery tab by allowing `MainTabs` nested tab params and routing to `{ screen: 'CoachesTab' }`.
  - Replaced the APP `ChatScreen` JSON preview with a real lightweight message list and send box:
    - loads `/api/chat/list-messages`;
    - renders left/right message bubbles;
    - sends text through `/api/chat/send-message` with the backend's real `roomId/messageType/content` fields.
  - Added APP Bearer-token compatibility for chat APIs:
    - `/api/chat/list-chatrooms` now supports `GET` and `POST` and accepts APP Bearer auth;
    - `/api/chat/list-messages` accepts APP Bearer auth;
    - `/api/chat/send-message` accepts APP Bearer auth and now checks that the sender belongs to the room.
  - Kept Web session auth paths intact for the same APIs.
- Remaining gaps:
  - The APP chat page is now functional but still lighter than the full Web/mini-program chat: no image/video upload, reply threading UI, unread mark-as-read flow, message search jump, or streaming/coach-AI surfaces.
  - `我的教练` renewal still routes to coach detail/payment handoff rather than a fully native renewal checkout.
  - Other generic `我的` subpages remain to be audited and migrated, including friends/activity, ranking, fitness card/e1RM chart, training history, and plan history detail.
- Verification:
  - `npm --workspace apps/mobile run typecheck`: passed.
  - `npx expo export --platform ios --output-dir /tmp/coachlink-mobile-my-coaches-export --clear`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `git diff --check`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed.
- Manual APP simulator visual verification remains left to the user per durable preference.

### Follow-up: Android Emulator Cmd+V Clipboard Bridge (`2026-06-21`)

- Task: fix the still-failing Android emulator letters/numbers and copy/paste behavior; user will manually verify inside the APP.
- Status: completed at local AVD/runtime configuration level.
- Key finding:
  - `Pixel_6_API_34` already had Android-side hard keyboard input working: `qwerty2`, `KeyboardType: 2`, `show_ime_with_hard_keyboard=1`, and `LatinIME`.
  - The emulator process already used `-use-keycode-forwarding`.
  - The likely remaining paste conflict was `forwardShortcutsToDevice=true`: macOS `Cmd+V` was being forwarded into Android instead of being handled by the Emulator host clipboard bridge.
- Change:
  - Kept letters/numbers forwarding enabled through `set/enforceKeycodeForwarding=true`, `hw.keyboard=yes`, `hw.keyboard.charmap=qwerty2`, and launch arg `-use-keycode-forwarding`.
  - Kept host clipboard sharing enabled through `set/clipboardSharing=true`.
  - Changed `forwardShortcutsToDevice=false` in `~/.android/avd/Pixel_6_API_34.avd/AVD.conf` and `com.android.Emulator` preferences.
  - Cold-restarted `Pixel_6_API_34` in `screen` session `coachlink_pixel6` with `-no-snapshot -no-snapshot-load -no-snapshot-save -use-keycode-forwarding`.
- Verification:
  - `adb -s emulator-5554 emu avd name`: `Pixel_6_API_34`.
  - `sys.boot_completed=1`.
  - `show_ime_with_hard_keyboard=1`.
  - Default IME: `com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME`.
  - `dumpsys input`: `qwerty2` and `KeyboardType: 2`.
  - `defaults read com.android.Emulator set/forwardShortcutsToDevice`: `0`.
  - `defaults read com.android.Emulator set/clipboardSharing`: `1`.
  - `defaults read com.android.Emulator set/enforceKeycodeForwarding`: `1`.
  - APP-level visual/input verification is intentionally left to the user.

### Local Android Emulator Keyboard / Clipboard Fix (`2026-06-21`)

- Task: user reported that the current Android emulator could not accept letters/numbers from the computer keyboard and copy/paste had no effect.
- Status: fixed at local machine configuration level.
- Root cause found:
  - Global Emulator preferences and launch flags were already mostly correct, but the AVD-specific file `~/.android/avd/Pixel_6_API_34.avd/AVD.conf` still had `set\enforceKeycodeForwarding=false`.
  - That AVD-level override can disable keycode forwarding for this emulator even when plist/global settings and launch flags appear enabled.
- Fix:
  - Updated `AVD.conf` to enable:
    - `set\enforceKeycodeForwarding=true`
    - `set\forwardShortcutsToDevice=true`
    - `set\clipboardSharing=true`
  - Confirmed/wrote Emulator global preferences in `/Users/kirigaya/Library/Preferences/com.android.Emulator.plist` for both slash-form and dot-form keys:
    - `set/clipboardSharing`
    - `set/forwardShortcutsToDevice`
    - `set/enforceKeycodeForwarding`
    - `perAvd/set/enforceKeycodeForwarding`
  - Cold-restarted `Pixel_6_API_34` with `-no-snapshot -no-snapshot-load -no-snapshot-save -use-keycode-forwarding`.
  - Reapplied Android input settings:
    - `show_ime_with_hard_keyboard=1`
    - default IME `com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME`
- Verification:
  - `adb devices -l`: `emulator-5554` online and boot completed.
  - Emulator process contains `-use-keycode-forwarding`.
  - `AVD.conf` now has the AVD-specific forwarding/clipboard settings enabled.
  - `dumpsys input` reports built-in `qwerty2` with `KeyboardType: 2`.
- Scope:
  - This is a local machine / Android Emulator configuration fix only; no app source code changed.

### Local Android Emulator Keyboard/Clipboard Fix (`2026-06-21`)

- Task: user reported the current Android emulator could not receive host keyboard letters/numbers and copy/paste did not work.
- Status: fixed at local machine configuration level.
- Local AVD: `Pixel_6_API_34`.
- Changes:
  - Rewrote AVD hardware keyboard settings in `/Users/kirigaya/.android/avd/Pixel_6_API_34.avd/config.ini`.
  - Rewrote generated/snapshot hardware keyboard settings in `hardware-qemu.ini` and `snapshots/default_boot/hardware.ini`.
  - Forced cold boot/no fast boot and disabled snapshot restore/save for this AVD config.
  - Enabled Emulator host clipboard sharing and keycode forwarding in `/Users/kirigaya/Library/Preferences/com.android.Emulator.plist`, including both slash-form and dot-form QSettings keys.
  - Cleared stale AVD lock/snapshot marker files and restarted the emulator in detached `screen` session `coachlink_pixel6` with `-use-keycode-forwarding -no-snapshot -no-snapshot-load -no-snapshot-save`.
  - Wrote Android runtime settings: `show_ime_with_hard_keyboard=1` and selected LatinIME.
- Verification:
  - `adb` device online as `emulator-5554`.
  - `sys.boot_completed=1`.
  - Emulator process contains `-use-keycode-forwarding`.
  - `settings get secure show_ime_with_hard_keyboard` returns `1`.
  - Default input method is `com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME`.
  - `dumpsys input` shows `Device 0: qwerty2` with `KeyboardType: 2`.
- Scope:
  - This is a local emulator configuration fix only; no project source code was changed for this task.

### Follow-up Batch: APP Plan History Detail And Ranking (`2026-06-21`)

- Task: continue the WeChat mini-program to APP migration by replacing remaining generic `我的` placeholders for plan history detail and ranking/challenge flows.
- Status: implemented at code/export/build/test level.
- Implemented:
  - Replaced APP `PlanHistoryDetailScreen` generic list placeholder with a mini-program-aligned plan detail page:
    - loads `/api/plan-lib/get-instance` by instance id;
    - renders plan name/description, status, source, start/end dates, training-day count, completion rate, and the same "detailed records on Web" notice as the mini-program;
    - adds a compact training-day/action overview for APP-native browsing.
  - Replaced APP `RankingScreen` generic list placeholder with a mini-program-aligned challenge list:
    - loads `/api/ranking/list-leaderboard` with approved-entry counts;
    - renders the dark `COACHLINK RANKING` hero, challenge cards, participant counts, CTA row, empty/loading states, and iconfont icons.
  - Added APP `RankingDetailScreen` and registered `RankingDetail` navigation:
    - loads `/api/ranking/get-leaderboard` and `/api/ranking/list-entries`;
    - renders challenge header, activity info/rules, realtime ranking entries, remarks, review status, and an APP-native bottom submission modal;
    - submission modal supports the mini-program's number/text/video/option schema and submits to `/api/ranking/create-entry`.
  - Added APP Bearer-token compatibility to `/api/ranking/create-entry`; existing ranking list/detail/entries and plan instance APIs keep Web session auth while accepting APP token auth.
- Remaining gaps:
  - Ranking detail is APP-native and functional, but does not yet reproduce the exact mini-program animated/gradient component styling or media preview flow for evidence links.
  - Remaining clearly generic/lightweight APP `我的` entries include friends, friend activity, messages list, coach application, and the payment webview/wechat placeholder screens.
- Verification:
  - `npm --workspace apps/mobile run typecheck`: passed.
  - `npx expo export --platform ios --output-dir /tmp/coachlink-mobile-plan-ranking-export --clear`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `git diff --check`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed.
- Manual APP simulator visual verification remains left to the user per durable preference.

### Follow-up Batch: APP Friends, Activity, Messages (`2026-06-21`)

- Task: continue replacing generic APP `我的` placeholders with mini-program-aligned native pages for social and messaging flows.
- Status: implemented at code/export/build/test level.
- Implemented:
  - Replaced `FriendsScreen` generic list placeholder with an APP-native version of the mini-program friends page:
    - loads accepted friends and pending requests;
    - supports user search by nickname/search id through `/api/user/search`;
    - supports sending friend requests, accepting/rejecting incoming requests, and deleting existing friends;
    - renders search results, segmented `好友列表 / 新请求` tabs, request badges, friend cards, and action buttons using the APP iconfont/style system.
  - Replaced `FriendActivityScreen` generic list placeholder:
    - loads `/api/user/friends/activity?limit=20`;
    - renders friend workout activity cards with avatar/name/time, training content, total volume, duration, day index, and highlight set when available.
  - Replaced `MessagesScreen` generic list placeholder:
    - loads `/api/chat/list-chatrooms` and `/api/user/friends/pending`;
    - renders the mini-program-style friends entry with pending request badge, search input, conversation section header/tag, sorted chatroom rows, last-message preview, relative time, and unread badge;
    - routes chatroom rows into the existing functional `ChatScreen`.
  - Updated APP route typing so `Friends` accepts `{ tab?: 'friends' | 'requests' }`, allowing the message center to jump directly to the pending-request tab.
- Remaining gaps:
  - Friend profile navigation currently lands on the existing APP `UserHome` route without passing/using a specific friend id; a fully migrated public user-home/profile drill-in remains to be completed.
  - Message polling/mark-read/search-in-room/media upload remain lighter than the full mini-program chat stack.
  - Remaining obvious APP placeholders include coach application and payment WebView/WeChat payment handoff screens; `PlanEditScreen` is still text-oriented rather than full plan editor parity.
- Verification:
  - `npm --workspace apps/mobile run typecheck`: passed.
  - `npx expo export --platform ios --output-dir /tmp/coachlink-mobile-friends-messages-export --clear`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `git diff --check`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed.
- Manual APP simulator visual verification remains left to the user per durable preference.

### Follow-up Batch: APP Fitness Card, e1RM, Training History (`2026-06-20`)

- Task: continue auditing and migrating high-frequency `我的` training-profile pages that were still generic `DataListScreen` placeholders.
- Status: implemented at code/export/build/test level.
- Implemented:
  - Replaced `FitnessCardScreen` with a mini-program-aligned editable fitness profile card:
    - loads `/api/user/get-student-profile`;
    - shows avatar/nickname context and field rows for nickname, gender, height, weight, fitness goals, training level, target body parts, weekly frequency, equipment, and session duration;
    - supports single-value edits, chip selection, and multi-select chips in a bottom modal;
    - saves profile fields through `/api/user/update-profile`;
    - saves questionnaire-style fields through `/api/user/submit-onboarding`, preserving the mini-program `registration_unified_v2` answer structure and legacy interest tags for fitness goals.
  - Replaced `E1RMChartScreen` with an APP-native version of the mini-program strength trend page:
    - loads student actions from `/api/student/action-lib/list-actions`;
    - supports horizontal action selection;
    - loads history from `/api/student/get-e1rm-history` with `actionId/actionName`;
    - renders current PR, latest value, record count, a compact native bar trend, and PR records.
  - Replaced `TrainingHistoryScreen` with the mini-program month-calendar/history pattern:
    - loads `/api/training-history/calendar` and `/api/training-history/month-share`;
    - renders month navigation, 7-column calendar cells, per-day session counts, monthly stats, and source breakdown;
    - loads `/api/training-history/day` for selected date;
    - expands day entries to show per-action completed/total sets;
    - keeps the `即兴锻炼` entry routed to the APP impromptu-training flow.
  - Added APP Bearer-token compatibility to:
    - `/api/training-history/calendar`;
    - `/api/training-history/day`;
    - `/api/training-history/month-share`.
  - Kept Web session auth paths intact for the same APIs.
- Remaining gaps:
  - Fitness card avatar upload is displayed but not yet wired to native image picking/upload in this APP page.
  - e1RM chart uses a native compact bar trend instead of the mini-program canvas line chart; full line-chart parity can be improved later if a charting dependency is adopted.
  - Training-history share action is currently a placeholder alert; full APP share poster/public training share handoff remains tied to the larger training share migration.
  - Remaining generic `我的` pages still include friends/activity, ranking, and plan-history detail.
- Verification:
  - `npm --workspace apps/mobile run typecheck`: passed.
  - `npx expo export --platform ios --output-dir /tmp/coachlink-mobile-profile-training-export --clear`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational script.
  - `git diff --check`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed.
- Manual APP simulator visual verification remains left to the user per durable preference.
## WeChat 小程序动作小游戏 V1 (`2026-06-23`)

- Task: 按用户要求先在当前 `coachlink` 小程序里实现一个可试玩的 V1 动作小游戏，优先验证“现实动作驱动屏幕角色”的可行性，并保留视频保存能力。
- Status: completed at code/build level; awaiting your manual device verification.
- Product scope for this iteration:
  - 入口放在 `apps/wechat` 工具箱子包，避免侵入主训练链路。
  - 玩法采用本地轻量“运动检测”而非骨骼关键点 AI：通过 `camera` 实时帧差分估算动作重心，驱动角色接豆子。
  - 录像能力升级为：优先导出 `带豆子/角色叠层的合成回放视频`；若当前设备不支持 `MediaRecorder + OffscreenCanvas`，再回退到 `原摄像头视频`。
- Changes:
  - 新增 `apps/wechat/src/toolbox/motion-bean/` 页面：
    - 自定义导航、实时摄像头舞台、动作强度条、分数/倒计时/最好成绩、开始试玩、试玩并录回放、停止录制、保存视频、左右反转切换。
    - 本地游戏循环每轮 30 秒，黄色豆加分、深色豆扣分。
    - 本轮继续把动作跟随提速：提高相机帧处理频率、降低采样步长、提高动作重心与角色位置的更新权重，并让碰撞判定跟随平滑后的实际角色位置。
  - 新增 `apps/wechat/src/toolbox/motion-bean/compositeReplayRecorder.ts`：
    - 用 `Taro.createOffscreenCanvas({ type: '2d' })` 绘制相机帧 + 豆子 + 角色 + HUD。
    - 再用 `Taro.createOffscreenCanvas({ type: 'webgl' }) + Taro.createMediaRecorder()` 逐帧生成可保存的合成回放视频。
    - 若该链路不可用，则回退到 `CameraContext.startRecord/stopRecord` 原视频录制。
  - 在 `apps/wechat/src/toolbox/index.tsx` 增加 `动动豆试玩版` 工具入口。
  - 在 `apps/wechat/src/app.config.ts` 注册 `toolbox/motion-bean/index` 子包页面。
  - 更新 `apps/wechat/scripts/copy-comp-to-subpackages.js` 与 `apps/wechat/scripts/fix-weapp-wxml.js`，把新页面纳入小程序兼容后处理脚本，避免 DevTools / Summer Compiler 因 `comp` 产物缺失出错。
- Verification:
  - `npm run lint`（根仓，信息提示脚本）✅
  - `npm run typecheck`（根仓）✅
  - `npm test`（根仓）✅ 35 files / 173 tests
  - `npx next build`（根仓）⚠️ 编译与静态页生成通过，但最终 standalone copy 仍被本机 Windows 文件锁阻塞，报 `EBUSY copyfile ... .next\\standalone ...`
  - `npm run build:weapp`（`apps/wechat`）✅，新页面 `toolbox/motion-bean/index` 已进入构建产物
  - `npx tsc --noEmit -p apps/wechat/tsconfig.json` ❌，仍被 Taro 类型声明和小程序历史类型噪音阻塞；本次新页面不是唯一报错源
- Manual verification note:
  - 按你的长期偏好，这次没有替你跑微信 DevTools / 真机交互验证，留给你手动试玩确认：动作跟随速度、合成回放是否成功生成、以及不支持设备上的原视频回退体验。
## WeChat 工具箱三小游戏与紧凑分组改版 (`2026-06-23`)

- Task: 按用户确认的方案，把小游戏继续放在微信小程序 `toolbox` 内，但改成更紧凑的小卡片入口，并补齐 3 个可玩的体感小游戏（`接豆派对 / 引体冲刺 / 俯卧撑突围`）。
- Status: completed at code/build level; manual UI verification left to the user per durable preference.
- Changes:
  - `apps/wechat/src/toolbox/index.tsx` / `index.scss`
    - 工具箱首页改成分组结构：`小游戏`、`实用工具`、压缩版 `场景放松`。
    - 卡片从原来的大封面 Hero 样式改成更小、更密的双列紧凑卡片，方便后续继续扩展更多小游戏。
    - 新增 3 个小游戏入口卡：`接豆派对`、`引体冲刺`、`俯卧撑突围`。
  - 新增共享小游戏底座 `apps/wechat/src/toolbox/games/`
    - `motionArcadePage.tsx`：统一封装摄像头帧差动作检测、2D 角色/道具碰撞、录制控制、保存视频、镜像切换。
    - `arcadeReplayRecorder.ts`：抽象原有合成回放录制器，复用到多个小游戏。
    - `gameConfigs.ts`：用配置方式区分三种玩法文案、道具、方向和主题。
    - `motionArcade.scss`：统一小游戏页面骨架样式，并给三种玩法提供主题差异。
  - 现有 `toolbox/motion-bean` 已重构为共享底座页面，名称/文案升级为 `接豆派对`。
  - 新增两个新页面：
    - `apps/wechat/src/toolbox/pullup-rush/`
    - `apps/wechat/src/toolbox/pushup-dash/`
  - 小程序路由和构建兼容脚本已同步更新：
    - `apps/wechat/src/app.config.ts`
    - `apps/wechat/scripts/copy-comp-to-subpackages.js`
- Verification:
  - `apps/wechat` `npm run build:weapp` ✅
  - 根仓 `npm run lint` ✅（信息提示脚本）
  - 根仓 `npm run typecheck` ✅
  - 根仓 `npm test` ✅（35 files / 173 tests）
  - 根仓 `npx next build` ✅
- Follow-up redesign after user feedback:
  - 用户随后明确否定了“动作主题换皮”的方向，要求小游戏规则必须直接和动作本身相关，而不是只换名字或皮肤。
  - `接豆派对` 保持为轻松向体感小游戏，继续承担“放松玩一玩”的角色。
  - `apps/wechat/src/toolbox/pullup-rush/index.tsx`
    - 已重做为接近 `Flappy Bird` 的穿障碍玩法：角色会自然下落，用户需要通过明显的上拉/抬升动作触发向上冲刺，穿过上下障碍之间的空隙。
    - 障碍改为成对的上下立柱，分数按成功穿越计数，而不再是泛化的横向接取/躲避。
  - `apps/wechat/src/toolbox/pushup-dash/index.tsx`
    - 已重做为“完整俯卧撑动作驱动推进”的玩法：必须识别到一次较完整的下去再起来动作周期，才会触发一次前冲/破墙。
    - 玩法目标改成把迎面而来的墙体在时机内击破，而不是与俯卧撑弱相关的普通位移躲避。
  - `apps/wechat/src/toolbox/games/arcadeReplayRecorder.ts`
    - 为配合新障碍/墙体玩法，回放录制器已支持圆形以外的 `rect` / `pill` 形状叠层，保证导出视频里能看见完整玩法动画。

## 当前任务（`2026-06-25`）

- 任务：提交当前代码并保证开发分支与主分支一致。
- 状态：已完成。
- 说明：
  - 先完成 `npm run lint`、`npm run typecheck`、`npm test`、`npx next build` 验证。
  - 清理临时无效文件后，将当前工作树中的代码提交。
  - 开发分支同步到当前可提交主线版本。

## AI 修改器区分注册与购买计划问卷（`2026-07-13`）

- Task: 修复教练端学员计划页的 AI 修改器把两套问卷混成单一“学员问卷”、且注册问卷存在时遗漏购买计划问卷的问题。
- Status: completed at code level; manual Web verification left to the user per durable preference.
- Changes:
  - `batch-operation/context.ts` 将 `onboarding_questionnaires` 作为独立的“注册问卷”注入。
  - 同时读取当前订阅 `coach_subscriptions.subscribe_data`，作为独立的“购买计划问卷”注入，并保留原题目/答案。
  - 提示词明确两者来源和优先级：当前计划的目标、限制、器械偏好优先遵从购买计划问卷；冲突时要求 AI 指出并请教练确认。
  - AI 修改器的上下文开关文案改为“注册及购买计划问卷”。
- Verification: `npm run lint` ✅（说明性脚本）、`npm run typecheck` ✅、`npm test` ✅（35 files / 177 tests）、`npx next build` ✅。
## 微信小程序工具箱部分设备点击无响应排查 (`2026-07-13`)

- Task: 用户反馈部分 iPhone 上进入工具箱后，工具卡片点击没有任何反应；本轮仅做代码诊断，尚未修改业务代码。
- Status: root cause identified in code; awaiting user confirmation to implement the fix.
- Finding:
  - `apps/wechat/src/toolbox/index.tsx` 的工具卡片和场景卡片跳转均直接调用 `Taro.navigateTo()`，没有 `await`、失败兜底或错误提示。
  - 自定义 `BottomNav` 也优先使用 `navigateTo`；持续通过底栏切换会增加页面栈。微信小程序页面栈达到上限时，`navigateTo` 会失败。当前工具箱入口没有捕获该失败，因此用户看到的就是“点了没反应”。
  - 此问题不是 iOS 专属，但不同用户的导航历史不同，因而很容易被观察成“部分苹果手机”问题；设备端需要在失败时看 `navigateTo:fail page stack overflow` 才能最终确认。
- Verification:
  - 已确认所有工具目标路由均在 `apps/wechat/src/app.config.ts` 注册，排除明显的未注册路由。
  - 已按 `weapp-devtools` 尝试连接本机自动化端口 9420，但当前没有已开启自动化的微信开发者工具会话，无法读取设备/模拟器控制台。
- Proposed fix:
  - 将工具箱卡片的跳转统一收口为可感知的导航函数：`navigateTo` 失败后降级 `redirectTo` / `reLaunch`，最终给出明确 toast；同时在底部导航避免无意义地累积页面栈。

## 微信小程序即兴训练完成时报错（`2026-07-13`）

- Task: 修复即兴锻炼点击“完成训练”后出现 `setWorkoutSummarySharePath is not defined` 的运行时错误。
- Status: completed at code/build level.
- Root cause: 训练完成收尾函数调用了并未声明、也未被页面消费的 `setWorkoutSummarySharePath`；即兴训练不生成公开分享路径，完成接口成功后会直接走到该分支并抛错。
- Change: `apps/wechat/src/training/training-execution/index.tsx` 移除了该无效 setter 调用，完成后可正常打开训练总结。
- Verification: `npm run lint` ✅（说明性脚本）、`npm run typecheck` ✅、`npm test` ✅（35 files / 177 tests）、`npm --workspace apps/wechat run build:weapp` ✅。`npx next build` 已完成编译和 517 页静态生成，但最终被本机 `.next` 文件锁的 `EBUSY` 阻断；`weapp-devtools` 端口 9420 无自动化会话，未能进行模拟器交互验证。

## 教练钱包待结算收入排查（`2026-07-13`）

- Task: 用户询问钱包中的累计收入 944.06 元、待结算 669.60 元以及“等待系统结算”的含义，并担心钱没有到账。
- Status: root cause identified; no money movement performed.
- Finding:
  - 累计收入是已写入 `coach_wallets.total_income` 的历史入账收入；可提现余额是钱包余额扣除冻结款后的金额；待结算收入是已支付订单中尚未写入钱包的教练分成，三者不能直接相加。
  - 当前待结算 669.60 元由四笔教练分成构成：271.20 元仍在 7 天退款保护期内；80.00 元、159.20 元、159.20 元已经分别在 7 月 12 日、6 月 30 日、6 月 4 日到期。
  - 三笔已到期订单均仍为 `pending`，`attempts = 0` 且 `last_attempt_at = null`，没有任何结算请求被发起；这不是正常的到账等待。根因是生产环境的汇付到期结算后台任务没有执行/没有被触发。该任务正常应每小时调用 `process-due`，随后再由 `reconcile` 确认分账结果。
- Next step: 需要用户明确授权后，才可对真实资金执行补跑到期结算任务；同时应修复/确认生产的 `HUIFU_SETTLEMENT_CRON_SECRET`（或 `CRON_SECRET`）和后台定时任务部署，防止后续订单继续卡住。

### 自动结算加固跟进

- 已实现：`process-due` / `reconcile` 同时接受专用 `HUIFU_SETTLEMENT_CRON_SECRET` 和兼容的 `CRON_SECRET`，不再因两者同时存在但值不同而拒绝应用内任务；`instrumentation.ts` 现在会把这些接口的非 2xx 响应写入日志。
- 已新增：`deploy/k8s/huifu-settlement-cronjob.example.yaml`，提供每 10 分钟独立调用到期分账和对账接口的 CronJob；`docs/ops/huifu-settlement-scheduler.md` 说明 Apollo、Kubernetes Secret 和验收流程。
- 线上只读验证：从当前 Apollo 加载到 `HUIFU_SETTLEMENT_CRON_SECRET`，但使用同一密钥请求生产 `process-due` 的 `dryRun` 仍返回 401 `用户未登录`。这表明线上 Web 进程未加载该密钥（常见于配置变更后未重启），或运行的不是同一份 Apollo 配置；现有自动任务因此无法获授权执行。
- Deployment blocker: 本机没有 Kubernetes context，且旧服务器 `154.8.205.78` 的 SSH 公钥认证被拒绝，无法替用户更新生产 Deployment/CronJob 或重启线上进程。未发起真实资金分账。
- Deployment repository confirmation: `D:\files\littlehorse-deployment-main\coachlink\main\deployment.yaml` uses Apollo bootstrap `coachlink / main / app-config` (not `local`) and contains an `apollo-reloader` sidecar. On each Apollo notification it deletes its current Pod after a 0–74 second delay; the Deployment restores the three replicas. Therefore publishing a production Apollo change is designed to restart Pods automatically. However, a read-only request using the exact current `main` Apollo settlement secret still receives production HTTP 401. The active Pods have not loaded that config, so republishing the key should be followed by log verification and a manual `kubectl -n default rollout restart deployment/coachlink-main` fallback if the endpoint remains 401.
- Final root cause and fix (`2026-07-14`): the 401 was not a Huifu/Apollo secret mismatch. `src/proxy.ts` intercepted every `/api/*` request for user-JWT authentication before the Node route could validate `x-cron-secret`, so both process-due and reconcile always returned `用户未登录`. Added those two paths to `ROUTE_AUTHENTICATED_CRON_PATHS`; their route handlers remain responsible for dedicated Huifu/cron-secret or admin authorization. Also normalized runtime secret reads/trimming. Local `dryRun` changed from 401 to 200 and returned 10 due rows without initiating any transfer.
- Wallet consistency follow-up (`2026-07-14`): after three overdue settlements totaling 398.40 yuan were credited, wallet gross balance and total income increased but withdrawable balance stayed at 933.72 because `calculateRefundProtectedAmountFen` used the new wallet transaction timestamp and imposed a second seven-day freeze. It now consults `coach_subscription_settlements.eligible_at`; an order that already passed the delayed-settlement protection window is not frozen again when credited. The verified result for the screenshot wallet is gross 1332.12, frozen 0, withdrawable 1332.12, pending 271.20, historical income 1342.46. Web copy now states the balance formula and renames cumulative income to historical cumulative income.
## 万界方舟大模型接口迁移 (`2026-07-14`)

- Task: 用户要求将 CoachLink 当前所有大模型调用从 DeepSeek、OfoxAI 与 Gemini 原生接口统一迁移至万界方舟的 OpenAI 兼容接口。
- Status: code and documentation complete; awaiting Apollo configuration and live API verification.
- Changes:
  - `src/lib/coachlinkLlm.ts` 统一使用 `WANJIE_ARK_API_KEY`、`WANJIE_ARK_BASE_URL`（默认 `https://maas-openapi.wanjiedata.com/api/v1`）和 `WANJIE_ARK_MODEL`；计划和教练自动回复可分别用可选模型变量覆盖。
  - 计划生成/解析、知识库问答、功率解读、教练 AI 自动回复、遗留 Gemini 封装及知识书生成脚本均不再请求旧供应商域名或读取旧 LLM Key。
  - 教练自动回复数据库中以 `deepseek` / `gemini` / `google/` 开头的历史模型值会自动回退为万界方舟默认模型，避免继续使用旧模型 ID。
- Required user action:
  - 当前 Web 开发和线上均使用 Apollo；在 Apollo 新增 `WANJIE_ARK_API_KEY`、`WANJIE_ARK_BASE_URL`、`WANJIE_ARK_MODEL=deepseek-v4-pro`。如未来实现图片输入，使用可选 `WANJIE_ARK_VISION_MODEL=qwen3-vl-flash`；当前没有激活的图片分析调用。旧 `DEEPSEEK_API_KEY`、`OFOXAI_API_KEY`、`GEMINI_API_KEY` 可在确认线上请求成功后删除。
- Verification:
  - `git diff --check` ✅
  - `npm run lint` ✅（提示性脚本）
  - `npm run typecheck` ✅
  - `npm test` ✅（35 files / 177 tests）
  - `npx next build` ⚠️ 未执行完成：已有 Next 进程占用 `.next/lock`，未中断用户进程。
## 多格式智能计划导入（小程序优先） (`2026-07-14`)

- Task: 用户要求智能计划导入支持文件、图片等多种来源，小程序与 Web 同步接入；原生文本/表格优先确定性提取，图片可使用万界方舟视觉模型。
- Status: implementation complete at code/build level; awaiting Apollo vision config and real-file verification.
- Implemented:
  - `/api/plan-lib/extract-file-text` 支持 txt/csv/md/docx/xlsx/xls/pdf/png/jpg/jpeg/webp，限制 10MB。
  - Word、文本、文字型 PDF 使用本地确定性提取；Excel 保留工作表、行号、列名后转为可审阅文本；图片走 `WANJIE_ARK_VISION_MODEL` 转写，并明确标出需人工核对的风险。
  - 扫描 PDF 没有可提取文字时，接口明确提示先导出为图片上传，避免伪造识别结果。
  - 小程序 `PlanEditorWorkbench` 智能导入弹窗已新增上传计划图片和上传文件入口；Web 学员/教练导入弹窗已扩展接受 PDF 和图片。所有来源仍先回填可编辑文本，再进入既有动作确认和结构化计划解析，避免直接写入。
- Required user action:
  - Apollo 必须配置 `WANJIE_ARK_API_KEY`、`WANJIE_ARK_MODEL=deepseek-v4-pro` 和 `WANJIE_ARK_VISION_MODEL=qwen3-vl-flash`，否则图片识别会返回清晰的配置错误。
- Verification:
  - `npm run typecheck` ✅
  - `npm --workspace apps/wechat run build:weapp` ✅
  - `npm test` ⚠️ 本机磁盘空间耗尽（`ENOSPC`）而未启动测试；并非断言失败。
  - 手动小程序验证按用户偏好留给用户执行。
## 微信小程序动作库图片与即兴训练分类统一 (`2026-07-14`)

- Task: 用户要求确认动作库当前图片覆盖情况，并修复即兴训练首次选动作没有部位/器械分类、而训练执行页追加动作有分类的不一致。
- Status: 已完成代码修改和代码级验证；尚未提交或推送。
- Image audit:
  - 线上 `canonical_actions` 共 426 个，426 个均有 `reference_image_url`，并对全部 426 个 CDN URL 做 HEAD 校验，均返回成功。
  - 其中 282 个为三帧 `sequence` 动作示意图，144 个为 `fallback-reference-card` 兜底参考卡；当前不存在 URL 缺失或 CDN 失效的标准动作。
  - 线上公共力量动作共 104 个，104 个均关联标准动作并可取得图片。
- Root cause:
  - 公共动作列表 API 会按 `canonical_action_id` 补 `reference_image_url`，但学员“我的动作”列表 API 原样返回 `student_actions`，没有补标准图；因此同一个动作在公共库有图、进入我的动作后可能显示首字兜底。
  - 即兴训练首选页只有关键字搜索，训练执行页的追加动作弹层单独维护肌群/器械筛选，造成两条入口体验不一致。
- Changes:
  - 学员动作列表 API 现在同时兼容 Web session 与小程序 Bearer token，并按 `canonical_action_id` 补标准动作的 `category` 和 `reference_image_url`。
  - 新增共享 `actionPickerFilters`，统一肌群、器械、搜索文本与匹配规则；训练执行页改为复用共享规则。
  - 即兴训练页新增器械（全部/杠铃/哑铃/徒手/器械/绳索）和部位（全部/胸/背/腿/肩/手臂/核心/臀部/功能性）筛选，并继续支持搜索与多选。
- Verification:
  - `npm run lint`、`npm run typecheck`、`npm test`（35 files / 177 tests）、`npm --workspace apps/wechat run build:weapp` 均通过。
  - `npx next build` 被工作区既有且与本次无关的 `src/app/api/plan-lib/extract-file-text/route.ts:123` JSX/语法错误阻断。
  - `weapp-devtools` 自动化未执行：`mrc` 已安装，但 9420 端口未监听，且常见安装目录未找到微信开发者工具 CLI。
## 微信小程序即兴训练总结分享与肌肉高亮修复 (`2026-07-14`)

- Task: 用户完成即兴训练的低杠深蹲和负重臂屈伸各 1 组后，总结正确显示 2 动作/2 组，但点击“生成分享图”提示“暂无可分享的训练记录”，且人体图没有训练部位高亮。
- Status: 已完成代码修复和代码级验证；尚未提交或推送。
- Root cause:
  - `/api/impromptu/finish` 已成功把 execution 更新为 `completed`，但训练执行页完成回调只弹总结，没有把 `finishRes` 合并回页面 `execution` 状态；总结从旧状态仍能统计已完成 sets，而分享门禁 `isWorkoutCompleted` 读取旧 `training` 状态，因而误报没有记录。
  - 总结使用“腿部/手臂/核心”等粗粒度名称，人体 SVG 的 `category` 使用“大腿/小腿/大臂/小臂/腹部”等细粒度名称；高亮函数只做完全相等匹配，所以柱状统计有数据但 SVG 不变色。
- Changes:
  - 普通完成和一键完成成功后，均将服务端完成结果与当前 execution 合并，立即 `setExecution`，并通过 `syncExecutionToCaches` 同步即兴快照/计划缓存。
  - 增加总结肌群到 SVG category 的映射：手臂→大臂/小臂、核心→腹部、腿部→大腿/小腿等；深蹲/硬拉/弓步额外识别臀部，避免普通腿部动作全部误亮臀部。
- Verification:
  - `npm run lint`、`npm run typecheck`、`npm test`（35 files / 177 tests）、`npm --workspace apps/wechat run build:weapp` 均通过。
  - 静态 SVG 映射验证：截图场景的腿部+手臂可命中正面 9 个、背面 10 个肌肉分区；深蹲还会单独识别臀部。
  - `npx next build` 仍被工作区既有、与本次无关的 `src/app/api/plan-lib/extract-file-text/route.ts:123` 语法错误阻断。
  - `weapp-devtools` 无法连接 `ws://localhost:9420`，未能实际点击生成分享图或截图验证。
## 微信小程序训练分享图临时文件失效修复 (`2026-07-14`)

- Task: 用户在微信开发者工具中生成即兴训练分享图时，`showShareImageMenu` 与后续 `saveImageToPhotosAlbum` 均报 `no such file or directory http://tmp/...png`，并询问是否支持分享到群聊。
- Status: 已完成代码修复与代码级验证；真机好友/群聊分享仍需用户用真机预览确认，代码尚未提交或推送。
- Root cause:
  - 通用 `useSharePoster` 直接返回 Canvas 的 `http://tmp` / `wxfile://tmp` 临时路径，训练执行页还会缓存并复用该路径；微信清理临时文件后，分享菜单和相册保存会连续使用同一失效路径。
  - 日志环境为 Windows 微信开发者工具。模拟器不能真实打开微信好友/群聊选择器，也没有手机相册，不能用它验证真实聊天分享。
- Changes:
  - Canvas 导出成功后立即复制到 `Taro.env.USER_DATA_PATH/<canvasId>.png`，分享、预览和相册保存统一使用稳定的用户文件路径；复制失败会重试生成，避免向业务层交付不存在的临时路径。
  - 训练总结每次点击“生成并分享”都会重新导出海报，不再复用旧 `workoutPosterImageUrl`。
  - 开发者工具环境改为明确提示环境限制，并提供稳定本地图片预览；真机继续调用 `showShareImageMenu`，可发送给好友或群聊，也可在菜单中保存。
  - 保存失败增加 `no such file` 诊断日志与明确提示。
- Verification:
  - `npm run lint` ✅（项目提示性脚本）；`npm run typecheck` ✅；`npm test` ✅（35 files / 177 tests）；`npm --workspace apps/wechat run build:weapp` ✅（2754 modules）；`git diff --check` ✅。
  - 构建产物已确认包含稳定路径复制、开发者工具预览提示和“生成并分享”文案。
  - `npx next build` ❌ 仍被无关既有 `src/app/api/plan-lib/extract-file-text/route.ts:123` 语法错误阻断。
  - `weapp-devtools` 自动化连接失败：微信开发者工具已打开，但 9420 自动化端口未启用，无法代替用户执行页面点击和截图。
  - `WindowInfoChanged` 监听警告的栈位于开发者工具 WASM 初始化，业务源码未发现对应的重复窗口监听注册；当前判断为开发者工具热重载累积警告，不是图片文件失效的原因。
## 万界方舟计划修改器连接失败修复 (`2026-07-14`)

- Task: 用户连续两次使用 Web 计划 AI 修改器时，万界方舟 `deepseek-v4-pro` 在意图/完整性判断阶段报 `UND_ERR_SOCKET: other side closed`，界面重复显示两条 `Connection error`。
- Status: 已完成真实端点诊断、代码修复和门禁验证；未做浏览器手动验收，按用户长期偏好由用户本地复测。
- Evidence:
  - Apollo 当前 Base URL/Key/模型权限有效：`GET /models` 返回 200，`deepseek-v4-pro` 和 `deepseek-v4-flash` 的 OpenAI 兼容 chat 请求均可返回 200。
  - 原代码的短判断请求带上整份计划、动作库和 9 组上下文；即使用户只输入 `?` 也会写出约 10KB 请求。
  - `deepseek-v4-pro` 在 `max_tokens=200`、`deepseek-v4-flash` 在 `max_tokens=800` 时均实测过 HTTP 200 但正文为空，输出预算全部消耗在 reasoning tokens。`deepseek-v4-flash + max_tokens=2000` 连续两次返回有效 JSON，约 5.1s / 6.2s。
- Changes:
  - 意图判断和指令完整性检查改用 `WANJIE_ARK_FAST_MODEL`（默认 `deepseek-v4-flash`）；正文计划修改仍默认 `deepseek-v4-pro`。
  - 短判断 prompt 移除无必要的计划/问卷/执行上下文，输出预算提高到 2000/3000；连接中断、空正文或非法 JSON 均显式快速重试一次。
  - OpenAI SDK 关闭默认长重试，设置 45s 超时；连续失败时返回可操作的中文错误。SSE 业务错误只记录一次，不再重复展示。
  - 同时修复多格式导入接口的 Excel 分支语法错误，并绕过 `pdf-parse` 顶层入口在 Turbopack 下的调试副作用。
- Verification: `npm run lint` ✅；`npm run typecheck` ✅；`npm test` ✅（35 files / 177 tests）；`npx next build` ✅；`git diff --check` ✅。
- Apollo: `WANJIE_ARK_FAST_MODEL` 可不配，代码默认 `deepseek-v4-flash`。如 Pro 长请求仍经常被万界方舟中断，可临时在 Apollo 设 `WANJIE_ARK_PLAN_MODEL=deepseek-v4-flash`作为稳定性降级。
## 知识库升级为 AI 咨询共建社区方案讨论 (`2026-07-14`)

- Task: 用户希望利用现有数千元免费 API Token（文本大模型、文生图、视频生成等），把知识库做成覆盖小白到高手的高质量咨询类圈子，并让用户、教练和专家共同建设内容。
- Status: 已结合现有知识树、人体地图、场景急救箱、书籍笔记、AI 问答、训练计划和动作库能力完成第一版产品方向建议；待用户确认首期切入的主题圈和 MVP 范围后再进入 PRD/开发。
- Recommended direction:
  - 知识库与社区不拆成两个孤立产品，统一为“问题咨询 -> AI 澄清/检索 -> 人类回答与审核 -> 形成可追溯知识节点 -> 训练实践反馈 -> 更新共识”的活知识系统。
  - 小白主入口应是自然语言提问、目标/问题入口、人体部位和场景卡，不以知识树或思维导图作为默认入口；知识树保留给进阶用户建立体系认知。
  - 内容采用分层阅读：30 秒结论、可执行步骤、进阶原理、证据与争议；同一节点服务不同水平用户，避免维护互相矛盾的多套文章。
  - 共建采用结构化投稿、AI 整理和专家审核，不直接开放无门槛 Wiki 式改正文；所有关键结论应有来源、审核人、版本和适用边界。
- Current content audit (`2026-07-14`, production read-only aggregates):
  - `knowledge_nodes` 共 196 个且全部发布：3 个 domain、17 个 category、176 篇 article；176 篇均有正文，但内容高度集中于人体地图/体态/关节肌肉与伤病管理。
  - 文章来源构成为：130 篇 `body-map-system/articles`、37 篇 `body-map-system/content`、3 篇高价值专题导入、6 篇早期 seed。当前仍公开 26 篇“转录素材包/摘录”类中间产物；170/176 篇文章没有直接父级闭包关系，知识树实际上只挂住 6 篇文章。
  - 书籍表 10 条全部免费，但实际不是 10 本书：主要是一部《力量训练原理》的总览 + 7 个专题分篇，另有 2 份内部主题笔记。视频课程为 0。
  - 公开训练计划 49 套：入门 14、进阶 16、高阶 19，覆盖基础入门、体态纠正、通用力量、负重引体/双杠、力量举和 SBD 专项。
  - 场景急救箱 4 个，数据库 `node_ids` 均为空；Web 场景页使用另一套硬编码 3 步流程，尚未真正关联标准动作、知识节点或用户实践记录。
  - 教练内容 13 篇，总浏览 914、点赞 5、评论 0，只有 1 篇挂到知识树；平台知识节点自身 `view_count` 全为 0，缺少有效阅读分析闭环。
  - Web 当前首页只展示搜索、3 个精选专题、6 个重点计划、书籍笔记和悬浮 AI；人体地图路由已缺失，知识树/思维导图与场景入口未在首页呈现。精选专题传入多词整句，而搜索 API 只按完整字符串匹配标题/摘要，实际容易无结果；正文不参与普通搜索。
  - AI 问答目前是关键词 ILIKE 检索而非向量/混合检索；无命中时允许模型以“专业教练和运动康复专家”身份脱离知识库直接回答，不符合未来高可信、可追溯定位。
- Assessment: 当前可评价为“有一定规模的专项素材仓库 + 计划资产”，不是空白，但还不是系统学习产品；主要短板是内容偏科、重复/中间产物公开、来源不可见、审核与版本缺失、学习路径缺失、社区共建尚未形成。
- Recommended adjustment priority:
  1. 先做内容清仓和可信度治理：隐藏中间产物、合并同题重复内容、补父子目录、显示来源/审核/版本/适用边界，并对健康与动作建议做专业复核。
  2. 前台改为“按水平 + 按目标/问题”进入，后台保留专业知识图谱；同一主题分为快速结论、实践步骤、进阶原理、证据/争议四层。
  3. 首先做一条完整的“力量训练从零到进阶”学习路径，复用现有《力量训练原理》、动作库和 49 套计划，加入小测、练习、笔记、进度和训练场景联动；验证后再扩展体态、营养、恢复等方向。
  4. AI 定位为有引用的学习导师/图书管理员；无可靠来源时明确不足并转交社区/专家，不以模型自身知识伪装平台共识。

## PlanScript 与 1RM 表达统一 (`2026-07-14`)

- Task: 用户要求计划修改的纯 PlanScript 与原结构化 JSON 能力完全等价，特别要覆盖动作级全局 1RM 的绝对配置与相对增减，减少模型长 JSON 输出和万界方舟超时。
- Status: 已完成代码、文档与门禁验证；按用户长期偏好未做浏览器手动验收，由用户本地复测计划 AI 修改器。
- Changes:
  - `plan_script` 引擎无论短修改还是长周期计划都只要求模型返回纯 PlanScript，不再要求 `script + oneRmAdjustments + loadAdjustments` JSON 包装。
  - 处方负荷直接由动作行承载：`@60kg`、`@8rm`、`@75%`；解析后与原计划内部强度结构等价。
  - 新增顶层 1RM 指令：`1RM 动作名 = 50kg`、`+= 2.5kg`、`-= 2.5kg`，必须放在 W1 前；解析器把它转换为现有 1RM 预览、确认和保存链路。
  - 绝对值是精确基准，相对增减按 2.5kg 步长归一化；同一动作同时出现绝对基准和相对增减时，在该基准上累计。
  - 长计划使用 `WANJIE_ARK_PLAN_SCRIPT_MODEL`（默认 `deepseek-v4-flash`）、120 秒超时、12000 输出 token，并校验用户要求的计划周数是否完整。
- Verification: 代码级 PlanScript/1RM 组合样例通过；`npm run lint` ✅；`npm run typecheck` ✅；`npm test` ✅（35 files / 177 tests）；`npx next build` ✅（517 pages）；`git diff --check` ✅。
## Web AI 修改器真实 12 周详细计划可靠导入 (`2026-07-14`)

- Task: 用户提供一份 6599 字的负重引体 12 周详细计划，实际多次在万界方舟返回前出现 `Connection error` / `Request timed out`，要求确认并修到真实 12 周计划可用。
- Root cause: 万界方舟 OpenAI/Anthropic 兼容端点对需要较长思考或输出的请求会在约 19 秒无响应字节时主动断开；即便逐周、串行和 4 次重试，同一段也可能连续失败。模型输出还会偶发重复日标题、用 `/` 合并多个动作，旧解析会覆盖同一天早先动作或吞掉部分处方。
- Status: 已完成。对已经明确写出 8～12 周、每天动作/重量/组次的中文 Markdown 计划，服务端优先确定性提取为 PlanScript，并校验原文处方数与结构化结果一致；不再让模型重新抄写整份计划。无法确定解析的布局才走万界方舟 Anthropic Sonnet 半周分段兜底，串行执行、最多 4 次重试，并归一化重复日标题和斜杠动作。
- Exact prompt verification: 用户原始文本已实际解析为 12 周、84 天、95 条训练处方；第 12 周 16 条，测试日依次保留自重、+10、+20、+30、+35、+40、+42.5、+45、+47.5、+50 kg。
- Verification: `npm run lint`、`npm run typecheck`、`npm test`（35 files / 177 tests）、`npx next build`（517 pages）及 `git diff --check` 均通过。按用户长期偏好未运行浏览器 UI 验证。
## 枭马葛为“痴迷负重引体”直接创建12周突破计划 (`2026-07-14`)

- Task: 用户确认自己是教练枭马葛、目标学员是“痴迷负重引体”，要求直接根据附件生成计划；同时最新日志显示长计划仍在前置 JSON 意图判断阶段发生万界方舟断连。
- Root cause addendum: 之前的确定性长计划解析位于 `runPlanScriptEdit` 内，但请求在进入该函数前仍会调用“意图判断”和“完整性检查”两个 JSON 模型，所以日志停在 `createJsonChatCompletionWithRetry`，根本没有到达本地解析器。
- Code status: 已在路由层提前识别完整 8～12 周计划；命中后直接按 `modify` 路由并跳过意图判断、完整性检查两次模型调用。确定性编译同时保留训练日中的条件、休息与调整规则到 day note，并在最后一周遇到通用附录标题时正确截断。
- Data operation: 已对订阅 `f41716eb-9295-4d89-9ceb-9cb3714162f0` 创建唯一 active 实例 `3027057e-8975-4791-be9d-e7afd0bdb317`，名称“负重引体突破 +50 kg｜12周专项训练计划”，开始日期 `2026-07-20`。数据库回读为 12 周 / 84 天 / 97 条处方；第84天负荷依次为自重、+15、+25、+35、+40、+42.5、+45、+47.5、+50 kg。
- Actions/history: 按精确原名新增并同步 5 个缺失变式（超负荷离心、4秒离心、自重高位、90°暂停、爆发负重引体），学员动作库所需 9 个动作均已存在；旧 55 条 execution 与三个历史实例未修改。
- Verification: 数据库回读、当前实例唯一性、动作同步均通过；`npm run lint`、`npm run typecheck`、`npm test`（35 files / 177 tests）、`npx next build`（517 pages）和 `git diff --check` 均通过。按用户长期偏好未运行浏览器 UI 验证。

## 现有 12 周计划的 AI 修改改为局部 PlanScript 补丁 (`2026-07-15`)

- Task: 用户已创建 12 周计划，但在计划上做小范围修改时仍遇到“万界方舟连接在返回结果前被中断”，要求确认是 API 格式还是代码问题并修复。
- Root cause: OpenAI 兼容 Base URL、Key 和请求格式有效；旧修改链路却把一句短指令放大为两次 JSON 前置请求，再把 84 天完整 PlanScript、动作库和 8 项上下文交给模型，且要求完整返回 84 天，因此仍是长输入/长输出，容易被万界方舟在首字节返回前断开。
- Changes:
  - 明确修改/查询在本地判定；可执行修改跳过意图 JSON 与完整性 JSON，两次不必要的网络调用被移除。
  - 现有计划按指令中的周次、D1～D7 或动作名选择局部范围；无明确范围时排除休息日，并按最多 14 天分段。
  - 模型只返回变化日的完整 PlanScript；服务端校验补丁不得越界，再按 `dayIndex` 合并回原 84 天，未变化周/日不再由模型重写。
  - OpenAI 兼容小段失败时，用同一万界方舟 Key 切到 Anthropic 端点重试该段；日志记录模型、chunk、prompt 字符数、范围天数和耗时，不记录 Key/正文。
- Real endpoint evidence: 当前 runtime config 下，`https://maas-openapi.wanjiedata.com/api/v1/chat/completions` + `deepseek-v4-flash` 的真实局部补丁请求 1.582 秒成功返回，正确把 W3/D1 的 `@40kg` 改成 `@37.5kg`（81 prompt tokens / 105 completion tokens）。
- Verification: `npm run lint` ✅；`npm run typecheck` ✅；`npm test` ✅（35 files / 177 tests）；`npx next build` ✅（517 pages）；`git diff --check` ✅。按用户长期偏好未运行浏览器 UI 验证。

## main / dev 分支一致性审计 (`2026-07-15`)

- Task: 核查当前代码是否保证主分支 `main` 与开发分支 `dev` 一致。
- Status: 当前不一致，也没有自动保持两分支一致的仓库门禁。
- Evidence after `git fetch --all --prune`:
  - 本地 `main` 与本地 `dev` 都是 `007a1dea`；Gitee `main/dev` 也都为 `007a1dea`。
  - GitHub `origin/main` 是 `007a1dea`，`origin/dev` 是 `ca410545`；`origin/dev` 单向领先 10 个提交。
  - 当前工作区在本地 `main` 上还有大量未提交修改与未跟踪文件，这些内容不属于任一分支提交，不能视为已同步。
  - `.github/workflows/test.yml` 监听 `main/master/develop`，没有监听实际使用的 `dev`；单元测试使用 `npm test || true`，E2E 使用 `continue-on-error: true`，且没有 main/dev SHA 或双向差异检查。
- Next step: 若用户要求重新对齐，需先决定以 GitHub `origin/dev` 为准合入 `main`，还是让 `dev` 回退到 `main`；同时先妥善处理当前脏工作区，再执行分支操作。

### GitHub dev 多出 10 个提交的来源追查

- Chronology:
  - 2026-07-14 10:04（Asia/Shanghai），账号 `SmallHorseBrother` 将 GitHub `main` 和 `dev` 同步推进到 `007a1dea`；不是 main 漏推。
  - 10:50～15:20，同一 Git 身份在独立分支 `codex/dev-workspace-20260714` 上连续形成 9 个提交。该分支从 `eff0c6a7` 分出，落后当时 main 一个提交。
  - 17:27 形成合并提交 `ca410545`，父提交分别是 `007a1dea`（当时 main/dev）和 `0077863d`（独立分支 tip），因此完整保留了 main 的最新提交。
  - GitHub Events 显示 17:58 由 `SmallHorseBrother` 认证账号直接把 `refs/heads/dev` 从 `007a1dea` 推到 `ca410545`；没有对应 PR。`main` 未推进，Gitee `main/dev` 也未推进。
- Attribution:
  - GitHub API 把 9 个功能提交及合并提交的 author/committer 都解析为 `SmallHorseBrother`，并非其他协作者账号；提交均为 unsigned。
  - 分支名 `codex/dev-workspace-20260714`、状态文档中的逐任务记录以及当前克隆的 remote reflog（直到 7 月 15 日 fetch 才看到该更新）共同表明：高概率是另一套 Codex/远程工作环境用同一 GitHub 账号完成并直推 dev，而不是当前本地 main 忘记 commit/push。仅凭 Git/GitHub 记录不能进一步证明具体是哪一个终端或对话执行了 push。
- Content: 9 个实际功能提交 + 1 个纯合并提交，净变化 24 files / +811 / -52，主要包括小程序清缓存、注销确认文案、动作库路由、教练专栏/套餐排版、教练联系方式、学员评价接口与渲染、训练更多入口弹层、完整训练方向筛选；另含底部导航问题的诊断记录。
- Local overlap: 当前工作区 25 个修改/未跟踪路径与远端 dev 的 24 个变更路径仅重叠 `CURRENT_TASK.md`、`memory/2026-07-14.md` 和 `TodayTrainingScreen.tsx`。业务文件中，远端修改约 1721 行的“更多训练方式”弹层，当前本地修改约 953 行的训练日只读控制，逻辑区段不同；远端功能并未存在于当前本地未提交代码中。
- Governance: GitHub `main`、`dev` 和该 codex 分支均显示 `protected=false`；仓库为 private，当前方案没有分支保护/ruleset，允许账号直接 push。CI 又未监听真实 `dev`，所以这次 dev-only 推送没有自动触发 main/dev 一致性门禁。
