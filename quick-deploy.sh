#!/bin/bash

echo "🚀 Modern Images Quick Deploy Script"
echo "===================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 函数：打印彩色消息
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# 获取当前用户信息
CURRENT_USER=$(id -u)
CURRENT_GROUP=$(id -g)
print_status "Detected User ID: $CURRENT_USER, Group ID: $CURRENT_GROUP"

# 停止现有容器
print_status "Stopping existing containers..."
docker compose down 2>/dev/null || true

# 创建必要目录
print_status "Creating directories..."
mkdir -p uploads/api

# 创建配置文件
if [ ! -f config.json ]; then
    print_status "Creating config.json from sample..."
    if [ -f config.sample.json ]; then
        cp config.sample.json config.json
        print_success "Config file created"
    else
        print_warning "config.sample.json not found, creating minimal config..."
        cat > config.json << EOF
{
  "port": 3000,
  "upload": {
    "path": "./uploads",
    "maxSize": "10MB",
    "allowedTypes": ["image/jpeg", "image/png", "image/gif", "image/webp"]
  },
  "server": {
    "host": "0.0.0.0"
  }
}
EOF
        print_success "Minimal config created"
    fi
fi

# 设置权限
print_status "Setting up permissions..."
chmod 755 uploads/ 2>/dev/null || true
chmod 755 uploads/api/ 2>/dev/null || true
chmod 644 config.json 2>/dev/null || true

# 创建.env文件
print_status "Creating environment configuration..."
cat > .env << EOF
# User and Group IDs for Docker
UID=$CURRENT_USER
GID=$CURRENT_GROUP

# Application Configuration
NODE_ENV=production
PORT=3000

# Redis Configuration
REDIS_URL=redis://redis:6379
EOF

print_success "Environment file created"

# 构建镜像
print_status "Building Docker image..."
if docker compose build --no-cache; then
    print_success "Docker image built successfully"
else
    print_error "Failed to build Docker image"
    exit 1
fi

# 启动服务
print_status "Starting services..."
if docker compose up -d; then
    print_success "Services started successfully"
else
    print_error "Failed to start services"
    exit 1
fi

# 等待服务启动
print_status "Waiting for service to be ready..."
sleep 5

# 检查服务状态
if docker compose ps | grep -q "Up"; then
    print_success "Service is running!"
    echo ""
    echo "🎉 Deployment completed successfully!"
    echo "----------------------------------------"
    echo "🌐 Application URL: http://localhost:3000"
    echo "📋 View logs: docker compose logs -f"
    echo "⏹️  Stop service: docker compose down"
    echo "🔄 Restart service: docker compose restart"
    echo ""
    
    # 检查服务响应
    if command -v curl &> /dev/null; then
        print_status "Testing service connectivity..."
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|302\|404"; then
            print_success "Service is responding to HTTP requests"
        else
            print_warning "Service may still be starting up. Check logs with: docker compose logs -f"
        fi
    fi
else
    print_error "Service failed to start properly"
    echo "Check logs with: docker compose logs"
    exit 1
fi 