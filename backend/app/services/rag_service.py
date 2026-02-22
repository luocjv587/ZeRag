"""
RAG 核心服务（增强版 v2）
流水线：
  1. 百炼查询改写 + 关键词提取
  2. HyDE 假设文档生成
  3. 多路检索融合
     - 向量检索（原始查询 + 改写变体 + HyDE 向量）
     - BM25 检索（jieba 分词，替代原 ILIKE 关键词匹配）
  4. Reranker 重排序（Cross-Encoder 精细打分）
  5. SQL 兜底（相似度过低时，百炼生成 SQL 直接查源库）
  6. 最终回答生成（支持流式输出 & 多轮对话）
  7. 结果缓存（相同问题 + 数据源版本未变 → 直接返回缓存）
"""
from typing import Optional, List, Dict, Any, Generator
from sqlalchemy.orm import Session

from app.services.vector_store_service import (
    search_similar_chunks,
    keyword_search,
    merge_results,
    get_max_similarity,
)
from app.services.embedding_service import embed_query
from app.services.llm_service import (
    chat_completion,
    chat_completion_stream,
    rewrite_query,
    generate_hyde_document,
    generate_sql_query,
)
from app.services.data_source_service import get_connector, get_data_source
from app.models.qa_history import QAHistory
from app.utils.logger import logger
from app.config import settings

# 相似度低于此阈值时触发 SQL 兜底
SIMILARITY_THRESHOLD = 0.45

SYSTEM_PROMPT = """你是一个智能知识库问答助手（ZeRag）。
用户会向你提问，你需要根据下方提供的【知识库内容片段】来回答问题。
内容可能来自数据库记录或上传的文档（PDF、Word、PPT 等）。
如果片段中没有相关信息，请如实告知，不要编造。
回答要简洁、准确、专业。"""

CHAT_SYSTEM_PROMPT = """你是 ZeRag 的 AI 助手，一个聪明、友好、知识渊博的对话伙伴。
你可以回答各种问题、帮助分析问题、进行创意写作、代码编写等。
请根据对话上下文给出准确、有帮助的回答。"""


def build_context(chunks: List[Dict[str, Any]], sql_rows: Optional[List[Dict]] = None) -> str:
    parts = []

    if chunks:
        for i, chunk in enumerate(chunks, 1):
            source = chunk.get("source", "vector")
            if source == "bm25":
                src_label = f"BM25命中 {chunk.get('bm25_score', 0):.2f}"
            elif source == "keyword":
                src_label = "关键词命中"
            else:
                src_label = f"语义相似 {chunk['similarity']:.0%}"

            if chunk.get("rerank_score") is not None:
                src_label += f" | Rerank {chunk['rerank_score']:.3f}"

            source_label = chunk.get("table_name") or "未知来源"
            parts.append(f"[片段{i}·{src_label}] 来源：{source_label}\n{chunk['chunk_text']}\n")

    if sql_rows:
        parts.append("[SQL直接查询结果]")
        for row in sql_rows[:10]:
            parts.append("  " + "，".join(f"{k}={v}" for k, v in row.items()))

    return "\n".join(parts) if parts else "（未检索到相关内容）"


def _run_sql_fallback(
    db: Session,
    question: str,
    data_source_id: int,
) -> List[Dict]:
    """SQL 兜底：百炼生成 SQL → 在源库执行 → 返回结果行"""
    ds = get_data_source(db, data_source_id)
    if not ds:
        return []

    try:
        connector = get_connector(ds)
        connector.connect()

        tables = connector.get_tables()
        schemas = []
        for table in tables[:20]:
            try:
                cols = connector.get_columns(table)
                schemas.append({"table": table, "columns": cols})
            except Exception:
                pass

        connector.close()
    except Exception as e:
        logger.error(f"SQL fallback schema fetch failed: {e}")
        return []

    db_type = ds.db_type
    sql = generate_sql_query(question, schemas, db_type)
    if not sql:
        logger.info("SQL generation returned nothing")
        return []

    logger.info(f"SQL fallback generated: {sql}")

    try:
        connector = get_connector(ds)
        connector.connect()

        rows = []
        if ds.db_type == "mysql":
            import pymysql.cursors
            with connector._conn.cursor(pymysql.cursors.DictCursor) as cur:
                cur.execute(sql)
                rows = list(cur.fetchall())
        elif ds.db_type == "postgresql":
            import psycopg2.extras
            with connector._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql)
                rows = [dict(r) for r in cur.fetchall()]
        elif ds.db_type == "sqlite":
            import sqlite3
            connector._conn.row_factory = sqlite3.Row
            cur = connector._conn.cursor()
            cur.execute(sql)
            rows = [dict(r) for r in cur.fetchall()]

        connector.close()
        logger.info(f"SQL fallback got {len(rows)} rows")
        return rows

    except Exception as e:
        logger.error(f"SQL fallback execution failed: {e}")
        try:
            connector.close()
        except Exception:
            pass
        return []


