"""add chunk_strategy to data_sources

Revision ID: 004
Revises: 003
Create Date: 2026-02-22

新增字段：
  - data_sources.chunk_strategy   文档分块策略（fixed | paragraph | sentence | smart）
"""
from alembic import op
import sqlalchemy as sa

revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    ds_cols = [c["name"] for c in inspector.get_columns("data_sources")]
    if "chunk_strategy" not in ds_cols:
        op.add_column(
            "data_sources",
            sa.Column(
                "chunk_strategy",
                sa.String(50),
                nullable=True,
                server_default="smart",
            ),
        )
        # 为已存在的文件类型数据源设置 smart，数据库类型设置 fixed
        conn.execute(
            sa.text("UPDATE data_sources SET chunk_strategy = 'smart' WHERE db_type = 'file'")
        )
        conn.execute(
            sa.text("UPDATE data_sources SET chunk_strategy = 'fixed' WHERE db_type != 'file'")
        )


def downgrade() -> None:
    op.drop_column("data_sources", "chunk_strategy")
