"""add file datasource columns

Revision ID: 002
Revises: 001
Create Date: 2026-02-22

新增字段：
  - data_sources.file_store_dir  文件存储目录
  - data_sources.uploaded_files  已上传文件列表（JSON）
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '002'
down_revision = None   # 如果有前置迁移，改为对应 ID
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 检查列是否已存在，不重复添加
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_cols = [c["name"] for c in inspector.get_columns("data_sources")]

    if "file_store_dir" not in existing_cols:
        op.add_column(
            "data_sources",
            sa.Column("file_store_dir", sa.String(500), nullable=True),
        )
    if "uploaded_files" not in existing_cols:
        op.add_column(
            "data_sources",
            sa.Column("uploaded_files", sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("data_sources", "uploaded_files")
    op.drop_column("data_sources", "file_store_dir")
