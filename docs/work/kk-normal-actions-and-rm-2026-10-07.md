# kk 深蹲动作与1RM纠正

2026-10-07，按教练明确要求完成正式数据修正。

计划唯一active实例 `134f2c8c-4577-4586-b787-8a89f43fe427`，使用最新线上02:21:51版本，保留其第1天已更新内容。全期29个“杠铃背蹲”动作块改用教练已有“负重深蹲”，保留重组/降重/评估等标题后缀和所有数值处方。

KK个人动作库补入反手负重引体（底部暂停）外挂1RM30kg、海豹划船1RM60kg。同步既有负重深蹲canonical身份，未填写未提供的深蹲1RM。不存在新增PR、训练执行记录。

全局33模板检查无旧引用；教练全部实例及跨实例直接引用检查仅KK计划，执行无引用。替换后引用归零，精确删除本任务新建的重复教练动作和KK副本。共享canonical身份、其他动作及他人数据保留。

数据库回读逐字段确认：只变更29块动作ID/名称/标题、两个reference_1rm、必要更新时间、同步正常动作与删除重复行；其余库项/资料/付款/订阅不变。84天、48训练日、12动作、241动作块、0执行；权益48次可到day84。力量处方和顺序保留，重量继续依线上RM规则计算。

正式KK身份调用计划读取API返回200，全部动作顺序及处方字段一致，aggregated1RM内canonical基准分别30与60，29处深蹲均指向正常动作。实际UI未验收，依用户默认手动验收偏好；未修改业务源码/测试、未部署。

私有证据位于 `artifacts/kk-plan/2026-10-07/`：normal-action-before.json、normal-action-journal.json、normal-action-after-references.json、normal-action-after.json、normal-action-student-api-readback.json、normal-action-result.json。current-plan-readback.json/current-result.json已更新为当前状态，旧导入载荷不能覆盖本版本。
