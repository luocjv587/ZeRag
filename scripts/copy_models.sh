#!/bin/bash
# 从本地 HuggingFace 缓存复制模型到 ./models 目录

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MODELS_DIR="$PROJECT_ROOT/models/hub"
CACHE_DIR="$HOME/.cache/huggingface/hub"

echo "===== 复制 HuggingFace 模型到 Docker 目录 ====="
echo "源目录: $CACHE_DIR"
echo "目标目录: $MODELS_DIR"
echo ""

# 创建目标目录
mkdir -p "$MODELS_DIR"

# 复制 bge-m3
if [ -d "$CACHE_DIR/models--BAAI--bge-m3" ]; then
    echo "📦 复制 BAAI/bge-m3..."
    cp -r "$CACHE_DIR/models--BAAI--bge-m3" "$MODELS_DIR/"
    echo "✅ bge-m3 复制完成"
else
    echo "⚠️  未找到 bge-m3 模型，请先下载："
    echo "   python3 -c \"from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-m3')\""
fi

# 复制 bge-reranker-base
if [ -d "$CACHE_DIR/models--BAAI--bge-reranker-base" ]; then
    echo "📦 复制 BAAI/bge-reranker-base..."
    cp -r "$CACHE_DIR/models--BAAI--bge-reranker-base" "$MODELS_DIR/"
    echo "✅ bge-reranker-base 复制完成"
else
    echo "⚠️  未找到 bge-reranker-base 模型，请先下载："
    echo "   python3 -c \"from sentence_transformers import CrossEncoder; CrossEncoder('BAAI/bge-reranker-base')\""
fi

echo ""
echo "===== 复制完成 ====="
echo "模型文件位置: $MODELS_DIR"
echo ""
echo "现在可以启动 Docker 容器："
echo "  docker compose up -d"
