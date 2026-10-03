# 单杠地图新体验版更新（2026-10-03）

用户明确要求提交推送全部本地修改并立即更新体验版。发布当前 dev 代码与体验 API，保持正式 main 与小程序正式版本不变。

## 已完成验证

此前本地官方开发者工具中文实际搜索回填验证通过，保留同一点坐标与手动编辑；原生空返回使用受控异常恢复验证，具体原生原因未明确。微信后台 uploadFile 已实际补入 dev.coachlink.fit，手机照片上传待新包复验。

本轮发布 gate lint、typecheck、单 worker 全量 npm test 均通过；生产小程序及后端镜像正在重新构建。

证据位于 artifacts/streetlifting-ux/2026-10-03/new-trial-*。
