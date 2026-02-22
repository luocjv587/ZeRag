from sqlalchemy import Column, Integer, Text, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from app.database.connection import Base


class QAHistory(Base):
    __tablename__ = "qa_history"

    id = Column(Integer, primary_key=True, index=True)
    # 发起问答的用户（NULL 为历史遗留记录，管理员可见）
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    data_source_id = Column(Integer, ForeignKey("data_sources.id", ondelete="SET NULL"), nullable=True)
    # 检索到的相关块 ID 列表及相似度
    retrieved_chunks = Column(JSON, nullable=True)
    # 使用的 LLM 模型等信息
    llm_config = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
