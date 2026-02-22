"""add web_urls column to data_sources

Revision ID: 006
Revises: 005
Create Date: 2026-02-22

新增字段：
  - data_sources.web_urls  网络数据源的 URL 列表（JSON）
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_cols = [c["name"] for c in inspector.get_columns("data_sources")]

    if "web_urls" not in existing_cols:
        op.add_column(
            "data_sources",
            sa.Column("web_urls", sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("data_sources", "web_urls")
