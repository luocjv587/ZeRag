"""
向量存储与检索服务（基于 pgvector）

优化：
  - sync 完成后调用 invalidate_bm25_index + bump_ds_version，使 BM25 和结果缓存失效
  - 同步过程中写入 sync_progress（0~100），前端可轮询显示进度条
  - 保留原有 keyword_search（ILIKE）作为无 data_source_id 时的全局搜索兜底
"""
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.document_chunk import DocumentChunk
from app.models.document_vector import DocumentVector
from app.models.data_source import DataSource
from app.utils.text_splitter import split_text, split_text_by_strategy, row_to_text
from app.services.embedding_service import embed_texts, embed_query
from app.utils.logger import logger
from datetime import datetime, timezone


def _embed_and_store(db: Session, chunks_batch: list, texts_batch: list) -> int:
    """批量向量化并写入数据库，返回写入数量"""
    if not texts_batch:
        return 0
    embeddings = embed_texts(texts_batch)
    for chunk, embedding in zip(chunks_batch, embeddings):
        vec = DocumentVector(
            chunk_id=chunk.id,
            embedding=embedding,
            metadata_=chunk.metadata_,
        )
        db.add(vec)
    return len(chunks_batch)


def _update_sync_progress(db: Session, ds: DataSource, progress: int) -> None:
    """更新数据源的同步进度（0~100）"""
    try:
        ds.sync_progress = max(0, min(100, progress))
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to update sync_progress: {e}")
        db.rollback()


def sync_file_data_source(db: Session, ds: DataSource) -> int:
    """
    同步文件类型数据源：解析文件 → 分块 → 向量化 → 存储
    """
    from app.services.file_processor import extract_texts_from_dir

    if not ds.file_store_dir:
        raise ValueError("file_store_dir 未配置，无法同步文件数据源")

    _update_sync_progress(db, ds, 5)

    # 删除旧的分块和向量
    db.query(DocumentChunk).filter(DocumentChunk.data_source_id == ds.id).delete()
    db.commit()

    file_docs = extract_texts_from_dir(ds.file_store_dir)
    logger.info(f"文件数据源 {ds.id}：共找到 {len(file_docs)} 个可解析文件")

    strategy = getattr(ds, "chunk_strategy", None) or "smart"
    logger.info(f"文件数据源 {ds.id}：使用分块策略 '{strategy}'")

    total_chunks = 0
    for file_idx, doc in enumerate(file_docs):
        filename = doc["filename"]
        full_text = doc["text"]
        sub_chunks = split_text_by_strategy(full_text, strategy=strategy, chunk_size=512, chunk_overlap=64)
        logger.info(f"  文件 {filename}：分为 {len(sub_chunks)} 块（策略: {strategy}）")

        texts_batch: list = []
        chunks_batch: list = []

        for idx, chunk_text in enumerate(sub_chunks):
            chunk = DocumentChunk(
                data_source_id=ds.id,
                table_name=filename,
                row_id=str(idx),
                chunk_text=chunk_text,
                chunk_index=idx,
                metadata_={"filename": filename, "chunk_index": idx},
            )
            db.add(chunk)
            db.flush()
            chunks_batch.append(chunk)
            texts_batch.append(chunk_text)

        total_chunks += _embed_and_store(db, chunks_batch, texts_batch)

        # 更新进度：文件处理完成比例（10%~90% 区间）
        progress = 10 + int(80 * (file_idx + 1) / max(len(file_docs), 1))
        _update_sync_progress(db, ds, progress)

    db.commit()
    return total_chunks


