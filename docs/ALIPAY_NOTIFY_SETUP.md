# 支付宝 notify 回调配置说明

## 问题说明

支付宝的 `notify_url`（异步通知地址）必须是**公网可访问的 HTTPS 地址**。本地开发时，如果使用 `http://localhost:3000`，支付宝服务器无法访问，会导致：

1. **notify 请求无法到达你的本地服务**
2. 支付宝可能使用**后台配置的默认 notify_url**（通常是线上地址）
3. 本地测试时看不到 notify 日志，无法调试

## 解决方案

### 方案 1：使用环境变量指向线上地址（推荐用于本地开发）

在 `.env.local` 或 `.env` 中添加：

```bash
# 支付宝回调地址（本地开发时指向线上，生产环境可留空使用自动推断）
ALIPAY_NOTIFY_URL=https://你的线上域名/api/payment/alipay/notify
ALIPAY_RETURN_URL=https://你的线上域名/api/payment/alipay/return
```

**优点**：
- 简单，无需额外工具
- 本地创建订单时，支付宝会调用线上的 notify 接口
- 线上服务收到 notify 后，会更新数据库，本地刷新页面就能看到结果

**缺点**：
- 本地看不到 notify 请求的详细日志（日志在线上服务器）
- 需要确保线上服务正常运行

### 方案 2：使用内网穿透工具（推荐用于完整调试）

使用 **ngrok** 或类似工具，将本地服务暴露到公网：

```bash
# 安装 ngrok
npm install -g ngrok

# 启动本地服务（假设在 3000 端口）
npm run dev

# 在另一个终端启动 ngrok
ngrok http 3000
```

ngrok 会给你一个公网地址，例如：`https://abc123.ngrok.io`

然后在 `.env.local` 中设置：

```bash
# 使用 ngrok 地址
ALIPAY_NOTIFY_URL=https://abc123.ngrok.io/api/payment/alipay/notify
ALIPAY_RETURN_URL=https://abc123.ngrok.io/api/payment/alipay/return
```

**注意**：如果使用 ngrok，代码会自动从请求头 `x-forwarded-host` 推断地址，所以也可以不设置环境变量。但设置环境变量更明确。

**优点**：
- 本地可以看到完整的 notify 请求和日志
- 可以完整调试整个支付流程

**缺点**：
- 需要额外工具
- ngrok 免费版地址会变化，每次重启需要更新

### 方案 3：生产环境（自动推断）

生产环境**不需要设置环境变量**，代码会自动从请求头推断：

- 使用 `x-forwarded-proto` 和 `x-forwarded-host`（如果存在，说明有反向代理）
- 否则使用 `host` 头
- 自动判断 http/https

## 如何验证 notify 是否正常工作

### 1. 检查日志

创建订单后，查看控制台输出：

```
[Alipay Create] 使用环境变量回调地址: notify=https://..., return=https://...
```

或

```
[Alipay Create] 从请求头推断回调地址: notify=https://..., return=https://...
```

### 2. 查看 notify 接口日志

如果 notify 被调用，你会看到：

```
[Alipay Notify] 2026-01-30T... - 收到支付宝异步通知请求
[Alipay Notify] 订单号: xxx, 支付宝交易号: xxx, 状态: TRADE_SUCCESS, 金额: 0.01
[Alipay Notify] 订单 xxx 处理成功，返回 success
```

### 3. 检查支付宝后台配置

登录 [支付宝开放平台](https://open.alipay.com/)：
1. 进入你的应用
2. 查看「开发信息」→「接口加签方式」
3. 确认「服务器异步通知页面（notify_url）」是否配置了默认地址

**重要**：如果配置了默认地址，即使你在请求中传了不同的 `notifyUrl`，支付宝也可能优先使用后台配置的地址。建议：
- 后台配置的地址设为你的生产环境地址
- 本地开发时使用环境变量覆盖

## 常见问题

### Q: 本地测试时，notify 一直没有收到请求？

**A**: 检查以下几点：
1. 是否设置了 `ALIPAY_NOTIFY_URL` 环境变量？
2. 环境变量中的地址是否可公网访问？
3. 查看创建订单时的日志，确认传给支付宝的 `notifyUrl` 是什么
4. 检查支付宝后台是否配置了默认 notify_url，可能覆盖了你的参数

### Q: 本地开发时，notify 请求到了线上服务器，但我想在本地调试怎么办？

**A**: 使用方案 2（ngrok），这样 notify 会直接到你的本地服务。

### Q: 生产环境需要设置环境变量吗？

**A**: 不需要。生产环境代码会自动从请求头推断地址。但如果你的部署环境有特殊需求，也可以设置环境变量强制指定。

## 技术细节

- **notify** 是支付宝服务器主动 POST 到你的接口，**不依赖用户是否关闭页面**
- **return** 是用户付款后浏览器跳转，依赖用户不关闭页面
- **query** 是前端轮询，依赖用户不关闭页面

因此，**notify 是确保"付了款就一定更新"的唯一可靠路径**。确保 notify 正常工作至关重要。
