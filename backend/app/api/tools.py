"""
工具箱 API
- POST /api/tools/pdf-to-word          PDF 转 Word（高质量，使用 pdf2docx）
- GET  /api/tools/pdf-to-word/history  获取当前用户的转换历史
- GET  /api/tools/pdf-to-word/download/{history_id}  重复下载已转换文件
"""

import os
import uuid
import tempfile
import logging
from typing import List

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from datetime import datetime
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.pdf_convert_history import PdfConvertHistory
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tools", tags=["tools"])


# ── 响应 Schema ───────────────────────────────────────────────────────────────

class PdfConvertHistoryResponse(BaseModel):
    id: int
    original_filename: str
    converted_filename: str
    file_size: int | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── 工具函数 ──────────────────────────────────────────────────────────────────

def _get_converted_dir() -> str:
    d = settings.CONVERTED_DIR
    os.makedirs(d, exist_ok=True)
    return d


# ── 端点 ──────────────────────────────────────────────────────────────────────

@router.post("/pdf-to-word", response_model=PdfConvertHistoryResponse)
async def pdf_to_word(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    将上传的 PDF 文件转换为 Word（.docx）格式。
    转换结果持久化保存，可通过历史记录重复下载。
    """
    # 校验文件类型
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="请上传 PDF 文件（.pdf）")

    # 文件大小限制：50 MB
    MAX_SIZE = 50 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="文件大小不能超过 50 MB")

    uid = uuid.uuid4().hex
    original_stem = os.path.splitext(file.filename)[0]
    converted_filename = f"{original_stem}.docx"
    stored_name = f"{uid}.docx"  # 服务端存储名（避免冲突）

    converted_dir = _get_converted_dir()
    docx_path = os.path.join(converted_dir, stored_name)

    # 写入临时 PDF
    tmp_pdf = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    try:
        tmp_pdf.write(content)
        tmp_pdf.close()

        # ── 核心转换：pdf2docx ──────────────────────────────────────────
        try:
            from pdf2docx import Converter
            cv = Converter(tmp_pdf.name)
            cv.convert(docx_path, start=0, end=None)
            cv.close()
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="服务器尚未安装 pdf2docx，请联系管理员执行 pip install pdf2docx"
            )
        # ───────────────────────────────────────────────────────────────

        if not os.path.exists(docx_path):
            raise HTTPException(status_code=500, detail="转换失败，生成文件不存在")

        file_size = os.path.getsize(docx_path)

        # 持久化记录到数据库
        record = PdfConvertHistory(
            user_id=current_user.id,
            original_filename=file.filename,
            converted_filename=converted_filename,
            file_path=docx_path,
            file_size=file_size,
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        return record

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("PDF 转 Word 失败")
        raise HTTPException(status_code=500, detail=f"转换过程出错：{str(e)}")
    finally:
        if os.path.exists(tmp_pdf.name):
            try:
                os.remove(tmp_pdf.name)
            except Exception:
                pass


@router.get("/pdf-to-word/history", response_model=List[PdfConvertHistoryResponse])
def get_pdf_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取当前用户的 PDF 转换历史（管理员可见所有用户记录）"""
    query = db.query(PdfConvertHistory).order_by(PdfConvertHistory.created_at.desc())
    if not current_user.is_admin:
        query = query.filter(PdfConvertHistory.user_id == current_user.id)
    return query.limit(limit).all()


@router.get("/pdf-to-word/download/{history_id}")
def download_converted(
    history_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """根据历史记录 ID 重复下载已转换的 Word 文件"""
    record = db.query(PdfConvertHistory).filter(PdfConvertHistory.id == history_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    # 权限校验：只能下载自己的文件（管理员除外）
    if not current_user.is_admin and record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权下载该文件")

    if not os.path.exists(record.file_path):
        raise HTTPException(status_code=410, detail="文件已被清理，请重新转换")

    return FileResponse(
        path=record.file_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=record.converted_filename,
    )