def sync_data_source(db: Session, ds: DataSource) -> int:
    """
    同步数据源：提取数据 → 分块 → 向量化 → 存储
    返回同步的文档块总数

    同步完成后自动：
      - 失效该数据源的 BM25 索引缓存
      - 失效该数据源的 RAG 结果缓存（通过版本号 bump）
    """
    ds.sync_status = "syncing"
    ds.sync_progress = 0
    db.commit()

    try:
        if ds.db_type == "file":
            total_chunks = sync_file_data_source(db, ds)
        else:
            total_chunks = _sync_database_source(db, ds)

        ds.sync_status = "synced"
        ds.sync_progress = 100
        ds.last_synced_at = datetime.now(timezone.utc)
        ds.sync_error = None
        db.commit()

        logger.info(f"DataSource {ds.id} synced: {total_chunks} chunks")

        # ── 缓存失效 ──────────────────────────────────────────
        try:
            from app.services.bm25_service import invalidate_bm25_index
            invalidate_bm25_index(ds.id)
        except Exception as e:
            logger.warning(f"BM25 cache invalidation failed: {e}")

        try:
            from app.services.cache_service import bump_ds_version
            bump_ds_version(ds.id)
        except Exception as e:
            logger.warning(f"Result cache bump failed: {e}")

        return total_chunks

    except Exception as e:
        logger.error(f"Sync failed for DataSource {ds.id}: {e}")
        ds.sync_status = "error"
        ds.sync_error = str(e)
        ds.sync_progress = 0
        db.commit()
        raise


def _sync_database_source(db: Session, ds: DataSource) -> int:
    """同步数据库类型数据源"""
    from app.services.data_source_service import get_connector

    _update_sync_progress(db, ds, 5)

    connector = get_connector(ds)
    connector.connect()

    tables_config = ds.tables_config or []
    if not tables_config:
        tables = connector.get_tables()
        tables_config = [{"table": t, "columns": None} for t in tables]

    # 删除旧的分块和向量
    db.query(DocumentChunk).filter(DocumentChunk.data_source_id == ds.id).delete()
    db.commit()

    total_chunks = 0
    strategy = getattr(ds, "chunk_strategy", None) or "fixed"

    for table_idx, table_cfg in enumerate(tables_config):
        table_name = table_cfg["table"] if isinstance(table_cfg, dict) else table_cfg.table
        columns = table_cfg.get("columns") if isinstance(table_cfg, dict) else table_cfg.columns

        rows = connector.fetch_all_rows(table_name, columns)
        logger.info(f"Table {table_name}: {len(rows)} rows")

        texts_batch: list = []
        chunks_batch: list = []

        for row in rows:
            row_text = row_to_text(table_name, row)
            sub_chunks = split_text_by_strategy(row_text, strategy=strategy)
            row_id = str(row.get("id", ""))

            for idx, chunk_text in enumerate(sub_chunks):
                chunk = DocumentChunk(
                    data_source_id=ds.id,
                    table_name=table_name,
                    row_id=row_id,
                    chunk_text=chunk_text,
                    chunk_index=idx,
                    metadata_={"table": table_name, "row_id": row_id},
                )
                db.add(chunk)
                db.flush()
                chunks_batch.append(chunk)
                texts_batch.append(chunk_text)

        total_chunks += _embed_and_store(db, chunks_batch, texts_batch)

        # 更新进度（10%~90%）
        progress = 10 + int(80 * (table_idx + 1) / max(len(tables_config), 1))
        _update_sync_progress(db, ds, progress)

    db.commit()
    connector.close()
    return total_chunks


