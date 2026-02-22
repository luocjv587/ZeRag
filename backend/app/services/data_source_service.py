import os
from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.data_source import DataSource
from app.schemas.data_source import DataSourceCreate, DataSourceUpdate
from app.utils.encryption import encrypt_password, decrypt_password
from app.connectors.mysql_connector import MySQLConnector
from app.connectors.postgresql_connector import PostgreSQLConnector
from app.connectors.sqlite_connector import SQLiteConnector
from app.connectors.base import BaseConnector
from app.config import settings


def get_connector(ds: DataSource) -> BaseConnector:
    """根据数据源配置返回对应连接器"""
    password = decrypt_password(ds.encrypted_password) if ds.encrypted_password else ""
    if ds.db_type == "mysql":
        return MySQLConnector(ds.host, ds.port, ds.database_name, ds.username, password)
    elif ds.db_type == "postgresql":
        return PostgreSQLConnector(ds.host, ds.port, ds.database_name, ds.username, password)
    elif ds.db_type == "sqlite":
        return SQLiteConnector(ds.sqlite_path)
    elif ds.db_type == "file":
        raise ValueError("文件类型数据源不使用数据库连接器")
    else:
        raise ValueError(f"Unsupported db_type: {ds.db_type}")


def _get_file_store_dir(ds_id: int) -> str:
    """获取文件数据源的存储目录"""
    base_dir = getattr(settings, "UPLOAD_DIR", "uploads")
    store_dir = os.path.join(base_dir, f"ds_{ds_id}")
    os.makedirs(store_dir, exist_ok=True)
    return store_dir


def create_data_source(db: Session, data: DataSourceCreate, owner_id: Optional[int] = None) -> DataSource:
    encrypted_pwd = encrypt_password(data.password) if data.password else None
    tables_cfg = [t.model_dump() for t in data.tables_config] if data.tables_config else None
    ds = DataSource(
        owner_id=owner_id,
        name=data.name,
        db_type=data.db_type,
        host=data.host,
        port=data.port,
        database_name=data.database_name,
        username=data.username,
        encrypted_password=encrypted_pwd,
        sqlite_path=data.sqlite_path,
        tables_config=tables_cfg,
    )
    db.add(ds)
    db.commit()
    db.refresh(ds)

    # 文件类型：自动创建存储目录
    if data.db_type == "file":
        store_dir = _get_file_store_dir(ds.id)
        ds.file_store_dir = store_dir
        ds.uploaded_files = []
        db.commit()
        db.refresh(ds)

    return ds


def get_data_sources(db: Session, current_user=None) -> List[DataSource]:
    query = db.query(DataSource).order_by(DataSource.created_at.desc())
    # 非管理员只能看到自己创建的数据源
    if current_user and not current_user.is_admin:
        query = query.filter(DataSource.owner_id == current_user.id)
    return query.all()


def get_data_source(db: Session, ds_id: int) -> Optional[DataSource]:
    return db.query(DataSource).filter(DataSource.id == ds_id).first()


def update_data_source(db: Session, ds_id: int, data: DataSourceUpdate) -> Optional[DataSource]:
    ds = get_data_source(db, ds_id)
    if not ds:
        return None
    update_data = data.model_dump(exclude_unset=True)
    if "password" in update_data:
        ds.encrypted_password = encrypt_password(update_data.pop("password"))
    if "tables_config" in update_data and update_data["tables_config"]:
        update_data["tables_config"] = [t.model_dump() if hasattr(t, "model_dump") else t for t in update_data["tables_config"]]
    for k, v in update_data.items():
        setattr(ds, k, v)
    db.commit()
    db.refresh(ds)
    return ds


def delete_data_source(db: Session, ds_id: int) -> bool:
    ds = get_data_source(db, ds_id)
    if not ds:
        return False
    # 文件类型：删除存储目录
    if ds.db_type == "file" and ds.file_store_dir and os.path.isdir(ds.file_store_dir):
        import shutil
        shutil.rmtree(ds.file_store_dir, ignore_errors=True)
    db.delete(ds)
    db.commit()
    return True


def test_data_source_connection(db: Session, ds_id: int) -> bool:
    ds = get_data_source(db, ds_id)
    if not ds:
        return False
    if ds.db_type == "file":
        # 文件类型：检查目录是否存在
        return bool(ds.file_store_dir and os.path.isdir(ds.file_store_dir))
    connector = get_connector(ds)
    return connector.test_connection()


def add_uploaded_file(db: Session, ds: DataSource, filename: str, file_path: str, size: int) -> DataSource:
    """记录已上传的文件到数据源"""
    uploaded_files = list(ds.uploaded_files or [])
    # 去重：同名文件替换
    uploaded_files = [f for f in uploaded_files if f.get("filename") != filename]
    uploaded_files.append({
        "filename": filename,
        "path": file_path,
        "size": size,
    })
    ds.uploaded_files = uploaded_files
    db.commit()
    db.refresh(ds)
    return ds


def remove_uploaded_file(db: Session, ds: DataSource, filename: str) -> DataSource:
    """从数据源中删除文件记录，并删除实际文件"""
    uploaded_files = list(ds.uploaded_files or [])
    target = next((f for f in uploaded_files if f.get("filename") == filename), None)
    if target:
        file_path = target.get("path")
        if file_path and os.path.isfile(file_path):
            os.remove(file_path)
        uploaded_files = [f for f in uploaded_files if f.get("filename") != filename]
        ds.uploaded_files = uploaded_files
        db.commit()
        db.refresh(ds)
    return ds
