# XPay 建单数据库约束修复

2026-10-13。用户0955沙箱体验页报`alipay_orders_payment_provider_check`，没有支付订单ID；查询按钮按`busy || !state.order?.id`禁用，不是独立点击事件故障。修复已在实际CoachLink云库生效，不用更换体验包。

## 根因与修复

实际dev配置与本地链接共同确认云项目`uhlqribpagvklpqmcqvo`。旧约束只接受`alipay`、`wechat`、NULL，而代码写`wechat_xpay`；20260916迁移创建XPay唯一索引并扩展退款状态，却遗漏provider CHECK。支付记录插入失败后，代码将会员业务单标`failed`，但会员CHECK也不支持failed。

迁移`supabase/migrations/20261013081211_allow_xpay_payment_provider_and_failed_membership_orders.sql`经CLI正常生成文件名，已使用既有已登录CLI身份通过[官方管理SQL接口](https://supabase.com/docs/reference/api/v1-run-a-query)执行。两个CHECK在同一事务、3秒锁超时、30秒语句超时内扩展；保留原表达式/合法值/NULL语义，只追加wechat_xpay与failed，默认完整验证。再次执行时读取原表达式判断新值已合法，不重复扩展。

只直接执行了DDL，没有宣称已更新Supabase migration history；本地迁移尚未Git提交。沒有重建或部署应用，dev88/main128均3Ready；没有会员收费恢复或汇付逻辑变更，也没有修改其他计划工作WIP。

## 真实验证

- 修复前事务复现provider与failed状态两项原CHECK错误，全部回滚。
- 修复后按下单API列形状真实插入会员与200分env1 XPay支付记录，能够返回并读回ID。
- 相同XPay交易号再次插入仍被`idx_alipay_orders_xpay_out_trade_no`拒绝；失败状态补偿可以保存。
- 旧alipay/wechat/NULL渠道仍可插入，非法渠道与非法会员状态仍拒绝。
- 整批`ROLLBACK`，探针0残留；原376支付行/25会员行与执行前一致。没有微信支付/发货/退款或余额、历史、角色写入。
- 两新CHECK validated=true，原XPay唯一索引保留，service_role INSERT/UPDATE权限正常。SQL执行成功不等于native付款与实际发货已验收。

用户继续路径：返回重进原体验支付页→再次“支付验证”→支付订单号出现后再查询；代理不代用户确认付款。若后续新报错继续按真实接口定位，不提前说完整闭环已通过。

## 独立安全风险

发现原两支付表RLS均关闭，alipay_orders匿名SELECT/INSERT/UPDATE/DELETE及membership匿名SELECT均允许。安全advisors目标表3条ERROR：policy_exists_rls_disabled与rls_disabled_in_public。参见[Supabase RLS公开表告警](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public)。本轮没有改变RLS/ACL；直接切权限可能影响旧Web/App所用匿名client，须另审查真实调用与权限边界并取得治理范围。

## 产物与边界

仅小型SQL/诊断脚本与状态文字，临时目录`D:/cache/agent-tests/coachlink-xpay-constraint-20261013`，子进程TEMP/TMP/TMPDIR均在该目录；没有新依赖、全量测试/构建或大媒体。正式原凭据仅进程内使用，不在脚本、结果或日志保存。证据收据见`artifacts/xpay-constraint/2026-10-13/receipt.json`；临时SQL/脚本完成后可清，不删除用户订单/附件或其他任务。