def keyword_search(
    db: Session,
    keywords: List[str],
    top_k: int = 5,
    data_source_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    关键词全文检索（PostgreSQL ILIKE 精确匹配）。
    当 data_source_id 有值时，优先使用 bm25_service.bm25_search；
    此函数作为全局搜索（无数据源限定）的兜底。
    """
    if not keywords:
        return []

    filter_clause = f"AND dc.data_source_id = {int(data_source_id)}" if data_source_id else ""
    kw_conditions = " OR ".join([
        "dc.chunk_text ILIKE '%" + kw.replace("'", "''") + "%'"
        for kw in keywords
    ])

    sql = text(f"""
        SELECT DISTINCT
            dc.id AS chunk_id,
            dc.chunk_text,
            dc.table_name,
            dc.row_id,
            dc.data_source_id
        FROM document_chunks dc
        WHERE ({kw_conditions}) {filter_clause}
        LIMIT {int(top_k * 2)}
    """)

    try:
        rows = db.execute(sql).fetchall()
    except Exception as e:
        logger.error(f"Keyword search failed: {e}")
        db.rollback()
        return []

    return [
        {
            "chunk_id": row.chunk_id,
            "chunk_text": row.chunk_text,
            "table_name": row.table_name,
            "row_id": row.row_id,
            "data_source_id": row.data_source_id,
            "similarity": 0.99,
            "source": "keyword",
        }
        for row in rows
    ]


def merge_results(
    vector_results: List[Dict],
    keyword_results: List[Dict],
    top_k: int = 5,
) -> List[Dict]:
    """
    融合向量检索和关键词/BM25 检索结果。
    精确/BM25 命中优先，向量检索补充语义。
    """
    seen_ids = set()
    merged = []

    # 1. 精确匹配 / BM25 结果优先
    for item in keyword_results:
        cid = item["chunk_id"]
        if cid not in seen_ids:
            item.setdefault("source", "keyword")
            merged.append(item)
            seen_ids.add(cid)

    # 2. 向量检索补充（按相似度排序）
    for item in sorted(vector_results, key=lambda x: x["similarity"], reverse=True):
        cid = item["chunk_id"]
        if cid not in seen_ids:
            item["source"] = "vector"
            merged.append(item)
            seen_ids.add(cid)

    # 综合排序：精确/BM25 > vector，同优先级按 similarity 排
    merged.sort(key=lambda x: (
        0 if x.get("source") == "vector" else 1,
        x["similarity"],
    ), reverse=True)

    return merged[:top_k]


def get_max_similarity(results: List[Dict]) -> float:
    """获取向量检索结果的最高相似度（关键词/BM25 来源不参与判断）"""
    if not results:
        return 0.0
    return max(
        (r["similarity"] for r in results if r.get("source") == "vector"),
        default=0.0,
    )


def search_similar_chunks(
    db: Session,
    query: str,
    top_k: int = 5,
    data_source_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """向量检索相似块"""
    count_filter = ""
    if data_source_id:
        count_filter = f"WHERE dc.data_source_id = {int(data_source_id)}"

    count_sql = text(f"""
        SELECT COUNT(*) FROM document_vectors dv
        JOIN document_chunks dc ON dc.id = dv.chunk_id
        {count_filter}
    """)
    try:
        total = db.execute(count_sql).scalar()
    except Exception:
        db.rollback()
        total = 0

    if not total:
        logger.info("No vectors found, skipping similarity search")
        return []

    query_embedding = embed_query(query)
    embedding_literal = "[" + ",".join(map(str, query_embedding)) + "]"

    filter_clause = ""
    if data_source_id:
        filter_clause = f"AND dc.data_source_id = {int(data_source_id)}"

    sql = text(f"""
        SELECT
            dc.id AS chunk_id,
            dc.chunk_text,
            dc.table_name,
            dc.row_id,
            dc.data_source_id,
            1 - (dv.embedding <=> '{embedding_literal}'::vector) AS similarity
        FROM document_vectors dv
        JOIN document_chunks dc ON dc.id = dv.chunk_id
        WHERE 1=1 {filter_clause}
        ORDER BY dv.embedding <=> '{embedding_literal}'::vector
        LIMIT {int(top_k)}
    """)

    try:
        result = db.execute(sql)
        rows = result.fetchall()
    except Exception as e:
        logger.error(f"Vector search failed: {e}")
        db.rollback()
        return []

    return [
        {
            "chunk_id": row.chunk_id,
            "chunk_text": row.chunk_text,
            "table_name": row.table_name,
            "row_id": row.row_id,
            "data_source_id": row.data_source_id,
            "similarity": float(row.similarity),
        }
        for row in rows
    ]
