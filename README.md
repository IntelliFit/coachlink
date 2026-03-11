# CoachLink

力量训练教练智能化线上执教平台。

## 📖 快速入门

如果你是新加入项目的开发者，请先阅读：

👉 **[项目全景图 (Project Bible)](./docs/PROJECT_BIBLE.md)**

该文档包含了业务愿景、核心逻辑、技术栈以及开发者规范。

## 🛠 开发环境

1. 安装依赖：`npm install`
2. 启动开发服务器：`npm run dev`
3. 环境变量：复制 `.env.example` 为 `.env.local` 并填写 Supabase 配置。

## 📂 目录结构

*   `src/app`: 路由与 API
*   `src/components`: UI 组件
*   `src/lib`: 核心业务逻辑
*   `supabase/`: 数据库与策略
*   `docs/`: 项目文档库


## 部署

目前项目配置了自动化部署，只需提交到main分支即可。在特殊情况下可以手动构建镜像：

以下是手动构建并推送的步骤：

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

