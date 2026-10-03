## 正式单杠后端热修已上线（2026-10-03）

- 用户已正式发布客户端，本轮严格只改后端；没有小程序源码/包更新。国家筛选根因是main旧镜像未同步历史country兼容；用户两条测试实际已入库，客户端照片优先排序解释全部列表开头旧图，排序遵要求不改。
- 后端88b8c7ae已推GitHub/Gitee dev/main，Next after使保存确认不等贡献榜，list/stats移除无用session查询。lint/typecheck/457测试、Docker内Next编译与546页生成通过。镜像f8b60be658e1b825f2e5ef813d65a7d2323b792cb790cc4325445aae35d40855，main generation124/dev80，各3/3新镜像Ready，Node无压力/41.85GiB可用。
- 真实微信登录正式API：新增美国940ms、中国1610ms，均提交成功/返回ID落库；编辑15039ms成功，不能声称所有操作1秒。探针精确清理0残留。正式stats匿名/登录200完整920点位；中国810、武荣公园搜索2条，旧记录恢复筛选。并发复验3个curl TLS超时/1个后端get瞬断，逐个重试均通过，外网偶发问题未宣称根除。
- 用户指定测试eed8e070-e812-47a6-988c-5d0c64c47d9d美国地图、341ee4a4-4ad6-4d17-9be9-64f06bd55f4f海淀区科育社区已核验署名/日期/名称并备份，于08:39:49UTC事务删除，同步其贡献统计。数据库0残留、两域读取两ID均404；其他用户新增保留。
- 发布包UI验证reLaunch报timeout waiting for automator response，未取得统计页面截图；手机原统计空白未当场复现。后端修复/发布/数据清理已完成，需用户返回上一页重新进入寻找单杠复看手机界面，若仍空白继续查实际请求/页面错误，不能宣称手机已验收。
- 记录docs/work/streetlifting-production-backend-hotfix-2026-10-03.md；证据artifacts/streetlifting-backend/2026-10-03。版本通告既有草稿未改内容、未对外发送。
## 正式版单杠后端紧急修复（2026-10-03，执行中）

- 用户已把体验版发布为正式版；明确只修后端，不再修改/上传小程序，并要求修复后删除两条测试点位。
- 实测正式API中国筛选仅1条，体验API810条，同DB共921条；正式main旧b4494f5d镜像缺历史country兼容。已将经验证3ce72794/d1d24099镜像同步main/latest，正式generation123与3/3新镜像Ready，中国筛选恢复810条。
- 两条用户测试实际已保存：美国地图eed8e070-e812-47a6-988c-5d0c64c47d9d；海淀区科育社区(中关村南一街东)341ee4a4-4ad6-4d17-9be9-64f06bd55f4f，计划执行者4215，08:11/08:12UTC。已准确备份，尚待最终修复验证后删除，不能误删其他新用户点位。
- 正式stats匿名及实际微信登录请求均200，后者3579ms/完整921点位数据；原手机统计空白暂无直接堆栈。实际微信登录新增美国8670ms、中国6209ms，HTTP200/提交成功/ID均落库；两条代理探针及前次工具超时探针已精确清理，零残留。
- 日志有一次认证读用户fetch failed；公开列表/统计原不使用session却等待三次用户查询。四个后端route最小修复：list/stats移除无用session读取，create/update使用Next after在成功响应后重算贡献榜。提交88b8c7ae，lint/typecheck与73文件457测试通过；首轮冷导入单测超时，未改测试，复跑全绿。Docker正式热修构建中，构建通过后同步main/dev API。
- 所有小程序前端源码/上传包保持不变。公告文案既有WIP保留，未将公告文件纳入此次业务提交。证据artifacts/streetlifting-backend/2026-10-03；后续完成镜像发布、正式API保存/统计/筛选复验、删除用户两测试、更新状态及同步远端。
## 手机登录网络故障已更正上传（2026-10-03）

- 用户手机截图同时有网络域名拦截提示及仅development显示的开发引导按钮；本地dist注入localhost:3001/有按钮，生产dist-release线上域名/无按钮。上一轮1543通过已打开的开发项目临时切root上传，实际产物与所检生产目录不一致。结合旧上传主包2095229/auth399526及独立生产上传主包1955537/auth398964，定位为上传流程拿到开发编译产物；此前“已检查包”等结论不能覆盖实际上传包。
- 新体验2026.10.03.1609已从独立D:/files/coachlink/apps/wechat/dist-release上传，官方upload result.success=true，无pending，9910125字节/主包1955537。根路径及srcRoot=./、urlCheck=true；当前原开发项目仍dist/，没有切其root。
- 独立生产项目真实打开登录页，PNG已查看，无开发按钮。实际common.API_BASE_URL=https://coachlink.fit，开启域名校验后通过应用request访问真实登录接口，空code返回后端“缺少code参数”，dev健康200；生产编译resolver四种env通过（trial→dev、release/develop安全回退→正式）。未执行真实手机手机号登录，未接受用户协议/改登录态或写账号/DB；手机完整登录需体验者复验。
- 业务源码沿用3ce72794，未改登录/地图源码或后端，不重建/部署不相关API。重新lint/typecheck通过，73文件457测试通过。元信息已更新为1609，发布包SHA256 0b437f819693c9f43f24cd19285b01a0a429119dbed45dbdec4d2b08b7ad7103；文档docs/work/wechat-trial-login-incident-2026-10-03.md，证据login-incident-*。

