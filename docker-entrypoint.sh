#!/bin/sh
set -e

# 创建必要的目录
mkdir -p /app/uploads/api

# 如果提供了UID/GID环境变量，则使用它们
if [ -n "$UID" ] && [ -n "$GID" ]; then
  echo "使用提供的UID($UID)/GID($GID)运行应用"
  # 修改node用户的UID/GID以匹配宿主机
  sed -i -e "s/^node:x:[0-9]*:[0-9]*:/node:x:$UID:$GID:/" /etc/passwd
  sed -i -e "s/^node:x:[0-9]*:/node:x:$GID:/" /etc/group
  # 修改目录所有权
  chown -R node:node /app/uploads || true
fi

# 以node用户身份执行命令
exec su-exec node "$@"
