# 微信小程序项目配置说明

## AppID 配置（解决「更改 AppID 失败 touristappid」）

`touristappid` 是游客模式占位符，无法用于真实登录、支付等能力。需替换为你的小程序 AppID：

1. 登录 [微信公众平台](https://mp.weixin.qq.com/) → 开发 → 开发管理 → 开发设置，复制 **AppID**
2. 编辑 `project.config.json`，将 `"appid": "touristappid"` 改为 `"appid": "你的AppID"`（如 `wx316e39eb71c0e834`）
3. **完全关闭**微信开发者工具后重新打开项目

> 不要在开发者工具「详情」里改 AppID，必须在 `project.config.json` 中修改才生效。

## 开发调试设置

- **不校验合法域名**：真机调试或访问本地/局域网 API 时，在开发者工具右上角「详情」→「本地设置」中勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」
