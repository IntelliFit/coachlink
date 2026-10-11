# 器材点位文案与统计漏算（2026-10-10 JST）

## 用户反馈及状态

用户询问：器材已扩展到单杠、双杠、云梯，上传和浏览文案是否应同步；地图截图显示1107，点位数据却显示1000整。

完成正式API只读诊断、后端本地最小修复及定向验证。没有修改小程序文案/布局、数据库数据、已有测试，也没有提交推送、构建镜像、部署或上传。文案是建议，尚未得到用户最终选择。

## 正式数据证据

2026-10-10T08:54:25.399Z（17:54 JST），匿名POST、空JSON请求三个正式接口均200/success=true：

| 接口 | 观测结果 |
| --- | --- |
| `/api/streetlifting-index/locations/list` | pagination.total=1126 |
| `/api/streetlifting-index/locations/map-pins` | 1107条且ID不重复 |
| `/api/streetlifting-index/stats` | locationOverview.totalCount=1000，mapReadyCount=982，withImagesCount=672，withDescriptionCount=766 |

1126与1107的差别是19条未带完整坐标，地图只包含有完整坐标的点位。1000不是正确的总量，也不是取整。统计route原来单次select全表，不分页；响应受数据库API行数限制截断。地图已使用500条分页读取，列表用exact count，因此不同页面数字不一致。图片/描述覆盖率、平均图片数、地区及月份分布同样基于被截断的1000条；统计漏126条，而有坐标统计漏125条。

外部核对：Supabase select官方说明默认最多返回1000条、建议range分页（https://supabase.com/docs/reference/python/select）。本地Next安装不存在dist/docs，改查Next 16官方Route Handlers文档（https://nextjs.org/docs/app/getting-started/route-handlers）。

## 本地代码修复

`src/app/api/streetlifting-index/stats/route.ts`改用按id稳定排序、每批500条range读取直到末页；所有点位概览计算复用完整结果。任一批次出错返回500，不把部分结果当作成功。接口结构和上传/地图逻辑保持兼容，线上生效只需发布后端，小程序不用重新上传。

顶层data.totalCount仍表示streetlifting_submissions数量，不能与locationOverview.totalCount混用。贡献人数来自独立派生贡献表exact count，本次未重建其数据；贡献榜rebuild函数也存在未分页select，应在独立贡献榜审计中检查，不能据本次修复宣称其统计已全面核准。

## 文案建议（未实施/未定案）

- 保留熟悉的“单杠地图”入口，并以“单杠 · 双杠 · 云梯”说明覆盖范围；暂不扩大成包含全部健身房设备的承诺。
- 上传按钮/表单改为“分享器材点位”，上传的是一个地点，一个地点可勾选多种器材。
- “单杠列表/单杠数据”改为“点位列表/点位数据”；地图介绍及点击提示使用“器材点位”。
- 必须纠正“数字表示单杠数量”：这是点位数量，不是物理器材件数；一个点位有多种器材仍只计一处。
- 面向海外的“覆盖省份/省份分布”建议改为“覆盖省/州/省/州分布”；未知地区不应被当作真实覆盖地区，当前代码行为未改。

## 验证与磁盘

- 新增src/lib/streetliftingLocationOverview.test.ts，4项定向接口回归全通过：1126条尾页全部指标、整批边界、空库存、后续页失败。
- npm run lint成功但仅提示未配置eslint，不声称执行真实eslint检查；npm run typecheck成功。
- 使用任务临时tsconfig额外覆盖实际修改route和新回归文件，类型检查成功；标准typecheck默认并不包含本route。
- 无全量测试/构建/UI验收（仅后端改动，没有小程序页面修改）。所有数据库访问只读，测试使用mock，无测试数据残留。
- 测试子进程TEMP/TMP/TMPDIR均指定D:/cache/agent-tests/coachlink-location-stats-20261010。临时配置和Node编译缓存共1599822字节、98文件、无reparse point；删除该任务目录的清理命令被工具自动审批规则拒绝，仅返回blocked by policy，没有具体原因，因此保留，不绕过。
- 代码/测试/状态/本文仅增加数KiB文本；清理方案是仅清理上述任务临时目录，保留源代码和报告、其他服务及数据。

## 后续

当前正式统计仍是旧逻辑。本地修复需单独后端发布后，复查总点位与列表一致、可地图打开与map-pins一致。用户确认文案方向后再做对应小程序文本变更和微信开发者工具验收；不重复生成全量产物。
