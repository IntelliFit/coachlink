# 单杠分享问题核查（2026-10-10 JST）

后端两处修复已于2026-10-10发布dev/main；小程序关闭符号与直接CDN分享仍仅本地，未上传。源码未提交/推送。最新发布验证见streetlifting-share-backend-release-2026-10-10.md；下文保留诊断及各阶段历史。

## 两个问题

1. 关闭按钮源码写成了“脳”，而非“×”。没有业务含义；已经恢复原有关闭符号。
2. 国际丽都点位正式接口data.location包含3张现场图，首张CDN200、image/jpeg、863130字节，约502ms。原图未丢失，不能直接归咎用户网络。分享封面代码读了data而非data.location，导致照片为空：实际current-cover.png写着“暂无现场图片”；显式传入首图的cover-with-photo.png可显示现场照片。

原动态封面接口虽然200/image/png，却约4～8秒生成，未缓存；整个聊天卡片灰色占位可能还有客户端取图失败或超时。没有手机分享错误日志，未复现微信聊天实际发送，不能证明其唯一原因。3:4动态封面尺寸也与微信5:4卡片展示比例不同，本轮未扩展为海报版式改造。

## 本地修改

- apps/wechat/src/streetlifting/index/locations/index.tsx：关闭符号恢复×。
- apps/wechat/src/utils/share.ts：已有现场图直接作为分享imageUrl，避免等待动态OG；列表及分享详情共用。无现场图维持品牌OG封面。
- src/app/api/og/streetlifting-location/route.tsx：读取data.location，修正服务器封面的地点与照片来源。

## 检查与边界

3份修改文件TypeScript/TSX语法转译无诊断；7项定向逻辑检查通过，其中OG检查使用正式get接口真实响应，捕获渲染树验证首图路径；同时验证无照片/查询失败兜底及分享目的地。不是完整类型检查或实际ImageResponse渲染验收。git diff --check通过。没有修改已有测试文件、数据库或登录态。

使用weapp-devtools技能盘点环境：本机无运行的微信开发者工具，无9420～9429自动化监听，mrc不在PATH；CLI在D:/software/微信web开发者工具/cli.bat。项目D:/files/coachlink/apps/wechat，AppID wx316e39eb71c0e834，配置root=dist/。没有可复用验收窗口，未新开窗口，未占用/操作任何项目，没有mock/storage需要恢复。最新磁盘规则禁止自动全量构建，本轮不执行该构建；DevTools视觉/真实微信聊天发送尚未验证。

本机node_modules/next/dist/docs不存在，Next相关API参考官方ImageResponse文档：https://nextjs.org/docs/app/api-reference/functions/image-response 。微信支持图片路径参考官方api-typings：https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.page.d.ts 。

## 证据与空间

artifacts/streetlifting-share/2026-10-10保留current-cover.png、cover-with-photo.png、probe.json、verification.json，总约1.8MB。未下载原始现场照片到本机；没有构建缓存、模型或依赖写入。定向检查的TEMP/TMP/TMPDIR只在子进程中设置为D:/cache/agent-tests/coachlink-streetlifting-share-20261010，报告转存后清理该任务的文件和空目录。

用户确认不再需要诊断图后，可只删除上述证据目录中的4个文件及空目录；不清理别的artifacts、数据库、用户照片或运行服务。后续需要重新本地构建和真机分享确认，再按明确授权同步小程序与后端；旧聊天卡片不会因本地改码自动刷新。

## 2026-10-10 分享修复的发布边界补充

用户追问仅更新后端是否有效。明确：后端部署可修旧小程序动态OG读取data.location的问题，让服务器封面包含现场图；不能更改已发布小程序中的“脳”关闭字符，也不能启用本地新增的直接CDN现场图分享。完整修复需后端部署与小程序新包更新配套；体验版可先验证，正式版还需审核发布。此追问不构成部署、上传或正式发布授权，当前修改仍只在本地。

## 分享后端发布期间补充根因（2026-10-10 JST）

- 首轮dev仅修data.location，generation85/3新副本Ready；公网实际PNG仍55525字节无现场图，因此没有推进main。真实HTTP NodePort请求有照片（1743303字节），仅加X-Forwarded-Proto:https即退成无图封面（52550字节）。
- Next 16内部URL会沿代理协议组合fetchHostname/port；容器HOSTNAME=0.0.0.0且服务只监听HTTP，导致Edge req.url的HTTPS回环origin不能自取点位。源码已只将localhost/127.0.0.1/0.0.0.0/[::1]的内部请求协议规范为HTTP，外部HTTPS保持。v2编译后helper增加4回环与外部HTTPS定向检查，准备完成；dev v2滚动中，main尚未动。
