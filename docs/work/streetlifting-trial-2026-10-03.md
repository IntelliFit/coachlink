# 单杠地图体验版更新（2026-10-03）

用户要求上传新的代码和体验版，并自行快速检查手机效果。本次范围为小程序新包及其依赖的dev接口；不提交/推送Git，不更新正式Web/API标签，不提审或发布正式小程序。

体验版包含：先选位置再补信息、自动地址回填、识别失败明确提示手填文字、保留坐标不要求手输经纬度、国家筛选含中国、初始视野与附近定位稳定、定位权限声明修复。完整正常流程此前在开发者工具已验证；新增失败提示的工具验证超时，本次手机验证由用户完成，不将旧截图当成新增提示验收。

体验环境服务同步：地址反查和历史中国地点读取/筛选。只更新CCR的独立本次标签和dev标签，已有latest/main不更新；既有数据库迁移已在前轮完成，本轮没有迁移或数据回填。

发布结果：体验版 **2026.10.03.1031** 已上传成功，官方同一任务`confirmation_upload_6faf4092-c6e6-4023-baaf-c02f2c1b8926`返回`status=success`、`execution_success`及`result.success=true`。总包9,905,262字节，主包1,953,799字节；`latest-weapp-release.json`已记录版本/结果、HEAD及sourceDirty、产物SHA256，源代码仍为未提交工作区。

生产mini2883模块/124路由、完整JS/JSON/WXML与正式/体验域名、fuzzy声明、新两步流程和失败提示、Intl降级及免费标识检查通过。根typecheck0、lint脚本提示未配置；直接Vitest单worker完整73文件457测试通过。首次并行npm运行已有会员冷导入30秒超时，重跑未改测试文件或超时值。

API镜像Next546页构建完成；CCR独立标签`map-ux-trial-20261003`及`dev`摘要均为`sha256:d81498fd047bf2244df86504d6932ac73c832e9875e265ffe527a59c8c5d563e`。Keel自动滚动后dev generation78、3/3新主容器Ready且摘要一致；main generation122和原b4494f5d摘要与发布前严格一致。公网两域health200，dev中国筛选791、中国加北京152、反查接口未登录401鉴权门禁均只读核验通过，没有业务数据写入。此401仅证明未登录门禁，不冒称手机登录后地址反查已实测。

证据目录：`artifacts/streetlifting-ux/2026-10-03/`，包括`trial-build.log`、`trial-package.json`、`trial-api-build.log`、`trial-tests-isolated.log`、`trial-rollout-before.json`及后续上传/线上核验记录。

用户手机快速检查顺序：打开单杠列表并选中国；分享位置并搜索国内/海外公园；确认后查看国家地址是否带回；重新选点及取消返回；定位附近后拖动缩放再重复定位；如地址未识别，按提示补国家和名称。实际导航由手机确认。
