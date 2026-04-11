# 网页前端与小程序页面对照表

本文档对照 **coachlink（网页前端）** 与 **coachlink-wechat-app（微信小程序）** 的页面路由与实现情况。

| 名称       | 网页路由 (coachlink)              | 小程序页面 (coachlink-wechat-app) | 说明 |
|------------|----------------------------------|-----------------------------------|------|
| 登录       | `/login`                         | `pages/login/index`               | 已完成 |
| 注册       | `/register`                      | `pages/register/index`            | 已完成 |
| 关于       | `/about`                         | `pages/about/index`               | 已完成，文案与前端 about.md 对齐 |
| 免责声明   | `/disclaimer`                    | `pages/disclaimer/index`          | 已完成，摘要展示，完整以网页为准 |
| 服务条款   | `/terms`                         | `pages/terms/index`               | 已完成，摘要展示，完整以网页为准 |
| 联系       | `/contact`                       | `pages/contact/index`             | 已完成，含联系方式与跳转反馈 |
| 反馈       | `/feedback`                      | `pages/feedback/index`            | 已完成，含 FAQ 与 relatedQuestion |
| 文档       | `/docs`、`/docs/[slug]`          | `pages/docs/index`                | 文档入口列表，详情跳转各单页 |
| 微信授权   | `/wechat-auth/login-bridge`、`bridge`、`bind`、`bind-bridge` | `pages/wechat-auth/index` | 网页端为 H5 微信授权回调；小程序内登录/绑定在登录页完成，此页做说明或重定向 |
| 分享落地页 | `/s/[shareId]`                  | `pages/share/index?shareId=xxx`   | 记录归因后跳转注册（带 share 参数） |
| 新用户引导 | `/onboarding`                   | `pages/onboarding/index`         | 入驻流程说明 + 教练/健身房申请入口 |
| 街头力量指数 | `/streetlifting-index` 及子页  | `pages/streetlifting-index/*`     | 已完成（calculator、data、locations 等） |
| 智能生成计划 | `/generate-plan`               | `pages/generate-plan/index`、`pages/generate-plan/waiting/index` | 已实现：选择训练域 → 计划等待 → 智能快速生成 |
| 市场 | `/market`                       | `pages/market/index`             | 已实现：教练/商品列表，点击进入教练主页 |
| 用户主页（公开） | `/user/[userId]`           | `pages/user/index?userId=xxx`    | 已实现：基础资料；好友关系则展示统计卡片与最近训练 |
| 训练（旧/重定向） | `/training`                 | `pages/training/index`           | 重定向到今日训练 `pages/today-training/index` |
| 测试/调试 | `/test`、`/test-push`           | `pages/test/index`、`pages/test-push/index` | 开发调试用 |

## 路由说明

- **网页**：Next.js App Router，路径即 URL（如 `coachlink.fit/about`）。
- **小程序**：Taro 多页结构，路径为 `pages/目录/index`，入参通过 `?key=value` 传递（如 `pages/share/index?shareId=xxx`）。
- 分享链接：网页使用 `/s/{shareId}`；小程序使用 path `pages/share/index` + query `shareId=xxx`，行为一致（存归因 → 跳转注册）。

## 内容来源

- 网页关于/免责/条款/联系/入驻：从 `public/docs/*.md` 读取并渲染。
- 小程序：关于/联系等已与前端文案对齐；免责/条款为摘要，完整内容以网页端公示为准。

---

## 各页面入口（小程序内从哪里能进入）

以下列出每个页面的**入口**：即用户从哪些地方可以跳转到该页面。未写入口的页面（如分享落地页）通常由分享链接、扫码或未登录拦截跳转进入。

