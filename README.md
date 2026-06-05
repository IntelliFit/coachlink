# CoachLink

力量训练教练智能化线上执教平台。

## 📖 快速入门

如果你是新加入项目的开发者，请先阅读：

👉 **[项目全景图 (Project Bible)](./docs/PROJECT_BIBLE.md)**

该文档包含了业务愿景、核心逻辑、技术栈以及开发者规范。

## 🛠 开发环境

1. 安装依赖：`npm install`
2. 启动开发服务器：`npm run dev`
3. 配置来源由根目录 `.env` 决定，必须在 `local` 和 `apollo` 中二选一。

### 运行配置

CoachLink Web 运行时配置采用严格单源模型：

- `CONFIG_SOURCE=local`：只读取 `LOCAL_ENV_FILE` 指定的本地业务配置文件，默认开发为 `.env.development`，生产构建/启动为 `.env.production`。
- `CONFIG_SOURCE=apollo`：只读取 `.env` 中的 Apollo bootstrap 信息，然后从 Apollo 拉取全部业务配置；不会再读取 `.env.development`、`.env.production` 或 `.env.local`。

根目录 `.env` 应只放配置源选择和 Apollo bootstrap 信息，不应放 Supabase、支付、短信、LLM 等业务密钥。详见 [Runtime Configuration](./docs/done/system-design/runtime-config.md)。

## 📂 目录结构

*   `src/app`: 路由与 API
*   `src/components`: UI 组件
*   `src/lib`: 核心业务逻辑
*   `supabase/`: 数据库与策略
*   `docs/`: 项目文档库


## 部署

> ⚠️ **重要**：项目配置了双平台同步推送（GitHub + Gitee）。如果你在本地克隆了项目，需要配置双 remote：

```bash
git remote set-url --add --push origin https://gitee.com/coachlink/coachlink.git
git remote set-url --add --push origin https://github.com/IntelliFit/coachlink
```

执行完成后可通过 `git remote -v` 确认配置正确（push URL 应有两个）。

目前项目配置了自动化部署，只需提交到main分支即可。

以下是手动构建并推送的步骤。构建前请确认 `.env` 的 `CONFIG_SOURCE` 指向正确环境；如果使用 Apollo，`NEXT_PUBLIC_*` 配置会在 `npm run build` 时固化进前端产物。

**1. 登录腾讯云 CCR（如果还未登录）：**

```bash
docker login ccr.ccs.tencentyun.com
```

**2. 构建镜像并推送：**


```bash
# 进入项目目录
cd coachlink

# 设置变量
export CCR_NAMESPACE="coachlink"
export CCR_IMAGE="ccr.ccs.tencentyun.com/${CCR_NAMESPACE}/coachlink"

# 构建镜像
docker build --platform linux/amd64 -t ${CCR_IMAGE}:production .

# 推送到腾讯云 CCR
docker push ${CCR_IMAGE}:production
```

