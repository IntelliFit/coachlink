# 小程序 API 集成说明

## 概述

小程序已集成真实的后端 API 接口，与 PC 端共享同一套后端服务。

## API 服务层

### 1. BaseService (`src/utils/request.ts`)

基础服务类，封装了 Taro 的 HTTP 请求方法。

**特性：**
- 统一的请求/响应处理
- 自动添加请求头
- 错误处理和超时设置
- 支持 GET、POST、PUT、DELETE 方法

**配置：**
- API 基础 URL 通过 `defineConstants` 中的 `TARO_APP_API_URL` 配置
- 开发环境：`http://localhost:3000`（在 `config/dev.ts` 中配置）
- 生产环境：`https://coachlink.fit`（在 `config/prod.ts` 中配置）

### 2. 认证服务 (`src/services/authService.ts`)

处理用户认证相关的 API 调用。

**方法：**
- `loginWithPassword(reqData)` - 使用手机号/邮箱 + 密码登录
- `loginWithCode(reqData)` - 使用手机号/邮箱 + 验证码登录
- `logout()` - 退出登录
- `getCurrentUser()` - 获取当前用户信息

**端点：**
- POST `/api/auth/callback/credentials` - 登录接口（next-auth）

**使用示例：**
```typescript
import { authService } from '@/services/authService'

// 密码登录
await authService.loginWithPassword({
  phoneOrEmail: '13800138000',
  password: 'password123'
})

// 验证码登录
await authService.loginWithCode({
  phoneOrEmail: '13800138000',
  verifyCode: '123456'
})
```

### 3. 短信服务 (`src/services/smsService.ts`)

处理手机验证码相关的 API 调用。

**方法：**
- `sendVerificationCode(reqData)` - 发送手机验证码

**端点：**
- POST `/api/sms/send-verification-code`

**使用示例：**
```typescript
import { smsService } from '@/services/smsService'

await smsService.sendVerificationCode({
  phoneNumber: '13800138000'
})
```

### 4. 邮件服务 (`src/services/sesService.ts`)

处理邮箱验证码相关的 API 调用。

**方法：**
- `sendVerificationCode(reqData)` - 发送邮箱验证码

**端点：**
- POST `/api/ses/send-verification-code`

**使用示例：**
```typescript
import { sesService } from '@/services/sesService'

await sesService.sendVerificationCode({
  email: 'user@example.com'
})
```

## 环境配置

### 开发环境

在 `config/dev.ts` 中配置：

```typescript
export default {
  defineConstants: {
    TARO_APP_API_URL: JSON.stringify('http://localhost:3000')
  },
  // ...
}
```

### 生产环境

在 `config/prod.ts` 中配置：

```typescript
export default {
  defineConstants: {
    TARO_APP_API_URL: JSON.stringify('https://coachlink.fit')
  },
  // ...
}
```

**注意：** `defineConstants` 中定义的常量会在编译时注入到代码中。修改配置后需要重新编译项目。

## 路径别名配置

项目支持使用 `@/` 作为 `src/` 目录的别名。

**TypeScript 配置** (`tsconfig.json`)：
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

**Vite 配置** (`config/index.ts`)：
```typescript
import { resolve } from 'path'

const baseConfig = {
  alias: {
    '@': resolve(__dirname, '..', 'src')
  }
}
```

## 错误处理

所有 API 服务都会抛出错误，请在调用时使用 try-catch 处理：

```typescript
try {
  await authService.loginWithPassword({
    phoneOrEmail: phoneOrEmail,
    password: password
  })
  Toast.show('登录成功')
} catch (error: any) {
  console.error('登录失败:', error)
  Toast.show(error.message || '登录失败')
}
```

## 开发模式特性

在开发模式下：
1. **模拟验证码**：可以使用 `123456` 作为验证码（需要后端配置支持）
2. **快捷登录**：登录页面提供快捷登录按钮，可直接登录测试账号
3. **详细日志**：控制台会输出详细的请求和响应信息

## 待实现功能

以下功能的 API 集成还在开发中：

- [ ] 发现教练列表 API
- [ ] 教练详情 API
- [ ] 我的教练列表 API
- [ ] 用户资料 API
- [ ] 训练计划相关 API

这些功能目前使用模拟数据，将在后续迭代中集成真实 API。

## 注意事项

1. **CORS 配置**：确保后端 API 已正确配置 CORS，允许小程序域名访问
2. **Cookie 处理**：next-auth 使用 cookie 管理 session，小程序可能需要额外处理
3. **错误信息**：后端返回的错误信息会直接显示给用户，请确保错误信息友好
4. **网络超时**：默认超时时间为 30 秒，可在 `src/utils/request.ts` 中调整
5. **生产环境**：部署前务必修改 `config/prod.ts` 中的 API 地址

## 测试建议

1. 确保后端服务已启动（开发环境：`http://localhost:3000`）
2. 使用开发者工具的网络面板检查 API 请求和响应
3. 在真机上测试前，确保手机可以访问后端服务（可能需要使用局域网 IP）
4. 使用快捷登录功能快速测试登录流程

