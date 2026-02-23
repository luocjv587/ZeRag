# 模型文件放置说明

## 📁 目录结构

将 HuggingFace 模型按照以下目录结构放置：

```
models/
└── hub/
    ├── models--BAAI--bge-m3/
    │   └── snapshots/
    │       └── <commit-hash>/
    │           ├── config.json
    │           ├── model.safetensors
    │           ├── tokenizer.json
    │           ├── tokenizer_config.json
    │           └── ... (其他模型文件)
    │
    └── models--BAAI--bge-reranker-base/
        └── snapshots/
            └── <commit-hash>/
                ├── config.json
                ├── model.safetensors
                ├── tokenizer.json
                └── ... (其他模型文件)
```

## 🔽 获取模型文件

### 方法0：使用便捷脚本（最简单）✨

如果你已经在本地下载过模型（在 `~/.cache/huggingface/hub/`），直接运行：

```bash
./scripts/copy_models.sh
```

脚本会自动从本地缓存复制模型到 `./models/hub/` 目录。

### 方法1：从 HuggingFace 下载（推荐）

在本地运行以下命令，模型会自动下载到 `~/.cache/huggingface/hub/`：

```bash
# 安装依赖
pip install sentence-transformers

# 下载 bge-m3 嵌入模型
python3 -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-m3')"

# 下载 bge-reranker-base 重排序模型
python3 -c "from sentence_transformers import CrossEncoder; CrossEncoder('BAAI/bge-reranker-base')"
```

然后复制到 `models/` 目录：

```bash
# 创建目录结构
mkdir -p models/hub

# 复制模型（替换为你的实际路径）
cp -r ~/.cache/huggingface/hub/models--BAAI--bge-m3 models/hub/
cp -r ~/.cache/huggingface/hub/models--BAAI--bge-reranker-base models/hub/
```

### 方法2：使用 huggingface-cli 下载

```bash
# 安装 huggingface-cli
pip install huggingface_hub

# 下载模型
huggingface-cli download BAAI/bge-m3 --local-dir models/hub/models--BAAI--bge-m3/snapshots/main
huggingface-cli download BAAI/bge-reranker-base --local-dir models/hub/models--BAAI--bge-reranker-base/snapshots/main
```

### 方法3：手动下载

1. 访问 HuggingFace 模型页面：
   - https://huggingface.co/BAAI/bge-m3
   - https://huggingface.co/BAAI/bge-reranker-base

2. 点击 "Files and versions" 标签页

3. 下载所有文件到对应目录

## ✅ 验证模型文件

启动容器前，检查目录结构：

```bash
# 检查 bge-m3
ls -lh models/hub/models--BAAI--bge-m3/snapshots/*/model.safetensors

# 检查 bge-reranker-base
ls -lh models/hub/models--BAAI--bge-reranker-base/snapshots/*/model.safetensors
```

## 📝 注意事项

1. **目录命名**：HuggingFace 使用 `models--组织名--模型名` 的命名格式，必须保持一致
2. **commit hash**：`snapshots/` 下的子目录名是模型的 commit hash，可以从 HuggingFace 页面获取
3. **文件完整性**：确保所有必需文件都已下载（至少包含 `config.json`、`model.safetensors`、`tokenizer.json`）
4. **权限**：确保容器有读取权限：`chmod -R 755 models/`

## 🚀 启动容器

模型文件放置完成后，启动容器：

```bash
docker compose up -d
```

容器会自动从 `./models` 目录加载模型，无需从网络下载。
