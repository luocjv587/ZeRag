from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database.connection import Base


class PdfConvertHistory(Base):
    """PDF 转 Word 历史记录"""
    __tablename__ = "pdf_convert_history"

    id = Column(Integer, primary_key=True, index=True)
    # 操作用户
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    # 原始 PDF 文件名（展示用）
    original_filename = Column(String(500), nullable=False)
    # 生成的 .docx 文件名（展示用，含 .docx 后缀）
    converted_filename = Column(String(500), nullable=False)
    # 服务器上的存储路径（用于重复下载）
    file_path = Column(String(1000), nullable=False)
    # 文件大小（字节）
    file_size = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
