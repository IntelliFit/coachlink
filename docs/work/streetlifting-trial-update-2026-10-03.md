## 单杠地图新体验版已交付（2026-10-03）

- 用户授权全部本地修改提交推送及体验版更新；源码提交3ce7279409330332f95fc5a4a6abf0d5e0e25cdd已同步GitHub/Gitee dev。lint/typecheck通过、73文件457测试通过；生产mini2884模块124页/包检查通过，未含本机API或开发诊断。
- 官方微信upload任务confirmation_upload_b37b6373-fc14-4f21-98a0-cf9bee156324已实际返回success/execution_success：体验版2026.10.03.1543，上传10050668字节，主包2095229字节；配置已按原备份恢复dist/，deploy元信息已更新。此前pending记录仅为历史。
- dev API新摘要sha256:d1d24099eccb3e843a6db9879ff8d75bb8889380cf7a71ca1057f59f0ef344fe、generation79，3/3全部新镜像Ready；main仍generation122与旧b4494f5d摘要。线上两域health200，国内筛选包含中国/北京非空，反查未登录401。当前登录会话只读访问真实dev搜索北京大学200，返回北京大学/北京市/颐和园路5号中文，WGS同一点。未写点位/上传照片/改DB。
- 原生空回调具体根因仍未明确，本包具备异常恢复与备用中文选点；图片dev上传域名已在微信后台补好，手机实际图片上传仍需体验者复验。完整发布记录docs/work/streetlifting-trial-update-2026-10-03.md。

# 单杠地图新体验版更新（2026-10-03）

用户明确要求提交推送全部本地修改并立即更新体验版。发布当前 dev 代码与体验 API，保持正式 main 与小程序正式版本不变。

## 已完成验证

此前本地官方开发者工具中文实际搜索回填验证通过，保留同一点坐标与手动编辑；原生空返回使用受控异常恢复验证，具体原生原因未明确。微信后台 uploadFile 已实际补入 dev.coachlink.fit，手机照片上传待新包复验。

本轮发布 gate lint、typecheck、单 worker 全量 npm test 均通过；生产小程序及后端镜像正在重新构建。

证据位于 artifacts/streetlifting-ux/2026-10-03/new-trial-*。

## 上传确认等待

新生产包 2026.10.03.1543：2884模块/124页通过，源码3ce7279409330332f95fc5a4a6abf0d5e0e25cdd（构建时clean），包检查通过SHA256 730e1ee65ce5e7fdaf662d408a9e64020e0c22eccca9c93172cf8cc775a3bca3，未含本机API及开发诊断。GitHub/Gitee dev均已推送。

官方upload返回pending；taskId confirmation_upload_b37b6373-fc14-4f21-98a0-cf9bee156324，参数版本2026.10.03.1543/描述3ce72794-map-first-native-recovery-chinese-search。已通知用户开发者工具确认，不主动轮询或重复上传。项目miniprogramRoot临时指dist-release/，完成该旧任务后从new-trial-project-config-backup.json恢复。后端dev镜像正构建推送，正式main预检保持原摘要b4494f5d。
