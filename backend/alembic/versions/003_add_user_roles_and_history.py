"""add user roles, owner_id, user_id, pdf_convert_history

Revision ID: 003
Revises: 002
Create Date: 2026-02-22

新增字段 / 新建表：
  - users.is_admin                      用户是否为超管
  - data_sources.owner_id               数据源创建者（外键 → users.id）
  - qa_history.user_id                  问答记录所属用户（外键 → users.id）
  - pdf_convert_history                 PDF 转 Word 历史记录表（新建）
"""
from alembic import op
import sqlalchemy as sa

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # ── users.is_admin ────────────────────────────────────────────────────────
    user_cols = [c["name"] for c in inspector.get_columns("users")]
    if "is_admin" not in user_cols:
        op.add_column(
            "users",
            sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false"),
        )
        # 已存在的 admin 账号升级为超管（按 DEFAULT_ADMIN_USERNAME 默认值 "admin"）
        conn.execute(sa.text("UPDATE users SET is_admin = true WHERE username = 'admin'"))

    # ── data_sources.owner_id ─────────────────────────────────────────────────
    ds_cols = [c["name"] for c in inspector.get_columns("data_sources")]
    if "owner_id" not in ds_cols:
        op.add_column(
            "data_sources",
            sa.Column("owner_id", sa.Integer(), nullable=True),
        )
        op.create_index("ix_data_sources_owner_id", "data_sources", ["owner_id"])
        op.create_foreign_key(
            "fk_data_sources_owner_id",
            "data_sources", "users",
            ["owner_id"], ["id"],
            ondelete="SET NULL",
        )

    # ── qa_history.user_id ────────────────────────────────────────────────────
    qa_cols = [c["name"] for c in inspector.get_columns("qa_history")]
    if "user_id" not in qa_cols:
        op.add_column(
            "qa_history",
            sa.Column("user_id", sa.Integer(), nullable=True),
        )
        op.create_index("ix_qa_history_user_id", "qa_history", ["user_id"])
        op.create_foreign_key(
            "fk_qa_history_user_id",
            "qa_history", "users",
            ["user_id"], ["id"],
            ondelete="SET NULL",
        )

    # ── pdf_convert_history（新建）────────────────────────────────────────────
    existing_tables = inspector.get_table_names()
    if "pdf_convert_history" not in existing_tables:
        op.create_table(
            "pdf_convert_history",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("original_filename", sa.String(500), nullable=False),
            sa.Column("converted_filename", sa.String(500), nullable=False),
            sa.Column("file_path", sa.String(1000), nullable=False),
            sa.Column("file_size", sa.Integer(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
            ),
        )


def downgrade() -> None:
    # pdf_convert_history
    op.drop_table("pdf_convert_history")

    # qa_history.user_id
    op.drop_constraint("fk_qa_history_user_id", "qa_history", type_="foreignkey")
    op.drop_index("ix_qa_history_user_id", table_name="qa_history")
    op.drop_column("qa_history", "user_id")

    # data_sources.owner_id
    op.drop_constraint("fk_data_sources_owner_id", "data_sources", type_="foreignkey")
    op.drop_index("ix_data_sources_owner_id", table_name="data_sources")
    op.drop_column("data_sources", "owner_id")

    # users.is_admin
    op.drop_column("users", "is_admin")
