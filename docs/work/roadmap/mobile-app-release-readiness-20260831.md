# CoachLink 移动 App 发布就绪审计（2026-08-31）

## 结论

当前 Android App 已从“可安装但大量入口未验证”推进到“核心游客、学员、教练路径可在模拟器真实运行”，但仍属于内部测试版，不能直接提交应用商店。

上线前的两个硬阻塞是：

1. 生产签名尚未建立。当前 Release APK 仍使用 Android Debug 证书；本轮已把 EAS production 改为 store App Bundle，但还没有正式上传密钥。
2. 支付通道尚未按 App 商店规则拆分。教练订阅已有支付宝 WAP 下单与查单链路，但未做真实资金闭环；后端现有会员、AI 次数和存储包接口仍是微信小程序 JSAPI。App 已停止调用该接口并明确提示“App 内购接入中”，不会再生成无法完成付款的订单，但真正的商店内购仍未实现。

## 本轮已完成并验证

- 修复登录成功后根导航未切换、接口响应重复拆包、游客训练页永久 loading、教练与学员多处死入口。
- 修复训练历史请求取消、完成训练时长持续增长、日期与状态本地化、内部测试商品暴露。
- 修复好友列表点击不携带 userId、好友主页占位和串用当前账号资料。
- 好友主页现已读取目标用户公开健身档案、好友可见训练记录，并提供私聊入口；自身主页继续支持编辑资料与完整健身档案。
- 会员订阅页已阻止 App 创建微信小程序 JSAPI 订单，展示明确的内购准备状态；模拟器点击套餐后仅提示、不下单。
- Android 模拟器真实验证：
  - 游客、学员、教练三种状态；
  - 密码登录及登录后导航；
  - 教练列表、详情、套餐、工作台、视频、学员、计划；
  - 学员训练、动作库、计划历史、训练历史；
  - 知识、工具箱和系统相册选择器；
  - 我的朋友 → 清水百合主页；
  - 我的主页 → 编辑资料 / 完整健身档案入口。
- 代码门禁：
  - TypeScript 通过；
  - Vitest 42 个文件、203 条用例全部通过；
  - Android assembleRelease 成功；
  - Android lintVitalRelease 成功。

## 差距矩阵

| 能力 | 当前状态 | 发布前动作 | 优先级 |
|---|---|---|---|
| 密码登录 | Android 模拟器已实测 | 再补手机号验证码、注册、刷新后会话保持真机回归 | P0 |
| 好友主页 | 本轮已实现并实测真实好友资料 | 有既有聊天室的账号再测“发消息”；避免测试创建残留会话 | P1 |
| 教练订阅支付 | 支付宝 WAP 创建/打开/轮询代码存在 | 配置生产商户、通知地址，完成支付/取消/退款/重复回调/分账真实资金回归 | P0 |
| 会员、AI 次数、存储包 | App 已阻止创建小程序 JSAPI 废订单，并显示内购接入中；真实支付尚未实现 | iOS/Google Play 使用商店内购；中国大陆非 Play Android 如需微信支付，单独接微信 OpenSDK/汇付 App 支付 | P0 |
| 即兴训练组视频 | UI 明确提示暂不支持 | 增加即兴 execution 视频上传接口、缓存同步和真机大文件回归 | P1 |
| AI 计划后台任务 | App 与微信体验版都没有后端轮询 API | 后端建立任务状态/重试/幂等接口后，两端共同接入 | P1 |
| 支付占位路由 | PaymentWebview / PaymentWechat 为未使用占位路由 | 确定最终通道后删除死路由或接真实 SDK | P1 |
| iOS | 尚未构建与测试 | EAS/TestFlight 构建、真机权限、深链、相册/相机、支付、登录全回归 | P0 |
| Android 商店包 | EAS production 已切到 App Bundle；本地包仍是 Debug 证书 APK | 生成并托管上传密钥，验证生产 AAB，启用 Play App Signing；版本号递增 | P0 |
| 法律文档 | App 内仅简版说明 | 上线完整、公开、可访问的隐私政策/用户协议/消费者保障 URL | P0 |
| 删除账号 | App 内已有注销入口 | 验证后端真正删除/匿名化范围；Google Play 另需可公开访问的网页删除入口 | P0 |
| 商店资料 | 未发现完整上架素材和 metadata | 应用简介、关键词、支持 URL、隐私 URL、截图、功能图、审核账号与审核说明 | P0 |
| 稳定性 | 自动测试与 Android 模拟器门禁已建立 | 接崩溃监控、网络错误监控、灰度渠道与版本回滚 | P1 |

