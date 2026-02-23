# 🚀 ZeRag 部署指南

## 快速启动

### 方式1：使用启动脚本（推荐）

```bash
./start.sh
```

### 方式2：手动启动

```bash
# 1. 构建镜像
docker compose build

# 2. 启动服务
docker compose up -d

# 3. 查看日志
docker compose logs -f
```

---

## 📋 当前配置

- **数据库**: `124.221.153.6:5432/zerag`
- **前端端口**: `80`
- **访问地址**: `http://服务器IP`

---

## 🔧 常用命令

### 查看服务状态
```bash
docker compose ps
```

### 查看日志
```bash
# 所有服务日志
docker compose logs -f

# 仅后端日志
docker compose logs -f backend

# 仅前端日志
docker compose logs -f frontend
```

### 重启服务
```bash
# 重启所有服务
docker compose restart

# 仅重启后端
docker compose restart backend

# 仅重启前端
docker compose restart frontend
```

### 停止服务
```bash
docker compose down
```

### 停止并删除数据卷（⚠️ 会删除上传的文件和模型缓存）
```bash
docker compose down -v
```

---

## 🔍 故障排查

### 1. 检查数据库连接
```bash
# 进入后端容器
docker compose exec backend bash

# 测试数据库连接
python3 -c "from app.database.connection import engine; engine.connect()"
```

### 2. 检查模型加载
```bash
# 查看后端日志中的模型加载信息
docker compose logs backend | grep -i "model loaded"
```

### 3. 检查端口占用
```bash
# 检查 80 端口是否被占用
netstat -tuln | grep :80
# 或
lsof -i :80
```

### 4. 查看容器资源使用
```bash
docker stats
```

---

## 📦 模型文件管理

### 手动放置模型
将模型文件按照以下结构放置：
```
models/hub/
├── models--BAAI--bge-m3/
└── models--BAAI--bge-reranker-base/
```

### 从本地缓存复制
```bash
./scripts/copy_models.sh
```

### 切换为自动下载模式
编辑 `docker-compose.yml`，将：
```yaml
- ./models:/app/.cache/huggingface
```
改为：
```yaml
- model_cache:/app/.cache/huggingface
```

---

## 🔐 安全建议

1. **修改默认密钥**: `.env` 中的 `SECRET_KEY` 和 `ENCRYPTION_KEY` 应使用强随机值
2. **关闭用户注册**: 生产环境设置 `ALLOW_REGISTER=false`
3. **配置 HTTPS**: 使用 nginx 反向代理配置 SSL 证书
4. **限制 CORS**: 修改 `CORS_ORIGINS` 为实际域名

---

## 📞 访问地址

- **前端界面**: http://服务器IP
- **API 文档**: http://服务器IP/docs
- **健康检查**: http://服务器IP/api/v1/health

---

## 🆘 需要帮助？

查看日志定位问题：
```bash
docker compose logs --tail=100 backend
```
