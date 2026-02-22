"""
向量存储与检索服务（基于 pgvector）
"""
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.document_chunk import DocumentChunk
from app.models.document_vector import DocumentVector
from app.models.data_source import DataSource
from app.utils.text_splitter import split_text, row_to_text
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


def sync_file_data_source(db: Session, ds: DataSource) -> int:
    """
    同步文件类型数据源：解析文件 → 分块 → 向量化 → 存储
    """
    from app.services.file_processor import extract_texts_from_dir

    if not ds.file_store_dir:
        raise ValueError("file_store_dir 未配置，无法同步文件数据源")

    # 删除旧的分块和向量
    db.query(DocumentChunk).filter(DocumentChunk.data_source_id == ds.id).delete()
    db.commit()

    file_docs = extract_texts_from_dir(ds.file_store_dir)
    logger.info(f"文件数据源 {ds.id}：共找到 {len(file_docs)} 个可解析文件")

    total_chunks = 0
    for doc in file_docs:
        filename = doc["filename"]
        full_text = doc["text"]
        sub_chunks = split_text(full_text, chunk_size=512, chunk_overlap=64)
        logger.info(f"  文件 {filename}：分为 {len(sub_chunks)} 块")

        texts_batch: list = []
        chunks_batch: list = []

        for idx, chunk_text in enumerate(sub_chunks):
            chunk = DocumentChunk(
                data_source_id=ds.id,
                table_name=filename,       # 复用 table_name 存文件名
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

    db.commit()
    return total_chunks


def sync_data_source(db: Session, ds: DataSource) -> int:
    """
    同步数据源：提取数据 → 分块 → 向量化 → 存储
    返回同步的文档块总数
    """
    ds.sync_status = "syncing"
    db.commit()

    try:
        # 文件类型数据源走独立流程
        if ds.db_type == "file":
            total_chunks = sync_file_data_source(db, ds)
        else:
            total_chunks = _sync_database_source(db, ds)

        ds.sync_status = "synced"
        ds.last_synced_at = datetime.now(timezone.utc)
        ds.sync_error = None
        db.commit()

        logger.info(f"DataSource {ds.id} synced: {total_chunks} chunks")
        return total_chunks

    except Exception as e:
        logger.error(f"Sync failed for DataSource {ds.id}: {e}")
        ds.sync_status = "error"
        ds.sync_error = str(e)
        db.commit()
        raise


def _sync_database_source(db: Session, ds: DataSource) -> int:
    """同步数据库类型数据源"""
    from app.services.data_source_service import get_connector

    connector = get_connector(ds)
    connector.connect()

    tables_config = ds.tables_config or []
    if not tables_config:
        # 未配置则同步所有表
        tables = connector.get_tables()
        tables_config = [{"table": t, "columns": None} for t in tables]

    # 删除旧的分块和向量
    db.query(DocumentChunk).filter(DocumentChunk.data_source_id == ds.id).delete()
    db.commit()

    total_chunks = 0
    for table_cfg in tables_config:
        table_name = table_cfg["table"] if isinstance(table_cfg, dict) else table_cfg.table
        columns = table_cfg.get("columns") if isinstance(table_cfg, dict) else table_cfg.columns

        rows = connector.fetch_all_rows(table_name, columns)
        logger.info(f"Table {table_name}: {len(rows)} rows")

        texts_batch: list = []
        chunks_batch: list = []

        for row in rows:
            row_text = row_to_text(table_name, row)
            sub_chunks = split_text(row_text)
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
                db.flush()  # 获取 chunk.id
                chunks_batch.append(chunk)
                texts_batch.append(chunk_text)

        total_chunks += _embed_and_store(db, chunks_batch, texts_batch)

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
    关键词全文检索（PostgreSQL LIKE 精确匹配）
    用于弥补向量检索对专有名词命中不足的缺陷
    """
    if not keywords:
        return []

    filter_clause = f"AND dc.data_source_id = {int(data_source_id)}" if data_source_id else ""
    # 构建多关键词 OR 条件（先转义单引号，再拼入 SQL）
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
            "similarity": 0.99,      # 关键词精确命中给高分
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
    融合向量检索和关键词检索结果（RRF 倒数排名融合）
    关键词命中优先，向量检索补充语义
    """
    seen_ids = set()
    merged = []

    # 1. 先加入关键词命中（精确匹配优先）
    for item in keyword_results:
        cid = item["chunk_id"]
        if cid not in seen_ids:
            item["source"] = item.get("source", "keyword")
            merged.append(item)
            seen_ids.add(cid)

    # 2. 再补充向量检索（按相似度排序）
    for item in sorted(vector_results, key=lambda x: x["similarity"], reverse=True):
        cid = item["chunk_id"]
        if cid not in seen_ids:
            item["source"] = "vector"
            merged.append(item)
            seen_ids.add(cid)

    # 按综合分排序：keyword > vector（同分按相似度）
    merged.sort(key=lambda x: (
        1 if x.get("source") == "keyword" else 0,
        x["similarity"]
    ), reverse=True)

    return merged[:top_k]


def get_max_similarity(results: List[Dict]) -> float:
    """获取检索结果的最高相似度"""
    if not results:
        return 0.0
    return max((r["similarity"] for r in results if r.get("source") != "keyword"), default=0.0)


def search_similar_chunks(
    db: Session,
    query: str,
    top_k: int = 5,
    data_source_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    向量检索相似块
    """
    # 先检查是否有向量数据，避免无意义的查询
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
    # 将向量直接嵌入 SQL（纯数字列表，无注入风险）
    embedding_literal = "[" + ",".join(map(str, query_embedding)) + "]"

    # 构建过滤条件
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
