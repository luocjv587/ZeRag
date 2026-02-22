"""
数据库迁移脚本 — 直接运行即可完成表结构升级
用法：
    cd backend
    python run_migration.py
"""
import sys
import os

# 确保 app 包可被 import
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text, inspect
from app.database.connection import engine, Base
from app.config import settings

# 导入所有模型，确保 create_all 能发现新表
from app.models import *  # noqa


def run():
    print("🔧 开始数据库迁移...")

    with engine.connect() as conn:
        inspector = inspect(conn)
        existing_tables = inspector.get_table_names()

        # ── 1. users.is_admin ────────────────────────────────────────────────
        user_cols = [c["name"] for c in inspector.get_columns("users")]
        if "is_admin" not in user_cols:
            print("  ➕ ALTER TABLE users ADD COLUMN is_admin")
            conn.execute(text(
                "ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false"
            ))
            # 将现有 admin 账号升级为超管
            admin_name = settings.DEFAULT_ADMIN_USERNAME
            conn.execute(text(
                f"UPDATE users SET is_admin = true WHERE username = :name"
            ), {"name": admin_name})
            print(f"  ✅ 已将账号 '{admin_name}' 设为超管")
        else:
            print("  ✔  users.is_admin 已存在，跳过")

        # ── 2. data_sources.owner_id ─────────────────────────────────────────
        ds_cols = [c["name"] for c in inspector.get_columns("data_sources")]
        if "owner_id" not in ds_cols:
            print("  ➕ ALTER TABLE data_sources ADD COLUMN owner_id")
            conn.execute(text(
                "ALTER TABLE data_sources ADD COLUMN owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_data_sources_owner_id ON data_sources(owner_id)"
            ))
        else:
            print("  ✔  data_sources.owner_id 已存在，跳过")

        # ── 3. qa_history.user_id ─────────────────────────────────────────────
        qa_cols = [c["name"] for c in inspector.get_columns("qa_history")]
        if "user_id" not in qa_cols:
            print("  ➕ ALTER TABLE qa_history ADD COLUMN user_id")
            conn.execute(text(
                "ALTER TABLE qa_history ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_qa_history_user_id ON qa_history(user_id)"
            ))
        else:
            print("  ✔  qa_history.user_id 已存在，跳过")

        # ── 4. data_sources.chunk_strategy ───────────────────────────────────
        ds_cols2 = [c["name"] for c in inspector.get_columns("data_sources")]
        if "chunk_strategy" not in ds_cols2:
            print("  ➕ ALTER TABLE data_sources ADD COLUMN chunk_strategy")
            conn.execute(text(
                "ALTER TABLE data_sources ADD COLUMN chunk_strategy VARCHAR(50) DEFAULT 'smart'"
            ))
            # 为已有数据源设置默认策略
            conn.execute(text(
                "UPDATE data_sources SET chunk_strategy = 'smart' WHERE db_type = 'file'"
            ))
            conn.execute(text(
                "UPDATE data_sources SET chunk_strategy = 'fixed' WHERE db_type != 'file' AND chunk_strategy IS NULL"
            ))
        else:
            print("  ✔  data_sources.chunk_strategy 已存在，跳过")

        conn.commit()

    # ── 5. 新建表（create_all 只补充不存在的表，不影响已有表）────────────────
    print("  ➕ 同步新建表（pdf_convert_history 等）")
    Base.metadata.create_all(bind=engine)

    print("✅ 迁移完成！")


if __name__ == "__main__":
    run()
