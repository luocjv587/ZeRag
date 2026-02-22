import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from app.database.connection import get_db
from app.schemas.data_source import DataSourceCreate, DataSourceUpdate, DataSourceResponse
from app.services import data_source_service
from app.services.vector_store_service import sync_data_source
from app.middleware.auth import get_current_user
from app.models.user import User
from app.services.file_processor import SUPPORTED_EXTENSIONS

router = APIRouter(prefix="/api/v1/data-sources", tags=["数据源"])

# 允许上传的文件扩展名
ALLOWED_EXTENSIONS = SUPPORTED_EXTENSIONS
# 单文件最大 50MB
MAX_FILE_SIZE = 50 * 1024 * 1024


@router.get("", response_model=List[DataSourceResponse])
def list_data_sources(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return data_source_service.get_data_sources(db, current_user)


@router.post("", response_model=DataSourceResponse, status_code=status.HTTP_201_CREATED)
def create_data_source(
    data: DataSourceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return data_source_service.create_data_source(db, data, owner_id=current_user.id)


@router.get("/{ds_id}", response_model=DataSourceResponse)
def get_data_source(
    ds_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ds = data_source_service.get_data_source(db, ds_id)
    if not ds:
        raise HTTPException(status_code=404, detail="数据源不存在")
    _check_ds_access(ds, current_user)
    return ds


@router.put("/{ds_id}", response_model=DataSourceResponse)
def update_data_source(
    ds_id: int,
    data: DataSourceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ds = data_source_service.get_data_source(db, ds_id)
    if not ds:
        raise HTTPException(status_code=404, detail="数据源不存在")
    _check_ds_access(ds, current_user)
    ds = data_source_service.update_data_source(db, ds_id, data)
    return ds


@router.delete("/{ds_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_data_source(
    ds_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ds = data_source_service.get_data_source(db, ds_id)
    if not ds:
        raise HTTPException(status_code=404, detail="数据源不存在")
    _check_ds_access(ds, current_user)
    data_source_service.delete_data_source(db, ds_id)


@router.post("/{ds_id}/test-connection")
def test_connection(
    ds_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ds = data_source_service.get_data_source(db, ds_id)
    if not ds:
        raise HTTPException(status_code=404, detail="数据源不存在")
    _check_ds_access(ds, current_user)
    ok = data_source_service.test_data_source_connection(db, ds_id)
    return {"success": ok, "message": "连接成功" if ok else "连接失败"}


@router.post("/{ds_id}/sync")
def trigger_sync(
    ds_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ds = data_source_service.get_data_source(db, ds_id)
    if not ds:
        raise HTTPException(status_code=404, detail="数据源不存在")
    _check_ds_access(ds, current_user)
    background_tasks.add_task(sync_data_source, db, ds)
    return {"message": "同步任务已启动", "data_source_id": ds_id}


@router.post("/{ds_id}/upload-files", response_model=DataSourceResponse)
async def upload_files(
    ds_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """上传文件到文件类型数据源"""
    ds = data_source_service.get_data_source(db, ds_id)
    if not ds:
        raise HTTPException(status_code=404, detail="数据源不存在")
    if ds.db_type != "file":
        raise HTTPException(status_code=400, detail="该数据源不是文件类型")
    _check_ds_access(ds, current_user)

    # 确保存储目录存在
    store_dir = ds.file_store_dir
    if not store_dir:
        raise HTTPException(status_code=500, detail="文件存储目录未配置")
    os.makedirs(store_dir, exist_ok=True)

    saved_files = []
    errors = []

    for upload_file in files:
        filename = upload_file.filename or "unknown"
        ext = os.path.splitext(filename)[1].lower()

        # 校验扩展名
        if ext not in ALLOWED_EXTENSIONS:
            errors.append(f"{filename}: 不支持的格式（支持 {', '.join(sorted(ALLOWED_EXTENSIONS))}）")
            continue

        # 读取内容，校验大小
        content = await upload_file.read()
        if len(content) > MAX_FILE_SIZE:
            errors.append(f"{filename}: 文件超过 50MB 限制")
            continue

        # 保存到目录
        dest_path = os.path.join(store_dir, filename)
        with open(dest_path, "wb") as f:
            f.write(content)

        data_source_service.add_uploaded_file(db, ds, filename, dest_path, len(content))
        saved_files.append(filename)

    if errors and not saved_files:
        raise HTTPException(status_code=400, detail="上传失败: " + "; ".join(errors))

    # 刷新数据源
    db.refresh(ds)
    return ds


@router.delete("/{ds_id}/files/{filename}", response_model=DataSourceResponse)
def delete_uploaded_file(
    ds_id: int,
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除文件类型数据源中的某个文件"""
    ds = data_source_service.get_data_source(db, ds_id)
    if not ds:
        raise HTTPException(status_code=404, detail="数据源不存在")
    if ds.db_type != "file":
        raise HTTPException(status_code=400, detail="该数据源不是文件类型")
    _check_ds_access(ds, current_user)
    ds = data_source_service.remove_uploaded_file(db, ds, filename)
    return ds


# ── 内部辅助 ──────────────────────────────────────────────────────────────────

def _check_ds_access(ds, current_user: User) -> None:
    """非管理员只能操作自己的数据源"""
    if current_user.is_admin:
        return
    if ds.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问该数据源")
