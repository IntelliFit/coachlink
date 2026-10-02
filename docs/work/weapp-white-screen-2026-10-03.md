# 小程序真机白屏诊断（2026-10-03）

## 真机根因已捕获（发布执行期间追加）

用户两张04:14 vConsole截图明确显示`ReferenceError: Intl is not defined`，堆栈在`TodayTrainingScreen`的`useMemo`；同时用户确认所有设备均白屏。路径为pages/index/index。由此本次白屏的具体异常已确定；下方缓存问题属于独立健壮性风险，不能继续作为本次根因。

源码关联：今日训练页`formatPlanDayLabel`调用共享`packages/core/src/beijingTime.ts`的`formatBeijingDate`。首个Intl格式化已有try/catch，但所谓降级路径又直接`new Intl.DateTimeFormat(... timeZone:'UTC')`，当真机缺少Intl时再次抛错，发生在首屏同步渲染。清storage不能安装缺失运行时API；修改服务器返回值也不能让已发布客户端该段代码变安全。

已在本地补上Intl能力检查，支持Intl/IANA时保持原格式；仅缺Intl或格式化不可用时用UTC时间加8小时后读取UTC字段生成年月日、星期和时分秒，不依赖手机时区。临时探针先复现旧源码失败，再验证缺Intl、缺DateTimeFormat、Intl构造失败三种场景及跨北京午夜/跨年，共19项断言通过；新包真机验证仍由用户执行。原构建已中止，不能上传只含缓存防护的旧产物。

用户已授权全量提交、更新前后端和上传新体验版，由本人提交审核；状态见docs/work/release-2026-10-03.md。正式版需审核发布后用户获取新包，不能保证微信审核次日早晨完成。此前“手机没有堆栈/根因未确认”的描述保留为前阶段调查记录，由本节覆盖。

用户截图手机03:09只有微信胶囊，没有页面内容、底部导航、加载或报错。正式版完全退出微信后重开仍白屏；随后确认体验版也有相同问题，另一个食探小程序正常。实际正式版本、页面入口和该手机JS日志仍未取得。10月2日本代理仅上传体验包2026.10.02.0714，未提审或发布正式版。

## 当前证据

- 最新UTC20:02–20:03（北京时间04:02–04:03）复核main/dev各3/3、Apollo三服务与MySQL、Redis及五worker全部Ready。节点无压力/taint，根盘剩47,874,007,040字节，约44.6GiB。两域health与公开教练读取均HTTP200且success；这不验证该手机账户、计划或首屏。
- 官方微信jserr_list在UTC19:40、20:02复查10月2至3、所有版本/错误类型，仍errcode0、totalCount0，未取得手机堆栈。可能没有上报/统计延迟/包未启动，不能当作真机无错误。凭据未打印或落盘，未强刷token。

- 2026-10-02T19:21:55Z复核：main/dev各3/3；Apollo、Redis及五处理worker全部Ready，节点无压力。根盘可用48,022,630,400字节，约45GiB。没有昨晚磁盘压力驱逐复发的证据。
- 两域公网轻量验证：health200且healthy，公开教练接口200且成功；login页面200，免费新购按策略403。主镜像仍上次部署版本。这些检查没有验证该手机的登录态、计划或首屏。
- 19:20:41Z读取过去30分钟Nginx记录，仅收录referer含CoachLink域名或AppID的API请求：3个全部HTTP200，分别微信登录1次、学员资料2次，最后19:02:52Z。截图时间附近未发现匹配请求。该结果排除了无referer记录，不能等价于手机没有发出任何请求，也不能识别这些请求是否属于截图用户。
- 官方DevTools skill0.3.2状态检查成功，登录有效、无需CLI令牌。只读当前页为pages/index/index；console grep error仅有微信WAServiceMainContext timeout，无可定位的业务异常堆栈；network grep fail为空，不能等价于全部网络或手机网络正常。
- 现有DevTools包含其他本地未发布任务，只绑定localhost:3001；它不是已上传体验包的真机运行。早期只读诊断后，本轮已本地重建并复用SDK9420做针对性回归，未关闭项目或切换账户。
- 19:31:02Z以正式容器bootstrap获得既有小程序配置，严格校验AppID；官方stable_token使用force_refresh=false，再只读查询jserr_list：日期2026-10-02至03，所有appVersion和errType，返回errcode0、totalCount0。未取得JS错误堆栈；不能据此断言该手机没有异常。接口规范来自微信当前server/API/operation/api_getjserrlist.html和mp-access-token/api_getstableaccesstoken.html（旧OpenApiDoc地址只返回目录，已纠正）。没有打印AppSecret或access_token。
- 已上传体验包记录版本2026.10.02.0714，生产构建按envVersion选择体验域dev.coachlink.fit/正式域coachlink.fit。源码正常首屏并不等待API才渲染；请求失败有toast。

