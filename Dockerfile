# 单阶段构建，确保Sharp在正确的环境中编译
FROM node:18-alpine

# 构建参数
ARG UID=1000
ARG GID=1000

# 创建用户组和用户，使用传入的UID/GID
RUN addgroup -g ${GID} -S nodejs && \
    adduser -S nodejs -u ${UID} -G nodejs

# 安装运行时依赖和构建工具
RUN apk add --no-cache vips vips-dev su-exec dumb-init python3 make g++ && \
    rm -rf /var/cache/apk/*

WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装所有依赖（在正确的环境中）
RUN npm ci --only=production && npm cache clean --force

# 复制源代码
COPY . .

# 只清理构建工具，保留vips和vips-dev以支持Sharp运行
RUN apk del python3 make g++

# 创建必要目录并设置权限
RUN mkdir -p uploads/api && \
    chown -R nodejs:nodejs /app

# 复制启动脚本并设置权限
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    chown nodejs:nodejs /usr/local/bin/docker-entrypoint.sh

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# 使用自定义entrypoint
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"] 