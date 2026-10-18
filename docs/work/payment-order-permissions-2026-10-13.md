# 付款表权限与正式收费同步回执

日期：2026-10-13。用户已明确授权治理两张付款表，保留原购买与汇付分账，同步 main/local，由用户自行微信提审。

## 已完成

- 业务提交 `32eef79f0d5acdf378cbdd4f261d9b81e023569d` 已推送 GitHub/Gitee 的 dev/main。
- `public.alipay_orders` 与 `public.student_membership_orders` 已启用 RLS，撤销 PUBLIC/anon/authenticated 直接表权限，保留 service_role CRUD，清除仅这两表的旧客户端策略。
- 兼容后端先部署，再应用 `supabase/migrations/20261013143926_lock_down_payment_order_tables.sql`，没有权限先关而旧服务仍在线的部署断档。
- 正常会员建单、Web 建单、游客建单/失败清理、历史普通查单改用服务端数据库权限；普通订单强制核对归属。保留游客现有不可猜测 UUID 的状态查询，不公开底层付款表。
- 汇付金额、分账、结算、回调与钱包业务逻辑没有修改。另一会话未完成且未授权发布的教练换套餐 WIP 排除在提交、测试发布快照及镜像之外。

## 部署与 Apollo

两环境使用同一个不可变镜像：

`ccr.ccs.tencentyun.com/littlehorse/coachlink@sha256:9b696b9dd4d6d56032ca580ee93fb8ed20a1499aa99c91e3430fa25bdbcd9803`

| 环境 | Generation | 新镜像就绪 |
| --- | --- | --- |
| main | 129 | 3/3 |
| dev | 90 | 3/3 |

Apollo `coachlink → DEV → app-config`：

| Cluster | 新发布 | 收费开关 | 沙箱 |
| --- | --- | --- | --- |
| main | 215 / `20261013-payment-acl-paid-main` | true | false |
| local | 216 / `20261013-payment-acl-paid-local` | true | false |
| dev | 保留既有现网收费配置 | true | false |

main/local 仅新增并发布 `COACHLINK_WECHAT_PAID_RELEASE=true`，两个 Namespace 的待发布差异都只有这一个键。其他配置与汇付设置未改，现网 AppKey、Token、OfferID 配套一致，密钥不写入回执。实际本机单源 bootstrap 回读 `CONFIG_SOURCE=apollo / APOLLO_CLUSTER=local / paid=true / sandbox=false`。main 的现网 AppKey 已通过微信官方 env=0 查询验签（errcode=0）。

正式发货地址保持 `https://coachlink.fit/api/payment/wechat/xpay/notify`，正式签名 GET=200/原样 echostr，未签名=403，无须用户更换回调地址或 Token。

## 验证

- 隔离已提交源码发布快照：lint 脚本执行（项目未配置实质 ESLint）、typecheck 通过，91 个测试文件/648 项测试通过。没有执行或发布当前未完成 WIP。
- 新增 6 项付款访问测试：本人订单查询、会员/教练/内容越权拒绝、匿名普通订单拒绝、游客查询兼容。未修改已有测试。
- 上线前真实数据库事务验证 anon/authenticated 拒绝、service_role 两表写入/更新/删除、旧微信/支付宝渠道保留、XPay 原子发货及重复发货不重复增加额度；全部 ROLLBACK。
- 正式应用权限后回读：两表 RLS=true，anon/authenticated SELECT/INSERT/UPDATE/DELETE 全为 false，service_role CRUD=true，旧策略数量0。
- main/dev 各17项实际线上检查通过：公开 REST 表读取401、服务端可读、本人历史 paid 查单200、不同用户403、匿名普通查单401、付费商品校验400、旧免费包建单403、教练/旧会员建单仍要求登录、通知验签及健康正常。
- 没有真实已付游客样本，因此游客兼容依据代码回归和数据库 ROLLBACK 验证，不声称真机游客购买已验收。
- 两付款表原 ERROR 级安全告警消除；剩余两条 `rls_enabled_no_policy` INFO 是服务端专用表拒绝客户端访问的预期提示。没有宣称全库其他告警已治理。
- 后续管理 SQL 复验请求出现超时，未当作成功；实际 REST/API 复验与最终服务端回读确认378笔付款/26笔会员订单保持，探针0残留，原验证账号 AI 余额仍5。
- 代理没有创建现金订单、确认付款、发起退款、汇付分账转账或修改用户原权益/历史数据。

## 小程序与交付边界

本轮只有后端权限与配置改动，沿用已成功上传的付费体验包 `2026.10.13.1703`（AppID `wx316e39eb71c0e834`），没有重复构建/上传小程序、提交审核或正式发布。1703包括前轮已获授权的本地改动；本轮更晚出现的换套餐 WIP 仍仅本地。

已有手机成功订单 env=1，是沙箱闭环，不是实扣现金证明。现网参数和后端检查通过不代替 Android 真机确认实际现金扣款、权益到账和重复查单；不承诺微信审核必过。本轮未进行前端界面修改或新 UI 验收。

## 资源

本机任务目录 `D:/cache/agent-tests/coachlink-payment-acl-20261013`，峰值新增约10.4MiB（主要源码/依赖小型压缩包），测试临时目录只在D盘，没有本机容器构建或依赖重装。复用服务器既有缓存，保留正在运行的服务。传输压缩包可删除，保留SQL、脚本和权限/发布摘要用于追溯；不清理任何用户数据或其他会话产物。Apollo 任务自建浏览器标签已关闭，用户原标签不动。