## 单杠地图新体验版已交付（2026-10-03）

- 用户授权全部本地修改提交推送及体验版更新；源码提交3ce7279409330332f95fc5a4a6abf0d5e0e25cdd已同步GitHub/Gitee dev。lint/typecheck通过、73文件457测试通过；生产mini2884模块124页/包检查通过，未含本机API或开发诊断。
- 官方微信upload任务confirmation_upload_b37b6373-fc14-4f21-98a0-cf9bee156324已实际返回success/execution_success：体验版2026.10.03.1543，上传10050668字节，主包2095229字节；配置已按原备份恢复dist/，deploy元信息已更新。此前pending记录仅为历史。
- dev API新摘要sha256:d1d24099eccb3e843a6db9879ff8d75bb8889380cf7a71ca1057f59f0ef344fe、generation79，3/3全部新镜像Ready；main仍generation122与旧b4494f5d摘要。线上两域health200，国内筛选包含中国/北京非空，反查未登录401。当前登录会话只读访问真实dev搜索北京大学200，返回北京大学/北京市/颐和园路5号中文，WGS同一点。未写点位/上传照片/改DB。
- 原生空回调具体根因仍未明确，本包具备异常恢复与备用中文选点；图片dev上传域名已在微信后台补好，手机实际图片上传仍需体验者复验。完整发布记录docs/work/streetlifting-trial-update-2026-10-03.md。

## 新体验版发布授权与执行（2026-10-03）

- 用户明确要求本地所有修改提交推送，并立即上传新体验版。本轮授权覆盖当前全部未提交代码/测试/文档，以及体验版所需 dev API 同步。发布门禁 lint/typecheck/单 worker 全量测试已通过；生产小程序构建进行中。正式 main API 与小程序提审/正式发布不在本次范围。
- 功能包括默认中国、地图优先和实时附近定位、可编辑自动回填、原生异常备用选点、旧数据国家筛选、中文备用搜索与缓存隔离；uploadFile dev 域名已在微信后台保存。原生空回调根因尚未明确，手机实际照片上传需新体验版复验。

## 备用搜索中文回填已在本地验证（2026-10-03 15:29）

- 原英文直接来自后端固定lang=en，不是用户日本所在地/梯子。已取消强制英文、升级两端搜索缓存标识。最终mini2897模块构建通过，4项相关测试通过。官方工具用实际local3001接口完成北京大学搜索/中文名称地区地址回填，2PNG已查看；searchResponseMocked=false，原草稿同一坐标且手改字段保留，未提交点位。
- 原生异常入口受控模拟，仅为进入备用地图；chooseLocation/showModal mock均restore，原真实诊断恢复。本用户原自动英文草稿已通过同一点实际重新选取更新成中文，备份可恢复，当前留在中文表单。真正原生空返回根因仍未定。
- 本轮只本地，未上传新体验版、未部署外部dev API。详见docs/work/streetlifting-search-language-2026-10-03.md。

## 单杠上传域名已保存成功（2026-10-03）

- 用户管理员扫码后，实际后台截图确认 uploadFile 已含 coachlink.fit/dev.coachlink.fit/staging.coachlink.fit，月度次数50→49；缺少体验域名这一配置错误已修正。手机实际上传尚待复验，无新包发布。原生选择返回空文字/原香港坐标，不能归为用户操作问题；本地异常防护与相同坐标 POI 名称保留已改，构建验证中，真实地址根因尚未查明。详见 docs/work/streetlifting-upload-domain-2026-10-03.md。

## 单杠图片上传域名：根因确认，待微信管理员扫码（2026-10-03）

- 已核对启能教链 AppID wx316e39eb71c0e834，uploadFile 原缺 dev.coachlink.fit，request 已有；已补入表单，保存后出现微信管理员扫码，尚未生效。用户已获确认页面，选点文字回填独立继续调查。浏览器先前登录食探不等于操作 FoodLink 代码，本地始终 D:/files/coachlink/apps/wechat。详见 docs/work/streetlifting-upload-domain-2026-10-03.md。

# USER.md

- Name: 马健文
- Preferred address: 马健文
- Timezone: Asia/Shanghai

## Working preference

- Wants concrete coding execution, not generic explanations.
- Expects clear project ownership when asking "who is responsible for what".
- Across all projects, does not want the agent to run frontend/browser/DevTools/manual UI verification by default because it is slow and unreliable. Leave frontend verification to the user unless the user explicitly asks the agent to run it.
- Does not want full E2E run for every ordinary feature change or push. Run E2E only when explicitly requested or when the change directly affects an E2E-covered flow.
- For small, targeted fixes, do not automatically run broad lint/typecheck/build/test suites after the relevant code or data is corrected; only run them when the user explicitly asks or when a release gate truly requires them.
- To inspect a specific user's real frontend state, first obtain the user ID and use the Web quick-login input with that ID. Prefer this over switching mini-program login state; Web and mini-program share the underlying user/plan data, while UI-specific rendering should still be diagnosed in its owning client when necessary.
- CoachLink 微信小程序是例外：每次修改都必须只在本地构建并在微信开发者工具中实际展示、截图确认；未经用户另行授权，不提交、不推送、不上传 `dev`、体验版或正式版。