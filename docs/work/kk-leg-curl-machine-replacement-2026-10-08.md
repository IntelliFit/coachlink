# kk 腿弯举替换为固定硬拉机

2026-10-08 JST，教练确认kk健身房无腿弯举设备，仅有提供照片中的挂片式固定硬拉机，要求替换计划动作。粘贴的学员反馈作为设备情况，不扩展为擅自添加视频或重新设计整套计划。

实际正式实例134f2c8c-4577-4586-b787-8a89f43fe427最新版已于10-07开始，D1完成、D3进行中。计划对应11个腿弯举块均未执行，位于D4、11、18、25、32、39、46、53、60、67、74。基于最新03:35:54UTC实例原位替换，未用昨日旧载荷覆盖。

动作库及canonical库检查无等价器械动作，所以建立“固定硬拉机”独立器械身份，教练动作227ce878-67a9-44ff-89dd-b6f2a5f1b2cd、canonical custom_8664136c-022a-49bd-8e77-2ac8e0d22806，并同步kk个人动作库。属性为力量/不包含体重，reference_1rm=null；演示URL与额外详情为空，不添教学套话或未经核实视频。杠铃硬拉140kg基准属于旧动作，未复制到此器械。

只更新对应动作块的actionId/actionName/setName和实例更新时间；原params与备注不变。常规2组10次12RM、减量周1组10次15RM，组休120秒。保留84天48训练次241块12动作。没有删除原腿弯举动作库行。

保存前后完整执行行深比较一致；付款订单、订阅、资料、旧个人动作库和旧教练动作库全字段一致。数据库回读与正式kk身份计划API200：11处显示新动作，正式数值字段/必要备注完整；未显示虚构机器1RM或借用杠铃负荷。实际UI未验收，按用户默认手测偏好。未改业务源码/测试、未提交或发布。

证据在artifacts/kk-plan/2026-10-08：machine-preflight.json、machine-before.json、machine-action-payload.json、machine-patch.json、machine-journal.json、machine-after.json、machine-student-api-readback.json、machine-result.json。10-08和旧10-07的current-plan-readback/current-result指针均刷新为最新，后续继续以正式实时读取为准。
