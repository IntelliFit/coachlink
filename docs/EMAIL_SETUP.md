# 📧 邮件验证码服务配置指南

当前的邮箱验证码功能在开发环境中工作正常，但要在生产环境中发送真实邮件，需要配置邮件发送服务。

## 🎯 当前状态

- ✅ **开发环境**：验证码显示在控制台和前端界面中
- ❌ **生产环境**：需要配置邮件服务才能发送真实邮件

## 🚀 推荐方案：使用 Resend 服务

### 步骤 1：注册 Resend 账号

1. 访问 [https://resend.com](https://resend.com)
2. 注册账号（提供免费额度：100邮件/天，3000邮件/月）
3. 验证邮箱地址

### 步骤 2：获取 API 密钥

1. 登录 Resend 控制台
2. 进入 "API Keys" 页面
3. 点击 "Create API Key"
4. 复制生成的 API 密钥（以 `re_` 开头）

### 步骤 3：配置域名（可选，推荐）

1. 在 Resend 控制台添加你的域名
2. 配置 DNS 记录验证域名所有权
3. 验证完成后，修改代码中的发件地址

### 步骤 4：配置 Supabase 环境变量

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 进入 "Settings" → "Edge Functions"
4. 添加环境变量：
   - `RESEND_API_KEY`: 你的 Resend API 密钥
   - `ENVIRONMENT`: `production`（启用真实邮件发送）

### 步骤 5：修改发件地址

在 `supabase/functions/send-email-code/index.ts` 文件第 12 行：

```typescript
from: 'noreply@your-domain.com', // 替换为你的真实域名
```

改为：

```typescript
from: 'noreply@yourdomain.com', // 使用你验证的域名
```

## 🔄 其他邮件服务选项

### 选项 2：SendGrid
- 免费额度：100邮件/天
- 配置方式类似，需要获取 SendGrid API 密钥

### 选项 3：SMTP 服务
- 可以使用 Gmail、QQ邮箱等 SMTP 服务
- 需要修改代码使用 SMTP 发送

### 选项 4：Supabase Auth（推荐长期方案）
- 直接使用 Supabase 的认证服务
- 内置邮件模板和发送功能
- 需要重构认证逻辑

## 🧪 测试邮件发送

配置完成后：

1. 重新部署 Supabase Functions
2. 将 `ENVIRONMENT` 设置为 `production`
3. 在前端测试邮箱验证码功能
4. 检查邮件是否正常发送和接收

## 📝 部署 Supabase Functions

```bash
# 安装 Supabase CLI
npm install -g supabase

# 登录
supabase login

# 链接项目
supabase link --project-ref your-project-id

# 部署函数
supabase functions deploy send-email-code
supabase functions deploy auth-with-code

# 设置环境变量
supabase secrets set RESEND_API_KEY=your_resend_api_key
supabase secrets set ENVIRONMENT=production
```

## 📧 邮件模板预览

配置完成后，用户将收到格式化的 HTML 邮件，包含：
- 品牌化的邮件头部
- 清晰的验证码显示
- 过期时间提醒
- 安全提示

## 🔧 故障排除

### 问题 1：邮件未发送
- 检查 Resend API 密钥是否正确
- 验证环境变量是否设置成功
- 查看 Supabase Functions 日志

### 问题 2：邮件进入垃圾箱
- 配置 SPF、DKIM、DMARC 记录
- 使用已验证的域名发送
- 避免使用触发垃圾邮件的词汇

### 问题 3：发送失败
- 检查收件人邮箱是否有效
- 验证是否超出发送额度
- 查看 Resend 控制台的发送日志

## 💡 最佳实践

1. **开发环境**：保持当前配置，验证码显示在界面中
2. **生产环境**：配置真实邮件服务
3. **监控**：定期检查邮件发送状态和额度使用情况
4. **备用方案**：考虑配置多个邮件服务提供商作为备用 