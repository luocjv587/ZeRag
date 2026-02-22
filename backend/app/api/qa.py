from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database.connection import get_db
from app.schemas.qa import AskRequest, AskResponse, QAHistoryResponse
from app.services.rag_service import ask
from app.models.qa_history import QAHistory
from app.middleware.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/v1/qa", tags=["智能问答"])


@router.post("/ask", response_model=AskResponse)
def ask_question(
    data: AskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = ask(
        db=db,
        question=data.question,
        data_source_id=data.data_source_id,
        top_k=data.top_k,
        enable_rewrite=data.enable_rewrite,
        enable_hyde=data.enable_hyde,
        enable_sql_fallback=data.enable_sql_fallback,
        user_id=current_user.id,
    )
    return AskResponse(**result)


@router.get("/history", response_model=List[QAHistoryResponse])
def get_history(
    limit: int = 50,
    data_source_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(QAHistory).order_by(QAHistory.created_at.desc())

    # 非管理员只能看到自己的历史（含 user_id=NULL 的历史遗留记录归管理员）
    if not current_user.is_admin:
        query = query.filter(QAHistory.user_id == current_user.id)

    if data_source_id:
        query = query.filter(QAHistory.data_source_id == data_source_id)

    return query.limit(limit).all()
