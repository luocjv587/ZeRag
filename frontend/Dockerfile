# ── 阶段一：构建 React 应用 ─────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# 先复制依赖文件，利用 Docker 层缓存
COPY package*.json ./
RUN npm ci --prefer-offline

# 复制源码并构建
COPY . .

# VITE_API_BASE_URL 留空 = 使用相对路径，由 nginx 反代 /api/
# 若需直连后端（如独立部署），可在 docker-compose build args 中传入
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ── 阶段二：nginx 静态服务 ──────────────────────────────────────
FROM nginx:1.27-alpine

# 替换默认 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 从构建阶段复制产物
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
