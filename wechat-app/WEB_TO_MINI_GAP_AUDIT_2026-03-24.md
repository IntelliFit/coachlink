# Coachlink Web-to-Mini Gap Audit

更新时间：2026-03-24

本文档基于当前仓库状态重新核对 `coachlink` 网页端与 `coachlink-wechat-app` 小程序端，目标不是重复罗列“有哪些页面”，而是明确：

- 哪些能力已经迁过来了
- 哪些页面只是有壳，业务闭环还没迁完
- 哪些网页能力不适合按原样搬进小程序

## 1. 调研基准

核心入口文件：

- 网页端学员导航：`src/components/NavigationStudent.tsx`
- 网页端教练导航：`src/components/NavigationCoach.tsx`
- 小程序页面注册：`src/app.config.ts`
- 小程序底部导航：`src/components/BottomNav.tsx`

重点核对方式：

- 先看网页端导航和 `src/app/**/page.tsx`，确认真实功能入口
- 再看小程序 `src/app.config.ts`，确认页面是否真的注册可访问
- 最后抽查小程序页面实现，识别占位、TODO、仅跳网页端的情况

## 2. 已确认保留在网页端的能力

这些功能不是“小程序漏做了”，而是当前阶段更适合继续保留在网页端：

### 2.1 管理后台

不建议纳入小程序首批迁移：

- `src/app/admin/payments/page.tsx`
- `src/app/admin/subscriptions/page.tsx`
- `src/app/admin/coach-applications/page.tsx`
- `src/app/admin/rankings/page.tsx`
- `src/app/admin/withdrawals/page.tsx`
- `src/app/admin/analytics/page.tsx`
- `src/app/admin/settings/page.tsx`

原因：

- 操作密度高，数据表格和审核流更适合网页
- 角色频次低，不值得优先消耗小程序空间和复杂度

### 2.2 H5 / 浏览器专属桥接

不需要按网页形态迁移到小程序：

- `src/app/wechat-auth/login-bridge/page.tsx`
- `src/app/wechat-auth/bridge/page.tsx`
- `src/app/wechat-auth/bind/page.tsx`
- `src/app/wechat-auth/bind-bridge/page.tsx`

小程序当前的 `src/auth/wechat-auth/index.tsx` 已经明确把这类能力收敛成说明页/重定向页，这个方向是对的，不应该再去复刻 H5 bridge。

### 2.3 重桌面化知识库编辑体验

不建议原样搬迁：

- `src/app/dashboard/knowledge/page.tsx` 中的思维导图模式
- `src/app/dashboard/knowledge/body-map/page.tsx` 的大屏人体地图体验
- 依赖 ReactFlow、复杂管理台布局的知识结构操作

更适合小程序的是“轻量浏览入口 + 搜索 + 节点详情”，不是复制网页管理台。

### 2.4 浏览器特有能力

建议保留网页实现：

- Web Push / 浏览器通知
- H5 分享落地桥接
- `html2canvas` 一类基于 DOM 的截图/海报生成路径

## 3. P0：当前最影响用户闭环的缺口

这部分不是“锦上添花”，而是会直接把用户赶回网页端。

### 3.1 支付闭环未迁完

证据：

- `src/me/payment/wechat/index.tsx`

现状：

- 页面明确写着“微信支付功能接入中”
- 当前仍让用户复制 `https://coachlink.fit` 去网页端完成支付

结论：

- 订阅、续费、支付等待这条链路，小程序仍未真正闭环

### 3.2 账户安全仍依赖网页端

证据：

- `src/me/settings/index.tsx`
- `src/auth/login/index.tsx`
- `src/components/ResetPasswordForm/index.tsx`
- `src/services/authService.ts`

现状：

- 修改密码仍是 TODO，实际只是 toast 提示去网页端完成
- 找回/重置密码仍显示“开发中”
- 但 `authService.resetPassword()` 已经存在，`ResetPasswordForm` 组件也已经写好，说明“重置密码”更像前端入口没接上，而不是后端能力缺失

结论：

- 登录后账户安全并没有真正迁移完成
- 其中“重置密码”属于可快速补齐项，“修改密码”仍需要补真正的 API 接入