## 支付策略边界

- Apple 要求 App 内解锁数字功能、会员、次数包、云存储使用 In-App Purchase。Apple 允许真正实时的一对一服务（官方示例包含 fitness training）使用其他支付方式，但当前 CoachLink 教练套餐还包含计划、消息、视频反馈等异步能力，不能默认全部落入例外。
- Google Play 同样要求数字商品使用 Play Billing；一对一在线服务只有在双方个人提供、且服务不能在 Play 分发的 App 中回放时可例外。包含可回放视频、数字计划或会员权益的 SKU 需要拆分或走 Play Billing。
- 因此建议：
  1. 会员、AI 次数、存储包：Apple StoreKit + Google Play Billing；
  2. 纯实时一对一教练服务：单独 SKU，并在商店审核说明中写清服务形态；
  3. 含训练计划、录播/回放视频、数字内容的教练套餐：按数字服务处理，或先取得商店书面确认；
  4. 中国大陆独立 Android 渠道如需微信/支付宝，使用独立渠道构建和支付能力，不把这套外部支付带进 iOS/Google Play 商店包。

官方依据：

- [Apple App Review Guidelines 3.1](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Payments policy explanation](https://support.google.com/googleplay/android-developer/answer/10281818)
- [Google Play 2026 target API requirement](https://developer.android.com/google/play/requirements/target-sdk)

## 签名与构建

当前本地 APK：

- 包名：cn.coachlink.app
- 版本：0.0.1 (1)
- targetSdk：36，满足 Google Play 自 2026-08-31 起的新应用/更新 API 36 要求。
- 签名：Android Debug，只有 APK Signature Scheme v2。
- 用途：仅内部安装测试，禁止当商店发布包。

上线动作：

1. 确认 Apple Bundle ID 和 Android package 永久使用 cn.coachlink.app。
2. 创建 Android upload key，放入密钥托管，不进入 Git；生产构建缺少密钥时应直接失败。
3. Google Play 使用 AAB，并启用 Play App Signing。
4. EAS production 已改为 store App Bundle；preview 保留 internal APK。
5. 将版本从 0.0.1 (1) 提升到首个发布版本，并建立自动递增规则。
6. iOS 使用 Apple Distribution / App Store Connect 凭据，通过 EAS 或 macOS 构建 IPA。

官方依据：

- [Android 发布要求与 AAB](https://developer.android.com/studio/publish/)
- [Android App Signing / Play App Signing](https://developer.android.com/studio/publish/app-signing)

## 隐私与合规

CoachLink 会处理手机号/邮箱、头像、训练档案、健康与健身数据、训练视频、聊天、订单和支付状态，隐私披露不能继续使用当前几行简版文案。

发布前至少完成：

- 公开 HTTPS 隐私政策 URL、用户协议 URL、支持 URL、账号删除网页；
- Apple App Privacy 数据类型申报；
- Google Play Data safety 表；
- Google Play Health apps declaration 与健康免责声明；
- 清楚说明相机、相册、视频、位置等权限的用途和保留周期；
- 验证注销账号会删除或匿名化非必须保留的个人数据，并说明依法保留的订单/结算记录；
- 中国大陆上架前确认 APP/ICP 备案信息、主体名称、包名与商店信息一致。

官方依据：

- [Apple App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- [Apple in-app account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Google Play account deletion](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Google Play Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Google Play Health Content and Services](https://support.google.com/googleplay/android-developer/answer/16679511)
- [Apple 中国大陆供应与 ICP 信息](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)

## 需要用户/公司提供的外部条件

不需要提供个人密码。建议使用平台邀请或受限密钥：

- Apple Developer / App Store Connect 组织邀请，或受限 App Store Connect API Key；
- Google Play Console 开发者邀请及最小权限服务账号；
- Android 正式 upload key 的安全托管方案；
- 支付宝生产 App ID、应用私钥、支付宝公钥、异步通知域名配置的确认；
- 微信开放平台“移动应用”AppID、Android 包名与正式签名登记；这与微信小程序 AppID 不是同一接入；
- 汇付生产商户号、App 支付产品权限、回调白名单和分账配置；
- 中国大陆 APP/ICP备案主体资料；
- 正式客服邮箱、隐私联系人、公司名称/地址、支持 URL；
- 至少一台 Android 和一台 iPhone 用于付款、相机、相册、前后台切换和弱网真机验收。

## 推荐后续批次

1. P0 支付决策：先拆清“数字会员/次数包/存储”与“实时一对一教练服务”的 SKU 和渠道。
2. P0 发布工程：正式签名、AAB、iOS TestFlight、版本递增和商店账号。
3. P0 真机回归：验证码登录、会话保持、支付、退款、相机/相册、视频上传、弱网和前后台切换。
4. P1 功能补齐：即兴训练视频、AI 任务轮询、支付死路由清理。
5. P1 运营能力：崩溃监控、支付对账告警、灰度发布、客服与退款工单。

## 追加验收：登录、法律入口与教练总览（2026-08-31）

- 未登录状态下已实测从登录页打开《用户服务协议》和《隐私政策》，并从注册页打开《免责声明》；未登录导航栈现已显式注册三个法律页面。
- 登录页移除了无法完成的微信占位登录分支；密码登录、验证码登录、注册、找回密码保留真实入口，协议勾选和主要控件补充了可访问标签与不小于 48dp 的触摸目标。
- 会话恢复改为“本地缓存先展示、后台请求 `/api/miniapp/session` 校验”：只有明确 401/过期或 userId 不匹配才清理登录态，离线/超时继续保留本地会话。
- Android 模拟器实测：虚构账号会弹出“登录失败 / 该手机号/邮箱未注册”；现有测试账号密码登录成功；强制停止并重启 App 后直接恢复到真实训练首页，且计划、训练进度和教练列表均加载真实数据。
- 教练总览已按最新微信端信息架构修正：总学员和待点评视频可进入对应页面、平均评分不再伪装成可点击按钮、“本月收入”改为“我的钱包”，补齐收款账户/自动化/问卷/内容/计划模板/动作库等路由，并增加加载失败重试与下拉刷新。
- 本轮测试账号恢复后是学员身份且页面显示“申请成为教练”；教练总览新布局已通过类型、Android 编译与静态路由核验，但本批 APK 的该页面仍需要一个已批准且 `primary_role=coach` 的受限测试账号做最终 UI 复测。
- 最终内部包：`CoachLink-0.0.1-android-auth-dashboard-tested-20260831.apk`，88,344,182 bytes，SHA-256 `FBC5B560DDEE4EACC8E75E89CFBA03AF27324EB978C8639368CDC7D52E66789B`；包名 `cn.coachlink.app`、minSdk 24、targetSdk 36、v2 签名有效，但仍为 Android Debug 证书。
- 本轮补充门禁：mobile/root TypeScript、lint、Vitest 42 files / 203 tests、Android `assembleRelease` + `lintVitalRelease`、Next.js 536 页生产构建、`git diff --check` 全部通过。
- 密码登录与重启会话恢复已通过 Android 模拟器；仍需手机号验证码、注册、真机前后台/弱网回归。法律入口已可点击，但正文仍需替换为完整、公开的正式文档。


## 追加验收：个人中心与媒体按钮可靠性（2026-08-31）

- 个人中心会在重新聚焦时刷新用户、会员和统计，并支持下拉刷新；本轮逐个打开动作库、计划库和训练记录，均加载真实内容且返回后统计保持 10 / 1 / 6。
- 删除没有真实浅深色切换能力的主题伪按钮；内测群入口改为 App 内二维码弹窗，支持失败重试和明确关闭，不再直接打开远程图片 URL。
- 教练内容视频、训练组视频、待点评视频、邀请海报和街健点位图片统一使用安全外链工具，无法打开时显示明确错误，不再静默失败；相关按钮补齐可读无障碍标签。
- 最新包覆盖安装后登录会话保持，恢复真实训练首页；个人中心与二维码弹窗 UI 回归通过，截图在 `screenshots/mobile-app-audit-20260831/90-profile-latest.png` 和 `91-beta-group-latest.png`。
- 完整门禁通过：mobile/root TypeScript、lint、Vitest 42 files / 203 tests、Android Release + lintVital、Next.js 536 页生产构建、diff check。
- 最新内部包：`CoachLink-0.0.1-android-profile-media-tested-20260831.apk`，88,348,626 bytes，SHA-256 `9B184867A1223418D3446F873CCC064887CAD0D2FEC800003E23153D12B2CF7D`；v2 签名有效但证书仍为 Android Debug，仅供内部验收。
- 下一阶段仍需已批准 coach 测试账号、验证码/注册真机回归、商店内购、生产签名/AAB、iOS TestFlight、公开完整法律文档与真实支付闭环。

## 追加整改：公开隐私与账号删除通道（2026-09-01）

- 新增 `/privacy`，由 `public/docs/privacy.md` 渲染正式公开隐私政策；新增 `/account-deletion`，提供 App 内注销、登录网页注销和无法登录时邮件申请三种方式。
- `/account-deletion` 已加入公开路径、Footer 和 sitemap；本地 HTTP 探针均为 200，未登录不会再被代理重定向到登录页。
- 删除 API 会在停用账号前先创建或复用 `related_question=account_deletion` 的反馈工单并返回 `deletionRequestId`；工单创建失败时不会停用账号。
- 登录凭据停用后的公开资料清理和订阅取消即使部分失败，也保留删除工单交给后续处理，避免用户已无法登录却只收到可重试 500。
- 当前仍是“即时停用账号 + 工单跟踪关联数据删除”的半自动流程。训练记录、健康数据、聊天、视频等跨表数据尚未由事务化 Worker 自动清理，必须由运营按工单执行并留痕；不得对外宣称全自动删除。
- 本地浏览器已验证桌面和 390px 手机布局、删除页到隐私页跳转、无横向溢出、按钮 48px、页面 0 error/0 warning；语义结构修正为单一 main。
- 门禁通过：lint 脚本、Web/mobile TypeScript、Vitest 42 files / 203 tests、Next.js 538 页生产构建和 `git diff --check`。
- 发布前仍需：部署公开 HTTPS 页面；用受控账号跑一次真实删除工单并完成关联数据清理审计；定义身份核验、SLA、法定留存清单、工单关闭证据和用户通知模板。

## 追加整改：App 支付导航与汇付支付宝契约（2026-09-01）

- 删除没有任何导航调用的 `PaymentWebview`、`PaymentWechat` 和重复假等待页，避免未来把占位页误当作已接通支付；真实 `PaymentWaiting` 继续承接订单查询。
- 修复 App 只读取 `paymentInfo.paymentUrl`、忽略汇付 `paymentInfo.payInfo` 的问题；现在与 Web 一致解析 `qr_code`、`code_url`、`pay_url`、`url` 等目标字段。
- 修复教练详情待支付横幅始终使用 `provider=wechat` 的问题；现在按订阅 `payment_method` 选择支付宝或微信查询接口。
- 支付等待页按钮补齐无障碍名称，返回按钮最低触控高度提高到 48dp。
- Android 模拟器回归只使用现有数据：覆盖安装后会话保持；训练首页、个人中心、购买记录、我的教练、教练详情和续费价格区正常；“查看订阅”只定位价格区，没有自动下单；App 进程无致命/未处理错误。
- 未点击具体续费时长，也未调用创建支付订单接口，因此本轮没有新增生产订单。真实付款、汇付回调、重复通知、退款与结算必须另用受控测试订单闭环。
- 最新内部 APK：`CoachLink-0.0.1-android-payment-web-compliance-tested-20260901.apk`，88,348,186 bytes，SHA-256 `2F10095BEE26152376BB127C6979F86212746FCBD13D9E9AB402FA77205D1EDA`；v2 签名有效，证书仍为 Android Debug。
- 门禁：mobile typecheck、Vitest 42 files / 203 tests、Android Release + lintVital、diff check 均通过；Web 隐私/删除批次的 root typecheck 和 538 页生产构建也已通过。
- 下一步仍是商店内购方案/正式签名、真实支付与退款闭环、验证码注册真机、iOS TestFlight，以及已批准 coach 账号的教练端总览回归。

## 追加整改：认证表单与支付状态反馈（2026-09-03）

- 登录/注册/找回密码字段加入可见标签与可访问名称；密码输入加入 48dp 显示/隐藏按钮；验证码提交前验证 6 位数字并支持 OTP autofill；键盘提交和主按钮均有防重复提交状态。
- 支付等待页修复“手动查询失败但错误被默认文案覆盖”的无反馈问题，增加请求并发锁、查询中禁用/转圈、外部支付链接复制结果的真实反馈，并改为底部安全区 + 可滚动布局。
- 购买教练服务前获取问卷失败时不再静默视为空问卷，改为阻止创建订阅并进入现有明确失败提示。
- AST 静态扫描覆盖 58 个移动端 TSX 文件：Pressable/Touchable/Button 缺失 onPress 为 0，空 onPress 处理器为 0；无障碍名称仍有较多历史欠账，后续按高频页面分批补齐。
- 门禁通过：lint 提示、root/mobile TypeScript、Vitest 42 files / 203 tests、Next.js 538 页生产构建、Android Release + lintVital。
- 最终内部 APK：CoachLink-0.0.1-android-auth-payment-reliability-tested-20260903.apk，88,350,186 bytes，SHA-256 D555C5EBB567B6B874CC7410F6D14860E3E912C77555DEE72B77EFC0735162A1；v2 签名有效但仍为 Android Debug。
- 最终 APK 覆盖安装成功；冷启动 1070ms、Home 后热恢复 428ms，均 Status ok，App 无 FATAL/自身 ANR。此前第一版新包已确认真实缓存会话恢复到训练首页。
- UI 环境阻塞：emulator-5554 在连续无障碍树抓取时触发 Android system_server/System UI ANR；无清数据重启 AVD 后仍复现，故本轮未完成认证新视觉和支付异常页的完整 UI 点击验收。
- 下一步需要稳定 Android 真机或 AVD、专用验证码/注册测试联系方式、已批准 coach 账号；真实支付闭环另需沙箱/低额订单与清理授权。生产签名、AAB、StoreKit/Play Billing 和 iOS TestFlight 仍是 P0。


## 追加整改：验证码滑块、核心交互与次级按钮可靠性（2026-09-03）

- 验证码登录的滑块根因已修复：PanResponder 过去只捕获组件首次渲染时的空 challengeId，后续挑战加载成功也无法开始拖动。现在通过 ref 读取最新 challenge、位置、验证状态和成功回调，并支持无障碍 adjustable 操作。
- 共享按钮契约收紧：可交互的 AppButton、PillButton、ActionTile、RowCard、ImageToolCard、MenuRow、SolidButton 和媒体控制不再允许缺失 onPress；暂不可用必须显式 disabled/busy，避免“看起来像按钮但点击为空”。
- 核心页已补齐明确反馈和可访问状态：训练首页、教练列表、知识页、即兴训练、训练执行、认证页、支付等待页；重试、筛选、分页、训练组、视频、休息计时、完成与反馈等高频操作均有 label/selected/disabled/busy 语义。
- 次级页独立触控目标继续统一到至少 48dp，覆盖知识搜索、训练分享、功率分析、特效视频、单手引体、街健筛选/认领/点位、教练自动化、分配计划、内容、市场、定价、问卷、教练主页、计划生成、钱包、收入、视频分页，以及个人中心的日历、好友、计划筛选和申请表单。
- 静默假成功已清理：功率分析、特效视频、教练邀请、动作视频链接、训练分享、单手引体分享在剪贴板或系统分享失败时都会明确提示，不再失败却显示“已复制”或点击无反馈。
- 最终 APK 实测：验证码登录入口能打开“安全验证”滑块并可取消；此前对同一修复代码执行错误位置拖动，服务端返回“请将滑块对齐缺口位置”，证明手势和验证请求均实际触发。测试使用公开虚构号码，未完成验证、未发送短信、未修改真实账号数据。
- 门禁：lint 提示、root/mobile TypeScript、Vitest 43 files / 210 tests、Next.js 538 页生产构建、Android assembleRelease + lintVitalRelease 与 git diff --check 均通过。Next 一次收尾遇到 Windows EBUSY，单独重跑后完整成功。
- 最终内部 APK：apps/mobile/android/app/build/outputs/apk/release/CoachLink-0.0.1-android-interaction-regression-20260903.apk，88,355,978 bytes，SHA-256 3E0681D71DCB8E75A3F3D6FAEBEDDEF7CADFF2EAB7074FBF83E5D1158D75BEAB；v2 签名有效，但证书仍为 Android Debug，仅供内部验收。覆盖安装成功，最终冷启动 1125ms，0 CoachLink FATAL / App ANR / 未处理 JS 错误。
- 仍需代码补齐：知识页目前仍明确标记为建设中；旧版 AI 计划 taskId 轮询分支与当前同步 generate-quick-plan 契约不一致；即兴训练视频缺少可关联的服务端表结构/API（现有上传外键只接受计划 execution）；全量 TalkBack、动态字体、横屏/平板和 iOS 交互矩阵尚未跑完。
- 仍需外部条件：StoreKit / Google Play Billing 与 SKU 决策、Android 正式 upload key/AAB/版本号、iOS TestFlight、专用验证码/注册测试联系方式、真实支付沙箱或可清理低额订单、公开隐私/删除页面部署及删除 Worker/运营 SLA、崩溃与网络监控、灰度/回滚、商店截图文案和审核账号。
