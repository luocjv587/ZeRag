from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class AskRequest(BaseModel):
    question: str
    data_source_id: Optional[int] = None
    top_k: int = 5
    # 增强检索策略开关
    enable_rewrite: bool = True       # 百炼查询改写 + 关键词提取
    enable_hyde: bool = True          # HyDE 假设文档检索
    enable_sql_fallback: bool = True  # 相似度低时 SQL 兜底


class AskResponse(BaseModel):
    question: str
    answer: str
    retrieved_chunks: List[Any] = []
    data_source_id: Optional[int] = None
    pipeline_log: Optional[List[Any]] = None   # 流水线调试信息


class QAHistoryResponse(BaseModel):
    id: int
    question: str
    answer: str
    data_source_id: Optional[int] = None
    retrieved_chunks: Optional[Any] = None
    created_at: datetime

    class Config:
        from_attributes = True
