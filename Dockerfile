# 单阶段构建，确保Sharp在正确的环境中编译
FROM node:18-alpine

# 构建参数
ARG UID=1000
ARG GID=1000

# 创建用户组和用户，处理已存在的情况
RUN set -ex; \
    # 尝试创建组，如果失败则使用现有组或创建新的
    if ! addgroup -g ${GID} -S nodejs 2>/dev/null; then \
        # 如果指定的GID已被使用，创建nodejs组（让系统分配GID）
        if ! getent group nodejs >/dev/null 2>&1; then \
            addgroup -S nodejs; \
        fi; \
    fi; \
    # 尝试创建用户，如果失败则使用现有用户或创建新的
    if ! adduser -S nodejs -u ${UID} -G nodejs 2>/dev/null; then \
        # 如果指定的UID已被使用，创建nodejs用户（让系统分配UID）
        if ! getent passwd nodejs >/dev/null 2>&1; then \
            adduser -S nodejs -G nodejs; \
        fi; \
    fi

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