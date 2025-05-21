# 现代图床 Docker 部署指南

## 准备工作

确保您的系统已安装 Docker 和 Docker Compose：

- Docker: https://docs.docker.com/get-docker/
- Docker Compose: https://docs.docker.com/compose/install/

## 快速开始

### 使用 Docker Compose（推荐）

1. 克隆或下载项目代码到本地

2. 在项目根目录下运行：

```bash
# 首次运行前，确保创建uploads目录并设置正确权限
mkdir -p uploads
chmod 777 uploads  # 或者使用更精细的权限设置

# 启动容器
docker-compose up -d
```

3. 访问 http://localhost:3000 使用应用

### 使用 Dockerfile

1. 构建镜像：

```bash
docker build -t modern-images .
```

2. 运行容器：

```bash
# 首次运行前，确保创建uploads目录并设置正确权限
mkdir -p uploads
chmod 777 uploads  # 或者使用更精细的权限设置

# 启动容器
docker run -d -p 3000:3000 \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/config.json:/app/config.json \
  --name modern-images modern-images
```

3. 访问 http://localhost:3000 使用应用

## 数据持久化

应用的数据通过以下卷进行持久化：

- `./uploads:/app/uploads`: 存储上传的图片
- `./config.json:/app/config.json`: 存储应用配置

## 环境变量

可以通过环境变量自定义应用行为：

- `PORT`: 应用监听端口（默认：3000）
- `NODE_ENV`: Node.js 环境（默认：production）

## 常用命令

- 查看容器日志：`docker logs modern-images`
- 重启容器：`docker restart modern-images`
- 停止容器：`docker stop modern-images`
- 删除容器：`docker rm modern-images`

## 注意事项

1. 首次启动时，需要访问 http://localhost:3000/setup 进行初始设置
2. 确保 `uploads` 目录和 `config.json` 文件有正确的读写权限
3. 在生产环境中，建议配置反向代理（如 Nginx）并启用 HTTPS
4. 如果遇到权限问题（EACCES错误），请检查宿主机上的目录权限，确保容器内的node用户（UID 1000）有权限写入 