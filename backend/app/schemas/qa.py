from pydantic import BaseModel
from typing import Optional, List, Any, Dict, Literal
from datetime import datetime


class ConversationTurn(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class AskRequest(BaseModel):
    question: str
    mode: Literal["rag", "chat"] = "rag"   # rag=知识库问答  chat=纯 AI 对话
    data_source_id: Optional[int] = None
    top_k: int = 5
    # 增强检索策略开关（仅 rag 模式生效）
    enable_rewrite: bool = True       # 百炼查询改写 + 关键词提取
    enable_hyde: bool = True          # HyDE 假设文档检索
    enable_sql_fallback: bool = True  # 相似度低时 SQL 兜底
    # 多轮对话历史（按时间顺序，不含当前问题）
    conversation_history: Optional[List[ConversationTurn]] = []


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
