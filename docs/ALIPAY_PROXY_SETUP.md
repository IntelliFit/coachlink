# 支付宝 SDK 代理配置说明

## 概述

由于支付宝 SDK 有白名单限制，在本地开发时可能需要通过代理服务器来访问支付宝 API。本项目已经集成了代理支持，可以通过环境变量统一配置。

## 配置方法

### 1. 在环境变量文件中添加代理配置

在 `.env.development`（开发环境）或 `.env.production`（生产环境）文件中添加以下配置：

```env
# 支付宝代理配置（用于本地开发时绕过白名单限制）
# 格式: http://username:password@host:port
# 例如: http://gos:upWGK87f7CJ1J!Gdb@代理服务器地址:8080
ALIPAY_PROXY=http://gos:upWGK87f7CJ1J!Gdb@代理服务器地址:8080
```

### 2. 代理 URL 格式说明

代理 URL 的标准格式为：
```
http://[用户名]:[密码]@[代理服务器地址]:[端口]
```

**重要提示：**
- 如果密码中包含特殊字符（如 `!`、`@`、`#`、`%` 等），需要进行 URL 编码
- 常见特殊字符的编码：
  - `!` → `%21`
  - `@` → `%40`
  - `#` → `%23`
  - `%` → `%25`
  - `&` → `%26`
  - `=` → `%3D`

**示例：**
- 原始密码：`upWGK87f7CJ1J!Gdb`
- URL 编码后：`upWGK87f7CJ1J%21Gdb`
- 完整代理 URL：`http://gos:upWGK87f7CJ1J%21Gdb@代理服务器地址:8080`

### 3. 禁用代理

如果不需要使用代理，可以：
- 注释掉 `ALIPAY_PROXY` 配置行（在前面加 `#`）
- 或者删除 `ALIPAY_PROXY` 配置行
- 或者设置为空：`ALIPAY_PROXY=`

## 工作原理

1. **启动时设置**：在 `scripts/start-dev.mjs` 中，如果检测到 `ALIPAY_PROXY` 环境变量，会自动设置全局的 `HTTPS_PROXY` 和 `HTTP_PROXY` 环境变量。

2. **统一初始化**：所有使用支付宝 SDK 的地方都通过 `src/lib/alipaySdk.ts` 中的 `createAlipaySdk()` 函数统一初始化。

3. **自动代理**：Node.js 的 `https` 和 `http` 模块会自动读取 `HTTPS_PROXY` 和 `HTTP_PROXY` 环境变量，所有通过支付宝 SDK 发出的请求都会自动使用代理。

## 已更新的文件

以下文件已经更新为使用统一的初始化工具：
- `src/app/api/payment/alipay/create/route.ts` - 创建支付订单
- `src/app/api/payment/alipay/query/route.ts` - 查询支付状态
- `src/app/api/payment/alipay/notify/route.ts` - 支付回调通知
- `src/app/api/membership/create-order/route.ts` - 创建会员订单

## 验证配置

配置完成后，启动开发服务器时会看到以下日志：
```
🌐 支付宝代理已启用: http://gos:****@代理服务器地址:8080
```

在使用支付宝 SDK 时，也会看到：
```
[Alipay SDK] 使用代理: http://gos:****@代理服务器地址:8080
```

## 故障排查

如果代理不工作，请检查：

1. **代理 URL 格式是否正确**：确保包含 `http://` 前缀
2. **密码中的特殊字符是否已编码**：使用 URL 编码工具进行编码
3. **代理服务器是否可访问**：确保代理服务器地址和端口正确
4. **环境变量是否生效**：重启开发服务器以确保环境变量被正确加载

## 注意事项

- 代理配置仅在服务端生效，不会影响浏览器端的请求
- 如果全局已经设置了 `HTTPS_PROXY` 或 `HTTP_PROXY`，支付宝代理不会覆盖它们
- 生产环境建议使用更安全的代理配置方式（如通过服务器配置而非环境变量）
