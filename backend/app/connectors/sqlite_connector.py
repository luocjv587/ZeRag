import sqlite3
from typing import List, Dict, Any, Optional
from app.connectors.base import BaseConnector


class SQLiteConnector(BaseConnector):
    def __init__(self, sqlite_path: str):
        self.sqlite_path = sqlite_path
        self._conn = None

    def connect(self) -> None:
        self._conn = sqlite3.connect(self.sqlite_path)
        self._conn.row_factory = sqlite3.Row

    def test_connection(self) -> bool:
        try:
            self.connect()
            return True
        except Exception:
            return False
        finally:
            self.close()

    def get_tables(self) -> List[str]:
        cursor = self._conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        return [row[0] for row in cursor.fetchall()]

    def get_columns(self, table_name: str) -> List[str]:
        cursor = self._conn.cursor()
        cursor.execute(f"PRAGMA table_info('{table_name}')")
        return [row[1] for row in cursor.fetchall()]

    def fetch_all_rows(self, table_name: str, columns: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        cols = ", ".join([f'"{c}"' for c in columns]) if columns else "*"
        cursor = self._conn.cursor()
        cursor.execute(f'SELECT {cols} FROM "{table_name}"')
        return [dict(row) for row in cursor.fetchall()]

    def close(self) -> None:
        if self._conn:
            self._conn.close()
            self._conn = None
