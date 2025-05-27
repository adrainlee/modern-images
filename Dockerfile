# 单阶段构建，确保Sharp在正确的环境中编译
FROM node:18-alpine

# 创建非特权用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

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

# 创建必要目录
RUN mkdir -p uploads/api && \
    chown -R nodejs:nodejs /app

# 复制启动脚本
COPY --chown=nodejs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 设置非root用户
USER nodejs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# 使用dumb-init作为PID 1
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["/usr/local/bin/docker-entrypoint.sh", "node", "server.js"] 