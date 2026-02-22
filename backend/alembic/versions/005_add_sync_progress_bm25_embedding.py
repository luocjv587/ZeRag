"""add sync_progress, BM25 GIN index, and embedding dimension upgrade

Revision ID: 005
Revises: 004
Create Date: 2026-02-22

变更内容：
  1. data_sources.sync_progress     Integer(0~100)，同步百分比进度
  2. document_chunks 全文检索 GIN 索引（PostgreSQL tsvector，加速关键词搜索）
  3. 向量维度升级迁移：
     - 检测当前 document_vectors.embedding 的维度
     - 若与 config.EMBEDDING_DIMENSION（默认 1024）不一致，
       则清空 document_vectors 表并重建 embedding 列为新维度
     - ⚠️  维度变更后所有数据源需要重新同步！
"""
from alembic import op
import sqlalchemy as sa

revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def _get_current_vector_dim(conn) -> int | None:
    """尝试读取当前 embedding 列的向量维度（从 pg_attribute / atttypmod）"""
    try:
        # pgvector 把维度存在 atttypmod 里，atttypmod = dim + 1（内部偏移）
        row = conn.execute(sa.text("""
            SELECT a.atttypmod
            FROM pg_attribute a
            JOIN pg_class c ON c.oid = a.attrelid
            WHERE c.relname = 'document_vectors'
              AND a.attname = 'embedding'
              AND a.attnum > 0
        """)).fetchone()
        if row and row[0] and row[0] > 0:
            return row[0]  # pgvector atttypmod 直接就是维度数
    except Exception:
        pass
    return None


def upgrade() -> None:
    from app.config import settings

    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # ── 1. data_sources.sync_progress ────────────────────────
    ds_cols = [c["name"] for c in inspector.get_columns("data_sources")]
    if "sync_progress" not in ds_cols:
        op.add_column(
            "data_sources",
            sa.Column("sync_progress", sa.Integer(), nullable=True, server_default="0"),
        )
        print("✅ Added data_sources.sync_progress")

    # ── 2. GIN 全文检索索引（document_chunks.chunk_text）──────
    # 使用 'simple' 词典（不做语言特定处理，适合中文 + 英文混合）
    existing_indexes = [idx["name"] for idx in inspector.get_indexes("document_chunks")]
    if "idx_document_chunks_fts" not in existing_indexes:
        conn.execute(sa.text("""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_chunks_fts
            ON document_chunks
            USING GIN (to_tsvector('simple', chunk_text))
        """))
        print("✅ Created GIN full-text index on document_chunks.chunk_text")

    # ── 3. 向量维度升级（如需要）─────────────────────────────
    target_dim = settings.EMBEDDING_DIMENSION
    current_dim = _get_current_vector_dim(conn)

    if current_dim is not None and current_dim != target_dim:
        print(
            f"⚠️  Embedding dimension mismatch: current={current_dim}, target={target_dim}. "
            f"Rebuilding document_vectors table..."
        )
        # 清空旧向量（维度不同，旧向量已无效）
        conn.execute(sa.text("TRUNCATE TABLE document_vectors"))
        # 删除旧 embedding 列
        op.drop_column("document_vectors", "embedding")
        # 重建为新维度
        op.add_column(
            "document_vectors",
            sa.Column("embedding", sa.Text(), nullable=False),   # 临时占位
        )
        # 用原始 SQL 改为 vector(new_dim)
        conn.execute(sa.text(
            f"ALTER TABLE document_vectors "
            f"ALTER COLUMN embedding TYPE vector({target_dim}) "
            f"USING embedding::vector({target_dim})"
        ))
        # 同时将所有数据源的 sync_status 重置为 pending，提示用户重新同步
        conn.execute(sa.text(
            "UPDATE data_sources SET sync_status = 'pending', sync_error = "
            "'Embedding model upgraded, please re-sync this data source.'"
        ))
        print(
            f"✅ Embedding column rebuilt: vector({target_dim}). "
            f"⚠️  All data sources have been reset to 'pending', please re-sync them."
        )
    elif current_dim is None:
        print("ℹ️  Could not detect current vector dimension (table may not exist yet), skipping.")
    else:
        print(f"✅ Embedding dimension already matches target ({target_dim}d), no change needed.")


def downgrade() -> None:
    # 移除 sync_progress（其他变更不可逆）
    op.drop_column("data_sources", "sync_progress")
    # GIN 索引
    op.drop_index("idx_document_chunks_fts", table_name="document_chunks")
