# Web Push 系统通知

Service Worker + Web Push，支持 **Android 常见浏览器** 与 **iOS Safari 16.4+**（含 PWA 加主屏）。

## 1. 环境变量

在 `.env.development` / `.env.production` 中配置 VAPID 密钥：

```bash
# Web Push 用（必填才可订阅 + 服务端发推送）
NEXT_PUBLIC_VAPID_PUBLIC_KEY=   # 公钥，前端订阅用
VAPID_PRIVATE_KEY=              # 私钥，仅服务端发推送用，勿泄露
```

### 生成 VAPID 密钥

```bash
npx web-push generate-vapid-keys
```

或使用 JSON 格式：

```bash
npx web-push generate-vapid-keys --json
```

将输出的 `publicKey` 填到 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`，`privateKey` 填到 `VAPID_PRIVATE_KEY`。

**⚠️ 重要：**
- 开发和生产环境可以使用**不同的** VAPID 密钥对
- 或者使用**同一对**密钥（推荐，便于测试）
- `VAPID_PRIVATE_KEY` 是敏感信息，**不要提交到 Git**
- 生产环境部署时，确保在服务器环境变量中配置了这两个值

## 2. 相关文件

| 文件 | 说明 |
|------|------|
| `public/sw.js` | Service Worker：`push`、`notificationclick`，解析 JSON 展示通知 |
| `src/lib/swRegistration.ts` | 注册 SW、请求权限、Push 订阅、上报 `/api/push/subscribe` |
| `src/lib/pushNotify.ts` | 服务端发推送：`sendPushToUser(userId, { title, body, url?, tag? })` |
| `src/app/api/push/subscribe/route.ts` | 接收订阅并写入 `push_subscriptions` |
| `supabase/migrations/20260122_push_subscriptions.sql` | 推送订阅表 |

## 3. 使用方式

- **前端**：在 `ClientLayout` 中已注册 SW；消息页有「开启通知」入口（需用户点击，iOS 要求手势触发权限）。
- **发推送**：在任意 API 或后端逻辑中调用 `sendPushToUser(userId, { title, body, url?, tag? })`。例如聊天发送成功后，对收件人触发推送（见 `send-message` 路由）。

## 4. 测试推送

使用测试脚本向指定用户发送测试推送：

```bash
tsx scripts/test-push.ts <userId> "标题" "内容"
```

示例：
```bash
tsx scripts/test-push.ts user-123 "测试通知" "这是一条测试推送消息"
```

## 5. iOS 注意

- 需 **iOS 16.4+**，且多数场景要求 **加主屏**（PWA）后才可订阅。
- 权限请求必须在 **用户手势**（如点击按钮）中触发，不能在页面加载时自动弹。
