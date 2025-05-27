#!/bin/sh
set -e

echo "=== Modern Images Docker Entrypoint ==="

# 获取环境变量中的UID/GID，如果没有则使用默认值
TARGET_UID=${UID:-1000}
TARGET_GID=${GID:-1000}

# 获取当前nodejs用户的UID/GID
CURRENT_UID=$(id -u nodejs)
CURRENT_GID=$(id -g nodejs)

echo "Target UID/GID: $TARGET_UID/$TARGET_GID"
echo "Current nodejs UID/GID: $CURRENT_UID/$CURRENT_GID"

# 如果需要，调整用户和组的ID
if [ "$CURRENT_UID" != "$TARGET_UID" ] || [ "$CURRENT_GID" != "$TARGET_GID" ]; then
    echo "Adjusting user permissions..."
    
    # 修改组ID
    if [ "$CURRENT_GID" != "$TARGET_GID" ]; then
        sed -i "s/nodejs:x:$CURRENT_GID:/nodejs:x:$TARGET_GID:/" /etc/group
    fi
    
    # 修改用户ID
    if [ "$CURRENT_UID" != "$TARGET_UID" ]; then
        sed -i "s/nodejs:x:$CURRENT_UID:$CURRENT_GID:/nodejs:x:$TARGET_UID:$TARGET_GID:/" /etc/passwd
    fi
fi

# 创建必要的目录
echo "Creating necessary directories..."
mkdir -p /app/uploads/api

# 检查并创建配置文件（如果不存在）
if [ ! -f "/app/config.json" ]; then
    echo "Config file not found, creating from sample..."
    if [ -f "/app/config.sample.json" ]; then
        cp /app/config.sample.json /app/config.json
        echo "Configuration file created. Please visit http://localhost:3000/setup for initial setup."
    else
        echo "Warning: No config.sample.json found. Please ensure config.json exists."
    fi
fi

# 尝试修复权限（如果以root身份运行）
if [ "$(id -u)" = "0" ]; then
    echo "Running as root, fixing permissions..."
    chown -R nodejs:nodejs /app/uploads /app/config.json 2>/dev/null || true
    echo "Switching to nodejs user..."
    exec su-exec nodejs "$@"
else
    echo "Running as non-root user: $(whoami)"
    # 检查权限
    if [ ! -w "/app/uploads" ]; then
        echo "Warning: uploads directory is not writable"
        echo "Please run: sudo chown -R $(id -u):$(id -g) uploads"
    fi
    
    if [ ! -w "/app/config.json" ]; then
        echo "Warning: config.json is not writable"
        echo "Please run: sudo chown $(id -u):$(id -g) config.json"
    fi
    
    exec "$@"
fi 