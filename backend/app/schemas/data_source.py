from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class TableConfig(BaseModel):
    table: str
    columns: Optional[List[str]] = None  # None 表示同步所有列


class UploadedFile(BaseModel):
    filename: str
    path: str
    size: Optional[int] = None


class DataSourceCreate(BaseModel):
    name: str
    db_type: str  # mysql | postgresql | sqlite | file
    host: Optional[str] = None
    port: Optional[int] = None
    database_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None       # 明文，存储时加密
    sqlite_path: Optional[str] = None
    tables_config: Optional[List[TableConfig]] = None
    # 分块策略: fixed | paragraph | sentence | smart
    chunk_strategy: Optional[str] = "smart"


class DataSourceUpdate(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    database_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    sqlite_path: Optional[str] = None
    tables_config: Optional[List[TableConfig]] = None
    status: Optional[str] = None
    chunk_strategy: Optional[str] = None


class DataSourceResponse(BaseModel):
    id: int
    name: str
    db_type: str
    host: Optional[str] = None
    port: Optional[int] = None
    database_name: Optional[str] = None
    username: Optional[str] = None
    sqlite_path: Optional[str] = None
    tables_config: Optional[Any] = None
    file_store_dir: Optional[str] = None
    uploaded_files: Optional[Any] = None
    sync_status: str
    sync_error: Optional[str] = None
    last_synced_at: Optional[datetime] = None
    sync_progress: Optional[int] = 0   # 同步进度 0~100
    status: str
    chunk_strategy: Optional[str] = "smart"
    created_at: datetime

    class Config:
        from_attributes = True
