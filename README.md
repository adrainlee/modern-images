现代图床程序
作者个人网站：
https://1keji.net/
欢迎提出宝贵意见。

🚀 免费 · 开源 · 极速的现代图床
 轻量图像存储解决方案，支持最新 **WebP / AVIF** 格式，内置 **格式自动转换** 与 **API接口上传** 功能。
 基于 **Node.js 高性能架构**，部署简单，使用便捷，适用于个人项目、博客、自建图床、前端协作等场景。
 🔧 开源地址 ：[1keji/modern-images: 现代图床. 安全、简单、高效的图片托管服务](https://github.com/1keji/modern-images)

## Docker 部署指南

### 准备工作

确保您的系统已安装 Docker 和 Docker Compose：

- Docker: https://docs.docker.com/get-docker/
- Docker Compose: https://docs.docker.com/compose/install/

### 快速开始

#### 使用 Docker Compose（推荐）

1. 克隆或下载项目代码到本地

2. 创建配置文件：
```bash
# 创建配置文件（首次部署）
cp config.sample.json config.json
```

3. 在项目根目录下运行：

```bash
# 首次运行前，确保创建uploads目录并设置正确权限
mkdir -p uploads
chmod 777 uploads  # 或者使用更精细的权限设置

# 启动容器
docker-compose up -d
```

4. 访问 http://localhost:3000 使用应用

#### 使用 Dockerfile

1. 构建镜像：

```bash
docker build -t modern-images .
```

2. 运行容器：

```bash
# 首次运行前，确保创建uploads目录并设置正确权限
mkdir -p uploads
chmod 777 uploads  # 或者使用更精细的权限设置

# 创建配置文件（如果尚未创建）
cp config.sample.json config.json

# 启动容器
docker run -d -p 3000:3000 \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/config.json:/app/config.json \
  --name modern-images modern-images
```

3. 访问 http://localhost:3000 使用应用

### 数据持久化

应用的数据通过以下卷进行持久化：

- `./uploads:/app/uploads`: 存储上传的图片
- `./config.json:/app/config.json`: 存储应用配置

### 环境变量

可以通过环境变量自定义应用行为：

- `PORT`: 应用监听端口（默认：3000）
- `NODE_ENV`: Node.js 环境（默认：production）
- `UID`: 容器内运行应用的用户ID（默认：1000）
- `GID`: 容器内运行应用的组ID（默认：1000）

### 配置文件说明

`config.json` 文件包含应用的配置信息，包括认证信息和API设置。该文件不会被提交到Git仓库，您需要在每个部署环境中手动创建或复制此文件。

首次部署时：
1. 复制示例配置：`cp config.sample.json config.json`
2. 访问 http://localhost:3000/setup 进行初始设置

### 常用命令

- 查看容器日志：`docker logs modern-images`
- 重启容器：`docker restart modern-images`
- 停止容器：`docker stop modern-images`
- 删除容器：`docker rm modern-images`

### 注意事项

1. 首次启动时，需要访问 http://localhost:3000/setup 进行初始设置
2. 确保 `uploads` 目录和 `config.json` 文件有正确的读写权限
3. 在生产环境中，建议配置反向代理（如 Nginx）并启用 HTTPS
4. 如果遇到权限问题（EACCES错误），请检查宿主机上的目录权限，确保容器内的node用户有权限写入

### 修复权限问题

如果您在使用Docker部署过程中遇到权限问题，项目提供了自动化脚本来解决这些问题：

1. 在项目根目录下运行提供的权限修复脚本：

```bash
# 确保脚本有执行权限
chmod +x fix-permissions.sh

# 运行脚本
./fix-permissions.sh
```

2. 脚本将自动执行以下操作：
   - 停止当前运行的容器
   - 创建必要的目录结构
   - 根据当前用户ID和组ID更新docker-compose.yml配置
   - 更新docker-entrypoint.sh脚本
   - 提供重新构建和启动容器的命令

3. 脚本运行完成后，按照提示重新构建并启动容器：

```bash
docker compose build
docker compose up -d
```

该脚本通过将容器内的node用户UID/GID动态映射为宿主机当前用户的UID/GID，解决了文件所有权不匹配导致的权限问题，无需手动修改宿主机上的文件权限。