def _run_retrieval(
    db: Session,
    question: str,
    data_source_id: Optional[int],
    top_k: int,
    enable_rewrite: bool,
    enable_hyde: bool,
    enable_sql_fallback: bool,
) -> tuple:
    """
    执行 RAG 检索流水线，返回 (context, sql_used, pipeline_log, final_chunks)
    """
    pipeline_log = []

    # ── Step 1：查询改写 + 关键词提取 ─────────────────────────
    keywords = [question]
    query_variants = [question]
    hyde_hint = question

    if enable_rewrite:
        try:
            rewrite_result = rewrite_query(question)
            keywords = rewrite_result.get("keywords", [question])
            query_variants = rewrite_result.get("queries", [question])
            hyde_hint = rewrite_result.get("hyde_hint", question)
            pipeline_log.append({
                "step": "query_rewrite",
                "keywords": keywords,
                "variants": query_variants,
            })
            logger.info(f"Query rewritten → keywords={keywords}, variants={query_variants}")
        except Exception as e:
            logger.warning(f"Query rewrite failed: {e}")

    # ── Step 2：多路向量检索 ──────────────────────────────────
    # 召回候选池：top_k * MULTIPLIER（留给 Reranker 更多候选）
    multiplier = settings.RERANKER_CANDIDATE_MULTIPLIER if settings.ENABLE_RERANKER else 1
    retrieval_top_k = top_k * multiplier

    all_vector_results = []
    seen_chunk_ids = set()

    orig_results = search_similar_chunks(db, question, top_k=retrieval_top_k, data_source_id=data_source_id)
    for r in orig_results:
        if r["chunk_id"] not in seen_chunk_ids:
            all_vector_results.append(r)
            seen_chunk_ids.add(r["chunk_id"])

    for variant in query_variants[:2]:
        if variant == question:
            continue
        variant_results = search_similar_chunks(db, variant, top_k=retrieval_top_k, data_source_id=data_source_id)
        for r in variant_results:
            if r["chunk_id"] not in seen_chunk_ids:
                all_vector_results.append(r)
                seen_chunk_ids.add(r["chunk_id"])

    if enable_hyde:
        try:
            hyde_doc = generate_hyde_document(question, hyde_hint)
            pipeline_log.append({"step": "hyde", "document": hyde_doc[:80]})
            hyde_results = search_similar_chunks(db, hyde_doc, top_k=retrieval_top_k, data_source_id=data_source_id)
            for r in hyde_results:
                if r["chunk_id"] not in seen_chunk_ids:
                    r["source"] = "hyde"
                    all_vector_results.append(r)
                    seen_chunk_ids.add(r["chunk_id"])
        except Exception as e:
            logger.warning(f"HyDE failed: {e}")

    # ── Step 3：BM25 检索（替代旧版 ILIKE 关键词匹配）────────
    bm25_results = []
    if data_source_id:
        try:
            from app.services.bm25_service import bm25_search
            bm25_query = " ".join(keywords)
            bm25_results = bm25_search(db, bm25_query, data_source_id, top_k=retrieval_top_k)
            pipeline_log.append({
                "step": "bm25_search",
                "hits": len(bm25_results),
                "query": bm25_query[:50],
            })
            logger.info(f"BM25: {len(bm25_results)} hits")
        except Exception as e:
            logger.warning(f"BM25 search failed, falling back to ILIKE: {e}")
            bm25_results = keyword_search(db, keywords, top_k=retrieval_top_k, data_source_id=data_source_id)
    else:
        # 无特定数据源时，使用 ILIKE 全库搜索
        bm25_results = keyword_search(db, keywords, top_k=retrieval_top_k, data_source_id=data_source_id)
        pipeline_log.append({"step": "keyword_search", "hits": len(bm25_results)})

    # ── Step 4：融合结果 ──────────────────────────────────────
    # 此时候选池可能多达 top_k * multiplier * N 条，交给 Reranker 精选
    candidate_chunks = merge_results(all_vector_results, bm25_results, top_k=retrieval_top_k * 2)

    max_sim = get_max_similarity(candidate_chunks)
    pipeline_log.append({
        "step": "merge",
        "candidates": len(candidate_chunks),
        "max_similarity": round(max_sim, 3),
        "bm25_hits": len(bm25_results),
    })
    logger.info(f"Merged: {len(candidate_chunks)} candidates, max_sim={max_sim:.3f}")

    # ── Step 5：Reranker 重排序 ───────────────────────────────
    if settings.ENABLE_RERANKER and candidate_chunks:
        try:
            from app.services.reranker_service import rerank
            final_chunks = rerank(question, candidate_chunks, top_k=top_k)
            pipeline_log.append({
                "step": "rerank",
                "input": len(candidate_chunks),
                "output": len(final_chunks),
            })
        except Exception as e:
            logger.error(f"Reranker failed: {e}, using merged results")
            final_chunks = candidate_chunks[:top_k]
    else:
        final_chunks = candidate_chunks[:top_k]

    # ── Step 6：SQL 兜底 ──────────────────────────────────────
    sql_rows = []
    sql_used = False
    no_bm25_hit = len(bm25_results) == 0
    low_similarity = max_sim < SIMILARITY_THRESHOLD
    ds_for_fallback = get_data_source(db, data_source_id) if data_source_id else None
    is_file_ds = ds_for_fallback and ds_for_fallback.db_type == "file"

    if enable_sql_fallback and data_source_id and no_bm25_hit and low_similarity and not is_file_ds:
        logger.info(f"Triggering SQL fallback (max_sim={max_sim:.3f}, no BM25 hit)")
        pipeline_log.append({"step": "sql_fallback", "reason": f"max_sim={max_sim:.3f}"})
        sql_rows = _run_sql_fallback(db, question, data_source_id)
        if sql_rows:
            sql_used = True

    context = build_context(final_chunks, sql_rows if sql_used else None)
    return context, sql_used, pipeline_log, final_chunks


