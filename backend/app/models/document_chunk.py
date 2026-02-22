from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database.connection import Base


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    data_source_id = Column(Integer, ForeignKey("data_sources.id", ondelete="CASCADE"), nullable=False, index=True)
    # 来源表名
    table_name = Column(String(255), nullable=True)
    # 来源行 ID（字符串化）
    row_id = Column(String(255), nullable=True)
    # 分块文本内容
    chunk_text = Column(Text, nullable=False)
    # 块序号（同一行可能分多块）
    chunk_index = Column(Integer, default=0)
    # 额外元数据
    metadata_ = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 关系
    data_source = relationship("DataSource", backref="chunks")
    vector = relationship("DocumentVector", back_populates="chunk", uselist=False, cascade="all, delete-orphan")
