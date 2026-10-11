# kk 自重与静态训练记录核查

2026-10-10 JST。用户提供 kk 第 4 天训练海报和学员反馈，要求核实无法记录自重的情况，并说明学员和计划均属于自己。本轮仅核查源码与正式数据库，未修改业务代码、计划、执行记录、极限记录或登录状态；未构建、测试、提交、部署或上传。

## 已确认事实

- 正式库用户 kk：`06de1d96-7c42-4291-817a-42d8720ca0b7`，资料体重 73kg。
- 教练枭马葛：coaches `02db8c38-dc64-490b-9b78-e002a13811df`，用户 `f9eac5b1-45f9-4479-9ab8-8223a5db8835`。
- 实例 `134f2c8c-4577-4586-b787-8a89f43fe427`，名称“kk计划”，状态 active。其 student_id、coach_id 与有效订阅 `9d156e8c-3383-4442-8b38-404ae7e93784` 对应字段一致。学员/教练关系及计划归属正确。
- 第 4 天面墙倒立实际处方：2 组，每组 20 秒，逐组 `targetType=time`、`targetUnit=s`、`targetValue=20`，RPE≤5；没有公斤负荷。动作 attrs 为组数/持续时间/休息时间、自动算重关闭。第 6 天同类处方亦如此。
- 当日完成 execution `bad370ea-678d-4395-b89a-7d6a3b96be37`，16 组，UTC 06:34:09 开始、08:03:35 完成，历时约 89 分钟，与截图吻合。
- 面墙倒立实际保存 3 组，每组 `actual_weight=50`、`actual_reps=20`，未保存 actual_duration。原前两组仍有 `planned_reps=20秒`；额外第三组继承 `planned_weight=50kg`、`planned_reps=20`。
- 全部完成组按外加重量×次数得到 5337.5，海报四舍五入为 5338kg。倒立贡献 50×20×3=3000；仅排除该错误贡献后，其余已保存力量数据容量为 2337.5kg（约2338kg）。这不是把倒立负荷改成体重73kg，也不能据此认定学员真实外加50kg。
- 还生成了面墙倒立 e1RM=85.5kg：三组 execution 均含此值；`personal_records_history` 中有 AUTO_STATE `a26fdcbc-2eae-4845-a67c-441ebbfc1c3e`，关联本次执行、第一组。is_auto_calculated=true、is_verified=false，不是已核验PR；学员面墙倒立 reference_1rm 仍为 null。

## 源码根因

1. 小程序 `apps/wechat/src/training/training-execution/index.tsx:711` 的 `isWeightRequiredForSet` 在 planned_weight 为空时返回 true；提交处 `:1351` 因 null/undefined 弹“请输入重量”。表单 `:2959` 仅公斤数输入，没有显式“自重”选项。0 与空值不同，0 不被此检查阻止。
2. Web `src/app/training-execution/[instanceId]/page.tsx:545` 同样把空计划重量视作必填；`:2403` 明确允许0。`complete-set/route.ts:155` 只检查 actualWeight 是否 undefined，因此底层可保存0公斤外加重量；没有必要填写体重或虚构比例。
3. 静态组虽由 start API 保留 planned_target_type/unit，但小程序 `getSetRepsDefault`（`:283`）把“20秒”抽成整数20，执行表单仍显示“重量/次数”；未根据 time/s 切成秒数录入。Web亦没有在此执行表单识别持续时间。静态训练不是普通次数训练。
4. 小程序容量计算 `:2391` 直接累计 actual_weight×actual_reps，海报 `:2432` 优先显示 actual_weight。0可展示“自重”，但非0就展示公斤，无法修正错误的数据语义。
5. `src/lib/autoE1rmTracking.ts:247` 读取动作配置后直接计算重量×次数 e1RM，未在计算/写 AUTO_STATE 前校验静态时间目标。`isOneRMEligibleAction` 只挡学员动作 reference_1rm 更新，未挡本次85.5的 execution/AUTO_STATE 写入。
6. HEAD小程序源码也存在相同空值必填逻辑；不是仅本地未提交WIP新增的判断。当前正式真实记录印证时长/重量/容量/派生数据问题，但本轮没有操作已发布小程序UI，不能声称真机交互已复现或已修复。

“包含自重”属性控制体重是否参与负重动作的强度/e1RM公式，不等于一个录组“自重”按钮。仅把倒立该属性改成true不能修正按秒记录问题，反而可能继续生成无意义负荷极限。

## 修复应覆盖的范围（尚未实施）

- 次数型徒手动作明确“自重/外加负重”，自重使用0外加负荷，不要求用户知道隐含输入约定。
- 静态动作按秒保存与展示，沿用原处方和组数/休息/备注；不强制重量和次数，不计算力量容量/e1RM。
- 对齐Web、小程序的输入、后端、训练摘要和海报；既有进行中快照/添加组也须保留时间目标。
- 当事人这次训练原始记录及AUTO_STATE更正必须明确确认真实完成时长/组数，仅凭截图不能擅自认定第三组是否实际完成；不把整份历史计划/执行回滚。修复源码与更正真实数据是后续工作，本轮没有执行。

## 证据与资源

`artifacts/kk-training-diagnosis/2026-10-10/` 保存只读脚本、`live-summary.json` 与 `derived-summary.json`。bootstrap沿用生产严格单源配置；正式DB hostname断言为 `uhlqribpagvklpqmcqvo.supabase.co`。脚本客户端fetch只允许GET，未调用存在生命周期写副作用的训练业务API，没有输出密钥。

核查时间UTC08:58–08:59（JST17:58–17:59）。检查前C约7.12GiB、D约41.12GiB。仅必要小型JSON/脚本/文档及状态笔记；没有测试临时目录或新开发者工具窗口。保留证据便于后续修复，需清理时仅指定本任务证据目录，先确认无跨目录链接。