def _build_messages(
    question: str,
    context: str,
    conversation_history: Optional[List[Dict]] = None,
) -> List[Dict[str, str]]:
    """构建发给 LLM 的 messages 列表，注入对话历史（多轮对话支持）"""
    messages: List[Dict[str, str]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
    ]

    if conversation_history:
        for turn in conversation_history[-10:]:
            role = turn.get("role", "user")
            content = turn.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})

    user_message = f"""【知识库内容片段】
{context}

【用户问题】
{question}"""
    messages.append({"role": "user", "content": user_message})
    return messages


def ask(
    db: Session,
    question: str,
    data_source_id: Optional[int] = None,
    top_k: int = 5,
    model: str = "qwen-turbo",
    enable_rewrite: bool = True,
    enable_hyde: bool = True,
    enable_sql_fallback: bool = True,
    user_id: Optional[int] = None,
    conversation_history: Optional[List[Dict]] = None,
) -> Dict[str, Any]:
    """
    增强版 RAG 问答主流程（支持多轮对话 + 结果缓存）
    """
    logger.info(f"RAG ask: {question}")

    # ── 结果缓存：命中则直接返回 ─────────────────────────────
    # 注意：只有无对话历史时才走缓存（多轮对话上下文会影响答案）
    if not conversation_history:
        try:
            from app.services.cache_service import get_cached_result, set_cached_result
            cached = get_cached_result(question, data_source_id, top_k)
            if cached is not None:
                logger.info(f"Result cache hit: '{question[:40]}'")
                return cached
        except Exception as e:
            logger.warning(f"Cache check failed: {e}")

    # ── 检索流水线 ─────────────────────────────────────────────
    context, sql_used, pipeline_log, final_chunks = _run_retrieval(
        db, question, data_source_id, top_k, enable_rewrite, enable_hyde, enable_sql_fallback
    )

    messages = _build_messages(question, context, conversation_history)
    answer = chat_completion(messages, model=model)

    # ── 记录问答历史 ──────────────────────────────────────────
    history = QAHistory(
        user_id=user_id,
        question=question,
        answer=answer,
        data_source_id=data_source_id,
        retrieved_chunks=[
            {
                "chunk_id": c["chunk_id"],
                "similarity": c["similarity"],
                "table_name": c["table_name"],
                "source": c.get("source", "vector"),
                "rerank_score": c.get("rerank_score"),
            }
            for c in final_chunks
        ],
        llm_config={
            "model": model,
            "pipeline": pipeline_log,
            "sql_fallback_used": sql_used,
            "has_history": bool(conversation_history),
            "reranker_enabled": settings.ENABLE_RERANKER,
        },
    )
    db.add(history)
    db.commit()

    result = {
        "question": question,
        "answer": answer,
        "retrieved_chunks": final_chunks,
        "data_source_id": data_source_id,
        "pipeline_log": pipeline_log,
    }

    # ── 写入结果缓存 ──────────────────────────────────────────
    if not conversation_history:
        try:
            from app.services.cache_service import set_cached_result
            set_cached_result(question, data_source_id, top_k, result)
        except Exception as e:
            logger.warning(f"Cache write failed: {e}")

    return result


