import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.database.connection import get_db
from app.schemas.data_source import DataSourceCreate, DataSourceUpdate, DataSourceResponse
from app.services import data_source_service
from app.services.vector_store_service import sync_data_source
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.data_source import DataSource
from app.models.document_chunk import DocumentChunk
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

    # 防止重复同步：如果已经在同步中，则拒绝新的同步请求
    if ds.sync_status == "syncing":
        raise HTTPException(
            status_code=400,
            detail="数据源正在同步中，请等待同步完成后再试"
        )

    # ⚠️  重要：不能把请求级的 db session 传给 BackgroundTask。
    # 请求返回后 session 会被关闭，后台任务继续使用会报 "Session is closed" 错误。
    # 正确做法：后台任务内部独立创建 session，用完自己关闭。
    background_tasks.add_task(_background_sync_task, ds_id)
    return {"message": "同步任务已启动", "data_source_id": ds_id, "sync_progress": 0}


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


class WebUrlBody(BaseModel):
    url: str


@router.post("/{ds_id}/web-urls", response_model=DataSourceResponse)
def add_web_url(
    ds_id: int,
    body: WebUrlBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """向网络数据源添加一个 URL"""
    ds = data_source_service.get_data_source(db, ds_id)
    if not ds:
        raise HTTPException(status_code=404, detail="数据源不存在")
    if ds.db_type != "web":
        raise HTTPException(status_code=400, detail="该数据源不是网络类型")
    _check_ds_access(ds, current_user)
    if not body.url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL 必须以 http:// 或 https:// 开头")
    ds = data_source_service.add_web_url(db, ds, body.url)
    return ds


@router.delete("/{ds_id}/web-urls", response_model=DataSourceResponse)
def remove_web_url(
    ds_id: int,
    url: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """从网络数据源删除一个 URL（url 作为 query 参数传入）"""
    ds = data_source_service.get_data_source(db, ds_id)
    if not ds:
        raise HTTPException(status_code=404, detail="数据源不存在")
    if ds.db_type != "web":
        raise HTTPException(status_code=400, detail="该数据源不是网络类型")
    _check_ds_access(ds, current_user)
    ds = data_source_service.remove_web_url(db, ds, url)
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


@router.get("/{ds_id}/sync-status")
def get_sync_status(
    ds_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取数据源同步状态及 chunk 统计（前端轮询用）"""
    ds = data_source_service.get_data_source(db, ds_id)
    if not ds:
        raise HTTPException(status_code=404, detail="数据源不存在")
    _check_ds_access(ds, current_user)
    chunk_count = db.query(DocumentChunk).filter(DocumentChunk.data_source_id == ds_id).count()
    return {
        "sync_status": ds.sync_status,
        "sync_error": ds.sync_error,
        "last_synced_at": ds.last_synced_at,
        "chunk_count": chunk_count,
        # 新增：同步进度（0~100），前端可用于进度条展示
        "sync_progress": getattr(ds, "sync_progress", 0) or 0,
    }


class ChunkItem(BaseModel):
    id: int
    table_name: Optional[str] = None
    chunk_text: str
    chunk_index: int
    created_at: datetime

    class Config:
        from_attributes = True


class ChunkListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[ChunkItem]


@router.get("/{ds_id}/chunks", response_model=ChunkListResponse)
def list_chunks(
    ds_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: Optional[str] = Query(None, description="按内容关键词过滤"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """分页查看数据源的 chunk 内容"""
    ds = data_source_service.get_data_source(db, ds_id)
    if not ds:
        raise HTTPException(status_code=404, detail="数据源不存在")
    _check_ds_access(ds, current_user)

    query = db.query(DocumentChunk).filter(DocumentChunk.data_source_id == ds_id)
    if q:
        query = query.filter(DocumentChunk.chunk_text.ilike(f"%{q}%"))
    total = query.count()
    items = (
        query.order_by(DocumentChunk.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return ChunkListResponse(total=total, page=page, page_size=page_size, items=items)


# ── 内部辅助 ──────────────────────────────────────────────────────────────────

def _check_ds_access(ds, current_user: User) -> None:
    """非管理员只能操作自己的数据源"""
    if current_user.is_admin:
        return
    if ds.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问该数据源")


def _background_sync_task(ds_id: int) -> None:
    """
    后台同步任务：在独立的 DB session 中执行，避免复用请求 session 导致的
    "Session is closed / DetachedInstanceError" 问题。
    
    注意：即使前端关闭，同步完成后也会自动更新状态为 synced 或 error。
    """
    from app.database.connection import SessionLocal
    from app.utils.logger import logger

    db = SessionLocal()
    try:
        # 重新查询以确保获取最新状态（防止并发请求导致重复同步）
        ds = db.query(DataSource).filter(DataSource.id == ds_id).first()
        if ds is None:
            logger.warning(f"Background sync: datasource {ds_id} not found")
            return
        
        # 双重检查：如果已经在同步中，则跳过（防止并发请求）
        if ds.sync_status == "syncing":
            logger.warning(f"Background sync: datasource {ds_id} is already syncing, skipping duplicate task")
            return
        
        # 执行同步（内部会处理异常并更新状态）
        sync_data_source(db, ds)
        logger.info(f"Background sync completed for datasource {ds_id}")
    except Exception as e:
        # 如果 sync_data_source 内部没有捕获异常（理论上不应该发生），
        # 这里作为最后的安全网，确保状态被更新
        logger.error(f"Background sync task failed for datasource {ds_id}: {e}", exc_info=True)
        try:
            # 尝试更新状态为 error（使用新的 session，因为原 session 可能已失效）
            error_db = SessionLocal()
            try:
                error_ds = error_db.query(DataSource).filter(DataSource.id == ds_id).first()
                if error_ds and error_ds.sync_status == "syncing":
                    error_ds.sync_status = "error"
                    error_ds.sync_error = f"同步任务异常终止: {str(e)}"
                    error_ds.sync_progress = 0
                    error_db.commit()
                    logger.info(f"Updated datasource {ds_id} status to error due to task failure")
            finally:
                error_db.close()
        except Exception as inner_e:
            logger.error(f"Failed to update error status for datasource {ds_id}: {inner_e}")
    finally:
        db.close()
