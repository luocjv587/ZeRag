"""
BM25 检索服务（jieba 分词 + Okapi BM25）

相比 ILIKE 关键词匹配的优势：
  - 考虑词频（TF）与逆文档频率（IDF），避免高频词干扰
  - jieba 分词能正确处理中文，不依赖子串匹配
  - 对专有名词、人名、术语的召回更准确

索引策略：
  - 每个 data_source 对应一个独立的 BM25Okapi 索引
  - 索引惰性构建（首次查询时构建），并缓存到内存
  - 数据源重新同步后自动失效（调用 invalidate_bm25_index）
"""
from __future__ import annotations

from threading import Lock
from typing import Any, Dict, List, Optional

from app.utils.logger import logger

# data_source_id -> {"bm25": BM25Okapi, "chunks": List[Dict]}
_bm25_indexes: Dict[int, Dict] = {}
_index_lock = Lock()


# ─────────────────────────────────────────────────────────────
# 分词
# ─────────────────────────────────────────────────────────────

def tokenize(text: str) -> List[str]:
    """
    jieba 精确模式分词，保留长度 ≥ 1 的 token。
    同时能处理中英文混合文本：英文按空格/jieba 拆分，中文按语义分词。
    """
    try:
        import jieba
        tokens = jieba.cut(text, cut_all=False)
        return [t.strip() for t in tokens if t.strip()]
    except ImportError:
        # jieba 未安装时退化为空格分词
        logger.warning("jieba not installed, falling back to whitespace tokenization")
        return text.split()


# ─────────────────────────────────────────────────────────────
# 索引构建
# ─────────────────────────────────────────────────────────────

def build_bm25_index(db, data_source_id: int) -> None:
    """
    从数据库 document_chunks 表构建指定数据源的 BM25 索引。
    构建完成后缓存到内存，下次查询直接复用。
    """
    from rank_bm25 import BM25Okapi
    from app.models.document_chunk import DocumentChunk

    chunks = (
        db.query(DocumentChunk)
        .filter(DocumentChunk.data_source_id == data_source_id)
        .all()
    )

    if not chunks:
        with _index_lock:
            _bm25_indexes[data_source_id] = {"bm25": None, "chunks": []}
        logger.info(f"BM25: no chunks found for datasource {data_source_id}")
        return

    chunk_dicts = [
        {
            "chunk_id": c.id,
            "chunk_text": c.chunk_text,
            "table_name": c.table_name,
            "row_id": c.row_id,
            "data_source_id": c.data_source_id,
        }
        for c in chunks
    ]

    corpus = [tokenize(c["chunk_text"]) for c in chunk_dicts]
    bm25 = BM25Okapi(corpus)

    with _index_lock:
        _bm25_indexes[data_source_id] = {"bm25": bm25, "chunks": chunk_dicts}

    logger.info(
        f"BM25 index built for datasource {data_source_id}: "
        f"{len(chunks)} chunks, vocab_size={len(bm25.idf)}"
    )


def invalidate_bm25_index(data_source_id: int) -> None:
    """数据源重新同步后调用，清除旧的 BM25 索引缓存"""
    with _index_lock:
        if data_source_id in _bm25_indexes:
            del _bm25_indexes[data_source_id]
    logger.info(f"BM25 index invalidated for datasource {data_source_id}")


# ─────────────────────────────────────────────────────────────
# 检索
# ─────────────────────────────────────────────────────────────

def bm25_search(
    db,
    query: str,
    data_source_id: Optional[int],
    top_k: int = 10,
) -> List[Dict[str, Any]]:
    """
    BM25 检索。

    返回格式与 vector_store_service.keyword_search 兼容，
    每条结果包含：chunk_id / chunk_text / table_name / row_id /
               data_source_id / similarity / source="bm25" / bm25_score
    """
    if data_source_id is None:
        return []

    # 确保索引已构建
    with _index_lock:
        index_exists = data_source_id in _bm25_indexes

    if not index_exists:
        build_bm25_index(db, data_source_id)

    with _index_lock:
        index_data = _bm25_indexes.get(data_source_id, {})

    bm25 = index_data.get("bm25")
    chunk_list: List[Dict] = index_data.get("chunks", [])

    if bm25 is None or not chunk_list:
        return []

    query_tokens = tokenize(query)
    if not query_tokens:
        return []

    scores = bm25.get_scores(query_tokens)

    # 取候选：至多 top_k * 2，过滤掉分数为 0 的
    indexed = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
    max_score = scores[indexed[0]] if indexed else 1.0

    results: List[Dict] = []
    for idx in indexed[: top_k * 2]:
        if scores[idx] <= 0:
            break
        chunk = chunk_list[idx].copy()
        chunk["bm25_score"] = float(scores[idx])
        # 归一化到 (0, 0.99]，用于与向量相似度在同一量纲比较
        chunk["similarity"] = float(min(scores[idx] / (max_score + 1e-9) * 0.99, 0.99))
        chunk["source"] = "bm25"
        results.append(chunk)

    logger.info(
        f"BM25 search: query='{query[:30]}', datasource={data_source_id}, "
        f"hits={len(results)}, top_score={round(max_score, 3)}"
    )
    return results[:top_k]
