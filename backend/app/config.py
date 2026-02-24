from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # 数据库
    DATABASE_URL: str = "postgresql://postgres:your_strong_password@localhost:5432/zerag"

    # JWT
    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24小时

    # 预设管理员账号
    DEFAULT_ADMIN_USERNAME: str = "admin"
    DEFAULT_ADMIN_PASSWORD: str = "admin123"

    # 数据源密码加密密钥（Fernet 对称加密）
    ENCRYPTION_KEY: Optional[str] = "tx2RayQwod6fBFg_If4O_zPCL21rEh6XDvqVlrVCjvo="

    # 阿里云通义千问（百炼）
    DASHSCOPE_API_KEY: Optional[str] = "sk-7d93810fe48a4401843e9294cd575c59"

    # ── 嵌入模型 ──────────────────────────────────────────────
    # 升级为 BAAI/bge-m3（1024 维，中英文 SOTA，支持多语言）
    # ⚠️  如果从旧模型（384维）迁移，必须运行 migration 005 并对所有数据源重新同步
    EMBEDDING_MODEL: str = "BAAI/bge-m3"
    EMBEDDING_DIMENSION: int = 1024

    # ── Reranker 重排序 ────────────────────────────────────────
    # Cross-Encoder 模型，对初步检索结果进行精细化重排
    # 推荐：BAAI/bge-reranker-base（~280MB，中英文双语）
    #        BAAI/bge-reranker-v2-m3（~1.1GB，更强但更慢）
    RERANKER_MODEL: str = "BAAI/bge-reranker-base"
    ENABLE_RERANKER: bool = True
    # 传给 reranker 的候选池大小（先召回 top_k * RERANKER_CANDIDATE_MULTIPLIER 个候选再重排）
    RERANKER_CANDIDATE_MULTIPLIER: int = 3

    # ── Hugging Face 镜像源配置（国内服务器使用）───────────────
    # 国内服务器无法访问 Hugging Face，可使用以下镜像站：
    # 1. hf-mirror.com（推荐，速度快）
    # 2. 留空则使用官方源（需要能访问 huggingface.co）
    HF_ENDPOINT: Optional[str] = None  # 例如: "https://hf-mirror.com"

    # ── 缓存 ───────────────────────────────────────────────────
    # Embedding 缓存（LRU，避免相同查询重复向量化）
    ENABLE_EMBEDDING_CACHE: bool = True
    EMBEDDING_CACHE_SIZE: int = 2000    # 最多缓存的查询文本数

    # RAG 结果缓存（TTL，数据源同步后自动失效）
    ENABLE_RESULT_CACHE: bool = True
    RESULT_CACHE_SIZE: int = 200        # 最多缓存的不同问题数
    RESULT_CACHE_TTL: int = 300         # 缓存 TTL（秒），默认 5 分钟

    # ── 应用配置 ───────────────────────────────────────────────
    APP_NAME: str = "ZeRag"
    DEBUG: bool = True

    # 文件上传存储目录（相对路径或绝对路径）
    UPLOAD_DIR: str = "uploads"

    # PDF 转 Word 输出存储目录
    CONVERTED_DIR: str = "uploads/converted"

    # 是否允许用户自助注册（false 时只有超管能创建账号）
    ALLOW_REGISTER: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
