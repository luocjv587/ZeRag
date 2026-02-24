# ZeRag

> 通用 RAG 智能数据库问答平台

## 技术栈

| 层次 | 技术 |
|------|------|
| 后端框架 | Python · FastAPI |
| 数据库 | PostgreSQL + pgvector |
| 嵌入模型 | sentence-transformers（本地） |
| LLM | 阿里云通义千问（DashScope） |
| 前端 | React · TypeScript · Tailwind CSS · Vite |
| 认证 | JWT（python-jose） |

---

## 快速开始

### 1. 准备数据库

```sql
-- 创建 ZeRag 专用数据库
CREATE DATABASE zerag;

-- 安装 pgvector 扩展（需要 PostgreSQL 11+）
-- 参考：https://github.com/pgvector/pgvector
```

### 2. 配置后端环境变量

```bash
cd backend
cp .env.example .env
```

编辑 `.env`，至少填写：

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/zerag
SECRET_KEY=your-random-secret-key
ENCRYPTION_KEY=        # 运行下方命令生成
DASHSCOPE_API_KEY=     # 阿里云通义千问 API Key

# 国内服务器配置（无法访问 Hugging Face 时使用）
HF_ENDPOINT=https://hf-mirror.com  # Hugging Face 镜像站
```

生成 ENCRYPTION_KEY：
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 3. 安装后端依赖并启动

```bash
cd backend
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate

pip install -r requirements.txt

# 启动服务（自动建表、初始化 pgvector、创建预设账号）
uvicorn app.main:app --reload --port 8000
```

### 4. 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173

---

## 国内服务器部署（镜像源配置）

如果服务器无法访问 Hugging Face，需要在 `.env` 中配置镜像源：

```env
# 使用 Hugging Face 镜像站（推荐）
HF_ENDPOINT=https://hf-mirror.com
```

**可用的镜像站：**
- `https://hf-mirror.com` - 推荐，速度快，稳定
- 留空则使用官方源（需要能访问 huggingface.co）

**模型文件位置：**
- Linux: `~/.cache/huggingface/hub/` 或 `~/.cache/torch/sentence_transformers/`
- 可通过环境变量 `HF_HOME` 或 `SENTENCE_TRANSFORMERS_HOME` 自定义路径

---

## 默认账号

| 字段 | 值 |
|------|----|
| 用户名 | admin |
| 密码 | admin123 |

> 可在 `.env` 中通过 `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` 修改

---

## 使用流程

1. **登录** → 使用预设账号登录
2. **添加数据源** → 进入「数据源」页面，填写目标数据库连接信息（MySQL / PostgreSQL / SQLite）
3. **测试连接** → 确认数据库连通性
4. **同步** → 点击「同步」，系统将拉取数据、分块、向量化并存储到 pgvector
5. **问答** → 进入「智能问答」，选择数据源，输入问题，获得 AI 回答

---

## API 文档

启动后端后访问：
- Swagger UI：http://localhost:8000/docs
- ReDoc：http://localhost:8000/redoc

---

## 项目结构

```
ZeRag/
├── backend/
│   ├── app/
│   │   ├── api/          # 路由（auth / data_sources / qa）
│   │   ├── connectors/   # 数据源连接器（MySQL / PostgreSQL / SQLite）
│   │   ├── database/     # 数据库连接 & pgvector 初始化
│   │   ├── middleware/   # JWT 认证中间件
│   │   ├── models/       # SQLAlchemy 模型
│   │   ├── schemas/      # Pydantic 请求/响应模型
│   │   ├── services/     # 业务逻辑（auth / rag / llm / embedding...）
│   │   ├── utils/        # 工具（JWT / 加密 / 文本分块）
│   │   └── main.py       # 应用入口
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/
    └── src/
        ├── pages/        # Login / Chat / DataSources / History
        ├── components/   # Sidebar / AppLayout / ChatMessage
        ├── contexts/     # AuthContext
        ├── services/     # API 调用封装
        └── types/        # TypeScript 类型
```
