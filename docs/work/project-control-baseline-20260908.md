# CoachLink 项目总控基线（2026-09-08）

## 总览

- 首次全量任务审计：94 条。
- 原始分类：52 条有完成证据，42 条需要继续或复核（7 interrupted、4 blocked、3 waiting、28 needs_review）。
- 原始健康度：70/100。经本轮证据复核，三项首要任务中两项属于历史状态已被后续工作覆盖，不能继续算作未闭环；移动 App 深度对齐仍在执行。
- 管理边界：默认只读，不自动归档或删除任务，不擅自提交、推送、部署或修改线上数据。

## 三项优先任务复核

### 1. 打包最新 App 并汇报进度 — 本地代码与构建已闭环

- 2026-09-14 已完成原生通知、消息中心、聊天缓存、训练/即兴/动作库 Bearer 鉴权和通知 Outbox 的集中代码审计；审计中修复缓存初始化竞态、无效 Bearer 降级、cron 代理白名单/调度缺口、测试外部依赖与 Expo 跨 SDK 原生依赖冲突。
- root TypeScript 与 mobile TypeScript 均通过；针对性 Vitest 8 files / 60 tests、完整 Vitest 53 files / 274 tests、Playwright E2E 4/4、Next.js 543 页生产构建、Expo config 与 Android `assembleRelease` 全部通过。
- 最新本地 APK 为 `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`（89,298,008 bytes，SHA-256 `3E4A94B5E4AE59A28FA75F1FABBB63D965B11289351129F0FBDBE0E822FDCED2`），与本轮源码一致；它位于 ignored build 目录且仍为本地 Debug 证书内部验证包，不是商店发布包。
- 远程推送还需要迁移/后端部署以及 Expo/FCM/APNs 凭据；当前版本号仍为 `0.0.1 (1)`，Android Release 仍使用 Debug 证书。

### 2. 为鞑靼创建 RM 训练计划 — 已闭环

- 2026-09-08 线上只读回读：计划 `47457535-7e45-4aa5-abf4-19c0d3905420` 为该订阅唯一 active/paused 计划，状态 active。
- 内容：84 天、36 个训练日、94 个动作模块，全部为 `STRENGTH`，`fixedWeight=0`；用户资料体重 75kg。
- 数据内容显示问题已在线上修复并回读；日期误用订阅开始日导致“顺延224天”的通用代码修复位于提交 `013b42d5`。
- `013b42d5` 经祖先检查已同时进入当前远端 `main/dev@32be39a6`；项目发布记录显示该代码随 2026-09-06 Web/API 发布。生产与开发健康探针在本轮均返回 HTTP 200。
- 边界：计划尚未首次开练，因此 `start_date/end_date` 仍为 null；这是既定“首次执行后建立日历锚点”模型，不是缺失内容。

### 3. 提交并同步开发分支 — 本轮已获授权

- 旧任务结束时 `dev` 的确曾领先远端 1 个文档提交，但后续已有明确提交/推送记录。
- 本轮通过 `git ls-remote` 直接确认 GitHub `refs/heads/dev` 与 `refs/heads/main` 均为 `32be39a69ff42cba44867f3a48b3ec2d64c0a6ff`。
- 当前检出的是功能分支 `codex/wechat-training-action-library-20260825`，HEAD 也为 `32be39a6`；它配置的同名旧 upstream 仍是 `0702fe30`，所以 `ahead 20` 只表示功能分支 upstream 陈旧，不代表远端 `dev` 未推送。
- 用户已于 2026-09-14 授权把审计通过的集中改动提交到 `dev` 并快进同步到 `main`；最终结果以两个远端分支共同 tip 和提交记录为准。

## 重复任务组

1. 拉取远端最新代码：2 条，1 条仍被旧分类标记 open。
2. 概述项目近期改动与分支：2 条，原分类均 open。
3. 读取 Lark 项目需求列表：2 条，原分类均 open。
4. 迁移动作库动作配图：2 条，1 条仍被旧分类标记 open。
5. 文件/Prompt 类同源任务：3 条，均已有完成证据。

不自动归档。继续时选择同组中最近且证据最完整的任务，其他只作为历史依据。

## 推荐继续入口

1. 完成移动推送的生产闭环：数据库迁移、服务端 Outbox/发送器部署、Expo/FCM/APNs 凭据、注册/撤销/点击跳转与可清理真机回归。
2. 对最新内部 APK 做带真实推送凭据的 Android 真机回归，并补齐 iOS 通知权限、收件与深链矩阵。
3. 完成移动 App 商店发布准备：正式 Android keystore、版本升级、AAB、Play Billing、iOS/TestFlight/StoreKit 与商店物料。
4. 对 2026-09-06 小程序体验版做真机验收，重点覆盖即兴训练组视频上传与教练查看；用户授权后再决定提审/发布。
5. 单开依赖与数据库安全治理：73 个历史 npm 漏洞及 Supabase 安全顾问存量问题，禁止在功能发布收尾中直接 `npm audit fix --force`。
