# 现代图床 - Docker部署

🚀 免费 · 开源 · 极速的现代图床

轻量图像存储解决方案，支持最新 **WebP / AVIF** 格式，内置 **格式自动转换** 与 **API接口上传** 功能。
基于 **Node.js 高性能架构**，部署简单，使用便捷。

## 🚀 快速部署

### 1. 克隆项目并启动

```bash
# 克隆项目
git clone <repository-url>
cd modern-images

# 准备配置文件
cp config.sample.json config.json

# 启动应用
docker-compose up -d

# 检查状态
docker-compose ps
```

应用将在端口3000运行，访问：http://localhost:3000

### 2. 首次设置

访问 http://localhost:3000/setup 进行初始配置

## 🔧 管理命令

```bash
# 查看应用日志
docker-compose logs -f modern-images

# 重启应用
docker-compose restart

# 停止应用
docker-compose down

# 更新应用
docker-compose pull
docker-compose up -d

# 备份数据
docker run --rm -v modern-images_uploads_data:/data -v $(pwd):/backup alpine tar czf /backup/uploads-backup.tar.gz -C /data .
```

## 📁 项目结构

```
modern-images/
├── Dockerfile              # Docker镜像构建文件
├── docker-compose.yml      # Docker编排配置
├── docker-entrypoint.sh    # 容器启动脚本
├── .dockerignore           # Docker构建忽略文件
├── package.json            # Node.js依赖配置
├── server.js               # 主应用程序
├── config.json             # 应用配置文件
├── fix-permissions.sh      # 权限修复脚本
├── views/                  # 前端页面
├── public/                 # 静态资源
└── uploads/                # 图片存储目录
```

## 🐳 Docker配置说明

- **基础镜像**: node:18-alpine
- **端口**: 3000
- **数据卷**: uploads目录持久化存储
- **健康检查**: 自动监控应用状态
- **安全**: 非root用户运行

---

作者个人网站：https://1keji.net/
开源地址：[1keji/modern-images](https://github.com/1keji/modern-images)
