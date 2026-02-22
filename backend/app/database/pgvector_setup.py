from sqlalchemy import text
from app.database.connection import engine


def setup_pgvector():
    """初始化 pgvector 扩展"""
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
        print("✅ pgvector extension initialized")
