# 多阶段构建：构建阶段
FROM node:22-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package.json package-lock.json ./

# 设置 npm 源：先尝试官方源，失败则自动切换到镜像源
# 通过 npm config set 的 fallback 机制实现
RUN npm config set registry https://registry.npmjs.org/ && \
    # 测试官方源是否可用（使用简短超时），如果不可用则切换到镜像源
    (timeout 5 npm ping > /dev/null 2>&1 || npm config set registry https://registry.npmmirror.com/)

# 安装编译依赖（isolated-vm 等原生模块需要 python3 和 build-base）
RUN apk add --no-cache python3 build-base

# 安装依赖（使用 legacy-peer-deps 与项目一致）
RUN npm ci --legacy-peer-deps

# 复制源码并构建
COPY . .
# 前端构建所需的环境变量（从 GitHub Secrets 作为 build-arg 传入）
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
# 清理旧的构建产物，确保每次构建都是全新的
RUN rm -rf .next
RUN npm run build

# 运行阶段
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
# 容器内 Next.js 默认监听 3000，宿主机映射端口在 docker run 时指定
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 从构建阶段复制产物
# standalone 目录已经包含了 .next/static 和 public（由 build-prod.js 处理）

# 【关键点 1】从 builder 复制 standalone 目录内容
COPY --from=builder /app/.next/standalone ./

# 【关键点 2】必须手动复制 static 和 public 目录到对应的位置
# Next.js standalone 运行时会在 .next/static 寻找静态资源
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER nextjs

EXPOSE 3000

# 环境变量通过 docker run --env-file 或 docker compose env_file 传入
CMD ["node", "server.js"]
