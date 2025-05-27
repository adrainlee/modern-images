# 现代图床 - Docker部署

🚀 免费 · 开源 · 极速的现代图床

轻量图像存储解决方案，支持最新 **WebP / AVIF** 格式，内置 **格式自动转换** 与 **API接口上传** 功能。
基于 **Node.js 高性能架构**，部署简单，使用便捷。

## 🚀 快速部署

### 方式一：自动部署（推荐）

使用我们提供的快速部署脚本，自动处理权限问题：

```bash
# 克隆项目
git clone <repository-url>
cd modern-images

# 运行快速部署脚本
./quick-deploy.sh
```

### 方式二：手动部署

```bash
# 克隆项目
git clone <repository-url>
cd modern-images

# 修复权限问题
./fix-permissions.sh

# 构建并启动
docker compose build --no-cache
docker compose up -d

# 检查状态
docker compose ps
```

应用将在端口3000运行，访问：http://localhost:3000

## 🔧 权限问题解决方案

如果遇到 `config.json` 或 `uploads` 目录权限问题，请使用以下解决方案：

### 自动修复

```bash
# 使用内置修复脚本
./fix-permissions.sh
```

### 手动修复

```bash
# 1. 停止容器
docker compose down

# 2. 创建必要目录
mkdir -p uploads/api

# 3. 修复权限
sudo chown -R $(id -u):$(id -g) uploads config.json
chmod 755 uploads/
chmod 644 config.json

# 4. 创建环境变量文件
echo "UID=$(id -u)" > .env
echo "GID=$(id -g)" >> .env

# 5. 重新构建和启动
docker compose build --no-cache
docker compose up -d
```

### 权限问题说明

本项目的Docker配置已经优化，能够：

- ✅ 自动检测宿主机用户ID
- ✅ 动态调整容器内用户权限
- ✅ 智能处理文件权限问题
- ✅ 支持非root用户运行

## 📸 图片管理功能

### 图片选择与删除

在图片库页面，您可以进行以下操作：

#### 选择图片
- **单选**：直接点击图片即可选中
- **多选**：按住 `Ctrl` 键（Mac用户按 `Cmd` 键）+ 点击图片进行多选
- **范围选择**：按住 `Shift` 键 + 点击可选择连续范围的图片
- **取消选择**：点击页面空白区域可取消所有选择

#### 删除图片
- **单张删除**：点击图片右上角的删除按钮（垃圾桶图标）
- **批量删除**：
  1. 使用 `Ctrl + 点击` 选择多张图片
  2. 点击页面顶部或底部的删除按钮
  3. 确认删除操作

#### 其他功能
- **双击预览**：双击图片可打开大图预览
- **右键菜单**：右键点击图片可复制链接、HTML代码、Markdown代码等
- **视图切换**：支持网格视图和列表视图切换
- **分页浏览**：支持分页浏览，可调整每页显示数量

### 快捷键说明
- `Delete` 键：提示使用删除按钮（安全考虑）
- `Esc` 键：关闭图片预览模态框
- `←/→` 方向键：在预览模式下切换图片

## 🔧 管理命令

```bash
# 查看应用日志
docker compose logs -f

# 重启应用
docker compose restart

# 停止应用
docker compose down

# 更新应用（保留数据）
git pull
docker compose build --no-cache
docker compose up -d

# 备份uploads目录
tar czf uploads-backup-$(date +%Y%m%d).tar.gz uploads/
```

## 📁 项目结构

```
modern-images/
├── Dockerfile              # Docker镜像构建文件
├── docker-compose.yml      # Docker编排配置  
├── docker-entrypoint.sh    # 容器启动脚本
├── quick-deploy.sh         # 快速部署脚本（新增）
├── fix-permissions.sh      # 权限修复脚本
├── .dockerignore           # Docker构建忽略文件
├── package.json            # Node.js依赖配置
├── server.js               # 主应用程序
├── config.json             # 应用配置文件
├── .env                    # 环境变量文件（自动生成）
├── views/                  # 前端页面
├── public/                 # 静态资源
└── uploads/                # 图片存储目录
```

## 🐳 Docker配置特性

- **基础镜像**: node:18-alpine
- **端口**: 3000
- **权限管理**: 动态用户ID映射
- **数据持久化**: 绑定挂载uploads目录
- **健康检查**: 自动监控应用状态
- **安全运行**: 非root用户运行

## 🔍 故障排除

### 常见问题

1. **权限拒绝错误**
   ```bash
   ./fix-permissions.sh
   docker compose build --no-cache
   docker compose up -d
   ```

2. **端口占用**
   ```bash
   # 检查端口占用
   sudo netstat -tlnp | grep :3000
   # 修改docker-compose.yml中的端口映射
   ```

3. **容器启动失败**
   ```bash
   # 查看详细日志
   docker compose logs -f
   # 检查配置文件
   cat config.json
   ```

---

作者个人网站：https://1keji.net/
开源地址：[1keji/modern-images](https://github.com/1keji/modern-images)
