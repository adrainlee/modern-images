# 现代图床 Docker 权限问题解决指南

## 问题描述

容器启动时出现以下错误：
```
Error: EACCES: permission denied, mkdir '/app/uploads/api'
```

这是因为容器内的 node 用户（UID 1000）无法在挂载的卷中创建目录。

## 解决方案

### 方案一：使用 fix-permissions.sh 脚本（推荐）

这个脚本会自动配置 Docker 环境，使容器内的 node 用户使用与宿主机当前用户相同的 UID/GID，从而解决权限问题。

```bash
# 运行修复脚本
./fix-permissions.sh

# 重新构建并启动容器
docker compose build
docker compose up -d
```

### 方案二：手动设置权限（如果您有足够权限）

如果您有足够的权限修改目录权限，可以尝试：

```bash
# 创建必要的目录
mkdir -p uploads/api

# 设置权限（使用您的用户ID）
sudo chown -R $(id -u):$(id -g) uploads
```

### 方案三：使用 Docker 命名卷

如果以上方法都不起作用，可以使用 Docker 命名卷代替绑定挂载：

1. 修改 docker-compose.yml：

```yaml
version: '3'

services:
  modern-images:
    # ... 其他配置保持不变 ...
    volumes:
      - modern_images_data:/app/uploads
      - ./config.json:/app/config.json

volumes:
  modern_images_data:
```

2. 启动容器：

```bash
docker compose up -d
```

注意：使用命名卷时，您需要使用 Docker 卷命令来管理数据，例如备份或恢复。

## 其他注意事项

1. 如果您在共享主机或受限环境中运行，可能需要联系系统管理员获取帮助。

2. 在生产环境中，建议使用更安全的权限设置，而不是简单地使用 777 权限。

3. 如果您使用的是 SELinux，可能还需要设置适当的上下文：

```bash
sudo chcon -Rt container_file_t uploads
``` 