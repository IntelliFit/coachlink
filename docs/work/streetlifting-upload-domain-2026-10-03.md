# 体验版图片上传域名错误（2026-10-03）

## 最新实际后台核验：已查明漏配，管理员扫码后已保存成功

实际切到启能教链，页面 AppID 核对为 `wx316e39eb71c0e834`。request 合法域名含 coachlink.fit/dev.coachlink.fit/staging.coachlink.fit，而 uploadFile 原来只有 coachlink.fit/staging.coachlink.fit，缺少体验包实际上传目标 dev.coachlink.fit，吻合手机报错。此前浏览器自动登录智健食探，只是后台账号会话；本地开发者工具和源码始终为 D:/files/coachlink/apps/wechat，未操作 FoodLink 项目代码。

已在配置表单保留原有域名，仅给 uploadFile 添加 `https://dev.coachlink.fit`，点击保存并提交后，截图实际显示“配置服务器域名 / 请使用微信扫码”弹窗。用户随后明确“我已经扫码了”，再读实际截图：弹窗消失，uploadFile 正式配置含 coachlink.fit/dev.coachlink.fit/staging.coachlink.fit，月度可修改次数50→49，确认后台保存成功。证据 `artifacts/streetlifting-ux/2026-10-03/upload-domain-saved.png`。管理员确认页证据为 `upload-domain-admin-confirm.png`。未宣称手机真实上传已通过，没有改密码、上传图片、提交点位或发布新包。以下未能读取后台的叙述为早先阶段记录，已被此实际核验覆盖。

用户提供粉丝手机体验版截图：分享单杠页选图时显示 `uploadFile:fail url not in domain list`，图片尚未添加。此截图证明微信上传域名校验失败，不能归为地图地址回填或用户文字不完整。

已核对源码及保留的 dist-release 产物：`uploadLocationImage` 使用 `${API_BASE_URL}/api/streetlifting-index/upload-location-image`，先传自有 API，再由服务器存 COS。体验 trial 选择 `https://dev.coachlink.fit`，正式 release 选择 `https://coachlink.fit`，保留产物 override 为空。因此应核对微信公众平台此 AppID 的 **uploadFile 合法域名** 是否包含 `https://dev.coachlink.fit`；同时核对正式使用的 `https://coachlink.fit`。request 合法域名和 COS 图片展示地址不等于 uploadFile 合法域名，不能用补 COS 直传域名代替实际 API 域名。

两地址上传接口只读 HEAD 探测均 401，无 Location 重定向；仅证明域名/服务器可达及鉴权拦截，没有测试真实上传或写 COS。当前项目 project.config.json 和私有配置均 urlCheck=false，开发工具默认不校验域名，先前本地功能验证不覆盖手机白名单。

初次浏览器清单为空，随后只读打开公众平台，沿用现有会话进入小程序后台；实际 DOM 显示当前账号为“智健食探”，不是 CoachLink，不用该账号域名列表归因本项目。读取账号切换入口时浏览器调用超时，CoachLink 实际列表尚未读取；官方 WeChat 工具清单不含服务器合法域名读写接口。未修改后台配置，不宣称后台已补齐/手机已修好。下一步为管理员在 CoachLink 公众平台开发管理的开发设置中核对并补齐 uploadFile 两个 API 域名，再由体验手机验证图片上传。此后台配置核对通常无需改地图逻辑；本次没有构建新上传代码、发布小程序、输入登录凭据或上传任何图片。
