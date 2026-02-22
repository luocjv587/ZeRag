import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database.connection import get_db
from app.schemas.qa import AskRequest, AskResponse, QAHistoryResponse
from app.services.rag_service import ask, ask_stream
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
    history = [h.model_dump() for h in (data.conversation_history or [])]
    result = ask(
        db=db,
        question=data.question,
        data_source_id=data.data_source_id,
        top_k=data.top_k,
        enable_rewrite=data.enable_rewrite,
        enable_hyde=data.enable_hyde,
        enable_sql_fallback=data.enable_sql_fallback,
        user_id=current_user.id,
        conversation_history=history,
    )
    return AskResponse(**result)


@router.post("/ask/stream")
def ask_question_stream(
    data: AskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    流式问答接口（Server-Sent Events）
    事件格式：data: <json>\\n\\n
    事件类型：
      - retrieval_done  检索完成，包含 chunks 和 pipeline_log
      - token           LLM 生成的单个文本片段
      - done            生成结束，包含完整 answer
      - error           发生错误
    """
    history = [h.model_dump() for h in (data.conversation_history or [])]

    def event_generator():
        try:
            for event in ask_stream(
                db=db,
                question=data.question,
                data_source_id=data.data_source_id,
                top_k=data.top_k,
                enable_rewrite=data.enable_rewrite,
                enable_hyde=data.enable_hyde,
                enable_sql_fallback=data.enable_sql_fallback,
                user_id=current_user.id,
                conversation_history=history,
            ):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


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
