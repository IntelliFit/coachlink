# main/dev 全后端与迁移上线回执

日期：2026-10-14。用户在全部本地代码提交后，明确追加要求线上迁移与部署全部执行。本轮正式 `main` 与开发 `dev` 后端及所需数据库迁移均已完成。

## 部署结果

应用源码固定为 `27ee1a997b1f41316480ad1baef12739c2f8ea9f`，包含业务提交 `79333c49` 的全部本地代码。两环境使用同一不可变镜像：

`ccr.ccs.tencentyun.com/littlehorse/coachlink@sha256:929921598b70c48046820041ab40b2c7e6a34448aba4584b144ea039cd608ffd`

| 环境 | Generation | 新实例 |
| --- | --- | --- |
| main | 130 | 3/3 Ready，0 重启 |
| dev | 91 | 3/3 Ready，0 重启 |

逐个核验六个新 Pod 的请求镜像、实际 `imageID` 和 Ready 状态。Kubernetes 的 `containerStatuses.image` 报告配置 digest，实际拉取的 manifest digest 以 `imageID` 为准；不能因为两字段不同误判为旧镜像。CCR `main`、`dev`、`latest`、`27ee1a9` 标签已同步。

先更新 dev 并核验，再更新 main。两次50秒的有界 rollout 等待均在最后一个实例就绪前超时；随后复查并继续等待同一次 rollout 成功，没有再次修改镜像或新建部署。

原旧镜像保留用于回退；Apollo 主配置、收费开关、现网支付密钥与汇付分账设置不变。未更新小程序/App安装包、微信提审或正式发布。

## 数据库迁移

实际项目为 CoachLink `uhlqribpagvklpqmcqvo`，PostgreSQL 17.4。先核对实际结构和权限，避免历史登记不完整导致旧DDL被重复执行。

| Version | 处理 |
| --- | --- |
| 20261013081211 | XPay渠道和failed状态已实际生效；校验后补齐历史登记 |
| 20261013084632 | XPay原子发货/私有回执/RPC已实际生效；校验后补齐历史登记 |
| 20261013142403 | 新建套餐接续队列及三个服务端RPC，事务应用并登记 |
| 20261013143926 | 两付款表权限已实际生效；校验后补齐历史登记 |
| 20261014092030 | 生产订单字段兼容补充迁移，实际执行并登记 |

真实线上回滚验证发现原接续迁移中的续费函数把 `last_payment_order_id` 当成 UUID；实际该字段为 `text`，而 `order_id` 为 `uuid`，导致同套餐续费 `COALESCE` 类型不匹配。此前临时PG测试夹具使用了UUID字段，未捕获此生产契约差异。

使用现有 Supabase CLI `migration new` 创建补充迁移 `20261014092030_fix_coach_package_renewal_payment_id_types.sql`，不修改已应用迁移。两个付款变量分别采用实际列 `%TYPE`，保留行锁、幂等、队列和权限逻辑。补充迁移仅改数据库函数；应用代码与镜像源码不变。

最终五项历史全部回读存在。队列表 RLS=true，PUBLIC/anon/authenticated 无直接访问权限，service_role 可CRUD；三个RPC均 `SECURITY INVOKER`、空search_path，仅service_role可调用。最新安全advisors相关表仅三条 `rls_enabled_no_policy` INFO，符合服务端专用访问模型；不宣称已治理全库其他告警。参见[数据库权限与RLS官方说明](https://supabase.com/docs/guides/database/postgres/row-level-security)。

## 验证与数据保护

- 复用同一应用代码已通过的root typecheck及17测试文件111项定向测试；既有测试文件未修改。本轮实际SQL回归覆盖新补充迁移，不重复无关全量本地测试或UI验收。
- 在既有Ubuntu服务器构建。首轮Alpine依赖下载缓慢，停止了本任务构建容器；随后核验不可变依赖缓存 `be7690818483...` 与当前package.json/package-lock.json的规范化SHA256完全一致，复用依赖。构建前移除缓存镜像旧源码，再复制固定提交源码；runner沿用仓库Dockerfile。
- Next生产编译通过，550页生成、standalone打包与CCR push成功。未在本机Docker/C盘构建或重装依赖。
- 在真实数据库 `BEGIN…ROLLBACK` 内创建明确ID的合成订阅、计划、执行和付款行；使用现存用户/教练外键但不更新其记录。覆盖新SKU排队不动旧额度、重复通知、过时周数/时间戳、进行中训练保护、FIFO、历史执行全字段保护、同SKU续费/UUID与文本付款信息、重复续费、退款不激活。最终所有合成ID回查0残留。
- main/dev各26项线上检查通过：实际本人不同SKU预览200且金额/周数与教练商品一致，伪造商品400、越权403、匿名401；队列和三个RPC匿名访问401；付款归属/公开表权限、旧免费客户端拒收费、会员商品校验、汇付登录边界、通知验签及健康正常。
- 没有发起现金支付、退款或汇付分账转账。没有真实已付游客样本，游客兼容依据已有代码与事务回归，不冒称游客真机购买已验收。最终付款379、会员订单27、队列0，探针0；未修改学员已有权益或训练历史。

## 证据与磁盘

永久小型证据：`artifacts/backend-release/2026-10-14`，包含部署摘要、两环境接口回执、迁移/权限/安全与回滚结果和必要脚本，不含密钥。

本机任务：`D:/cache/agent-tests/coachlink-backend-release-20261014`，新增约115.35MiB，主要为115.22MiB源码压缩包；只读盘点32文件/0reparse，D盘余约45.30GiB。自动审批拒绝删除本任务源码压缩包，理由仅 `blocked by policy`；未执行删除或通过其他工具绕过。用户可手动删除本任务目录，永久证据已另存，其他任务目录/服务/数据库保留。

远端源码与日志位于 `/home/ubuntu/coachlink-release-20261014-*`；服务器构建缓存等新增约数GB，根盘余56GiB。没有全局清理Docker缓存或其他项目。