### 3.3 学员动作库页面存在，但未真正发布

证据：

- 页面代码：`src/me/action-lib/index.tsx`
- 编辑页代码：`src/me/action-lib/edit/index.tsx`
- 页面注册表：`src/app.config.ts`
- 个人中心入口：`src/me/profile/index.tsx`

现状：

- 学员动作库目录已经存在
- 但 `src/app.config.ts` 的 `me` 分包里没有 `action-lib` 页面注册
- 小程序底部导航和主入口也没有把它作为正式页面开放
- 个人中心里的“我的动作库”当前还指向了 `/coach/action-lib`，也就是教练动作库，而不是学员动作库

结论：

- 这是典型的“代码在仓库里，但用户实际上进不去”
- 这项不属于新功能开发，更接近路由注册和入口修正

## 4. P1：网页端已经成熟，但小程序端缺深度

### 4.1 知识库只迁了一层外壳

网页端能力：

- 首页 + 搜索：`src/app/dashboard/knowledge/page.tsx`、`src/app/dashboard/knowledge/search/page.tsx`
- 人体地图：`src/app/dashboard/knowledge/body-map/page.tsx`
- AI 问答：`src/app/dashboard/knowledge/ai/page.tsx`
- 文章 / 书籍 / 视频 / pillar / scenario / node 等完整结构

小程序现状：

- `src/content/knowledge/index.tsx` 只有搜索、书籍、文章三块
- 视频区还是“敬请期待”
- 没有人体地图、AI、场景、支柱、专题体系入口

结论：

- 当前小程序知识库更像“轻量内容页”，还不是网页端那套完整知识系统

### 4.2 我的教练只完成了第一版

证据：

- `src/me/my-coaches/index.tsx`
- `src/me/my-coaches/API_MAPPING.md`
- `src/me/my-coaches/types.ts`
- 网页端来源：`../coachlink/src/app/coach/subscription/page.tsx`

现状：

- 页面已可用，详情、续费、咨询也开始接了
- 但映射文档和类型定义里仍保留多个 TODO
- 字段仍缺 `rating`、`monthly_price`、`latest_plan_instance_id`、暂停期结束时间等

结论：

- 这是“已迁移但还没完全对齐”的模块，不应算作完全完成

### 4.3 学员侧内容入口仍少于网页端

网页端入口里有，但小程序没有等价结构或深度不足：

- 好友动态独立入口：`src/app/friends/activity/page.tsx`
- 全局搜索：`src/app/search/page.tsx`
- 全局文章体系：`src/app/articles/page.tsx`
- 短链分享页：`src/app/s/[shareId]/page.tsx`

说明：

- 小程序不是完全没有相关能力，但入口组织和信息结构明显比网页端薄
- 这会导致用户感觉“小程序能用，但内容不全”

## 5. 迁移优先级建议

### 第一批：先补回网页端跳转

建议优先做：

1. 小程序支付闭环
2. 修改密码
3. 把现成的重置密码表单接回登录页
4. 学员动作库页面注册与入口联通

判断标准：

- 这些能力现在会直接把用户赶回网页端
- 改完后，小程序“基础留存能力”会明显提升

建议拆法：

- 快速补齐项：重置密码入口接线、学员动作库注册、个人中心动作库入口纠正
- 真正需要新开发或后端配合的项：微信支付闭环、修改密码 API

### 第二批：补高频内容深度

建议优先做：

1. 知识库二期
2. 我的教练字段和交互补齐
3. 全局搜索 / 内容入口 / 分享落地链路梳理

判断标准：

- 这部分决定用户会不会觉得“小程序版是缩水版”

### 第三批：做轻量重设计，而不是硬搬网页

建议按“小程序友好版本”重做：

1. 知识库人体地图轻量版
2. 知识节点 / 场景浏览结构
3. 教练侧复杂工作台中的高频子能力

不建议直接照搬：

- Admin 后台
- H5 bridge
- ReactFlow 思维导图管理台

## 6. 结论摘要

如果只看小程序目录，会误以为很多页面“已经有了”；但按真实可访问性和业务闭环去看，当前主要还差三件事：

