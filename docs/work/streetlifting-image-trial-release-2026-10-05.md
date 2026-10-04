# 单杠照片预览体验版上传

用户要求将已本地验证的单杠图片点击预览修复上传新版。源码提交 `48e3d411` 已同步 GitHub/Gitee `dev`，此次只增加照片预览，没有改后端、地图录入或支付业务。既有教练购买恢复沿用当前 dev 基础版本。

## 产物与检查

- 新版 `2026.10.05.0653`，说明 `48e3d411-bar-location-photo-preview`。
- 独立生产目录 `D:/files/coachlink/apps/wechat/dist-release`，AppID `wx316e39eb71c0e834`，miniprogramRoot/srcRoot 为 `./`，urlCheck 为 true；原开发项目保持 `dist/`。
- lint 命令成功但未配置 ESLint；root typecheck、74 文件/477 测试通过，未修改测试。10/4本地 Next 546 页构建已通过。本次生产 mini 2884 模块、124 页构建 3m30s 成功。
- 124 页的 js/json/wxml 全部存在，共享样式和目标页 wxss 存在。13 个无独立样式页没有额外 wxss，不算缺少必需页面产物。
- 生产图片处理和点击提示存在；无本机 API/开发登录按钮；编译 resolver 核验 trial → dev.coachlink.fit，其余环境安全回退 coachlink.fit。
- 包校验 SHA256 `af46d9bf787f770233d956eff3c22628782bc6e1cc3b2161289f73eac0d6e2c1`，968 文件/10332588 本地字节。这是本地产物统计，不冒称微信上传压缩体积。

## 开发者工具核验

`coachlink-wechat-app` 是正确的 CoachLink 工程名。用户看到 app.json 缺失，是代理在构建未结束、目录正在重建时先开上传目录造成；已向用户承认。构建完成后重新编译，官方自动化实际读取当前路由 `streetlifting/index/locations`、AppID 和 API `https://coachlink.fit`，实际角标 `3 张图 · 点击查看` 与图片点击 success。

本轮完整截图工具超时，未取得新的生产相册 PNG；此前 10/4同源码本地真实公开点位点击后原生 `1 / 3` 相册 PNG 已查看，见照片修复记录。不称手机或滑动缩放已验收，没有 mock/清用户 storage/改变登录态或写点位。

## 上传状态

官方工具 `upload` 返回 `pending`，待用户在开发者工具确认：

- taskId：`confirmation_upload_ea02d371-c9be-4eaa-bdf6-c628ad24689c`
- tool：`upload`
- project：`D:/files/coachlink/apps/wechat/dist-release`
- version：`2026.10.05.0653`
- desc：`48e3d411-bar-location-photo-preview`
- 最后状态：pending，未轮询。

已提醒工具内确认。遵循官方 async-task-polling 规则，其他 pending 不主动轮询、不重发；用户继续后先查询原 taskId，只有实际成功才记录上传体积/时间、更新 latest-weapp-release.json 和宣告交付。没有提审或正式发布。

10/4旧 `2026.10.04.1200` 任务先查返回 `Task not found`，其结果未知。本次是新增照片修复的新用户授权版本，不重发旧版本。最后已确认成功元信息仍为 `2026.10.03.1609`。

证据保存于 `artifacts/streetlifting-image-release/2026-10-05/`：构建/测试日志、官方运行时/角标/tap/上传回执及包校验。