## 已复现的源码风险与本地修复

原首页缓存读取只校验版本、用户和60天时间，未检查字段结构。用实际缓存模块与TodayTrainingScreen源码执行复现：

| 异常缓存 | 原读取 | 首次渲染错误 |
| --- | --- | --- |
| coachSubscriptions是对象 | 接受 | coachSubscriptions.find is not a function |
| selfInstance.training_days是对象 | 接受 | trainingDays.find is not a function |
| coachSubscriptions数组含null | 接受 | Cannot read properties of null (reading id) |

这些异常发生在首屏同步渲染、云端更新效果执行之前，能形成白屏风险。**尚无证据证明该手机的缓存就是这些结构，根因未确定。** 两个版本都白屏和食探正常使CoachLink共同的启动/数据/缓存路径更值得排查，但无法排除该域名链路或微信包加载问题。

仅修改apps/wechat/src/utils/todayTrainingPageCache.ts，增加列表、计划训练日/actionSets、计划块与映射的基础结构校验，以及有限savedAt。异常快照返回null，读操作不删除/重写原storage；有效缓存继续按用户隔离和60天规则使用，正常云端成功结果仍按既有流程更新。不新增全局错误边界或遥测，不清登录和本地训练记录。

## 本地验证

- 实际缓存模块10项临时探针通过：三种异常拒绝且存储保留，正常空缓存/计划可读，用户隔离、61天过期、Infinity时间及异常教练日/动作组均符合预期。
- 根lint（仅未配置提示）、typecheck、69文件443项现有测试通过，未修改已有测试。Next546页与本地小程序2893模块构建成功；相对虚拟HEAD完整小程序类型诊断428→428，新增0，历史诊断仍在。
- 构建后首张实际截图是基础资料引导页，不能当作首页验收。后续用weapp-devtools SDK9420严格核对AppID，保留当前账户；针对三种异常缓存逐项reLaunch首页，实际路由pages/index/index、底栏5项、三张PNG已查看，内容完整无白屏。
- 针对性UI回归模拟所有wx.request为只读空计划/完成引导资料，阻断测试请求到云端。没有真实训练、资料保存或云端写入；这不是全量UI审查或手机真实账户验证。finally解除mock、返回原引导路由并逐键恢复4项触碰缓存，完整user和token一致，restored=true。
- 临时完整屏幕源码探针在修复后曾遇到简化测试替身的moduleCount缺失；该探针不足以验证整个页面，后续独立模块检查和真实DevTools画面才是本地修复验收证据。

## 尚未完成

手机版本与入口已发文字询问，真机启动日志/受控修复包验证仍缺。不能承诺手机已修复；本地截图不能替代真机。未经新增授权未提交/推送/部署/上传，未重启线上或删除真机数据。工作区另有未发布的海外地图改动及迁移，不应混入猜测性修复包。

证据位于artifacts/incident-2026-10-03/：status-followup.json、online-followup.json、wechat-errors-followup.json、cache-boot-before.jsonl、cache-guard-checks.jsonl、cache-typecheck.json、cache-ui-manifest.json、三个异常场景PNG与各构建/检查日志。上述脚本与网络响应仅用于本轮本地验证，未加入已有测试配置。
