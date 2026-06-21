---
title: APP 开发测试账号（本地环境）
date: 2026-06-21
owner: coachlink-mobile
---

# APP 开发测试账号（本地环境）

该列表来源于 Web 配置与 APP 内统一测试用户配置：

- `.env.development` 中的 `NEXT_PUBLIC_DEV_USERS`
- `src/config/devUsers.ts` 中的 `DEV_USERS`

以下为当前生效账号（开发/本地联调使用）：

| 名称 | 手机号/邮箱 | 密码 | 说明 |
|---|---:|---:|---|
| 教练测试号(MAX) | `13915850622` | `123456` | 学员/教练两端都可用于联调 |
| 教练(枭马葛） | `18115072586` | `123456` | 同上 |
| 学员(沈妈妈) | `13921064643` | `123456` | 学员身份联调 |
| 管理员(小马哥) | `13915850621` | `123456` | 管理视图与高权限链路联调 |

> 说明：这些账号仅用于本地开发验证，不应进入生产环境正式体验流程，也不应外发公开仓库。

## 与文档一致性校验

- `src/config/devUsers.ts` 会先读取 `.env.development` 的 `NEXT_PUBLIC_DEV_USERS`（或 `NEXT_PUBLIC_DEV_ACCOUNTS`）并进行去重；若未配置环境变量则自动回退到内置备用账号。
- `src/config/devUsers.ts` 与 `.env.development` 的记录应保持一致。
- 若新增测试账号，请同时：
  1. 更新两处配置；
  2. 在本文件补齐变更记录（版本时间 + 变更说明）；
  3. 确认 APP 登录页「开发状态按钮」仍可正常登录该账号（`AuthProvider` 登录链路）。

## 推荐登录验证步骤

1. 在本地启动 API 与 APP。
2. 打开 APP 登录页，选择「密码登录」。
3. 分别使用上表账号逐一验证：
   - 个人主页可访问；
   - 训练计划加载；
   - 会员、订阅、教练发现/购买链路；
   - 消息与好友相关入口；
   - 会员/训练历史是否按用户角色返回正确数据。
4. 发现异常时，先检查：
   - `.env.development` 的 `CONFIG_SOURCE` 与 bootstrap 配置；
   - 本地 token 与 `getStoredToken()` 存储；
   - 相关接口是否支持 APP Bearer Token（如 `api/coach/*`、`api/student/*` 等）。
