#!/bin/bash

echo "=== Modern Images Permission Fix Script ==="

# 获取当前用户和组ID
CURRENT_USER=$(id -u)
CURRENT_GROUP=$(id -g)

echo "Current User ID: $CURRENT_USER"
echo "Current Group ID: $CURRENT_GROUP"

# 停止现有容器
echo "Stopping existing containers..."
docker compose down 2>/dev/null || true

# 创建必要的目录
echo "Creating necessary directories..."
mkdir -p uploads/api

# 创建配置文件（如果不存在）
if [ ! -f config.json ]; then
    echo "Creating config.json from sample..."
    if [ -f config.sample.json ]; then
        cp config.sample.json config.json
        echo "✓ Config file created"
    else
        echo "⚠ Warning: config.sample.json not found"
    fi
fi

# 修复权限
echo "Fixing file permissions..."
chmod 755 uploads/
chmod 755 uploads/api/ 2>/dev/null || true
chmod 644 config.json 2>/dev/null || true

# 创建或更新.env文件以传递用户ID
echo "Creating .env file with user IDs..."
cat > .env << EOF
# User and Group IDs for Docker
UID=$CURRENT_USER
GID=$CURRENT_GROUP
EOF

echo "✓ Environment file created"

# 显示使用说明
echo ""
echo "=== Setup Complete ==="
echo "Now run the following commands:"
echo ""
echo "1. Build the image with correct user permissions:"
echo "   docker compose build --no-cache"
echo ""
echo "2. Start the application:"
echo "   docker compose up -d"
echo ""
echo "3. Check logs:"
echo "   docker compose logs -f"
echo ""
echo "The application will be available at: http://localhost:3000"
echo ""
echo "If you still encounter permission issues, you can also try:"
echo "   sudo chown -R $CURRENT_USER:$CURRENT_GROUP uploads config.json" 