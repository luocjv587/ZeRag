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

    # 嵌入模型
    EMBEDDING_MODEL: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    EMBEDDING_DIMENSION: int = 384

    # 应用配置
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