| 页面 | 入口位置 | 说明 |
|------|----------|------|
| **登录** `pages/login/index` | 首页顶部「登录」按钮；未登录时访问今日训练/个人中心/教练端/知识库/计划/排行榜等会 `redirectTo` 或 `reLaunch` 到登录（带 `returnTo`）；注册页「去登录」；个人中心退出后 `reLaunch` 到登录；工具箱未登录时按钮；`wechat-auth` 页根据 `type` 重定向到登录。 | 多处需登录能力都会跳转登录，登录成功后会回到 `returnTo` 或默认首页。 |
| **注册** `pages/register/index` | 首页「立即注册锁定权益」按钮；登录页「还没有账号？去注册」。 | 分享落地页 `share` 会带 `?share=xxx` 跳转本页。 |
| **关于** `pages/about/index` | 首页底部 footer「关于」；个人中心底部小字「关于」。 | 关于页内可点「联系我们」进入联系页。 |
| **免责声明** `pages/disclaimer/index` | 首页底部 footer「免责声明」；个人中心底部小字「免责声明」；文档页列表「免责声明」项。 | - |
| **服务条款** `pages/terms/index` | 首页底部 footer「服务条款」；个人中心底部小字「服务条款」；文档页「服务条款」项；注册页勾选协议时链接。 | - |
| **联系** `pages/contact/index` | 首页底部 footer「联系」；个人中心底部小字「联系」；文档页「联系我们」项；关于页「联系我们」按钮。 | 联系页内可点「意见反馈」进入反馈页。 |
| **反馈** `pages/feedback/index` | 联系页「意见反馈」按钮。 | 需经「联系」进入。 |
| **文档** `pages/docs/index` | 首页底部 footer「文档」；个人中心底部小字「文档」。 | 文档页为列表，点击某项跳转对应单页（条款/免责/关于/联系）。 |
| **微信授权** `pages/wechat-auth/index` | 一般由**网页端**微信授权后回调打开小程序时带 path（如 `type=bind`/`type=login`），小程序内会再重定向到登录页；无参数时展示说明 +「去首页」。 | 小程序内无主动入口，主要给 H5 授权回调用。 |
| **分享落地页** `pages/share/index?shareId=xxx` | **分享链接/扫码**：生成分享时 path 设为 `pages/share/index`，query 带 `shareId`。用户打开后存归因并跳转注册页（带 `share`）。无 `shareId` 时重定向到首页。 | 无小程序内点击入口，仅通过分享或扫码进入。 |
| **新用户引导** `pages/onboarding/index` | 首页「入驻成为教练」按钮；个人中心（profile）底部小字「入驻说明」。 | 入驻页内「我是教练，立即入驻」会判断登录后跳转教练申请；健身房合作提示去网页端。 |
| **智能生成计划** `pages/generate-plan/index?coachId=xxx` | 教练主页 `pages/coach-profile/index` 底部固定区（仅当订阅状态为「服务进行中」时显示）→ 点击「智能生成计划」按钮。 | 需带 `coachId`；未登录会跳转登录页；无 coachId 会重定向到发现页。 |
| **市场** `pages/market/index` | 个人主页 `pages/profile/index` → 功能列表中的「市场」入口。 | 展示教练与订阅商品，点击进入教练主页。 |
| **用户主页（公开）** `pages/user/index?userId=xxx` | 好友列表 `pages/friends/index` → 点击好友头像/昵称；好友动态等带 userId 的跳转。 | 需带 `userId`；好友关系则展示统计与最近训练。 |

### 入口汇总（按场景）

- **首页（未登录）**：登录、注册、入驻、关于、免责声明、服务条款、联系、文档。
- **个人中心（profile）**：底部小字链接「关于 · 免责声明 · 服务条款 · 联系 · 文档 · 入驻说明」。
- **登录页**：注册。
- **注册页**：登录、服务条款、免责声明。
- **关于页**：联系。
- **联系页**：反馈。
- **文档页**：服务条款、免责声明、关于我们、联系我们（均为跳转对应单页）。
- **分享/扫码**：分享落地页（带 shareId）→ 注册。
- **网页回调**：微信授权页（带 type）→ 登录。
- **教练主页（已订阅）**：智能生成计划、填写/更新问卷、续费。
- **个人主页**：当前计划、我的教练、我的会员、训练历史、我的好友、消息中心、动作库、知识库、计划库、**市场**、工具箱、购物车、购买记录等。
- **好友列表**：点击好友头像/昵称 → 用户主页。
