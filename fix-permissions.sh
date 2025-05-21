#!/bin/bash

# 停止正在运行的容器
echo "停止现有容器..."
docker compose down

# 创建必要的目录
echo "创建必要的目录结构..."
mkdir -p uploads/api

# 检查当前用户和组
CURRENT_USER=$(id -u)
CURRENT_GROUP=$(id -g)
echo "当前用户ID: $CURRENT_USER, 组ID: $CURRENT_GROUP"

echo "注意: 不尝试修改权限，而是修改Docker配置以适应当前权限"

# 如果config.json不存在，创建一个默认的
if [ ! -f config.json ]; then
  echo "创建默认config.json..."
  cat > config.json << EOF
{
  "auth": {
    "isConfigured": false,
    "username": "",
    "hashedPassword": "",
    "salt": ""
  },
  "api": {
    "enabled": true,
    "tokens": [],
    "defaultFormat": "original"
  }
}
EOF
fi

# 创建或修改docker-compose.yml，添加用户ID映射
echo "更新docker-compose.yml文件..."
cat > docker-compose.yml << EOF
version: '3'

services:
  modern-images:
    build: .
    container_name: modern-images
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - UID=$CURRENT_USER
      - GID=$CURRENT_GROUP
    volumes:
      - ./uploads:/app/uploads
      - ./config.json:/app/config.json
    healthcheck:
      test: ["CMD", "wget", "-q", "-O", "-", "http://localhost:3000/"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
EOF

echo "修改docker-entrypoint.sh脚本..."
cat > docker-entrypoint.sh << EOF
#!/bin/sh
set -e

# 创建必要的目录
mkdir -p /app/uploads/api

# 如果提供了UID/GID环境变量，则使用它们
if [ -n "\$UID" ] && [ -n "\$GID" ]; then
  echo "使用提供的UID(\$UID)/GID(\$GID)运行应用"
  # 修改node用户的UID/GID以匹配宿主机
  sed -i -e "s/^node:x:[0-9]*:[0-9]*:/node:x:\$UID:\$GID:/" /etc/passwd
  sed -i -e "s/^node:x:[0-9]*:/node:x:\$GID:/" /etc/group
  # 修改目录所有权
  chown -R node:node /app/uploads || true
fi

# 以node用户身份执行命令
exec su-exec node "\$@"
EOF

# 确保脚本可执行
chmod +x docker-entrypoint.sh

echo "配置更新完成！"
echo "现在请重新构建并启动容器："
echo "docker compose build"
echo "docker compose up -d" 