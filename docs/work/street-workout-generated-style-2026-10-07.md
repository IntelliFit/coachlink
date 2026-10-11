# 街健统一风格生成（2026-10-07）

## 用户确认的需求

最终动作图片由项目自己生成，保持整库统一风格。网络视频/照片只用于弄懂真实动作和具体变式，不能直接成为动作库的最终素材。前次先导入视频、再导入真人视频帧都是代理误解。之前“真实照片/合法视频帧可作最终图片”的决策作废。

最新纠正：统一的是人物与插画风格，幅数由动作决定。静态/等长保持动作默认一幅完整姿势；动态动作只在有助于说明过程时增加关键姿势，每一幅必须提供新信息。禁止重复同一姿势凑三幅。平板支撑的三幅版本已被下文单幅版本替换。

## 已查看的原素材

- 从原图片备份地址下载并实际查看：平板支撑、反手引体、跪姿俯卧撑旧库图。它们不是本地 `fallback-outputs` 的文字占位卡。
- 查看角色母版 `design/image-workspace/outputs/anatomy-model-persona-sheet-v4.png`，及既有负重臂屈伸/负重引体三帧图。
- 读取既有生产规范 `design/image-workspace/action-library/production-plan.md` 与 `scripts/generate-canonical-action-reference-images.ts` 原提示词。
- 共同风格：白底，灰白解剖教学人体，短黑发/赤脚，主要肌群红色、辅助肌群橙色，无文字/箭头/水印。原批次常用横向三幅，但这不是后续必须遵守的幅数。v4母版无面部细节、半透明灰白材质。旧街健批次已有面部细节/黑短裤等漂移，因此新图同时参考母版与真实旧库图，不能只根据动作名称盲生成。

## 正确工作顺序

1. 先查真实示范，明确动作定义、器械、握法、支撑点、身体路线和具体变式。
2. 用原角色母版及旧库示范图片锁定风格，再将已确认姿势转为逐幅生成规格。
3. 用内建 `image_gen` 生成项目自己的插画；真人画面仅姿势输入，母版/旧图仅风格输入，明确每张参考的作用。
4. 先按动作选择幅数：静态一幅，动态按说明需要。对生成结果逐幅比对真实姿势，并检查人物、配色、背景和排版。不重复静态姿势，也不为了凑幅数编造动作变化。
5. 只导入经核对的生成图；仍不清楚动作或生成姿势不可靠的条目保持待审。不能为了图齐、URL可访问或风格相似就认定姿势正确。

## 平板支撑首张重绘（历史三幅版，已替换）

- 输入：v4母版、原平板支撑、既有负重臂屈伸（风格），DVIDS真实前臂平板支撑120秒画面（姿势）。
- 内建 `image_gen` 输出保存到 `design/image-workspace/action-library/reviewed-outputs/2026-10-07/plank-v4-reviewed.png`；生成提示全文保存在同目录 `plank-v4-prompt.md`，本地draft也保留。
- PNG SHA256 `a91810eaa9a0786e9a7c23295711f1dc3975052c72530a6162748f558572ece1`。
- 已实际查看生成结果：白底横向三幅、灰白解剖模型、无面部细节、黑短裤/赤脚、红橙高亮；三幅是同一静态保持。前臂及脚尖承重、膝盖离地、肘肩及躯干位置已与真实示范比较。视觉检查不是专业运动教练对全库的逐项认证。
- `scripts/promote-reviewed-plank-illustration.mts`只接受该生成文件的hash、目标DB主机、平板公共/标准ID，以及当前为本任务误导入的照片URL（或已替换的生成URL）。备份后上传PNG、CDN下载hash校验、条件更新标准图片、回读，不改其他动作/训练记录/用户视频。
- 原截图导入脚本已明确退役并拒绝运行；本地准入清单明确 `assetKind=generated-illustration` 和原风格参考，照片URL不再是通过审核的素材。
- 其余312项仍未完成动作理解与图片重绘审核，保留待审；不能声称已全部搜查、生成或验收。

## 结果与验证

- 已备份并条件替换本任务的真人截图，CDN PNG类型/完整内容hash与标准动作回读通过；正式API返回新生成插画URL、视频URL为空。
- root typecheck、78文件520测试、Next编译及547页构建通过；lint脚本只提示未配置ESLint，没有修改已有测试。
- 本地实际列表代码/已构建HTTP详情验证通过：力量102、有氧20、待审312；已核验生成图可见，分页总数正确，待审详情404，错误图片URL/标准动作ID被拒绝。验证没有DB写。
- DevTools9420只读连接成功，仍为`pages/index/index`，实际项目完整路径/AppID/窗口/构建版本/占用者未确认，遵AGENTS未抢用/导航/mock/storage写/再开同AppID窗口，命令结束已断开。小程序实际展示尚未验收。
- 只读临时服务已关闭，3002监听及port-manager登记已释放。首张生成图更正已在线生效；本地审核代码未部署、无客户端源码修改/新包上传、无提交推送。其他312项仍待审核及重绘。

## 最新：静态单幅纠正（2026-10-07）

- 用户指出同一静态姿势重复三幅没有意义，原三幅规则作废。生成提示词、生产规范和审核元数据已同步：静态一幅，动态按过程说明需要增加不同关键姿势。
- 内建 image_gen 新单幅平板支撑保存为 `design/image-workspace/action-library/reviewed-outputs/2026-10-07/plank-v4-single.png`；提示词全文见同目录 `plank-v4-single-prompt.md`。已实际查看姿势、支撑点和统一风格。
- SHA256 `5e63bb0464bedef687efb2dad6c359ba0e2447ab60084acaceedf909629f01bb`，CDN `https://cdn-assets.coachlink.fit/action-reference-images/street-workout-reviewed/auto_e051e34349e66344350282be/plank-v4-single-5e63bb04.png`。
- 精确条件替换原三幅标准动作图片，CDN内容/hash、数据库及正式API回读通过，视频为空。脚本只允许当前三幅URL或已更新单幅URL，备份见 `plank-before-single-pose-replacement.json`，执行日志 `plank-single-pose-replacement.json`。
- 本地准入清单使用新URL和 `poseCount=1`；其余312项仍待动作理解与重绘。无客户端改动/包上传/API部署/提交推送；DevTools实际窗口归属与版本仍不明确，小程序展示未验收。
- 最终代码/准入检查：root typecheck、78文件520测试、Next547页构建、git diff --check通过，lint仅提示未配置。实际本地列表/HTTP详情回读单幅新URL/url=null，错误URL/变式拒绝、待审详情404；力量102、有氧20、待审312。只读验证0数据库写，临时服务已关闭、端口登记释放。证据 `single-pose-tests.log`、`single-pose-next-build.log`、`single-pose-policy-check.log`、`verification.json`。