def ask_chat(
    db: Session,
    question: str,
    model: str = "qwen-turbo",
    user_id: Optional[int] = None,
    conversation_history: Optional[List[Dict]] = None,
) -> Dict[str, Any]:
    """
    纯 AI 对话模式（无检索）：直接将对话历史 + 当前问题发给 LLM
    """
    logger.info(f"Chat ask: {question}")

    messages: List[Dict[str, str]] = [
        {"role": "system", "content": CHAT_SYSTEM_PROMPT},
    ]
    if conversation_history:
        for turn in conversation_history[-20:]:
            role = turn.get("role", "user")
            content = turn.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": question})

    answer = chat_completion(messages, model=model)

    history = QAHistory(
        user_id=user_id,
        question=question,
        answer=answer,
        data_source_id=None,
        retrieved_chunks=[],
        llm_config={
            "model": model,
            "mode": "chat",
            "has_history": bool(conversation_history),
        },
    )
    db.add(history)
    db.commit()

    return {
        "question": question,
        "answer": answer,
        "retrieved_chunks": [],
        "data_source_id": None,
        "pipeline_log": [],
    }


def ask_chat_stream(
    db: Session,
    question: str,
    model: str = "qwen-turbo",
    user_id: Optional[int] = None,
    conversation_history: Optional[List[Dict]] = None,
) -> Generator[Dict[str, Any], None, None]:
    """
    纯 AI 对话模式（流式）：跳过检索，直接流式输出 LLM 回答
    """
    logger.info(f"Chat ask_stream: {question}")

    messages: List[Dict[str, str]] = [
        {"role": "system", "content": CHAT_SYSTEM_PROMPT},
    ]
    if conversation_history:
        for turn in conversation_history[-20:]:
            role = turn.get("role", "user")
            content = turn.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": question})

    # chat 模式直接跳过检索，发一个空的 retrieval_done 表示流程开始
    yield {"type": "retrieval_done", "chunks": [], "pipeline_log": []}

    full_answer = ""
    try:
        for token in chat_completion_stream(messages, model=model):
            full_answer += token
            yield {"type": "token", "token": token}
    except Exception as e:
        logger.error(f"Chat stream generation failed: {e}")
        yield {"type": "error", "message": str(e)}
        return

    yield {"type": "done", "answer": full_answer}

    try:
        history = QAHistory(
            user_id=user_id,
            question=question,
            answer=full_answer,
            data_source_id=None,
            retrieved_chunks=[],
            llm_config={
                "model": model,
                "mode": "chat",
                "stream": True,
                "has_history": bool(conversation_history),
            },
        )
        db.add(history)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to save chat history: {e}")


def ask_stream(
    db: Session,
    question: str,
    data_source_id: Optional[int] = None,
    top_k: int = 5,
    model: str = "qwen-turbo",
    enable_rewrite: bool = True,
    enable_hyde: bool = True,
    enable_sql_fallback: bool = True,
    user_id: Optional[int] = None,
    conversation_history: Optional[List[Dict]] = None,
) -> Generator[Dict[str, Any], None, None]:
    """
    流式 RAG 问答：先 yield 检索进度，再逐 token yield 答案，最后 yield 完成信号
    """
    logger.info(f"RAG ask_stream: {question}")

    context, sql_used, pipeline_log, final_chunks = _run_retrieval(
        db, question, data_source_id, top_k, enable_rewrite, enable_hyde, enable_sql_fallback
    )

    yield {"type": "retrieval_done", "chunks": final_chunks, "pipeline_log": pipeline_log}

    messages = _build_messages(question, context, conversation_history)

    full_answer = ""
    try:
        for token in chat_completion_stream(messages, model=model):
            full_answer += token
            yield {"type": "token", "token": token}
    except Exception as e:
        logger.error(f"Stream generation failed: {e}")
        yield {"type": "error", "message": str(e)}
        return

    yield {"type": "done", "answer": full_answer}

    try:
        history = QAHistory(
            user_id=user_id,
            question=question,
            answer=full_answer,
            data_source_id=data_source_id,
            retrieved_chunks=[
                {
                    "chunk_id": c["chunk_id"],
                    "similarity": c["similarity"],
                    "table_name": c["table_name"],
                    "source": c.get("source", "vector"),
                    "rerank_score": c.get("rerank_score"),
                }
                for c in final_chunks
            ],
            llm_config={
                "model": model,
                "pipeline": pipeline_log,
                "sql_fallback_used": sql_used,
                "stream": True,
                "has_history": bool(conversation_history),
                "reranker_enabled": settings.ENABLE_RERANKER,
            },
        )
        db.add(history)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to save history: {e}")
