# 小程序模拟器调试说明

## 前置：依赖已安装

`pnpm install` 已完成，`cross-env` 已就绪。

## 1. 启动 coachlink 后端

在**第一个终端**中：

```bash
cd d:\files\coachlink
pnpm dev
```

等待看到类似 `Ready on http://localhost:3000` 的输出，表示后端已监听 3000 端口。

## 2. 启动小程序模拟器调试

在**第二个终端**中：

```bash
cd d:\files\coachlink-wechat-app
pnpm dev:weapp
```

此命令会：

- 输出到 `dist`，这是微信开发者工具固定读取的本地调试目录
- 使用 `USE_LOCALHOST=1`，API 地址为 `http://127.0.0.1:3000`
- 在每次构建后自动执行 weapp 修复脚本

如果你要做真机联调，而不是 DevTools 模拟器调试，用：

```bash
pnpm dev:weapp:lan
```

这会把 API 地址切到你电脑的局域网 IP。

## 3. 在微信开发者工具中

1. 导入项目：选择 `d:\files\coachlink-wechat-app` 项目根目录
2. DevTools 会根据 [project.config.json](D:\files\coachlink-wechat-app\project.config.json) 自动读取 `dist`
2. 确保「详情 → 本地设置」已勾选「不校验合法域名」
3. 进行微信登录等操作

## 4. 发布构建与本地调试目录分离

- `dist`：只给本地 DevTools 调试使用
- `dist-release`：给发布/上传前构建使用

发布前请执行：

```bash
pnpm build:weapp:release
```

这样就不会再出现“本地 DevTools 误读上一次生产包，结果没开本地后端也还能访问线上接口”的情况。

## 5. 编译稳定性必读

遇到小程序白屏、`ENOENT ... wxss`、脚本反复刷日志时，先看：

- `docs/小程序编译问题解决总结.md`
