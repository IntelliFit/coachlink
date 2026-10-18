> 纠正（2026-10-07）：本次全清备注是代理误解，用户明确要求只删废话。必要备注已恢复，当前结果见 [纠错记录](kk-essential-notes-restored-2026-10-07.md)。下文保留为历史操作记录，不能作为当前计划或后续偏好。

# kk 计划备注清理

2026-10-07，按用户“不要备注、不要写重量和多余东西”的明确要求完成。

基于最新正式实例02:39:38版本，保留教练已编辑内容，删除training_days内全部566个note字段（含每日、动作组顶层、params及嵌套），计划description/execution_notice为空。不新增替代说明。

逐字段比较确认正式动作、顺序、组数、次数、RM、休息时间、技能秒数、逐组配置和动态计算重量原样保留。84天、48训练日、241块、12动作；0执行。个人动作库反手负重引体外挂1RM30kg与海豹划船60kg保持，订阅/付款/问卷资料完整不变。未修改全局动作库详情。

正式kk身份读取计划HTTP200，返回没有note字段，描述与训练提示为空，48训练日、全部动作和数值处方一致，两个1RM基准仍在。实际UI未验收，按用户默认手测偏好。无业务源码、测试变更或发布。

私有证据：artifacts/kk-plan/2026-10-07/no-notes-preflight.json、no-notes-before.json、no-notes-journal.json、no-notes-after.json、no-notes-student-api-readback.json、no-notes-result.json。current-plan-readback.json/current-result.json已更新；后续不得用旧载荷还原备注。
