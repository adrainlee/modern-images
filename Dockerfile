FROM node:18-alpine

# 安装sharp依赖的系统库和su-exec
RUN apk add --no-cache python3 make g++ vips-dev su-exec shadow

# 创建应用目录
WORKDIR /app

# 复制package.json和package-lock.json（如果存在）
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制应用代码
COPY . .

# 创建上传目录
RUN mkdir -p uploads && \
    chown -R node:node /app

# 暴露端口
EXPOSE 3000

# 设置健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O - http://localhost:3000/ || exit 1

# 创建启动脚本
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 启动应用
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"] 