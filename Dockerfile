# 多阶段构建：构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package.json package-lock.json ./

# 安装依赖（使用 legacy-peer-deps 与项目一致）
RUN npm ci --legacy-peer-deps

# 复制源码并构建
COPY . .
RUN npm run build

# 运行阶段
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
# 容器内 Next.js 默认监听 3000，宿主机映射端口在 docker run 时指定
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 从构建阶段复制产物
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# 使用 standalone 输出的 server.js
CMD ["node", "server.js"]
