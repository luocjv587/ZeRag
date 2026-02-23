#!/bin/bash
# ZeRag 一键启动脚本

set -e

echo "===== ZeRag 启动脚本 ====="
echo ""

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "❌ 错误: .env 文件不存在"
    echo "请先创建 .env 文件，参考 .env.example"
    exit 1
fi

# 检查模型文件（可选）
if [ ! -d "models/hub/models--BAAI--bge-m3" ] || [ ! -d "models/hub/models--BAAI--bge-reranker-base" ]; then
    echo "⚠️  警告: 模型文件未找到"
    echo "   如果这是首次启动，模型将从 HuggingFace 自动下载（需要网络）"
    echo "   或者运行 ./scripts/copy_models.sh 从本地缓存复制"
    echo ""
    read -p "是否继续启动？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "📦 构建 Docker 镜像..."
docker compose build

echo ""
echo "🚀 启动服务..."
docker compose up -d

echo ""
echo "⏳ 等待服务就绪..."
sleep 5

echo ""
echo "📊 查看服务状态..."
docker compose ps

echo ""
echo "📝 查看日志（按 Ctrl+C 退出）..."
echo "   完整日志: docker compose logs -f"
echo "   后端日志: docker compose logs -f backend"
echo "   前端日志: docker compose logs -f frontend"
echo ""

# 显示访问地址
FRONTEND_PORT=$(grep FRONTEND_PORT .env | cut -d '=' -f2 || echo "80")
echo "✅ 服务已启动！"
echo ""
echo "🌐 访问地址:"
echo "   前端: http://$(hostname -I | awk '{print $1}'):${FRONTEND_PORT:-80}"
echo "   API 文档: http://$(hostname -I | awk '{print $1}'):${FRONTEND_PORT:-80}/docs"
echo ""
echo "📋 常用命令:"
echo "   停止服务: docker compose down"
echo "   查看日志: docker compose logs -f"
echo "   重启服务: docker compose restart"
echo "   查看状态: docker compose ps"
