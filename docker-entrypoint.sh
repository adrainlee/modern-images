#!/bin/sh
set -e

# 创建必要的目录（如果不存在）
mkdir -p /app/uploads/api

# 检查挂载点权限
if [ ! -w "/app/uploads" ]; then
  echo "警告: uploads目录不可写，请检查挂载点权限"
  echo "建议在宿主机上运行: sudo chown -R $(id -u):$(id -g) uploads"
  exit 1
fi

# 检查配置文件
if [ ! -f "/app/config.json" ]; then
  echo "错误: 找不到config.json配置文件"
  echo "请确保config.json文件存在并正确挂载"
  exit 1
fi

# 验证Node.js环境
if ! command -v node >/dev/null 2>&1; then
  echo "错误: Node.js未安装"
  exit 1
fi

echo "启动现代图床应用..."
echo "用户: $(whoami)"
echo "工作目录: $(pwd)"
echo "Node.js版本: $(node --version)"

# 执行传入的命令
exec "$@" 