## 手机登录网络故障已更正上传（2026-10-03）

- 用户手机截图同时有网络域名拦截提示及仅development显示的开发引导按钮；本地dist注入localhost:3001/有按钮，生产dist-release线上域名/无按钮。上一轮1543通过已打开的开发项目临时切root上传，实际产物与所检生产目录不一致。结合旧上传主包2095229/auth399526及独立生产上传主包1955537/auth398964，定位为上传流程拿到开发编译产物；此前“已检查包”等结论不能覆盖实际上传包。
- 新体验2026.10.03.1609已从独立D:/files/coachlink/apps/wechat/dist-release上传，官方upload result.success=true，无pending，9910125字节/主包1955537。根路径及srcRoot=./、urlCheck=true；当前原开发项目仍dist/，没有切其root。
- 独立生产项目真实打开登录页，PNG已查看，无开发按钮。实际common.API_BASE_URL=https://coachlink.fit，开启域名校验后通过应用request访问真实登录接口，空code返回后端“缺少code参数”，dev健康200；生产编译resolver四种env通过（trial→dev、release/develop安全回退→正式）。未执行真实手机手机号登录，未接受用户协议/改登录态或写账号/DB；手机完整登录需体验者复验。
- 业务源码沿用3ce72794，未改登录/地图源码或后端，不重建/部署不相关API。重新lint/typecheck通过，73文件457测试通过。元信息已更新为1609，发布包SHA256 0b437f819693c9f43f24cd19285b01a0a429119dbed45dbdec4d2b08b7ad7103；文档docs/work/wechat-trial-login-incident-2026-10-03.md，证据login-incident-*。

## 体验版手机登录故障正在修复（2026-10-03）

- 用户新截图登录报“当前版本网络配置异常”，显示仅NODE_ENV=development存在的dev-onboarding-btn。源码该错误只对应微信域名白名单拒绝；本地dist含localhost:3001并有该开发按钮，生产dist-release无local API及该按钮。因此当前手机运行的是开发产物；原体验入口/预览入口及1543实际上传目录仍核对中，不归因用户。
- 此前1543仅证明upload返回成功及磁盘生产包检查，不足以证明实际上传与所检包完全一致；上传曾临时改已打开开发项目root，存在编译缓存继续打包dist的可能。
- 当前已独立打开D:/files/coachlink/apps/wechat/dist-release，AppID核验wx316e39eb71c0e834，src/miniprogramRoot=./、urlCheck=true。实际运行common.API_BASE_URL=https://coachlink.fit，登录页PNG已查看、无开发按钮；真实应用request空code返回服务器“缺少code参数”，dev健康200，未写账号/DB/登录态。实际生产resolver四种env检查通过（trial→dev）。重新上传独立发布项目进行中，未修改业务源码/服务端，也不重复部署。

证据：artifacts/streetlifting-ux/2026-10-03/login-incident-*。
