import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database.connection import get_db
from app.schemas.qa import AskRequest, AskResponse, QAHistoryResponse
from app.services.rag_service import ask, ask_stream, ask_chat, ask_chat_stream
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
    if data.mode == "chat":
        result = ask_chat(
            db=db,
            question=data.question,
            user_id=current_user.id,
            conversation_history=history,
        )
    else:
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
        gen = None
        try:
            if data.mode == "chat":
                gen = ask_chat_stream(
                    db=db,
                    question=data.question,
                    user_id=current_user.id,
                    conversation_history=history,
                )
            else:
                gen = ask_stream(
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
            for event in gen:
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except GeneratorExit:
            # 前端主动断开连接：显式关闭下游生成器，确保 dashscope 的 httpx 连接被释放
            if gen is not None:
                gen.close()
            return
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"
        finally:
            # 兜底：确保生成器一定被关闭（释放 dashscope httpx 连接资源）
            if gen is not None:
                gen.close()

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


@router.delete("/history/{history_id}", status_code=204)
def delete_history(
    history_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除单条问答历史"""
    record = db.query(QAHistory).filter(QAHistory.id == history_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    # 非管理员只能删除自己的记录
    if not current_user.is_admin and record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权删除该记录")
    db.delete(record)
    db.commit()


@router.delete("/history", status_code=204)
def clear_history(
    data_source_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """清空问答历史（管理员可清空全部，普通用户只能清空自己的）"""
    query = db.query(QAHistory)
    if not current_user.is_admin:
        query = query.filter(QAHistory.user_id == current_user.id)
    if data_source_id:
        query = query.filter(QAHistory.data_source_id == data_source_id)
    query.delete(synchronize_session=False)
    db.commit()
