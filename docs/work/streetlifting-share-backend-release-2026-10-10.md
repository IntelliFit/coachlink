# 单杠分享后端发布（2026-10-10 JST）

用户明确要求先更新dev和main后端，前端稍后处理。两环境发布已完成；未上传小程序、未修改数据库、未将其他本地WIP打包上线。源码修复仍保留在当前工作区，没有Git提交或分支推送。

## 上线结果

| 环境 | deployment | generation | 状态 | 新镜像摘要 |
| --- | --- | --- | --- | --- |
| dev | coachlink-dev | 86 | 3 updated / 3 ready / 3 available，应用与sidecar均0重启 | sha256:94d62a4d38aea4e4a4efdab80a105d6d72129beb9bbbe2cfc2b6012d238118b1 |
| main | coachlink-main | 128 | 3 updated / 3 ready / 3 available，应用与sidecar均0重启 | sha256:3e446dd3d8e72676d048d47b1b1edc46f6c4381bc2f8bbc6c04932cf958fe031 |

dev基线为29b98d04770c7e1c25bbafc63c7fd6dba432c70d54d9f81c31b28eabd157d11c；main保留原xpay-notify-20261008-v1基线0f0c45d491e78f714ed0168efd8cb22f04681b5cf94a952f9ec8323c0ec78537。镜像库路径ccr.ccs.tencentyun.com/littlehorse/coachlink。部署使用不可变摘要；可读候选标签为streetlifting-share-{dev,main}-20261010-v2，不覆盖latest/main/dev移动标签。生产资源仅条件JSON patch业务容器image：验证resourceVersion与旧镜像，无环境变量、配置、sidecar或服务参数修改。

## 后端两处修复

1. 地点get接口实际结构是data.location；原OG误读data容器而拿不到图片。
2. 公网HTTPS反向代理影响Next Edge req.url：内部fetchHostname/port被组合成HTTPS，但容器监听HTTP。真实NodePort HTTP请求会显示照片，加X-Forwarded-Proto:https则返回无照片封面。已仅将localhost、127.0.0.1、0.0.0.0、[::1]的内部origin规范为HTTP；外部HTTPS保持。

源码位于src/app/api/og/streetlifting-location/route.tsx。发布采用各环境既有镜像的唯一OG路由chunk小补丁，未做本机全量构建。被改chunk在middleware manifest中只属于此路由。所有原始镜像层与runtime配置Cmd/Entrypoint/User/Env/WorkingDir/ports/volumes均逐项校验保留，候选仅追加一个COPY层：dev v2约7960字节、main约7712字节。main此前支付回调热修由原基线完整保留。补丁原文件/新文件SHA、Dockerfile、镜像摘要及部署前置条件已存审计文件。

## 实际验证

- 两镜像的Node语法检查通过；编译后的实际getLocationFromApi helper通过真实嵌套结构、调用目标、4个HTTPS回环地址、外部HTTPS、缺地点、API失败、HTTP失败等检查。源码TypeScript/TSX语法检查与git diff --check通过。未改已有测试，没有全量测试/依赖安装或本机容器构建。
- 公网dev于18:45:54 JST、main于18:47:44 JST：health200、地点get200/3张图、OG200/image/png。国际丽都点位4ecf1463-3da2-4d20-8734-6f3089433378封面1080×1440、1742525字节；两张实际返回PNG的SHA256完全相同：4491add882ecbe0e713ae09b94d2643d1e2845529fc0d04888469ab23534667a。已查看返回图，现场照片可见。
- 本机观测完整图片下载耗时dev10456ms、main6715ms；生成仍较慢，没有声称微信聊天缩略图取图超时已消除。微信手机分享未验收，用户需重新分享新卡片观察。小程序关闭字符与直接CDN分享仍是本地未上传改动。
- 正式支付回调真实GET挑战：unsigned403、正确签名200、原文echo完全匹配；原Apollo main配置已安全加载，未输出业务密钥。没有付款、发货、退款或订单/权益写入。
- 发布后节点Ready=True、MemoryPressure=False、DiskPressure=False。

## 过程异常与处置

第一轮dev v1只修数据结构，虽3副本就绪，但公网封面仍无图；因此没有推进main，继续定位并修内部HTTPS问题。v2 dev首推CLI显示成功，随后实际registry tag/digest不可查、Pod ImagePullBackOff；重新推送同一镜像后远端manifest可查。只回收本任务新建且未就绪的coachlink-dev-5574dcdd65-x4scm，让控制器重新拉取。既有可用副本继续提供服务，最终全部v2就绪。几个45秒rollout等待窗口超时后再次查询最终成功，未把中间超时当终态通过。main只在dev实际封面有图后更新。

## 空间、收尾与后续发布

本轮本机新增证据3570416字节（约3.6MB），目录D:/files/coachlink/artifacts/streetlifting-share/2026-10-10/deployment；全任务证据累计5369608字节。主要是dev-cover-after.png与main-cover-after.png两张必要环境验证图，无原始照片下载、模型、依赖、完整源码副本或大构建产物。没有在C盘创建任务临时目录。

服务器任务目录/home/ubuntu/coachlink-streetlifting-share-20261010和同名-v2合计约207KB，保留小型回滚/镜像审计；本任务两张HTTP对照临时图已精确删除，所有docker验证容器--rm退出，本任务本机卡住的只读Docker inventory client已停止，未停Docker/数据库/用户服务。

需要回收本机证据空间时，只删除deployment/dev-cover-after.png和main-cover-after.png可回收3485050字节；JSON/脚本与小型审计可保留。服务器目录确认不再需要后再精确清理其本任务文件；运行镜像、数据库、其他构建缓存及服务不清理。

下次常规发布须包含本地OG两处源码修复，main还须包含已有proxy精确公共回调路径与wechatXPay独立Token验签修复，不能从旧Git基线整包覆盖掉这些已上线内容。当前两部署固定摘要，常规流水线恢复移动标签时需有意更新deployment；没有把候选标签假装成Git dev/main已同步。
