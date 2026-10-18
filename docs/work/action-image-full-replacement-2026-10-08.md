# CoachLink 全量动作图片处理结果

更新：2026-10-08 02:51 JST（2026-10-07 17:51 UTC）
工作区：D:/files/coachlink

## 结果

- 完整范围434条公共训练动作，430条实际替换并验证，4条暂时隐藏。不能称434条全部替换。
- 正式 `https://coachlink.fit` 与体验 `https://dev.coachlink.fit` 匿名公共动作接口各返回430条力量/有氧动作，430条图片URL逐条与替换清单一致，无额外未复核训练动作。
- 新鲜只读数据库审计430条零错误，公共454条、标准764条完整；公共ID、名称、说明、标签、身体部位、原视频与标准动作其他字段一致。
- 有氧20/20已替换。所有最终图片由内建image_gen自主生成，统一灰色人体、黑发/黑短裤、橙红肌肉、白底的CoachLink解剖插画。
- 静态动作单幅；动态根据需要展示有区别的阶段。普通/宽距祈祷者俄挺俯卧撑、地面反手转手背飞机采用单幅主要下降/结束姿势，未声称这些单图展示完整运动过程。
- 不确定的额外肢体、手指、错握、错接触点、错器材或重复端点输出退回，未导入。内建输出检查误拒绝的任务未计入素材，使用完整运动服提示重试。

## 四条暂时隐藏

| 动作 | 原因 |
| --- | --- |
| 单杠卡指俄挺 | 没有可靠近景确认卡指的具体握法，不能推断为中指 |
| 单杠卡指飞机 | 同上 |
| 仙人挂画 | 原剪影无法可靠确认支撑点 |
| 手肘松解 | 原视频无法通过可用浏览器打开，且无可靠动作说明 |

四条公共记录保留全部ID、视频和训练关联，类型为STREET_REVIEW_PENDING，标准图片为空；未删除动作。`unverifiable-four-before.json` 为精确备份；最新只读核对仍为四条待审且无错误图片。隐藏不计替换。

## 证据与流程

证据目录 `artifacts/action-image-replacement/2026-10-07/`：

- `catalog-current.json`：原始只读基线，未覆盖。
- `scope-queue.json`：434条范围；430条replaced_verified，4条保留待审。
- `batch-*-planned.json` / `batch-*-reviewed*.json` / `batch-*-rejected.json`：生成、逐图复核及拒绝记录。
- `before-*.json` / `result-*.json`：精确目标备份、CDN完整SHA256、CAS更新及数据库回读。
- `live-verification.json`：17:51:27UTC全量430条只读审计零错误。
- `live-public-api-verification.json`：17:51:23UTC正式/体验接口各430条，failures为空。
- `unverifiable-four-before.json` / `unverifiable-four-result.json`：四条隐藏备份与执行回读。

登记素材 `design/image-workspace/action-library/reviewed-outputs/2026-10-07/full-replacement/`；原生生成文件保留在Codex generated_images目录。使用新不可变CDN对象键，上传后完整校验字节SHA，再串行更新与回读数据库。未并行写数据库。

研究依据包括原四方动作海报、Christopher Sommer《Building the Gymnastic Body》真实动作照片、Yordan Stanchev本人《All About Maltese》、Calisteniapp与作者/教练原文。网络照片/视频只用于研究，未直接导入；不能声称观看了无法访问的网络视频。

## 检查与边界

- 本轮lint、typecheck通过；78文件520测试通过；Next build编译成功并生成547页。
- 只读正式/体验公共接口与数据库验证通过，手机实际画面未验收。
- 未提交、推送、API部署或上传小程序。既有其他任务的源码修改保持，不将它们归入此次图片结果。
- 微信开发者工具窗口未创建、抢占、修改mock/storage或关闭；此前已有研究浏览器连接超时，未连续新开窗口或下载远程媒体绕过。

## 后续

四条隐藏动作只有获得可靠原始动作与握法资料后，才继续同风格生成、实际视觉复核、完整CDN/数据库校验并恢复。其余430条完成；不把隐藏四条称作已替换，也不导入猜测姿势。
