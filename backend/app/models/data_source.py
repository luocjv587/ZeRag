from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from app.database.connection import Base


class DataSource(Base):
    __tablename__ = "data_sources"

    id = Column(Integer, primary_key=True, index=True)
    # 创建者用户 ID（NULL 表示由超管创建、对所有管理员可见）
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    # 数据源类型: mysql | postgresql | sqlite | file
    db_type = Column(String(50), nullable=False)
    host = Column(String(255), nullable=True)
    port = Column(Integer, nullable=True)
    database_name = Column(String(255), nullable=True)
    username = Column(String(255), nullable=True)
    # 加密存储的密码
    encrypted_password = Column(Text, nullable=True)
    # SQLite 专用：完整文件路径
    sqlite_path = Column(String(500), nullable=True)
    # 需要同步的表配置：[{"table": "users", "columns": ["id", "name", "email"]}]
    tables_config = Column(JSON, nullable=True)
    # 文件类型数据源：存储上传文件的目录
    file_store_dir = Column(String(500), nullable=True)
    # 已上传的文件列表：[{"filename": "xxx.pdf", "path": "/uploads/..."}]
    uploaded_files = Column(JSON, nullable=True)
    # 同步状态: pending | syncing | synced | error
    sync_status = Column(String(50), default="pending")
    sync_error = Column(Text, nullable=True)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    # 同步进度（0~100），前端可轮询展示进度条
    sync_progress = Column(Integer, default=0, nullable=True)
    # 整体状态: active | inactive
    status = Column(String(50), default="active")
    # 文档分块策略: fixed | paragraph | sentence | smart（默认 smart）
    chunk_strategy = Column(String(50), nullable=True, server_default="smart")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