1. 核心闭环还没完全脱离网页端，尤其是支付和账户安全。
2. 一些模块虽然已经建页，但仍是半迁移状态，例如知识库、我的教练、学员动作库。
3. 网页端里确实有一部分能力应该明确标记为“保留在网页端”，否则迁移范围会被无限放大。

因此，当前最合理的执行方式不是“继续广撒网补页面”，而是：

- 先清掉会强制跳网页端的 P0 缺口
- 再把知识库和我的教练这种高频模块做成完整版本
- 明确 admin / H5 bridge / 重管理台能力继续留在网页端

## 7. 建议的 P0 落地清单

### 7.1 一天内可完成的前端修补

- 登录页把“忘记密码”从 toast 改为挂接 `ResetPasswordForm`
- 在 `src/app.config.ts` 注册学员动作库页面
- 把 `src/me/profile/index.tsx` 里的“我的动作库”入口从 `/coach/action-lib` 改到学员端正确页面

本次已落地：

- 已接回登录页的重置密码入口
- 已注册学员动作库页面
- 已修正个人中心动作库入口

### 7.2 需要接口或联调的项

- `src/me/settings/index.tsx` 接入真正的修改密码调用
- `src/me/payment/wechat/index.tsx` 从占位页升级为真实支付闭环，或至少接入明确的支付中间态和回跳确认

### 7.3 完成标准

- 用户在小程序里可以完成“登录 -> 忘记密码 -> 重置密码 -> 重新登录”
- 用户在小程序里可以进入并使用学员动作库，而不是误入教练动作库
- 用户订阅/续费不再必须复制网页链接才能继续

## 8. 第二阶段设计范围

第二阶段建议围绕两个模块展开，而不是继续平均摊薄：

### 8.1 知识库二期

优先顺序：

1. 搜索结果页和节点详情
2. 文章 / 书籍 / 视频的统一内容详情流
3. 轻量人体地图入口
4. AI 问答

网页端实现来源：

- 搜索结果页：`../coachlink/src/app/dashboard/knowledge/search/page.tsx`
- 知识库首页与人体地图入口：`../coachlink/src/app/dashboard/knowledge/page.tsx`
- 人体地图页：`../coachlink/src/app/dashboard/knowledge/body-map/page.tsx`
- AI 问答页：`../coachlink/src/app/dashboard/knowledge/ai/page.tsx`

小程序现有可复用基础：

- `src/services/knowledgeService.ts` 已经有 `search()`、`getNode()`、`listKnowledgeBooks()`、`listCoachContents()`
- `src/content/knowledge/index.tsx` 已经有搜索框、书籍列表、文章列表的第一版 UI

建议做法：

- 不要重写知识服务层，优先在现有 `knowledgeService` 上扩方法
- 先把“搜索结果页 -> 节点详情页”走通，再扩人体地图和 AI
- 视频区不要继续停留在首页占位，应该转成真正可点击的内容入口

不建议第二阶段就做：

- 网页端完整思维导图
- 管理台式知识树编辑

### 8.2 我的教练二期

优先补齐：

1. 字段对齐：价格、评分、计划实例、暂停期信息
2. 状态对齐：active / preparing / waiting / inactive / expiring / expired
3. 交互对齐：详情、续费、咨询的统一入口和状态文案

网页端实现来源：

- 列表页：`../coachlink/src/app/coach/subscription/page.tsx`
- 卡片状态和文案：`../coachlink/src/app/coach/subscription/CoachList.tsx`

小程序现有基础：

- 页面：`src/me/my-coaches/index.tsx`
- 类型：`src/me/my-coaches/types.ts`
- 接口映射文档：`src/me/my-coaches/API_MAPPING.md`

建议做法：

- 先对齐类型和状态计算，再调 UI 文案，不要反过来做
- 让 `API_MAPPING.md` 和真实实现保持一致，避免文档继续落后于代码
- 把“详情 / 续费 / 咨询”都收敛到订阅状态驱动，而不是每个按钮独立写判断

这两块做完，小程序体验会从“能用”提升到“和网页端是同一个产品体系”。
